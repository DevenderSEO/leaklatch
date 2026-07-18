# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-19

### Added

- Layered detection engine: prefix-anchored rule pack, per-rule Shannon-entropy
  gates, and false-positive filters (placeholders, test/fixture paths,
  low-information values, character-class checks).
- Rule pack for AWS access/secret keys, GitHub tokens (`ghp_`, `gho_`,
  `github_pat_`), OpenAI, Anthropic, Google API keys, Stripe live keys, Slack
  tokens & webhooks, private key blocks, JWTs, npm tokens, and generic
  `KEY`/`SECRET`/`TOKEN`/`PASSWORD` assignments.
- Committed `.env` / `.env.*` file detection (with `.env.example`,
  `.env.sample`, `.env.template`, `.env.dist`, `.env.test` allowed).
- `scan` command: staged-diff scanning (default), `--all` tree scan, `--json`,
  `--verbose`, `--quiet`, `--no-color`, `--no-baseline`, `--update-baseline`.
- Append-safe git pre-commit hook via `install` / `uninstall` (husky-friendly).
- Allowlist layer: inline `# leaklatch-ignore` and `# leaklatch-ignore-next-line`
  directives, `leaklatch.config.json` / `.leaklatchrc` config, and a
  `.leaklatch-baseline.json` fingerprint baseline.
- Redacted, colored, grouped output with remediation hints; JSON mode for CI.
- Programmatic API (`scan`, `detectLines`, and detection internals).
- Full test suite (vitest) with 100% line coverage on core detection logic.
- GitHub Actions workflows for CI (lint, typecheck, test+coverage, build,
  self-scan), npm publish on tag, and GitHub Pages deploy of the landing page.

[Unreleased]: https://github.com/DevenderSEO/leaklatch/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/DevenderSEO/leaklatch/releases/tag/v0.1.0
