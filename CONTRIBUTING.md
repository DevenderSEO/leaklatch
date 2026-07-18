# Contributing to leaklatch

Thanks for your interest in making secret scanning less painful! Contributions
of all sizes are welcome — from a new detection rule to a docs typo fix.

## Getting started

```bash
git clone https://github.com/DevenderSEO/leaklatch.git
cd leaklatch
npm install
npm run build
npm test
```

## Development workflow

| Command | What it does |
|---|---|
| `npm run build` | Bundle CJS + ESM + types with tsup |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Run the vitest suite |
| `npm run test:coverage` | Run tests with coverage thresholds |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm run selfscan` | Scan this repo with the built CLI |

Before opening a PR, please make sure all of these are green:

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run selfscan
```

## Adding a detection rule

Detection rules live in [`src/detect/rules.ts`](./src/detect/rules.ts). A good
rule is **narrow** — prefer a distinctive prefix and, where the format is
generic, an entropy threshold and/or a `validator`. Every rule should come with:

1. A positive test (a realistic but **fake** secret that must match) in
   [`test/rules.test.ts`](./test/rules.test.ts).
2. A negative test (a placeholder / look-alike that must **not** match).

> ⚠️ **Never commit a real secret**, even in tests. Use obviously-fake values.
> leaklatch scans itself in CI and will block real credentials.

## Reducing false positives

The false-positive filters live in
[`src/detect/filters.ts`](./src/detect/filters.ts). If you hit a noisy false
positive in the wild, the ideal PR adds a filter **plus** a regression test that
would have failed before your change.

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `ci:`.

## Code of Conduct

By participating you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).
