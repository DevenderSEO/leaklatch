/**
 * Config loading. leaklatch is zero-config by default; a config file only
 * customises behaviour. We look for `leaklatch.config.json` then `.leaklatchrc`
 * (also JSON) in the repo root.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LeaklatchConfig } from './types.js';

const CONFIG_FILENAMES = ['leaklatch.config.json', '.leaklatchrc', '.leaklatchrc.json'];

/** Parse and lightly validate a config object. */
export function parseConfig(raw: unknown): LeaklatchConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Config must be a JSON object.');
  }
  const cfg = raw as Record<string, unknown>;
  const out: LeaklatchConfig = {};

  if (Array.isArray(cfg.ignorePaths)) {
    out.ignorePaths = cfg.ignorePaths.filter((x): x is string => typeof x === 'string');
  }
  if (Array.isArray(cfg.disabledRules)) {
    out.disabledRules = cfg.disabledRules.filter((x): x is string => typeof x === 'string');
  }
  if (typeof cfg.entropyOverrides === 'object' && cfg.entropyOverrides !== null) {
    const overrides: Record<string, number> = {};
    for (const [k, v] of Object.entries(cfg.entropyOverrides)) {
      if (typeof v === 'number') overrides[k] = v;
    }
    out.entropyOverrides = overrides;
  }
  if (typeof cfg.genericEntropyThreshold === 'number') {
    out.genericEntropyThreshold = cfg.genericEntropyThreshold;
  }
  if (typeof cfg.disableGenericEntropy === 'boolean') {
    out.disableGenericEntropy = cfg.disableGenericEntropy;
  }
  if (Array.isArray(cfg.customRules)) {
    out.customRules = cfg.customRules
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .filter((r) => typeof r.id === 'string' && typeof r.regex === 'string')
      .map((r) => ({
        id: r.id as string,
        regex: r.regex as string,
        description: typeof r.description === 'string' ? r.description : undefined,
        flags: typeof r.flags === 'string' ? r.flags : undefined,
        entropy: typeof r.entropy === 'number' ? r.entropy : undefined,
        severity: isSeverity(r.severity) ? r.severity : undefined,
        remediation: typeof r.remediation === 'string' ? r.remediation : undefined,
        secretGroup: typeof r.secretGroup === 'number' ? r.secretGroup : undefined,
      }));
  }
  return out;
}

function isSeverity(v: unknown): v is 'critical' | 'high' | 'medium' | 'low' {
  return v === 'critical' || v === 'high' || v === 'medium' || v === 'low';
}

/** Load config from disk (or return an empty config if none exists). */
export function loadConfig(cwd: string = process.cwd()): LeaklatchConfig {
  for (const name of CONFIG_FILENAMES) {
    const path = join(cwd, name);
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf8'));
        return parseConfig(raw);
      } catch (err) {
        throw new Error(
          `Failed to parse ${name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
  return {};
}
