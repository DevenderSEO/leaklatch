# Grant Application — DRAFT (do not publish)

> **Status: internal draft** for the Claude for Open Source program. Not part of
> the published package. Contains no invented metrics, stars, or download counts.

## Project

**leaklatch** — a git-aware secret & `.env` leak guard for the TypeScript/Node
ecosystem. It scans staged git changes on every commit and blocks credentials
before they enter history, with a layered detection design tuned for a low
false-positive rate.

## Ecosystem impact statement (~500 words)

Leaked credentials are one of the most common and most damaging software
supply-chain failures. A secret committed to git is effectively public the
moment it lands: it persists in history even after a "fix" commit, propagates to
every clone and fork, and is harvested by automated scrapers within minutes of
reaching a public host. The downstream cost — key rotation, incident response,
unauthorized cloud spend, data exposure — is borne not only by the author but by
everyone who depends on the affected service. For the JavaScript/TypeScript
community specifically, the risk surface is enormous: it is the largest package
ecosystem in the world, `.env` files are the default configuration idiom, and a
single leaked npm or cloud token can compromise a widely-depended-upon package.

leaklatch attacks this problem at the cheapest possible point to fix it: the
developer's pre-commit moment, before the secret is ever written to history. The
existing, excellent scanners (gitleaks, detect-secrets, trufflehog) are built as
Go or Python binaries oriented toward whole-repository and CI scanning. That
leaves a real gap for the millions of TypeScript developers who want a tool that
installs with `npx`, needs zero configuration, runs in well under a second on a
staged diff, and — critically — does not flood them with false positives, which
is the single biggest reason developers disable secret scanning. leaklatch is
built precisely for that inner loop: TS-native, zero-config, `npx`-installable,
and layered (prefix-anchored rules + per-rule entropy gates + placeholder and
test-path filters + de-duplication) so that it stays quiet unless something is
genuinely wrong. A scanner that is fast and trustworthy is one that stays
enabled — and a scanner that stays enabled is the only kind that prevents leaks.

**Who it helps.** Individual open-source maintainers and indie developers who
lack a security team; small teams adopting DevSecOps hygiene without heavyweight
tooling; and the broader ecosystem, which benefits every time a token is caught
before it reaches a public repository or an npm release. Because leaklatch also
ships a programmatic API and a CI-friendly JSON mode, it can be embedded into
other developer tools and CI templates, multiplying its reach.

**Why now.** The volume of AI-assisted code generation is rising sharply, and
generated code frequently inlines example or real credentials. Lightweight,
low-friction guardrails at commit time are more valuable than ever.

**Maintenance plan.** leaklatch is MIT-licensed and built for sustainable
maintenance: a small, dependency-light codebase (commander + one color library),
a strict TypeScript build, and a test suite with 100% line coverage on the core
detection engine that runs across Node 18/20/22. The project dogfoods itself —
CI fails if leaklatch detects a secret in its own tree — and ships a public
roadmap, scoped good-first-issues, and contribution/security policies to lower
the barrier for outside contributors. The near-term maintenance focus is
expanding provider coverage, tuning false-positive filters against real-world
reports, and adding SARIF output for GitHub code scanning. Grant support would
fund dedicated time for provider-rule expansion, a precision/recall benchmark
suite against a public corpus, and responsive triage of community-reported false
positives and negatives — the work that keeps a security tool both trusted and
trustworthy.

## Honest status

- Pre-1.0; core detection, hook, allowlist, baseline, and CI are implemented and
  tested. No published download or star metrics are claimed because the project
  is newly released.
