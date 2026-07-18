/**
 * Shannon entropy utilities. Entropy is measured in bits per character and is
 * a core signal in the layered detector: high-entropy strings are more likely
 * to be real secrets, while low-entropy strings (dictionary words, repeated
 * characters, placeholders) are more likely to be false positives.
 */

/**
 * Compute the Shannon entropy (bits per character) of a string.
 * Returns 0 for empty strings.
 */
export function shannonEntropy(input: string): number {
  if (input.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of input) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  const len = input.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Count the number of distinct character classes present in a string
 * (lowercase, uppercase, digit, symbol). Real credential material tends to
 * mix several classes; a run of a single class is usually not a secret.
 */
export function characterClasses(input: string): number {
  let classes = 0;
  if (/[a-z]/.test(input)) classes++;
  if (/[A-Z]/.test(input)) classes++;
  if (/[0-9]/.test(input)) classes++;
  if (/[^a-zA-Z0-9]/.test(input)) classes++;
  return classes;
}

/**
 * Heuristic: does this token look like random credential material rather than a
 * natural-language word, identifier, or file path? Combines entropy with
 * structural checks that kill the most common generic-detector false positives:
 * camelCase identifiers (e.g. `noUncheckedIndexedAccess`) and file paths
 * (e.g. `src/config/settings.ts`).
 */
export function looksRandom(input: string, minEntropy: number): boolean {
  if (input.length < 12) return false;
  const entropy = shannonEntropy(input);
  if (entropy < minEntropy) return false;
  // Path-like tokens (contain a separator) are not secrets.
  if (input.includes('/') || input.includes('\\')) return false;
  // A single character class (all lowercase, etc.) is rarely a real secret.
  if (characterClasses(input) < 2) return false;
  // Purely alphabetic tokens — even mixed-case — are almost always identifiers
  // or concatenated words, not machine-generated credentials, which virtually
  // always include digits or symbols. Requiring a non-letter here removes a
  // large class of false positives (camelCase config keys, type names) at a
  // negligible recall cost, since prefixed real secrets are caught by name.
  if (/^[A-Za-z]+$/.test(input)) return false;
  return true;
}
