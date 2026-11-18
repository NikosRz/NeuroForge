import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeError } from './errors';
import { DEFAULT_OLLAMA_MODEL } from './shared';
import type { AiConfigRow, StickyNoteRow } from './types';

const execFileAsync = promisify(execFile);
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const STATUS_TIMEOUT_MS = 2_500;
const GENERATE_TIMEOUT_MS = 30_000;
const PULL_TIMEOUT_MS = 10 * 60_000;

/** Tracks the PID if NeuroForge itself spawned `ollama serve` in this process. */
let managedPid: number | null = null;

const normalizeOllamaUrl = (raw?: string): string =>
  (raw?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');

/** Checks whether the `ollama` CLI binary is available on PATH. */
const checkBinaryInstalled = async (): Promise<boolean> => {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execFileAsync(cmd, ['ollama'], { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
};

/**
 * Probes the local Ollama HTTP API (`/api/tags`) to determine whether Ollama is
 * `ready`, `stopped` (binary installed, daemon not running), or `not_installed`,
 * and whether the configured model is already pulled.
 */
export const getOllamaStatus = async (
  ollamaUrl?: string,
  model = DEFAULT_OLLAMA_MODEL
): Promise<{
  status: 'not_installed' | 'stopped' | 'ready';
  modelInstalled: boolean;
  error?: string;
}> => {
  const baseUrl = normalizeOllamaUrl(ollamaUrl);

  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        status: 'stopped',
        modelInstalled: false,
        error: `Ollama health check returned HTTP ${res.status}.`,
      };
    }

    const payload = (await res.json()) as { models?: Array<{ name?: unknown }> };
    const models = Array.isArray(payload.models) ? payload.models : [];
    const modelBase = model.split(':')[0];
    const modelInstalled = models.some(
      (m) =>
        typeof m.name === 'string' &&
        (m.name === model || m.name.startsWith(`${modelBase}:`))
    );

    return { status: 'ready', modelInstalled };
  } catch (err) {
    const installed = await checkBinaryInstalled();
    return {
      status: installed ? 'stopped' : 'not_installed',
      modelInstalled: false,
      error: installed ? undefined : normalizeError(err, 'Ollama is not running'),
    };
  }
};

/** Installs Ollama using the OS-appropriate package manager (macOS Homebrew or Linux script). */
export const installOllama = async (): Promise<{ ok: boolean; message: string }> => {
  if (await checkBinaryInstalled()) {
    return { ok: true, message: 'Ollama is already installed.' };
  }

  try {
    if (process.platform === 'darwin') {
      await execFileAsync('brew', ['install', 'ollama'], { timeout: 120_000 });
      return { ok: true, message: 'Ollama installed via Homebrew.' };
    }

    if (process.platform === 'linux') {
      await execFileAsync(
        'sh',
        ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'],
        { timeout: 120_000 }
      );
      return { ok: true, message: 'Ollama installed via official install script.' };
    }

    return {
      ok: false,
      message: 'Automatic install is supported on macOS and Linux. On Windows, install from ollama.com.',
    };
  } catch (err) {
    return { ok: false, message: normalizeError(err, 'Could not install Ollama') };
  }
};

/** Spawns `ollama serve` in the background and polls `/api/tags` until ready. */
export const startOllamaServer = async (
  ollamaUrl?: string
): Promise<{ ok: boolean; message: string }> => {
  const current = await getOllamaStatus(ollamaUrl);
  if (current.status === 'ready') {
    return { ok: true, message: 'Ollama is already running.' };
  }
  if (current.status === 'not_installed') {
    return { ok: false, message: 'Ollama is not installed.' };
  }

  try {
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
    });

    let spawnError: Error | null = null;
    child.on('error', (err) => {
      spawnError = err;
    });

    managedPid = child.pid ?? null;
    child.unref();

    for (let i = 0; i < 10; i += 1) {
      if (spawnError) {
        managedPid = null;
        return { ok: false, message: normalizeError(spawnError, 'Could not start Ollama') };
      }
      await new Promise((r) => setTimeout(r, 350));
      const check = await getOllamaStatus(ollamaUrl);
      if (check.status === 'ready') {
        return { ok: true, message: 'Ollama server started.' };
      }
    }

    return { ok: false, message: 'Ollama process spawned, but did not become ready in time.' };
  } catch (err) {
    managedPid = null;
    return { ok: false, message: normalizeError(err, 'Could not start Ollama') };
  }
};

/** Stops the managed `ollama serve` PID (or falls back to exact-match OS process lookup). */
export const stopOllamaServer = async (): Promise<{ ok: boolean; message: string }> => {
  if (managedPid) {
    const pid = managedPid;
    managedPid = null;
    try {
      process.kill(pid);
      return { ok: true, message: 'Stopped managed Ollama server.' };
    } catch {
      // Process may have already exited externally; fall through to OS lookup.
    }
  }

  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill', ['/IM', 'ollama.exe', '/F'], { timeout: 5_000 });
    } else {
      await execFileAsync('pkill', ['-x', 'ollama'], { timeout: 5_000 });
    }
    return { ok: true, message: 'Stopped Ollama server.' };
  } catch (err) {
    return { ok: false, message: normalizeError(err, 'No running Ollama server found to stop') };
  }
};

