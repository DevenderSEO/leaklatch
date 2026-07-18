# Roadmap

leaklatch's north star: **the secret scanner TypeScript teams keep enabled**
because it's fast and never noisy. Everything below is judged against that.

## v0.x (current)

- [x] Layered detection engine (rules + entropy + FP filters)
- [x] Staged-diff scanning + `--all` tree scan
- [x] Native, append-safe pre-commit hook (`install` / `uninstall`)
- [x] Inline ignore directives, config file, fingerprint baseline
- [x] Colored + JSON reporters with redaction
- [x] Programmatic API

## v0.2 — sharper detection

- [ ] More providers: GCP service-account JSON, Azure connection strings,
      Twilio, SendGrid, Postgres/Mongo/Redis connection URLs
- [ ] Entropy tuning per file type (Markdown/docs are noisier than `.ts`)
- [ ] `--staged` partial-line awareness for very large diffs

## v0.3 — workflow polish

- [ ] `leaklatch report` — summarise findings across a branch range
- [ ] SARIF output for GitHub code scanning
- [ ] `--fix` interactive mode to add ignores / baseline entries
- [ ] Official reusable GitHub Action (`DevenderSEO/leaklatch-action`)

## v0.4 — history & scale

- [ ] Optional full-history scan (`--since <ref>`)
- [ ] Verified-secret mode (opt-in live validation for a few providers)
- [ ] Benchmark suite vs. incumbents (recall/precision on a public corpus)

## Non-goals

- Becoming a heavyweight, config-first enterprise platform
- Live-validating every credential by default (privacy + speed cost)
- Language-specific AST parsing (regex + entropy keeps it universal and fast)
