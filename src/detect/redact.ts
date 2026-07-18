/**
 * Redaction helpers. leaklatch never prints a raw secret value: findings show
 * only the first and last two characters so a human can recognise which
 * credential leaked without the report itself becoming a leak.
 */

/**
 * Redact a secret value, keeping the first and last two characters.
 * Short values are fully masked.
 */
export function redact(value: string): string {
  const v = value;
  if (v.length <= 6) {
    return '*'.repeat(v.length);
  }
  const head = v.slice(0, 2);
  const tail = v.slice(-2);
  const middle = '*'.repeat(Math.min(v.length - 4, 12));
  return `${head}${middle}${tail}`;
}

/**
 * Produce a redacted preview of a full line by replacing the secret substring
 * with its redacted form. Falls back to the raw line if the secret is absent.
 */
export function redactLine(line: string, secret: string): string {
  const trimmed = line.trim();
  if (!secret || !trimmed.includes(secret)) {
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
  }
  const replaced = trimmed.split(secret).join(redact(secret));
  return replaced.length > 120 ? `${replaced.slice(0, 117)}...` : replaced;
}
