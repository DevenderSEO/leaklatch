/**
 * Baseline handling. A baseline file records fingerprints of findings that have
 * been reviewed and accepted, so they no longer block commits. This lets teams
 * adopt leaklatch on an existing repo without having to fix everything at once.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding } from './types.js';

export const BASELINE_FILENAME = '.leaklatch-baseline.json';

/** Shape of the on-disk baseline file. */
export interface BaselineFile {
  version: 1;
  generatedAt: string;
  fingerprints: string[];
}

/** Load baseline fingerprints from disk. Returns an empty set if absent. */
export function loadBaseline(cwd: string = process.cwd()): Set<string> {
  const path = join(cwd, BASELINE_FILENAME);
  if (!existsSync(path)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<BaselineFile>;
    return new Set(Array.isArray(raw.fingerprints) ? raw.fingerprints : []);
  } catch {
    return new Set();
  }
}

/** Serialize a baseline file body from a list of findings. */
export function buildBaseline(findings: Finding[], now: string): BaselineFile {
  const fingerprints = Array.from(new Set(findings.map((f) => f.fingerprint))).sort();
  return {
    version: 1,
    generatedAt: now,
    fingerprints,
  };
}

/** Write a baseline file to disk from the given findings. */
export function writeBaseline(
  findings: Finding[],
  cwd: string = process.cwd(),
  now: string = new Date().toISOString(),
): string {
  const path = join(cwd, BASELINE_FILENAME);
  const body = buildBaseline(findings, now);
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return path;
}
