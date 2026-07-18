/**
 * The layered detector. For each line of input it runs the rule pack, then
 * subjects every candidate to entropy + false-positive gates before promoting
 * it to a Finding. This layering is what keeps leaklatch's false-positive rate
 * low relative to regex-only scanners.
 */

import { createHash } from 'node:crypto';
import { RULES } from './rules.js';
import { looksRandom, shannonEntropy } from './entropy.js';
import { isFalsePositive } from './filters.js';
import { redact, redactLine } from './redact.js';
import type { Finding, LeaklatchConfig, Rule, ScanLine } from '../types.js';

/** Rules whose prefix already proves intent — they bypass soft FP gates. */
const STRICT_RULE_IDS = new Set([
  'aws-access-key-id',
  'github-pat',
  'github-oauth',
  'github-fine-grained-pat',
  'anthropic-key',
  'stripe-secret-key',
  'slack-token',
  'slack-webhook',
  'private-key',
  'npm-token',
  'google-api-key',
]);

/** Default entropy floor for the generic high-entropy detector. */
const DEFAULT_GENERIC_ENTROPY = 4.0;

/** Build a stable fingerprint for baseline matching. */
export function fingerprint(file: string, ruleId: string, secret: string): string {
  const hash = createHash('sha256').update(secret).digest('hex').slice(0, 16);
  return `${file}:${ruleId}:${hash}`;
}

/** Compile custom rules from config into runtime Rules. */
export function compileCustomRules(config?: LeaklatchConfig): Rule[] {
  if (!config?.customRules?.length) return [];
  return config.customRules.map((c) => {
    const flags = c.flags?.includes('g') ? c.flags : `${c.flags ?? ''}g`;
    return {
      id: c.id,
      description: c.description ?? `Custom rule ${c.id}`,
      regex: new RegExp(c.regex, flags),
      entropy: c.entropy,
      secretGroup: c.secretGroup ?? 0,
      severity: c.severity ?? 'high',
      remediation: c.remediation ?? 'Review and remove this custom-flagged secret.',
    } satisfies Rule;
  });
}

/** Resolve the active rule set given config (disabled rules + custom rules). */
export function resolveRules(config?: LeaklatchConfig): Rule[] {
  const disabled = new Set(config?.disabledRules ?? []);
  const base = RULES.filter((r) => !disabled.has(r.id));
  return [...base, ...compileCustomRules(config)];
}

/** Apply a single rule to a line, yielding zero or more findings. */
function applyRule(rule: Rule, sl: ScanLine, config?: LeaklatchConfig): Finding[] {
  const found: Finding[] = [];
  const strict = STRICT_RULE_IDS.has(rule.id);
  const entropyThreshold = config?.entropyOverrides?.[rule.id] ?? rule.entropy;

  // Reset stateful global regex before each line.
  rule.regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = rule.regex.exec(sl.content)) !== null) {
    // Guard against zero-width matches causing an infinite loop.
    if (m.index === rule.regex.lastIndex) rule.regex.lastIndex++;

    const groupIdx = rule.secretGroup ?? 0;
    const secret = m[groupIdx] ?? m[0];
    if (!secret) continue;

    const entropy = shannonEntropy(secret);
    if (entropyThreshold !== undefined && entropy < entropyThreshold) continue;
    if (rule.validator && !rule.validator(secret)) continue;
    if (isFalsePositive(secret, sl.file, { strict })) continue;

    found.push({
      ruleId: rule.id,
      description: rule.description,
      severity: rule.severity,
      remediation: rule.remediation,
      file: sl.file,
      line: sl.line,
      match: redact(secret),
      preview: redactLine(sl.content, secret),
      fingerprint: fingerprint(sl.file, rule.id, secret),
      entropy: Math.round(entropy * 100) / 100,
    });
  }
  return found;
}

/**
 * Generic high-entropy detector: catches random-looking tokens that no named
 * rule covers (e.g. a bespoke API key assigned to a quoted string). Kept
 * conservative to avoid false positives — only quoted or assigned values.
 */
function detectGenericEntropy(sl: ScanLine, config?: LeaklatchConfig): Finding[] {
  if (config?.disableGenericEntropy) return [];
  const threshold = config?.genericEntropyThreshold ?? DEFAULT_GENERIC_ENTROPY;
  const found: Finding[] = [];

  // Candidate tokens: quoted strings or assigned values of length >= 20.
  const candidateRe = /["'`]([A-Za-z0-9_\-+/=.]{20,})["'`]|[:=]\s*([A-Za-z0-9_\-+/=]{20,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = candidateRe.exec(sl.content)) !== null) {
    if (m.index === candidateRe.lastIndex) candidateRe.lastIndex++;
    const token = m[1] ?? m[2];
    if (!token) continue;
    if (!looksRandom(token, threshold)) continue;
    if (isFalsePositive(token, sl.file, { strict: false })) continue;

    found.push({
      ruleId: 'generic-high-entropy',
      description: 'Generic high-entropy string',
      severity: 'medium',
      remediation: 'Confirm this is not a credential; move real secrets to env/secrets manager.',
      file: sl.file,
      line: sl.line,
      match: redact(token),
      preview: redactLine(sl.content, token),
      fingerprint: fingerprint(sl.file, 'generic-high-entropy', token),
      entropy: Math.round(shannonEntropy(token) * 100) / 100,
    });
  }
  return found;
}

/**
 * Ranking used to resolve overlaps: when several rules match the *same* secret
 * value on the same line, we keep the most specific one. Named credential rules
 * win over the generic assignment rule, which wins over pure entropy.
 */
function rulePriority(ruleId: string): number {
  if (ruleId === 'generic-high-entropy') return 2;
  if (ruleId === 'generic-assignment') return 1;
  return 0;
}

/**
 * Detect all findings in a set of scan lines. De-duplicates so overlapping
 * rules don't double-report the same secret: exact fingerprint duplicates are
 * dropped, and when multiple rules match the identical value on one line only
 * the most specific rule survives.
 */
export function detectLines(lines: ScanLine[], config?: LeaklatchConfig): Finding[] {
  const rules = resolveRules(config);
  const raw: Finding[] = [];
  const seenFingerprints = new Set<string>();

  for (const sl of lines) {
    for (const rule of rules) {
      for (const f of applyRule(rule, sl, config)) {
        const key = `${f.fingerprint}:${f.line}`;
        if (seenFingerprints.has(key)) continue;
        seenFingerprints.add(key);
        raw.push(f);
      }
    }
    for (const f of detectGenericEntropy(sl, config)) {
      const key = `${f.fingerprint}:${f.line}`;
      if (seenFingerprints.has(key)) continue;
      seenFingerprints.add(key);
      raw.push(f);
    }
  }

  // Collapse overlaps on identical (file, line, redacted value), keeping the
  // most specific rule so a single leaked secret is reported exactly once.
  const bestByValue = new Map<string, Finding>();
  for (const f of raw) {
    const key = `${f.file}:${f.line}:${f.match}`;
    const existing = bestByValue.get(key);
    if (!existing || rulePriority(f.ruleId) < rulePriority(existing.ruleId)) {
      bestByValue.set(key, f);
    }
  }
  return Array.from(bestByValue.values());
}
