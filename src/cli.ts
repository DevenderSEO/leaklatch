#!/usr/bin/env node
/**
 * leaklatch CLI. Thin command layer over the scanner + hook installer.
 */

import { Command } from 'commander';
import pc from 'picocolors';
import { scan } from './scan.js';
import { loadConfig } from './config.js';
import { loadBaseline, writeBaseline, BASELINE_FILENAME } from './baseline.js';
import { installHook, uninstallHook } from './hook.js';
import { isGitRepo } from './git.js';
import { toText, toJson } from './output.js';

const VERSION = '0.1.1';

/** Shown when a command needs a git repo but isn't in one. */
const GIT_REPO_HINT =
  'leaklatch: not a git repository — run `git init` first, or run this inside an existing repo.\n';

interface ScanFlags {
  all?: boolean;
  staged?: boolean;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
  updateBaseline?: boolean;
  noBaseline?: boolean;
}

function runScan(flags: ScanFlags): number {
  const cwd = process.cwd();
  if (!isGitRepo(cwd)) {
    process.stderr.write(pc.red(GIT_REPO_HINT));
    return 2;
  }

  const config = loadConfig(cwd);
  const baseline = flags.noBaseline ? new Set<string>() : loadBaseline(cwd);

  const result = scan({
    all: flags.all,
    config,
    baseline,
    cwd,
  });

  if (flags.updateBaseline) {
    const path = writeBaseline(result.findings, cwd);
    process.stdout.write(pc.green(`✔ Wrote ${result.findings.length} fingerprint(s) to ${path}\n`));
    return 0;
  }

  if (flags.json) {
    process.stdout.write(`${toJson(result)}\n`);
  } else {
    const text = toText(result, {
      quiet: flags.quiet,
      verbose: flags.verbose,
      color: flags.color,
    });
    if (text) process.stdout.write(`${text}\n`);
  }

  return result.findings.length > 0 ? 1 : 0;
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name('leaklatch')
    .description('Git-aware secret & .env leak guard with the lowest false-positive rate.')
    .version(VERSION, '-V, --version', 'output the version number');

  program
    .command('scan', { isDefault: true })
    .description('Scan staged changes (default) or the whole tree for secrets')
    .option('--all', 'scan all tracked files instead of only staged changes')
    .option('--staged', 'scan only staged changes (default)')
    .option('--json', 'output machine-readable JSON (for CI)')
    .option('--quiet', 'suppress output when nothing is found')
    .option('--verbose', 'show line preview, entropy, and fingerprints')
    .option('--no-color', 'disable colored output')
    .option('--no-baseline', 'ignore the baseline file for this run')
    .option('--update-baseline', `write current findings to ${BASELINE_FILENAME}`)
    .action((opts: ScanFlags) => {
      process.exitCode = runScan(opts);
    });

  program
    .command('install')
    .description('Install the leaklatch git pre-commit hook (append-safe)')
    .action(() => {
      const cwd = process.cwd();
      if (!isGitRepo(cwd)) {
        process.stderr.write(pc.red(GIT_REPO_HINT));
        process.exitCode = 2;
        return;
      }
      const res = installHook(cwd);
      const msg: Record<string, string> = {
        created: `✔ Installed pre-commit hook at ${res.path}`,
        appended: `✔ Appended leaklatch to existing hook at ${res.path}`,
        'already-present': `✔ leaklatch hook refreshed at ${res.path}`,
      };
      process.stdout.write(pc.green(`${msg[res.action] ?? 'Done'}\n`));
    });

  program
    .command('uninstall')
    .description('Remove the leaklatch git pre-commit hook (leaves other hooks intact)')
    .action(() => {
      const cwd = process.cwd();
      const res = uninstallHook(cwd);
      if (res.action === 'removed') {
        process.stdout.write(pc.green(`✔ Removed leaklatch hook from ${res.path}\n`));
      } else {
        process.stdout.write(pc.yellow('leaklatch hook not found; nothing to remove.\n'));
      }
    });

  return program;
}

buildProgram().parse(process.argv);
