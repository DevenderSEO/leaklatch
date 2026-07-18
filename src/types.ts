/**
 * Core type definitions for leaklatch.
 */

/** A single detection rule in the rule pack. */
export interface Rule {
  /** Stable identifier, e.g. `aws-access-key-id`. */
  id: string;
  /** Human-readable description of what this rule catches. */
  description: string;
  /** Primary regex used to locate candidate matches. Must include the `g` flag. */
  regex: RegExp;
  /**
   * Optional minimum Shannon entropy (bits/char) the captured secret must have.
   * Rules with a strict prefix (e.g. `ghp_`) usually leave this undefined.
   */
  entropy?: number;
  /**
   * Which capture group holds the actual secret value (for redaction + entropy).
   * Defaults to 0 (the whole match).
   */
  secretGroup?: number;
  /** Severity used purely for reporting/sorting. */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Short remediation hint shown to the user. */
  remediation: string;
  /**
   * Optional secondary validator. Return `false` to reject a candidate match
   * (kills false positives). Receives the captured secret value.
   */
  validator?: (value: string) => boolean;
  /** Tags used by keyword pre-filtering to skip rules cheaply. */
  keywords?: string[];
}

/** A confirmed finding produced by the detector. */
export interface Finding {
  ruleId: string;
  description: string;
  severity: Rule['severity'];
  remediation: string;
  /** 1-based file path relative to repo root (or `<working tree>` marker). */
  file: string;
  /** 1-based line number within the file. */
  line: number;
  /** The redacted secret (never the raw value). */
  match: string;
  /** Redacted preview of the full line for context. */
  preview: string;
  /** Stable fingerprint used for the baseline file. */
  fingerprint: string;
  /** Shannon entropy of the matched secret, if measured. */
  entropy?: number;
}

/** A logical line of content to scan, tagged with its origin. */
export interface ScanLine {
  file: string;
  line: number;
  content: string;
  /** Preceding line content, used for the next-line ignore directive. */
  prevContent?: string;
}

/** User configuration (leaklatch.config.json / .leaklatchrc). */
export interface LeaklatchConfig {
  /** Glob-ish path substrings to ignore entirely. */
  ignorePaths?: string[];
  /** Rule ids to disable. */
  disabledRules?: string[];
  /** Per-rule entropy threshold overrides, keyed by rule id. */
  entropyOverrides?: Record<string, number>;
  /** Additional custom rules (regex provided as a string + flags). */
  customRules?: CustomRuleConfig[];
  /** Global minimum entropy for the generic high-entropy detector. */
  genericEntropyThreshold?: number;
  /** Disable the generic entropy detector entirely. */
  disableGenericEntropy?: boolean;
}

/** JSON-serializable custom rule definition. */
export interface CustomRuleConfig {
  id: string;
  description?: string;
  regex: string;
  flags?: string;
  entropy?: number;
  severity?: Rule['severity'];
  remediation?: string;
  secretGroup?: number;
}

/** Options controlling a scan run. */
export interface ScanOptions {
  /** Scan the whole working tree instead of only staged changes. */
  all?: boolean;
  config?: LeaklatchConfig;
  /** Loaded baseline fingerprints to suppress. */
  baseline?: Set<string>;
  /** Repo root; defaults to cwd. */
  cwd?: string;
}

/** Result of a full scan. */
export interface ScanResult {
  findings: Finding[];
  /** Findings that were suppressed by ignore directives / baseline. */
  suppressed: number;
  filesScanned: number;
}
