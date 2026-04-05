const REDACTED = '[REDACTED]';
const MAX_DEPTH = 5;
const MAX_OBJECT_KEYS = 30;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 400;

const SENSITIVE_KEY_PATTERN =
  /(password|passphrase|secret|token|authorization|cookie|set-cookie|api[-_]?key|client[-_]?secret)/i;

export function sanitizeForLog(value: unknown): unknown {
  const seen = new WeakSet<object>();
  return sanitizeValue(value, 0, seen, false);
}

export function serializeForLog(value: unknown): string {
  try {
    const sanitized = sanitizeForLog(value);
    return JSON.stringify(sanitized);
  } catch {
    return '"[UNSERIALIZABLE]"';
  }
}

export function sanitizeErrorForLog(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { raw: sanitizeForLog(error) };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
      ?.split('\n')
      .map((line) => line.trim())
      .slice(0, 8),
  };
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  maskAsSensitive: boolean,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (maskAsSensitive) {
    return maskValue(value);
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Buffer) {
    return `[Buffer length=${value.byteLength}]`;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return `[Array(${value.length})]`;
    }

    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => {
      return sanitizeValue(entry, depth + 1, seen, false);
    });
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[Circular]';
    }

    seen.add(value as object);

    if (depth >= MAX_DEPTH) {
      return '[Object]';
    }

    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    const keys = Object.keys(input).slice(0, MAX_OBJECT_KEYS);

    for (const key of keys) {
      const sensitive = SENSITIVE_KEY_PATTERN.test(key);
      output[key] = sanitizeValue(input[key], depth + 1, seen, sensitive);
    }

    return output;
  }

  return String(value);
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated:${value.length - MAX_STRING_LENGTH}]`;
}

function maskValue(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return REDACTED;
  }

  if (value.length <= 8) {
    return REDACTED;
  }

  return `${value.slice(0, 4)}...${value.slice(-2)}[masked]`;
}
