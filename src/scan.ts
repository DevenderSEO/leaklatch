/**
 * Scan orchestration: gather scan lines from git, run the detector, detect
 * committed .env files, then apply the allowlist. Returns a structured result
 * the CLI/reporters can render.
 */

import { detectLines } from './detect/detector.js';
import { applyAllowlist } from './allowlist.js';
import { getStagedLines, getAllTrackedLines, getStagedFiles, getTrackedFiles } from './git.js';
import type { Finding, ScanLine, ScanOptions, ScanResult } from './types.js';

/** Files matching this are dotenv files that should never be committed. */
const ENV_FILE_RE = /(^|\/)\.env(\.[A-Za-z0-9_.-]+)?$/;
/** Except these safe example/sample variants. */
const ENV_ALLOWED_RE = /\.(example|sample|template|dist|test)$/i;

/** Is this path a committed dotenv file that should be flagged? */
export function isCommittedEnvFile(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  if (!ENV_FILE_RE.test(normalized)) return false;
  const base = normalized.split('/').pop() ?? normalized;
  // `.env.example` / `.env.sample` etc. are safe.
  if (ENV_ALLOWED_RE.test(base)) return false;
  // Bare `.env.example` where the suffix IS the allowed word.
  const suffix = base.replace(/^\.env\.?/, '');
  if (['example', 'sample', 'template', 'dist', 'test'].includes(suffix.toLowerCase())) {
    return false;
  }
  return true;
}

/** Build synthetic findings for committed .env files. */
export function detectEnvFiles(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (isCommittedEnvFile(file)) {
      findings.push({
        ruleId: 'dotenv-file-committed',
        description: 'Committed .env file',
        severity: 'high',
        remediation: 'Add this file to .gitignore and commit a .env.example instead.',
        file,
        line: 0,
        match: file,
        preview: file,
        fingerprint: `${file}:dotenv-file-committed:0`,
        entropy: undefined,
      });
    }
  }
  return findings;
}

/** Run a full scan according to the given options. */
export function scan(options: ScanOptions = {}): ScanResult {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config;

  let lines: ScanLine[];
  let files: string[];
  if (options.all) {
    lines = getAllTrackedLines(cwd);
    files = getTrackedFiles(cwd);
  } else {
    lines = getStagedLines(cwd);
    files = getStagedFiles(cwd);
  }

  const secretFindings = detectLines(lines, config);
  const envFindings = detectEnvFiles(files);
  const all = [...secretFindings, ...envFindings];

  const { kept, suppressed } = applyAllowlist(all, lines, config, options.baseline);

  // Sort: critical first, then by file/line for stable output.
  const severityRank: Record<Finding['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  kept.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );

  const filesScanned = new Set(lines.map((l) => l.file)).size + envFindings.length;

  return { findings: kept, suppressed, filesScanned };
}
