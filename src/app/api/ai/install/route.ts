import { normalizeError } from '@/lib/errors';
import { installOllamaStream } from '@/lib/ollama-client';

export const POST = async (req: Request): Promise<Response> => {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let closed = false;

  const onReqAbort = () => {
    abortController.abort();
  };
  req.signal.addEventListener('abort', onReqAbort, { once: true });

  const stream = new ReadableStream({
    start: async (controller) => {
      const send = (payload: Record<string, unknown>) => {
        if (closed || abortController.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const res = await installOllamaStream(
          (evt) => {
            send({ ...evt });
          },
          abortController.signal
        );

        if (!res.ok && !abortController.signal.aborted) {
          send({ status: 'error', progress: 0, error: res.message });
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          send({
            status: 'error',
            progress: 0,
            error: normalizeError(err, 'Ollama installation failed.'),
          });
        }
      } finally {
        req.signal.removeEventListener('abort', onReqAbort);
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
      abortController.abort();
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
