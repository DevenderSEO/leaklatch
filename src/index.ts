/**
 * Public programmatic API for leaklatch. Lets other tools embed the scanner
 * without shelling out to the CLI.
 */

export { scan, detectEnvFiles, isCommittedEnvFile } from './scan.js';
export { detectLines, resolveRules, fingerprint } from './detect/detector.js';
export { RULES, ruleById } from './detect/rules.js';
export { shannonEntropy, looksRandom, characterClasses } from './detect/entropy.js';
export { redact, redactLine } from './detect/redact.js';
export { isPlaceholder, isTestPath, isLowInformation, isFalsePositive } from './detect/filters.js';
export { applyAllowlist, collectIgnoredLines, isPathIgnored } from './allowlist.js';
export { loadConfig, parseConfig } from './config.js';
export { loadBaseline, writeBaseline, buildBaseline, BASELINE_FILENAME } from './baseline.js';
export { installHook, uninstallHook, resolveHooksDir } from './hook.js';
export { toText, toJson } from './output.js';

export type {
  Rule,
  Finding,
  ScanLine,
  ScanOptions,
  ScanResult,
  LeaklatchConfig,
  CustomRuleConfig,
} from './types.js';
