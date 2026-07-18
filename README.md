# 🔒 leaklatch

> Git-aware secret & `.env` leak guard for TypeScript/Node — **sub-second pre-commit scanning with the lowest false-positive rate.**

[![npm version](https://img.shields.io/npm/v/leaklatch.svg)](https://www.npmjs.com/package/leaklatch)
[![CI](https://github.com/DevenderSEO/leaklatch/actions/workflows/ci.yml/badge.svg)](https://github.com/DevenderSEO/leaklatch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Website](https://img.shields.io/badge/website-leaklatch.click-4f46e5.svg)](https://leaklatch.click)

leaklatch stops API keys, tokens, and `.env` files from ever reaching your git
history. It scans **only your staged diff** on every commit, so it's fast enough
to never get in your way — and its layered detection means it won't cry wolf on
every base64 string in your codebase.

```console
$ git commit -m "add billing"
✖ leaklatch: 1 potential secret detected

src/stripe.ts
  CRITICAL  stripe-secret-key  src/stripe.ts:12
      match: sk************34
      fix:   Roll the key in the Stripe dashboard immediately.

commit aborted.
```

<!-- Replace with an animated demo GIF once recorded -->
<!-- ![leaklatch demo](docs/demo.gif) -->

---

## 30-second quickstart

```bash
# Install the pre-commit hook in your repo (no global install needed)
npx leaklatch install

# That's it. Every commit now scans staged changes.
# Run a one-off scan any time:
npx leaklatch scan
```

Prefer a dev dependency?

```bash
npm install --save-dev leaklatch
npx leaklatch install
```

---

## Why leaklatch? (vs the incumbents)

The established scanners are excellent, broad tools — but they're written for a
different world (Go/Python binaries, whole-repo scans, config-heavy). leaklatch
is built for the **TypeScript developer's inner loop**: zero config, `npx`-native,
and tuned to stay quiet unless something is genuinely wrong.

| | **leaklatch** | gitleaks | detect-secrets | trufflehog |
|---|:---:|:---:|:---:|:---:|
| TS/Node-native, `npx` install | ✅ | ❌ (Go) | ❌ (Python) | ❌ (Go) |
| Zero-config default | ✅ | ⚠️ | ⚠️ (needs baseline) | ⚠️ |
| Scans **staged diff** for fast pre-commit | ✅ | ✅ | ⚠️ | ⚠️ |
| Layered false-positive filtering | ✅ | ⚠️ (regex+entropy) | ✅ (plugins) | ⚠️ |
| Inline `# leaklatch-ignore` directives | ✅ | ✅ | ⚠️ | ❌ |
| Fingerprint baseline for gradual adoption | ✅ | ✅ | ✅ | ❌ |
| Redacts secret values in output | ✅ | ⚠️ | ✅ | ⚠️ |
| Programmatic API (`import { scan }`) | ✅ | ❌ | ⚠️ | ❌ |

> leaklatch isn't trying to out-feature these tools — it's trying to be the one
> your team actually keeps enabled because it's fast and never noisy.

---

## Why the low false-positive rate?

Regex-only scanners flag anything that _looks_ like a secret. leaklatch runs
every candidate through **layered validation** before it ever becomes a finding:

1. **Narrow, prefix-anchored rules.** Where a credential has a distinctive
   prefix (`ghp_`, `sk-ant-`, `AKIA…`, `sk_live_`), the rule requires it — no
   guessing from shape alone.
2. **Per-rule Shannon entropy gates.** Generic assignments (`API_KEY=…`) must
   clear an entropy threshold, so `API_KEY=changeme` never fires.
3. **Placeholder & context filters.** Known placeholders (`xxxx`, `changeme`,
   `your-key-here`, `<token>`, `${VAR}`), example values, and test/fixture paths
   are recognised and skipped.
4. **Character-class checks.** A long lowercase word isn't a secret just because
   it's long; real credential material mixes character classes.
5. **De-duplication.** A single leaked value matched by several rules is
   reported **once**, under the most specific rule.

The result: high recall on real credentials, low noise on everything else.

---

## Commands

### `leaklatch scan`

Scan for secrets. Defaults to **staged changes** (the pre-commit path).

```bash
leaklatch scan                 # scan staged diff (default)
leaklatch scan --all           # scan all tracked files (CI mode)
leaklatch scan --json          # machine-readable output for CI
leaklatch scan --verbose       # show line preview, entropy, fingerprints
leaklatch scan --quiet         # print nothing when clean
leaklatch scan --no-color      # disable ANSI colors
leaklatch scan --no-baseline   # ignore the baseline file for this run
leaklatch scan --update-baseline   # accept current findings into the baseline
```

Exit codes: `0` clean · `1` findings · `2` not a git repo.

### `leaklatch install` / `leaklatch uninstall`

Install (or remove) the git `pre-commit` hook. Installation is **append-safe**:
if you already have a `pre-commit` hook (including husky), leaklatch inserts a
clearly delimited block and leaves the rest untouched. Uninstall removes only
that block.

```bash
leaklatch install
leaklatch uninstall
```

---

## Configuration (optional — leaklatch is zero-config by default)

Drop a `leaklatch.config.json` (or `.leaklatchrc`) in your repo root:

```json
{
  "ignorePaths": ["test/fixtures", "docs/**"],
  "disabledRules": ["jwt"],
  "entropyOverrides": { "generic-assignment": 4.0 },
  "genericEntropyThreshold": 4.0,
  "disableGenericEntropy": false,
  "customRules": [
    {
      "id": "acme-internal-token",
      "regex": "ACME-[A-Z0-9]{20}",
      "severity": "high",
      "remediation": "Rotate the ACME token in the internal console."
    }
  ]
}
```

| Field | Purpose |
|---|---|
| `ignorePaths` | Substrings or globs (`*`, `**`) of paths to skip entirely. |
| `disabledRules` | Rule ids to turn off. |
| `entropyOverrides` | Per-rule entropy thresholds, keyed by rule id. |
| `genericEntropyThreshold` | Floor for the generic high-entropy detector. |
| `disableGenericEntropy` | Turn off the generic entropy detector. |
| `customRules` | Your own regex rules (`id` + `regex` required). |

### Inline ignores

```ts
const token = process.env.LEGACY_TOKEN ?? 'sk_live_...'; // leaklatch-ignore

// leaklatch-ignore-next-line
const anotherKnownSafeValue = '...';
```

### Baseline (adopt on an existing repo)

Already have findings you can't fix today? Accept them into a baseline so they
stop blocking commits, while any **new** secret is still caught:

```bash
leaklatch scan --all --update-baseline   # writes .leaklatch-baseline.json
git add .leaklatch-baseline.json
```

---

## CI: GitHub Actions

leaklatch ships a self-scan-friendly JSON mode. Drop this into
`.github/workflows/secrets.yml`:

```yaml
name: secret-scan
on: [push, pull_request]

jobs:
  leaklatch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx leaklatch scan --all --no-color
```

Exit code `1` fails the job when a secret is found.

---

## Programmatic API

```ts
import { scan, detectLines } from 'leaklatch';

const result = scan({ all: true });
if (result.findings.length > 0) {
  for (const f of result.findings) {
    console.log(`${f.file}:${f.line} ${f.ruleId} ${f.match}`);
  }
}

// Or run the pure detector over your own lines:
const findings = detectLines([{ file: 'a.ts', line: 1, content: 'API_KEY=...' }]);
```

---

## What it detects

AWS access keys & secret keys · GitHub tokens (`ghp_`, `gho_`, `github_pat_`) ·
OpenAI (`sk-`) · Anthropic (`sk-ant-`) · Google API keys · Stripe live keys ·
Slack tokens & webhooks · private key blocks · JWTs · npm tokens · generic
`KEY`/`SECRET`/`TOKEN`/`PASSWORD` assignments · committed `.env` files ·
generic high-entropy strings.

See [`ROADMAP.md`](./ROADMAP.md) for what's next and
[`ISSUES.md`](./ISSUES.md) for good first issues.

---

## Contributing

PRs welcome! Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and our
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). To report a vulnerability, see
[`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE) © Deven Aggarwal
