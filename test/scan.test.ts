import { describe, it, expect } from 'vitest';
import { isCommittedEnvFile, detectEnvFiles } from '../src/scan.js';
import { parseUnifiedDiff } from '../src/git.js';

describe('isCommittedEnvFile', () => {
  it.each(['.env', '.env.local', '.env.production', 'config/.env', 'app/.env.staging'])(
    'flags %s',
    (f) => {
      expect(isCommittedEnvFile(f)).toBe(true);
    },
  );

  it.each(['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.test'])(
    'allows %s',
    (f) => {
      expect(isCommittedEnvFile(f)).toBe(false);
    },
  );

  it('does not flag unrelated files', () => {
    expect(isCommittedEnvFile('src/environment.ts')).toBe(false);
    expect(isCommittedEnvFile('README.md')).toBe(false);
  });
});

describe('detectEnvFiles', () => {
  it('produces one finding per committed env file', () => {
    const findings = detectEnvFiles(['.env', '.env.example', 'src/a.ts', '.env.local']);
    expect(findings.map((f) => f.file).sort()).toEqual(['.env', '.env.local']);
    expect(findings[0]!.ruleId).toBe('dotenv-file-committed');
  });
});

describe('parseUnifiedDiff', () => {
  it('extracts only added lines with correct new-file line numbers', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      'index 000..111 100644',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -0,0 +1,2 @@',
      '+const a = 1;',
      '+const token = "ghp_x";',
    ].join('\n');
    const lines = parseUnifiedDiff(diff);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ file: 'src/a.ts', line: 1, content: 'const a = 1;' });
    expect(lines[1]).toMatchObject({ file: 'src/a.ts', line: 2 });
  });

  it('ignores removed lines and /dev/null targets', () => {
    const diff = [
      'diff --git a/x b/x',
      '--- a/x',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-secret',
    ].join('\n');
    expect(parseUnifiedDiff(diff)).toHaveLength(0);
  });

  it('skips binary file extensions', () => {
    const diff = [
      'diff --git a/logo.png b/logo.png',
      '--- a/logo.png',
      '+++ b/logo.png',
      '@@ -0,0 +1 @@',
      '+AKIA' + 'IOSFODNN7ZZ12CD3',
    ].join('\n');
    expect(parseUnifiedDiff(diff)).toHaveLength(0);
  });

  it('threads prevContent for next-line directives', () => {
    const diff = [
      'diff --git a/x.ts b/x.ts',
      '--- a/x.ts',
      '+++ b/x.ts',
      '@@ -0,0 +1,2 @@',
      '+// leaklatch-ignore-next-line',
      '+token=ghp_x',
    ].join('\n');
    const lines = parseUnifiedDiff(diff);
    expect(lines[1]!.prevContent).toBe('// leaklatch-ignore-next-line');
  });
});
