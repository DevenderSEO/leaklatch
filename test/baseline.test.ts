import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBaseline, loadBaseline, writeBaseline, BASELINE_FILENAME } from '../src/baseline.js';
import type { Finding } from '../src/types.js';

function finding(fp: string): Finding {
  return {
    ruleId: 'r',
    description: 'd',
    severity: 'high',
    remediation: 'fix',
    file: 'a.ts',
    line: 1,
    match: '**',
    preview: '',
    fingerprint: fp,
  };
}

describe('buildBaseline', () => {
  it('dedupes and sorts fingerprints', () => {
    const body = buildBaseline([finding('b'), finding('a'), finding('a')], '2026-01-01T00:00:00Z');
    expect(body.fingerprints).toEqual(['a', 'b']);
    expect(body.version).toBe(1);
    expect(body.generatedAt).toBe('2026-01-01T00:00:00Z');
  });
});

describe('writeBaseline / loadBaseline', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'leaklatch-bl-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips fingerprints', () => {
    writeBaseline([finding('x'), finding('y')], dir, '2026-01-01T00:00:00Z');
    expect(existsSync(join(dir, BASELINE_FILENAME))).toBe(true);
    const loaded = loadBaseline(dir);
    expect(loaded.has('x')).toBe(true);
    expect(loaded.has('y')).toBe(true);
  });

  it('returns an empty set when no baseline exists', () => {
    expect(loadBaseline(dir).size).toBe(0);
  });

  it('returns an empty set on corrupt baseline', () => {
    writeFileSync(join(dir, BASELINE_FILENAME), '{ broken');
    expect(loadBaseline(dir).size).toBe(0);
  });

  it('tolerates a baseline without a fingerprints array', () => {
    writeFileSync(join(dir, BASELINE_FILENAME), JSON.stringify({ version: 1 }));
    expect(loadBaseline(dir).size).toBe(0);
  });
});
