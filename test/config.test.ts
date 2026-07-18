import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig, loadConfig } from '../src/config.js';

describe('parseConfig', () => {
  it('throws on non-objects', () => {
    expect(() => parseConfig(null)).toThrow();
    expect(() => parseConfig('x')).toThrow();
  });

  it('parses a full valid config', () => {
    const cfg = parseConfig({
      ignorePaths: ['test', 123],
      disabledRules: ['jwt', 5],
      entropyOverrides: { jwt: 4.5, bad: 'x' },
      genericEntropyThreshold: 4.2,
      disableGenericEntropy: true,
      customRules: [
        { id: 'a', regex: 'foo', severity: 'low', flags: 'i', entropy: 3, secretGroup: 1 },
        { id: 'bad' }, // missing regex -> dropped
        'nope',
      ],
    });
    expect(cfg.ignorePaths).toEqual(['test']);
    expect(cfg.disabledRules).toEqual(['jwt']);
    expect(cfg.entropyOverrides).toEqual({ jwt: 4.5 });
    expect(cfg.genericEntropyThreshold).toBe(4.2);
    expect(cfg.disableGenericEntropy).toBe(true);
    expect(cfg.customRules).toHaveLength(1);
    expect(cfg.customRules?.[0]?.id).toBe('a');
  });

  it('ignores invalid severity on custom rules', () => {
    const cfg = parseConfig({ customRules: [{ id: 'a', regex: 'x', severity: 'nope' }] });
    expect(cfg.customRules?.[0]?.severity).toBeUndefined();
  });

  it('returns empty config for an empty object', () => {
    expect(parseConfig({})).toEqual({});
  });
});

describe('loadConfig', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'leaklatch-cfg-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty config when none exists', () => {
    expect(loadConfig(dir)).toEqual({});
  });

  it('loads leaklatch.config.json', () => {
    writeFileSync(join(dir, 'leaklatch.config.json'), JSON.stringify({ ignorePaths: ['x'] }));
    expect(loadConfig(dir).ignorePaths).toEqual(['x']);
  });

  it('loads .leaklatchrc when config.json absent', () => {
    writeFileSync(join(dir, '.leaklatchrc'), JSON.stringify({ disabledRules: ['jwt'] }));
    expect(loadConfig(dir).disabledRules).toEqual(['jwt']);
  });

  it('throws a helpful error on invalid JSON', () => {
    writeFileSync(join(dir, 'leaklatch.config.json'), '{ not json ');
    expect(() => loadConfig(dir)).toThrow(/Failed to parse/);
  });
});
