/**
 * Reporters. The default reporter is colored, grouped by file, and shows a
 * remediation hint per finding. `--json` emits machine-readable output for CI.
 */

import pc from 'picocolors';
import type { Finding, ScanResult } from './types.js';

export interface ReportOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
}

const SEVERITY_COLOR: Record<Finding['severity'], (s: string) => string> = {
  critical: (s) => pc.bgRed(pc.white(s)),
  high: (s) => pc.red(s),
  medium: (s) => pc.yellow(s),
  low: (s) => pc.dim(s),
};

/** Format the JSON report body. */
export function toJson(result: ScanResult): string {
  return JSON.stringify(
    {
      ok: result.findings.length === 0,
      findingCount: result.findings.length,
      suppressed: result.suppressed,
      filesScanned: result.filesScanned,
      findings: result.findings.map((f) => ({
        ruleId: f.ruleId,
        description: f.description,
        severity: f.severity,
        file: f.file,
        line: f.line,
        match: f.match,
        entropy: f.entropy,
        remediation: f.remediation,
        fingerprint: f.fingerprint,
      })),
    },
    null,
    2,
  );
}

/** Render the human-readable report to a string. */
export function toText(result: ScanResult, opts: ReportOptions = {}): string {
  const useColor = opts.color !== false;
  const c = useColor ? pc : stripColors();

  if (result.findings.length === 0) {
    if (opts.quiet) return '';
    const suffix = result.suppressed > 0 ? c.dim(` (${result.suppressed} suppressed)`) : '';
    return `${c.green('✔')} leaklatch: no secrets detected${suffix}`;
  }

  const lines: string[] = [];
  const byFile = new Map<string, Finding[]>();
  for (const f of result.findings) {
    const arr = byFile.get(f.file) ?? [];
    arr.push(f);
    byFile.set(f.file, arr);
  }

  lines.push(
    c.bold(
      c.red(
        `✖ leaklatch: ${result.findings.length} potential secret${
          result.findings.length === 1 ? '' : 's'
        } detected`,
      ),
    ),
  );
  lines.push('');

  for (const [file, findings] of byFile) {
    lines.push(c.underline(c.cyan(file)));
    for (const f of findings) {
      const sev = useColor
        ? SEVERITY_COLOR[f.severity](` ${f.severity.toUpperCase()} `)
        : `[${f.severity.toUpperCase()}]`;
      const loc = f.line > 0 ? `:${f.line}` : '';
      lines.push(`  ${sev} ${c.bold(f.ruleId)}  ${c.dim(`${file}${loc}`)}`);
      lines.push(`      ${c.dim('match:')} ${f.match}`);
      if (opts.verbose) {
        lines.push(`      ${c.dim('line: ')} ${f.preview}`);
        if (f.entropy !== undefined) {
          lines.push(`      ${c.dim('entropy:')} ${f.entropy}`);
        }
        lines.push(`      ${c.dim('id:')} ${f.fingerprint}`);
      }
      lines.push(`      ${c.dim('fix:  ')} ${f.remediation}`);
    }
    lines.push('');
  }

  lines.push(
    c.dim(
      `Scanned ${result.filesScanned} file(s). ${result.suppressed} suppressed by allowlist/baseline.`,
    ),
  );
  lines.push(
    c.dim('Tip: add `# leaklatch-ignore` to a line, or run `leaklatch scan --update-baseline`.'),
  );
  return lines.join('\n');
}

/** A no-op color shim used when color is disabled. */
function stripColors(): typeof pc {
  const identity = (s: string) => s;
  return new Proxy(pc, {
    get() {
      return identity;
    },
  }) as unknown as typeof pc;
}