/**
 * Streams NDJSON download progress from Ollama's `/api/pull` endpoint.
 * Throws normalized errors if the HTTP request fails, the stream aborts, or Ollama emits `{ error }`.
 */
export const pullOllamaModelStream = async (
  ollamaUrl: string,
  model: string,
  onProgress: (evt: { status: string; completed?: number; total?: number }) => void,
  signal?: AbortSignal
): Promise<void> => {
  const baseUrl = normalizeOllamaUrl(ollamaUrl);
  const timeoutSignal = AbortSignal.timeout(PULL_TIMEOUT_MS);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const res = await fetch(`${baseUrl}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: true }),
    signal: combinedSignal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama pull failed with HTTP ${res.status}.`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed: { status?: unknown; completed?: unknown; total?: unknown; error?: unknown };
        try {
          parsed = JSON.parse(trimmed) as typeof parsed;
        } catch {
          continue;
        }

        if (typeof parsed.error === 'string' && parsed.error.trim()) {
          throw new Error(parsed.error.trim());
        }

        onProgress({
          status: typeof parsed.status === 'string' ? parsed.status : 'downloading',
          completed: typeof parsed.completed === 'number' ? parsed.completed : undefined,
          total: typeof parsed.total === 'number' ? parsed.total : undefined,
        });
      }
    }
  } finally {
    reader.releaseLock();
  }
};

/**
 * Calls `/api/generate` with a strict JSON Schema `format` and `keep_alive` TTL.
 * Validates transport errors, Ollama `{ error }` payloads, and JSON parsing.
 */
const callOllamaJson = async <T>(
  cfg: AiConfigRow,
  prompt: string,
  schema: Record<string, unknown>
): Promise<{ data?: T; error?: string }> => {
  const baseUrl = normalizeOllamaUrl(cfg.ollama_url);
  let res: Response;

  try {
    res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_OLLAMA_MODEL,
        prompt,
        stream: false,
        keep_alive: cfg.keep_alive || '30s',
        format: schema,
      }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
  } catch (err) {
    return { error: normalizeError(err, 'Local AI unreachable') };
  }

  if (!res.ok) {
    return { error: `Ollama returned HTTP ${res.status}.` };
  }

  try {
    const body = (await res.json()) as { response?: unknown; error?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) {
      return { error: `Ollama error: ${body.error.trim()}` };
    }
    if (typeof body.response !== 'string' || !body.response.trim()) {
      return { error: 'Ollama returned an empty response.' };
    }

    const parsed = JSON.parse(body.response) as T;
    return { data: parsed };
  } catch {
    return { error: 'Local AI returned invalid JSON. Try again or check the model.' };
  }
};

/** Splits a JIRA quest summary/description into 3–5 tiny ADHD-friendly micro-steps via local AI. */
export const splitQuestWithOllama = async (
  cfg: AiConfigRow,
  summary: string,
  description?: string
): Promise<{ steps: string[]; error?: string }> => {
  const prompt = [
    'Break this software/work task into 3 to 5 tiny, concrete, low-friction micro-steps (max 10 words each) for someone with ADHD.',
    `Task: ${summary}`,
    description ? `Context: ${description.slice(0, 400)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const schema = {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['steps'],
  };

  const res = await callOllamaJson<{ steps?: unknown }>(cfg, prompt, schema);
  if (res.error) return { steps: [], error: res.error };

  const rawSteps = Array.isArray(res.data?.steps) ? res.data.steps : [];
  const steps = rawSteps
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (steps.length === 0) {
    return { steps: [], error: 'Local AI returned no usable steps. Try adding one manually.' };
  }

  return { steps };
};

/** Matches a saved Mind-Dump sticky note to an available 5/15/30-minute time window. */
export const pickQuickTaskWithOllama = async (
  cfg: AiConfigRow,
  minutes: 5 | 15 | 30,
  notes: StickyNoteRow[]
): Promise<{ noteId?: number; text?: string; reason?: string; error?: string }> => {
  if (notes.length === 0) {
    return { error: 'Your Mind-Dump is empty! Capture a thought first.' };
  }

  const noteLines = notes
    .slice(0, 25)
    .map((n) => `[id=${n.id}] ${n.content}`)
    .join('\n');

  const prompt = [
    `The user has ${minutes} minutes free right now. Pick the single best note from the list below that realistically fits inside ${minutes} minutes.`,
    'Notes:',
    noteLines,
  ].join('\n');

  const schema = {
    type: 'object',
    properties: {
      noteId: { type: 'integer' },
      reason: { type: 'string' },
    },
    required: ['noteId', 'reason'],
  };

  const res = await callOllamaJson<{ noteId?: unknown; reason?: unknown }>(cfg, prompt, schema);
  if (res.error) return { error: res.error };

  const matched =
    typeof res.data?.noteId === 'number'
      ? notes.find((n) => n.id === res.data?.noteId)
      : undefined;

  if (!matched) {
    return { error: `No saved note matched a ${minutes}-minute window.` };
  }

  return {
    noteId: matched.id,
    text: matched.content,
    reason: typeof res.data?.reason === 'string' ? res.data.reason : `Fits nicely in ${minutes}m.`,
  };
};
