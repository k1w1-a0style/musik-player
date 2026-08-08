const MAX_DIAGNOSTIC_DEPTH = 4;
const MAX_DIAGNOSTIC_ARRAY_ITEMS = 20;
const MAX_DIAGNOSTIC_OBJECT_KEYS = 40;
const MAX_DIAGNOSTIC_TEXT_LENGTH = 500;

const SENSITIVE_FIELD_PATTERN = /(?:uri|url|path|file(?:name)?|document(?:id)?|authority|authorization|auth|credential|token|secret|password|passphrase|keystore(?:base64)?|privatekey|api[_-]?key|access[_-]?key|title|artist|album|genre|comment|lyrics)$/i;
const URI_PATTERN = /\b(?:content|file):\/\/[^\s'"<>]+/gi;
const WEB_URL_PATTERN = /\bhttps?:\/\/[^\s'"<>]+/gi;
const WINDOWS_PATH_PATTERN = /\b[A-Za-z]:\\[^\r\n\t"'<>]+/g;
const ANDROID_PATH_PATTERN = /(?:^|[\s(])\/(?:storage|sdcard|data|mnt|media|system|vendor|product|apex|proc|sys)(?:\/[^\s'"<>),;]*)?/gi;
const MEDIA_FILENAME_PATTERN = /\b[^\s/\\'"<>]+\.(?:mp3|m4a|mp4|aac|flac|wav|ogg|opus|wma|webm)\b/gi;
const AUTH_SECRET_PATTERN = /\b(?:bearer\s+[A-Za-z0-9._~+\/-]+=*|(?:token|api[_-]?key|secret|password|passphrase)\s*[:=]\s*[^\s,;]+)/gi;

export const sanitizeDiagnosticText = (value: string): string => {
  const redacted = value
    .replace(URI_PATTERN, '<redacted-uri>')
    .replace(WEB_URL_PATTERN, '<redacted-url>')
    .replace(WINDOWS_PATH_PATTERN, '<redacted-path>')
    .replace(ANDROID_PATH_PATTERN, (match) => {
      const prefix = match.startsWith(' ') || match.startsWith('(') ? match[0] : '';
      return `${prefix}<redacted-path>`;
    })
    .replace(MEDIA_FILENAME_PATTERN, '<redacted-file>')
    .replace(AUTH_SECRET_PATTERN, '<redacted-secret>');
  return redacted.length > MAX_DIAGNOSTIC_TEXT_LENGTH
    ? `${redacted.slice(0, MAX_DIAGNOSTIC_TEXT_LENGTH)}…`
    : redacted;
};

interface SanitizedPrimitive {
  handled: boolean;
  value: unknown;
}

const sanitizePrimitive = (value: unknown): SanitizedPrimitive => {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return { handled: true, value };
  if (typeof value === 'string') return { handled: true, value: sanitizeDiagnosticText(value) };
  if (typeof value === 'bigint') return { handled: true, value: String(value) };
  if (typeof value === 'symbol' || typeof value === 'function') return { handled: true, value: `<${typeof value}>` };
  return { handled: false, value };
};

const sanitizeError = (error: Error): Record<string, string> => ({
  name: sanitizeDiagnosticText(error.name || 'Error'),
  message: sanitizeDiagnosticText(error.message || ''),
});

const sanitizeRecord = (
  value: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  const entries = Object.entries(value).slice(0, MAX_DIAGNOSTIC_OBJECT_KEYS);
  for (const [key, entryValue] of entries) {
    output[key] = SENSITIVE_FIELD_PATTERN.test(key)
      ? '<redacted>'
      : sanitizeDiagnosticInternal(entryValue, depth + 1, seen);
  }
  return output;
};

const sanitizeDiagnosticInternal = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown => {
  const primitive = sanitizePrimitive(value);
  if (primitive.handled) return primitive.value;
  if (value instanceof Error) return sanitizeError(value);
  if (typeof value !== 'object' || value === null) return sanitizeDiagnosticText(String(value));
  if (seen.has(value)) return '<circular>';
  if (depth >= MAX_DIAGNOSTIC_DEPTH) return '<max-depth>';
  seen.add(value);

  return Array.isArray(value)
    ? value.slice(0, MAX_DIAGNOSTIC_ARRAY_ITEMS).map((item) => sanitizeDiagnosticInternal(item, depth + 1, seen))
    : sanitizeRecord(value as Record<string, unknown>, depth, seen);
};

export const sanitizeDiagnosticValue = (value: unknown): unknown =>
  sanitizeDiagnosticInternal(value, 0, new WeakSet<object>());

const DIAGNOSTIC_CONSOLE_METHODS = ['debug', 'info', 'log', 'warn', 'error'] as const;
type DiagnosticConsoleMethod = typeof DIAGNOSTIC_CONSOLE_METHODS[number];

let diagnosticConsoleSanitizerInstalled = false;

export const sanitizeDiagnosticArgs = (args: unknown[]): unknown[] =>
  args.map(sanitizeDiagnosticValue);

export const installDiagnosticConsoleSanitizer = (): void => {
  if (diagnosticConsoleSanitizerInstalled) return;
  diagnosticConsoleSanitizerInstalled = true;
  const writableConsole = console as unknown as Record<DiagnosticConsoleMethod, (...args: unknown[]) => void>;
  for (const method of DIAGNOSTIC_CONSOLE_METHODS) {
    const original = writableConsole[method].bind(console);
    writableConsole[method] = (...args: unknown[]) => original(...sanitizeDiagnosticArgs(args));
  }
};
