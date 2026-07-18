import { describe, it, expect } from 'vitest';
import {
  detectLines,
  resolveRules,
  compileCustomRules,
  fingerprint,
} from '../src/detect/detector.js';
import type { LeaklatchConfig, ScanLine } from '../src/types.js';

function sl(content: string, file = 'src/app.ts', lineNo = 1): ScanLine {
  return { file, line: lineNo, content };
}

describe('fingerprint', () => {
  it('is stable for the same inputs', () => {
    expect(fingerprint('a.ts', 'r', 'secret')).toBe(fingerprint('a.ts', 'r', 'secret'));
  });
  it('changes when the secret changes', () => {
    expect(fingerprint('a.ts', 'r', 's1')).not.toBe(fingerprint('a.ts', 'r', 's2'));
  });
});

describe('detectLines — dedup', () => {
  it('reports an overlapping secret once, preferring the specific rule', () => {
    // `awsKey = "AKIA..."` matches both aws-access-key-id and generic-assignment.
    const findings = detectLines([sl('const awsKey = "AKIA' + 'IOSFODNN7ZZ12CD3";')]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe('aws-access-key-id');
  });

  it('reports the same value on distinct lines separately', () => {
    const findings = detectLines([
      sl('ghp_' + '1234567890abcdefABCDEF1234567890abcd', 'src/app.ts', 1),
      sl('ghp_' + '1234567890abcdefABCDEF1234567890abcd', 'src/app.ts', 2),
    ]);
    // Same value, same file, different lines -> two findings (distinct lines).
    expect(findings.length).toBe(2);
  });

  it('collapses the identical value on the same line to one finding', () => {
    const findings = detectLines([
      sl('ghp_' + '1234567890abcdefABCDEF1234567890abcd', 'src/app.ts', 5),
      sl('ghp_' + '1234567890abcdefABCDEF1234567890abcd', 'src/app.ts', 5),
    ]);
    expect(findings.length).toBe(1);
  });
});

describe('detectLines — generic high entropy', () => {
  it('flags a random-looking quoted token not covered by a named rule', () => {
    const findings = detectLines([sl('const h = "aZ3kR9mQ2pL7xW4nB8dF6gH1jK0";')]);
    expect(findings.some((f) => f.ruleId === 'generic-high-entropy')).toBe(true);
  });

  it('can be disabled via config', () => {
    const cfg: LeaklatchConfig = { disableGenericEntropy: true };
    const findings = detectLines([sl('const h = "aZ3kR9mQ2pL7xW4nB8dF6gH1jK0";')], cfg);
    expect(findings.some((f) => f.ruleId === 'generic-high-entropy')).toBe(false);
  });

  it('respects a raised generic threshold', () => {
    const cfg: LeaklatchConfig = { genericEntropyThreshold: 6 };
    const findings = detectLines([sl('const h = "aZ3kR9mQ2pL7xW4nB8dF6gH1jK0";')], cfg);
    expect(findings.some((f) => f.ruleId === 'generic-high-entropy')).toBe(false);
  });
});

describe('resolveRules — config', () => {
  it('drops disabled rules', () => {
    const rules = resolveRules({ disabledRules: ['github-pat'] });
    expect(rules.some((r) => r.id === 'github-pat')).toBe(false);
  });

  it('applies entropy overrides during detection', () => {
    // Raise the generic-assignment threshold so a modest secret is ignored.
    const cfg: LeaklatchConfig = { entropyOverrides: { 'generic-assignment': 6 } };
    const findings = detectLines([sl('PASSWORD=Xk9mQ2pL7wZ4nB8rT3vY')], cfg);
    expect(findings.some((f) => f.ruleId === 'generic-assignment')).toBe(false);
  });
});

describe('custom rules', () => {
  it('compiles and applies a custom rule', () => {
    const cfg: LeaklatchConfig = {
      customRules: [
        {
          id: 'acme-token',
          regex: 'ACME-[A-Z0-9]{10}',
          severity: 'high',
        },
      ],
    };
    const findings = detectLines([sl('key=ACME-ABCDE12345')], cfg);
    expect(findings.some((f) => f.ruleId === 'acme-token')).toBe(true);
  });

  it('adds a global flag if missing', () => {
    const rules = compileCustomRules({
      customRules: [{ id: 'x', regex: 'foo', flags: 'i' }],
    });
    expect(rules[0]!.regex.global).toBe(true);
    expect(rules[0]!.regex.ignoreCase).toBe(true);
  });

  it('returns an empty array when no custom rules are configured', () => {
    expect(compileCustomRules(undefined)).toEqual([]);
    expect(compileCustomRules({})).toEqual([]);
  });
});

describe('detectLines — false positives suppressed', () => {
  it('ignores placeholder assignments', () => {
    expect(detectLines([sl('API_KEY=your-key-here')])).toHaveLength(0);
  });
  it('ignores secrets in test fixture paths for non-strict rules', () => {
    expect(detectLines([sl('token=Xk9mQ2pL7wZ4nB8rT3vY', 'test/fixtures/a.ts')])).toHaveLength(0);
  });
});
