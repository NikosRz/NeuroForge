const URL_PATTERN = /https?:\/\/[^\s"'<>]+/i;
const SENSITIVE_PATTERN = /\b(SQLITE_|Bearer\s+|Basic\s+|ATATT|token=|key=|password=)/i;

export const normalizeError = (err: unknown, fallback: string): string => {
  if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return `${fallback}: request timed out.`;
  }

  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return `${fallback}: request timed out.`;
    }
    const msg = err.message.trim();
    if (
      msg &&
      msg.length <= 160 &&
      !URL_PATTERN.test(msg) &&
      !SENSITIVE_PATTERN.test(msg) &&
      !msg.includes('\n')
    ) {
      return msg;
    }
  }

  return fallback;
};
