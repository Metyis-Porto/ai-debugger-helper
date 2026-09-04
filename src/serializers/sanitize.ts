/**
 * Central sanitization for everything the recorder captures. See
 * IMPLEMENT_BROWSER_DEBUG_RECORDER.md's "Privacy" section — every capture
 * path that surfaces potentially sensitive data must run it through this
 * module before it's added to the timeline. Network request/response
 * headers and bodies aren't captured at all (see `events/network.ts`), so
 * this module has no header/body sanitizer — only what's actually captured
 * (input values, console arguments) needs one.
 */

const REDACTED = '[redacted]';

const SENSITIVE_FIELD_PATTERN =
  /password|passwd|secret|token|api[_-]?key|auth|card[_-]?number|cvv|cvc|ssn|pin\b/i;

export function isSensitiveFieldName(name: string): boolean {
  return SENSITIVE_FIELD_PATTERN.test(name);
}

/** A password input, or any input whose name/id/autocomplete marks it sensitive. */
export function isSensitiveInputElement(element: Element): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
  if (element.type === 'password' || element.type === 'hidden') return true;
  const autocomplete = element.autocomplete ?? '';
  if (/current-password|new-password|cc-number|cc-csc/.test(autocomplete)) return true;
  return isSensitiveFieldName(element.name || element.id || '');
}

/** Best-effort, circular-safe stringification for console arguments. */
export function stringifyConsoleArgument(argument: unknown): string {
  if (typeof argument === 'string') return argument;
  if (argument instanceof Error) return argument.stack ?? argument.message;

  const seen = new WeakSet();
  try {
    return JSON.stringify(
      argument,
      (key, value: unknown) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[circular]';
          seen.add(value);
        }
        if (isSensitiveFieldName(key)) return REDACTED;
        return value;
      },
      0
    );
  } catch {
    return String(argument);
  }
}
