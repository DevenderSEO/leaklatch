import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installHook, uninstallHook, BEGIN_MARKER, HOOK_BLOCK } from '../src/hook.js';

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'leaklatch-hook-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

describe('installHook / uninstallHook', () => {
  let dir: string;
  beforeEach(() => {
    dir = initRepo();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates a new hook when none exists', () => {
    const res = installHook(dir);
    expect(res.action).toBe('created');
    const body = readFileSync(res.path, 'utf8');
    expect(body).toContain('#!/bin/sh');
    expect(body).toContain(BEGIN_MARKER);
    expect(body).toContain('leaklatch scan');
  });

  it('appends to an existing hook without clobbering it', () => {
    const hookPath = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hookPath, '#!/bin/sh\necho "existing hook"\n');
    chmodSync(hookPath, 0o755);

    const res = installHook(dir);
    expect(res.action).toBe('appended');
    const body = readFileSync(hookPath, 'utf8');
    expect(body).toContain('echo "existing hook"');
    expect(body).toContain(BEGIN_MARKER);
  });

  it('is idempotent — reinstalling refreshes the block in place', () => {
    installHook(dir);
    const res = installHook(dir);
    expect(res.action).toBe('already-present');
    const body = readFileSync(res.path, 'utf8');
    // Only one managed block should be present.
    expect(body.split(BEGIN_MARKER).length - 1).toBe(1);
  });

  it('uninstall removes only our block, preserving the existing hook', () => {
    const hookPath = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hookPath, '#!/bin/sh\necho "existing hook"\n');
    chmodSync(hookPath, 0o755);
    installHook(dir);

    const res = uninstallHook(dir);
    expect(res.action).toBe('removed');
    const body = readFileSync(hookPath, 'utf8');
    expect(body).toContain('echo "existing hook"');
    expect(body).not.toContain(BEGIN_MARKER);
  });

  it('uninstall on a hook-only file leaves a valid bare hook', () => {
    installHook(dir);
    const res = uninstallHook(dir);
    expect(res.action).toBe('removed');
    const body = readFileSync(res.path, 'utf8');
    expect(body).not.toContain(BEGIN_MARKER);
    expect(body.startsWith('#!/bin/sh')).toBe(true);
  });

  it('hook resolves the runner once and never double-scans', () => {
    // Regression: the old fallback `npx --no-install … || npx …` would run the
    // scan twice on a real finding (both "not installed" and "secret found"
    // exit non-zero). The runner must be resolved with a --version probe.
    expect(HOOK_BLOCK).toContain('npx --no-install leaklatch --version');
    expect(HOOK_BLOCK).not.toContain('scan --staged || npx leaklatch scan');
    // Exactly one scan invocation per branch: global, cached npx, fresh npx.
    expect(HOOK_BLOCK.match(/leaklatch scan --staged/g)?.length).toBe(3);
  });

  it('uninstall is a no-op when nothing is installed', () => {
    expect(uninstallHook(dir).action).toBe('not-present');
  });

  it('uninstall is a no-op when a foreign hook exists', () => {
    const hookPath = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hookPath, '#!/bin/sh\necho hi\n');
    expect(uninstallHook(dir).action).toBe('not-present');
    expect(existsSync(hookPath)).toBe(true);
  });
});
