/**
 * Git integration. leaklatch scans either the staged diff (default, for the
 * pre-commit path) or all tracked files (`--all`, for CI). We shell out to git
 * rather than depend on a git library to stay dependency-light and fast.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ScanLine } from './types.js';

/** Run a git command, returning stdout. Throws on non-zero exit. */
function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // Ignore git's own stderr so messages like "fatal: not a git repository"
    // don't leak in front of leaklatch's own, friendlier output.
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/** Is `cwd` inside a git work tree? */
export function isGitRepo(cwd: string): boolean {
  try {
    return git(['rev-parse', '--is-inside-work-tree'], cwd).trim() === 'true';
  } catch {
    return false;
  }
}

/** File extensions we never scan (binary / generated). */
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|pdf|zip|gz|tar|tgz|bz2|7z|rar|jar|war|class|exe|dll|so|dylib|bin|wasm|woff2?|ttf|otf|eot|mp[34]|mov|avi|mkv|webm|wav|flac|ogg|lock|snap|min\.js|min\.css)$/i;

/**
 * Dependency lock files are full of high-entropy integrity hashes that are not
 * secrets. Skipping them by default is a major false-positive reduction.
 */
const SKIP_BASENAMES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'cargo.lock',
  'poetry.lock',
  'gemfile.lock',
  'go.sum',
  'bun.lockb',
]);

function isScannable(file: string): boolean {
  if (BINARY_EXT.test(file)) return false;
  const base = (file.replace(/\\/g, '/').split('/').pop() ?? file).toLowerCase();
  return !SKIP_BASENAMES.has(base);
}

/** Detect a NUL byte, a reliable signal that content is binary. */
function hasNullByte(text: string): boolean {
  return text.indexOf(String.fromCharCode(0)) !== -1;
}

/**
 * Parse `git diff --cached --unified=0` output into scan lines representing
 * only the *added* lines (with correct new-file line numbers).
 */
export function parseUnifiedDiff(diff: string): ScanLine[] {
  const lines: ScanLine[] = [];
  let currentFile = '';
  let newLineNo = 0;
  let prevContent: string | undefined;

  const rawLines = diff.split('\n');
  for (const raw of rawLines) {
    if (raw.startsWith('diff --git')) {
      currentFile = '';
      prevContent = undefined;
      continue;
    }
    if (raw.startsWith('+++ ')) {
      // +++ b/path/to/file  (or /dev/null for deletions)
      const path = raw.slice(4).replace(/^b\//, '');
      currentFile = path === '/dev/null' ? '' : path;
      continue;
    }
    if (raw.startsWith('@@')) {
      // @@ -a,b +c,d @@
      const match = /\+(\d+)/.exec(raw);
      newLineNo = match ? parseInt(match[1]!, 10) : 0;
      prevContent = undefined;
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      const content = raw.slice(1);
      if (currentFile && isScannable(currentFile)) {
        lines.push({ file: currentFile, line: newLineNo, content, prevContent });
      }
      prevContent = content;
      newLineNo++;
      continue;
    }
    if (raw.startsWith('-') && !raw.startsWith('---')) {
      // Removed line: does not advance new-file line counter.
      continue;
    }
    // Context line (rare with --unified=0) advances the counter.
    if (!raw.startsWith('\\')) {
      prevContent = raw.startsWith(' ') ? raw.slice(1) : raw;
      if (raw.length > 0) newLineNo++;
    }
  }
  return lines;
}

/** Get scan lines from the staged diff. */
export function getStagedLines(cwd: string): ScanLine[] {
  const diff = git(['diff', '--cached', '--unified=0', '--no-color', '--diff-filter=ACM'], cwd);
  return parseUnifiedDiff(diff);
}

/** List staged file paths (added/copied/modified). */
export function getStagedFiles(cwd: string): string[] {
  const out = git(['diff', '--cached', '--name-only', '--diff-filter=ACM'], cwd);
  return out.split('\n').filter(Boolean);
}

/** List all git-tracked files. */
export function getTrackedFiles(cwd: string): string[] {
  const out = git(['ls-files'], cwd);
  return out.split('\n').filter(Boolean).filter(isScannable);
}

/**
 * Read all tracked files into scan lines (for `--all`). Files that can't be
 * read as UTF-8 text are skipped.
 */
export function getAllTrackedLines(cwd: string): ScanLine[] {
  const files = getTrackedFiles(cwd);
  const lines: ScanLine[] = [];
  for (const file of files) {
    const abs = join(cwd, file);
    if (!existsSync(abs)) continue;
    let text: string;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    // Skip files that look binary (contain a NUL byte).
    if (hasNullByte(text)) continue;
    const fileLines = text.split('\n');
    let prevContent: string | undefined;
    for (let i = 0; i < fileLines.length; i++) {
      const content = fileLines[i]!;
      lines.push({ file, line: i + 1, content, prevContent });
      prevContent = content;
    }
  }
  return lines;
}
