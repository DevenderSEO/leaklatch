/**
 * False-positive filters. This is leaklatch's core differentiator: incumbents
 * flag anything that matches a pattern, drowning users in noise. We layer
 * several cheap heuristics to reject values that are obviously not real
 * secrets before they ever become a finding.
 */

import { characterClasses, shannonEntropy } from './entropy.js';

/** Common placeholder fragments that indicate a non-secret. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /x{4,}/i,
  /\*{3,}/,
  /\.{3,}/,
  /change[\s_-]?me/i,
  /\byour[\s_-]/i, // your-key, your_token, "your api key"
  /[\s_-]here\b/i, // ...-key-here
  /your[\s_-]?(?:api[\s_-]?)?(?:key|token|secret|password)/i,
  /(?:my|some|test|dummy|fake|sample|example|placeholder|redacted|insert)[\s_-]?(?:key|token|secret|password|value|here)?/i,
  /replace[\s_-]?(?:me|this|with)/i,
  /<[^>]+>/, // <your-token>
  /\$\{[^}]+\}/, // ${ENV_VAR}
  /\{\{[^}]+\}\}/, // {{ handlebars }}
  /^(?:foo|bar|baz|qux)+$/i,
  /^(?:abc|xyz|123|test|todo|none|null|nil|undefined|empty)+$/i,
  /^0+$/,
  /^(?:true|false)$/i,
];

/** Path fragments that indicate test/fixture/example material. */
const TEST_PATH_HINTS: RegExp[] = [
  /(^|\/)(?:test|tests|__tests__|spec|specs|fixtures?|mocks?|examples?|samples?|e2e)(\/|$)/i,
  /\.(?:test|spec)\.[jt]sx?$/i,
  /(^|\/)(?:testdata|__mocks__|__fixtures__)(\/|$)/i,
];

/** Dictionary-ish words that are low-entropy and commonly false-positive. */
const COMMON_WORDS = new Set([
  'password',
  'passphrase',
  'secretkey',
  'secret',
  'apikey',
  'accesstoken',
  'token',
  'username',
  'localhost',
  'development',
  'production',
  'application',
  'authorization',
  'configuration',
]);

/**
 * Is this value an obvious placeholder rather than a real secret?
 */
export function isPlaceholder(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return true;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(v)) return true;
  }
  return false;
}

/**
 * Does this file path look like test/fixture/example material where secrets
 * are (almost always) intentionally fake?
 */
export function isTestPath(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  return TEST_PATH_HINTS.some((p) => p.test(normalized));
}

/**
 * Is this a low-information value (dictionary word, single character class,
 * or too little entropy to be a random credential)?
 */
export function isLowInformation(value: string): boolean {
  const v = value.trim();
  const lower = v.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (COMMON_WORDS.has(lower)) return true;
  // A purely alphabetic value with only one character class and low entropy is
  // almost never a real machine-generated secret.
  if (characterClasses(v) === 1 && shannonEntropy(v) < 3.0) return true;
  return false;
}

/**
 * Combined false-positive gate. `strict` rules (prefix-anchored, high-confidence)
 * skip the low-information/entropy checks because their prefix already proves
 * intent — but placeholders are always rejected.
 */
export function isFalsePositive(
  value: string,
  file: string,
  opts: { strict?: boolean } = {},
): boolean {
  if (isPlaceholder(value)) return true;
  if (opts.strict) return false;
  if (isTestPath(file)) return true;
  if (isLowInformation(value)) return true;
  return false;
}
