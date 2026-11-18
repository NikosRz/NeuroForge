'use server';

import { getDb } from '@/lib/db';
import { normalizeError } from '@/lib/errors';
import {
  getOllamaStatus,
  installOllama,
  startOllamaServer,
  stopOllamaServer,
} from '@/lib/ollama-client';
import { DEFAULT_OLLAMA_MODEL } from '@/lib/shared';
import type { AiConfigRow } from '@/lib/types';

export const getOllamaStatusAction = async (): Promise<{
  status: 'not_installed' | 'stopped' | 'ready';
  modelInstalled: boolean;
  model: string;
  error?: string;
}> => {
  try {
    const db = getDb();
    const cfg = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as AiConfigRow;
    const status = await getOllamaStatus(cfg.ollama_url, cfg.model);
    return { ...status, model: cfg.model };
  } catch (err) {
    return {
      status: 'stopped',
      modelInstalled: false,
      model: DEFAULT_OLLAMA_MODEL,
      error: normalizeError(err, 'Failed to check Ollama status.'),
    };
  }
};

export const installOllamaAction = async (): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> => {
  try {
    const res = await installOllama();
    return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.message };
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'Failed to install Ollama.') };
  }
};

export const startOllamaAction = async (): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> => {
  try {
    const db = getDb();
    const cfg = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as AiConfigRow;
    const res = await startOllamaServer(cfg.ollama_url);
    return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.message };
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'Failed to start Ollama.') };
  }
};

export const stopOllamaAction = async (): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> => {
  try {
    const res = await stopOllamaServer();
    return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.message };
  } catch (err) {
    return { ok: false, error: normalizeError(err, 'Failed to stop Ollama.') };
  }
};
