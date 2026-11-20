import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { normalizeError } from './errors';
import { DEFAULT_OLLAMA_MODEL } from './shared';
import type { AiConfigRow, StickyNoteRow } from './types';

const execFileAsync = promisify(execFile);
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const STATUS_TIMEOUT_MS = 2_500;
const GENERATE_TIMEOUT_MS = 30_000;
const INSTALL_TIMEOUT_MS = 5 * 60_000;
const PULL_TIMEOUT_MS = 10 * 60_000;

export interface OllamaInstallEvent {
  status: string;
  progress: number;
  detail?: string;
  done?: boolean;
  error?: string;
}

/** Tracks the PID if NeuroForge itself spawned `ollama serve` in this process. */
let managedPid: number | null = null;

/** Prevents concurrent Ollama installations from spawning overlapping Homebrew/curl processes. */
let activeInstallChild: ChildProcess | null = null;

const normalizeOllamaUrl = (raw?: string): string =>
  (raw?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');

const isExecutableFile = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** Resolves the `ollama` binary from PATH or the macOS Ollama.app bundle. */
const resolveOllamaBinary = async (): Promise<string | null> => {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execFileAsync(cmd, ['ollama'], { timeout: 3_000 });
    return 'ollama';
  } catch {
    // Fall through to macOS app bundle check.
  }

  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Ollama.app/Contents/Resources/ollama',
      join(homedir(), 'Applications', 'Ollama.app', 'Contents', 'Resources', 'ollama'),
    ];
    for (const candidate of candidates) {
      if (await isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

/** Checks whether the `ollama` CLI binary (or macOS Ollama.app bundle) is installed. */
const checkBinaryInstalled = async (): Promise<boolean> =>
  (await resolveOllamaBinary()) !== null;

const checkCommandAvailable = async (command: string): Promise<boolean> => {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execFileAsync(lookup, [command], { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
};

const stripAnsi = (raw: string): string =>
  raw.replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, '').trim();

const killProcessGroup = (child: ChildProcess): void => {
  const pid = child.pid;
  if (!pid) return;
  try {
    if (process.platform !== 'win32') {
      process.kill(-pid, 'SIGTERM');
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // Process already exited.
    }
  }
};

const parseInstallProgress = (
  line: string,
  currentProgress: number,
  currentStatus: string
): { progress: number; status: string } => {
  const lower = line.toLowerCase();
  let progress = currentProgress;
  let status = currentStatus;

  if (lower.includes('downloading')) {
    status = 'Downloading Ollama...';
    progress = Math.max(progress, 15);
  } else if (lower.includes('verifying') || lower.includes('checksum') || lower.includes('sha')) {
    status = 'Verifying download...';
    progress = Math.max(progress, 78);
  } else if (
    lower.includes('installing cask') ||
    lower.includes('moving app') ||
    lower.includes('linking binary') ||
    lower.includes('installing ollama')
  ) {
    status = 'Installing Ollama...';
    progress = Math.max(progress, 88);
  } else if (lower.includes('was successfully installed') || lower.includes('install complete')) {
    status = 'Finalizing installation...';
    progress = Math.max(progress, 96);
  }

  const pctMatch = line.match(/(\d{1,3}(?:\.\d+)?)%/);
  if (pctMatch) {
    const pct = Number.parseFloat(pctMatch[1]);
    if (Number.isFinite(pct) && pct >= 0 && pct <= 100 && currentProgress < 78) {
      const mapped = Math.round(15 + pct * 0.6);
      progress = Math.max(progress, mapped);
      status = `Downloading Ollama (${Math.round(pct)}%)...`;
    }
  }

  return { progress, status };
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

/**
 * Streams installation progress for Ollama using the prebuilt macOS cask
 * (`brew install --cask ollama`) or the official Linux install script.
 * Kills the entire child process group on cancellation or timeout.
 */
export const installOllamaStream = async (
  onEvent: (evt: OllamaInstallEvent) => void,
  signal?: AbortSignal
): Promise<{ ok: boolean; message: string }> => {
  if (await checkBinaryInstalled()) {
    const message = 'Ollama is already installed.';
    onEvent({ status: message, progress: 100, done: true });
    return { ok: true, message };
  }

  if (activeInstallChild) {
    return { ok: false, message: 'An Ollama installation is already in progress.' };
  }

  let command: string;
  let args: string[];
  let env: NodeJS.ProcessEnv = { ...process.env };
  let initialStatus: string;

  if (process.platform === 'darwin') {
    if (!(await checkCommandAvailable('brew'))) {
      return {
        ok: false,
        message: 'Homebrew was not found. Download Ollama directly from https://ollama.com/download.',
      };
    }
    command = 'brew';
    args = ['install', '--cask', 'ollama'];
    env = {
      ...process.env,
      HOMEBREW_NO_AUTO_UPDATE: '1',
      HOMEBREW_NO_ENV_HINTS: '1',
    };
    initialStatus = 'Starting Homebrew cask install (prebuilt Ollama.app)...';
  } else if (process.platform === 'linux') {
    command = 'sh';
    args = ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'];
    initialStatus = 'Running official Ollama Linux installer...';
  } else {
    return {
      ok: false,
      message: 'Automatic install is supported on macOS and Linux. On Windows, download from https://ollama.com/download.',
    };
  }

  let progress = 5;
  let status = initialStatus;
  let lastDetail = '';
  let lastErrorLine = '';

  onEvent({ status, progress });

  return await new Promise<{ ok: boolean; message: string }>((resolve) => {
    let settled = false;
    let timedOut = false;

    const child = spawn(command, args, {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });
    activeInstallChild = child;

    const finish = (result: { ok: boolean; message: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', handleAbort);
      if (activeInstallChild === child) {
        activeInstallChild = null;
      }
      resolve(result);
    };

    const handleAbort = () => {
      killProcessGroup(child);
      finish({ ok: false, message: 'Installation cancelled.' });
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      killProcessGroup(child);
      finish({
        ok: false,
        message: 'Ollama installation timed out. You can also download it directly from https://ollama.com/download.',
      });
    }, INSTALL_TIMEOUT_MS);

    const handleChunk = (chunk: Buffer, isStderr: boolean) => {
      const text = chunk.toString('utf8');
      const lines = text.split(/[\r\n]+/);
      for (const rawLine of lines) {
        const cleaned = stripAnsi(rawLine);
        if (!cleaned) continue;
        lastDetail = cleaned;
        if (isStderr && /error|failed|fatal|denied/i.test(cleaned)) {
          lastErrorLine = cleaned;
        }
        const next = parseInstallProgress(cleaned, progress, status);
        progress = next.progress;
        status = next.status;
        onEvent({ status, progress, detail: cleaned });
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => handleChunk(chunk, false));
    child.stderr?.on('data', (chunk: Buffer) => handleChunk(chunk, true));

    child.on('error', (err) => {
      finish({ ok: false, message: normalizeError(err, 'Could not start Ollama installer.') });
    });

    child.on('close', async (code) => {
      if (settled || timedOut) return;
      if (code === 0) {
        const installed = await checkBinaryInstalled();
        if (!installed) {
          finish({
            ok: false,
            message:
              'Installer exited cleanly, but Ollama was not detected on PATH or in /Applications/Ollama.app.',
          });
          return;
        }
        const successMsg =
          process.platform === 'darwin'
            ? 'Ollama.app installed! Click Start to launch the local server.'
            : 'Ollama installed! Click Start to launch the local server.';
        onEvent({ status: successMsg, progress: 100, detail: lastDetail || undefined, done: true });
        finish({ ok: true, message: successMsg });
        return;
      }

      const fallbackDetail = lastErrorLine || lastDetail;
      const errMsg = fallbackDetail
        ? `Ollama install failed (exit ${code ?? 'unknown'}): ${fallbackDetail}`
        : `Ollama install failed with exit code ${code ?? 'unknown'}.`;
      finish({ ok: false, message: errMsg });
    });
  });
};

/** Installs Ollama using the OS-appropriate installer (non-streaming wrapper). */
export const installOllama = async (): Promise<{ ok: boolean; message: string }> =>
  installOllamaStream(() => {});

/** Spawns `ollama serve` in the background and polls `/api/tags` until ready. */
export const startOllamaServer = async (
  ollamaUrl?: string
): Promise<{ ok: boolean; message: string }> => {
  const current = await getOllamaStatus(ollamaUrl);
  if (current.status === 'ready') {
    return { ok: true, message: 'Ollama is already running.' };
  }
  const binary = await resolveOllamaBinary();
  if (!binary) {
    return { ok: false, message: 'Ollama is not installed.' };
  }

  try {
    const child = spawn(binary, ['serve'], {
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

const normalizeEstimateBucket = (raw: unknown): 0 | 5 | 15 | 30 => {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0;
  if (raw <= 5) return 5;
  if (raw <= 15) return 15;
  return 30;
};

/**
 * Uses local AI to assign a time bucket (5, 15, or 30 minutes) to each Mind-Dump note.
 * Notes that are vague or uncertain are assigned 0 minutes.
 */
export const estimateMindDumpTimesWithOllama = async (
  cfg: AiConfigRow,
  notes: StickyNoteRow[]
): Promise<{
  estimates: Array<{ noteId: number; minutes: 0 | 5 | 15 | 30 }>;
  error?: string;
}> => {
  if (notes.length === 0) {
    return { estimates: [], error: 'Your Mind-Dump is empty! Capture a thought first.' };
  }

  const batch = notes.slice(0, 40);
  const noteLines = batch.map((n) => `[id=${n.id}] ${n.content}`).join('\n');

  const prompt = [
    'Assign an estimated duration in minutes to each task below using ONLY one of: 5, 15, 30, or 0.',
    '- 5: quick task taking ~5 minutes or less',
    '- 15: short task taking ~6 to 15 minutes',
    '- 30: longer task taking ~16 to 30+ minutes',
    '- 0: unsure, too vague, or not an actionable task',
    'Return an estimate for every noteId listed.',
    'Tasks:',
    noteLines,
  ].join('\n');

  const schema = {
    type: 'object',
    properties: {
      estimates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            noteId: { type: 'integer' },
            minutes: { type: 'integer', enum: [0, 5, 15, 30] },
          },
          required: ['noteId', 'minutes'],
        },
      },
    },
    required: ['estimates'],
  };

  const res = await callOllamaJson<{ estimates?: unknown }>(cfg, prompt, schema);
  if (res.error) return { estimates: [], error: res.error };

  const validIds = new Set(batch.map((n) => n.id));
  const byId = new Map<number, 0 | 5 | 15 | 30>();
  const rawList = Array.isArray(res.data?.estimates) ? res.data.estimates : [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { noteId?: unknown; minutes?: unknown };
    if (typeof record.noteId !== 'number' || !validIds.has(record.noteId)) continue;
    byId.set(record.noteId, normalizeEstimateBucket(record.minutes));
  }

  // Leave any note omitted by the model at 0 minutes
  const estimates = batch.map((n) => ({
    noteId: n.id,
    minutes: byId.get(n.id) ?? 0,
  }));

  return { estimates };
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
