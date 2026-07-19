/**
 * Git hook installation. We install a native `.git/hooks/pre-commit` hook that
 * calls `leaklatch scan`. Installation is append-safe: if a hook already exists
 * we insert a clearly delimited block rather than clobbering it, and uninstall
 * removes only our block.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const BEGIN_MARKER = '# >>> leaklatch pre-commit >>>';
const END_MARKER = '# <<< leaklatch pre-commit <<<';

/**
 * The hook body we manage between the markers.
 *
 * We resolve *which* runner to use first (a globally-installed binary, an
 * already-cached npx package, or a fresh npx download), then run the scan
 * exactly once. Chaining `npx --no-install … || npx …` directly is wrong: both
 * "package not installed" and "secret found" exit non-zero, so a real finding
 * would trigger the fallback and scan (and print) a second time.
 */
const HOOK_BLOCK = `${BEGIN_MARKER}
# Managed by leaklatch. Remove with: leaklatch uninstall
if command -v leaklatch >/dev/null 2>&1; then
  leaklatch scan --staged || exit 1
elif npx --no-install leaklatch --version >/dev/null 2>&1; then
  npx --no-install leaklatch scan --staged || exit 1
else
  npx leaklatch scan --staged || exit 1
fi
${END_MARKER}`;

const SHEBANG = '#!/bin/sh';

/** Resolve the hooks directory, honoring core.hooksPath if set. */
export function resolveHooksDir(cwd: string): string {
  try {
    const custom = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd,
      encoding: 'utf8',
    }).trim();
    if (custom) return join(cwd, custom);
  } catch {
    // no custom hooksPath
  }
  try {
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd,
      encoding: 'utf8',
    }).trim();
    return join(cwd, gitDir, 'hooks');
  } catch {
    return join(cwd, '.git', 'hooks');
  }
}

export interface HookResult {
  path: string;
  action: 'created' | 'appended' | 'already-present' | 'not-present' | 'removed';
}

/** Install (or update) the pre-commit hook. */
export function installHook(cwd: string = process.cwd()): HookResult {
  const hooksDir = resolveHooksDir(cwd);
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, 'pre-commit');

  if (!existsSync(hookPath)) {
    writeFileSync(hookPath, `${SHEBANG}\n${HOOK_BLOCK}\n`, 'utf8');
    chmodSync(hookPath, 0o755);
    return { path: hookPath, action: 'created' };
  }

  const existing = readFileSync(hookPath, 'utf8');
  if (existing.includes(BEGIN_MARKER)) {
    // Refresh the managed block in place.
    const updated = replaceBlock(existing);
    writeFileSync(hookPath, updated, 'utf8');
    chmodSync(hookPath, 0o755);
    return { path: hookPath, action: 'already-present' };
  }

  // Append our block, preserving the existing hook.
  const needsShebang = !existing.startsWith('#!');
  const prefix = needsShebang ? `${SHEBANG}\n` : '';
  const separator = existing.endsWith('\n') ? '' : '\n';
  writeFileSync(hookPath, `${prefix}${existing}${separator}\n${HOOK_BLOCK}\n`, 'utf8');
  chmodSync(hookPath, 0o755);
  return { path: hookPath, action: 'appended' };
}

/** Uninstall the pre-commit hook (remove only our block). */
export function uninstallHook(cwd: string = process.cwd()): HookResult {
  const hooksDir = resolveHooksDir(cwd);
  const hookPath = join(hooksDir, 'pre-commit');
  if (!existsSync(hookPath)) {
    return { path: hookPath, action: 'not-present' };
  }
  const existing = readFileSync(hookPath, 'utf8');
  if (!existing.includes(BEGIN_MARKER)) {
    return { path: hookPath, action: 'not-present' };
  }

  const stripped = removeBlock(existing);
  // If only the shebang (or nothing meaningful) remains, remove the file.
  const meaningful = stripped
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#!'))
    .join('');
  if (meaningful.length === 0) {
    // Leave a bare shebang-only file? Cleaner to write an empty valid hook.
    writeFileSync(hookPath, `${SHEBANG}\n`, 'utf8');
    chmodSync(hookPath, 0o755);
  } else {
    writeFileSync(hookPath, stripped, 'utf8');
    chmodSync(hookPath, 0o755);
  }
  return { path: hookPath, action: 'removed' };
}

/** Replace the managed block with the current HOOK_BLOCK. */
function replaceBlock(content: string): string {
  const re = new RegExp(`${escapeRe(BEGIN_MARKER)}[\\s\\S]*?${escapeRe(END_MARKER)}`, 'm');
  return content.replace(re, HOOK_BLOCK);
}

/** Remove the managed block (and any leftover blank line it introduced). */
function removeBlock(content: string): string {
  const re = new RegExp(`\\n?${escapeRe(BEGIN_MARKER)}[\\s\\S]*?${escapeRe(END_MARKER)}\\n?`, 'm');
  return content.replace(re, '\n').replace(/\n{3,}/g, '\n\n');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { HOOK_BLOCK, BEGIN_MARKER, END_MARKER };
