import { describe, it, expect } from 'vitest';
import { collectIgnoredLines, isPathIgnored, applyAllowlist } from '../src/allowlist.js';
import type { Finding, ScanLine } from '../src/types.js';

function finding(over: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'github-pat',
    description: 'GitHub PAT',
    severity: 'critical',
    remediation: 'rotate',
    file: 'src/a.ts',
    line: 3,
    match: 'gh****cd',
    preview: '...',
    fingerprint: 'src/a.ts:github-pat:deadbeef',
    ...over,
  };
}

describe('collectIgnoredLines', () => {
  it('suppresses a same-line directive', () => {
    const lines: ScanLine[] = [
      { file: 'a.ts', line: 5, content: 'token=ghp_x // leaklatch-ignore' },
    ];
    expect(collectIgnoredLines(lines).has('a.ts:5')).toBe(true);
  });

  it('suppresses the line after a next-line directive', () => {
    const lines: ScanLine[] = [
      {
        file: 'a.ts',
        line: 6,
        content: 'token=ghp_x',
        prevContent: '// leaklatch-ignore-next-line',
      },
    ];
    expect(collectIgnoredLines(lines).has('a.ts:6')).toBe(true);
  });

  it('same-line regex does not match the next-line directive text', () => {
    const lines: ScanLine[] = [
      { file: 'a.ts', line: 7, content: 'x // leaklatch-ignore-next-line' },
    ];
    // The next-line directive alone should not suppress its own line.
    expect(collectIgnoredLines(lines).has('a.ts:7')).toBe(false);
  });
});

describe('isPathIgnored', () => {
  it('matches a substring pattern', () => {
    expect(isPathIgnored('test/fixtures/a.env', { ignorePaths: ['test/fixtures'] })).toBe(true);
  });
  it('matches a single-star glob', () => {
    expect(isPathIgnored('src/gen/a.ts', { ignorePaths: ['src/*/a.ts'] })).toBe(true);
  });
  it('matches a double-star glob', () => {
    expect(isPathIgnored('a/b/c/d.ts', { ignorePaths: ['a/**/d.ts'] })).toBe(true);
  });
  it('returns false with no patterns', () => {
    expect(isPathIgnored('a.ts', {})).toBe(false);
    expect(isPathIgnored('a.ts', undefined)).toBe(false);
  });
  it('does not match unrelated paths', () => {
    expect(isPathIgnored('src/app.ts', { ignorePaths: ['docs'] })).toBe(false);
  });
});

describe('applyAllowlist', () => {
  it('suppresses by path', () => {
    const res = applyAllowlist([finding({ file: 'docs/a.ts' })], [], { ignorePaths: ['docs'] });
    expect(res.kept).toHaveLength(0);
    expect(res.suppressed).toBe(1);
  });

  it('suppresses by inline ignore', () => {
    const f = finding({ file: 'a.ts', line: 2 });
    const lines: ScanLine[] = [{ file: 'a.ts', line: 2, content: 'x // leaklatch-ignore' }];
    const res = applyAllowlist([f], lines);
    expect(res.kept).toHaveLength(0);
    expect(res.suppressed).toBe(1);
  });

  it('suppresses by baseline fingerprint', () => {
    const f = finding();
    const res = applyAllowlist([f], [], undefined, new Set([f.fingerprint]));
    expect(res.kept).toHaveLength(0);
  });

  it('keeps findings that match nothing', () => {
    const res = applyAllowlist([finding()], []);
    expect(res.kept).toHaveLength(1);
    expect(res.suppressed).toBe(0);
  });
});
