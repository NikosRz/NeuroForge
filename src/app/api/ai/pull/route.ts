import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { normalizeError } from '@/lib/errors';
import { pullOllamaModelStream } from '@/lib/ollama-client';
import type { AiConfigRow } from '@/lib/types';

const VALID_MODEL_RE = /^[a-zA-Z0-9._:/-]{1,120}$/;

export const POST = async (req: Request): Promise<Response> => {
  let ollamaUrl: string;
  let model: string;

  try {
    const body = (await req.json().catch(() => ({}))) as { model?: unknown };
    const db = getDb();
    const cfg = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as AiConfigRow;
    ollamaUrl = cfg.ollama_url;

    const requested = typeof body.model === 'string' ? body.model.trim() : '';
    if (requested && !VALID_MODEL_RE.test(requested)) {
      return NextResponse.json({ error: 'Invalid Ollama model name.' }, { status: 400 });
    }
    model = requested || cfg.model;
  } catch (err) {
    return NextResponse.json(
      { error: normalizeError(err, 'Failed to initialize model pull.') },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start: async (controller) => {
      const send = (payload: Record<string, unknown>) => {
        if (closed || req.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        await pullOllamaModelStream(
          ollamaUrl,
          model,
          (evt) => {
            send(evt);
          },
          req.signal
        );
        send({ status: 'done', completed: 1, total: 1 });
      } catch (err) {
        if (!req.signal.aborted) {
          send({ status: 'error', error: normalizeError(err, 'Model download failed.') });
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // Stream already closed by client disconnect.
          }
        }
      }
    },
    cancel: () => {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
};
