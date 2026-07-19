# Good First Issues

Real, scoped starter tasks. Each is small enough for a first PR but genuinely
useful. Open a GitHub issue referencing the one you pick, and see
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for the workflow.

---

### 1. Add a detection rule for database connection URLs

**Difficulty:** 🟢 Easy · **Area:** `src/detect/rules.ts`

Add a rule that flags connection strings with embedded credentials, e.g.
`postgres://user:pass@host:5432/db`, `mongodb+srv://user:pass@…`,
`redis://:pass@host`. Capture the password portion for redaction and add both a
positive and a placeholder-negative test.

**Acceptance:** rule fires on a fake credentialed URL, ignores
`postgres://localhost/db` (no password), tests pass.

---

### 2. Add SendGrid & Twilio rules

**Difficulty:** 🟢 Easy · **Area:** `src/detect/rules.ts`

SendGrid keys look like `SG.<22 chars>.<43 chars>`; Twilio account SIDs start
with `AC` + 32 hex and auth tokens are 32 hex. Add both, with realistic fake
fixtures.

**Acceptance:** new rules detect fake keys and don't regress existing tests.

---

### 3. Emit a summary count line in `--json` grouped by severity

**Difficulty:** 🟡 Medium · **Area:** `src/output.ts`

Extend the JSON payload with a `bySeverity` object
(`{ critical, high, medium, low }`) so CI dashboards can chart findings without
re-parsing. Add a unit test asserting the counts.

**Acceptance:** `toJson` includes `bySeverity`; existing fields unchanged.

---

### 4. Honor a `LEAKLATCH_DISABLE=1` environment variable

**Difficulty:** 🟡 Medium · **Area:** `src/cli.ts`, hook template in `src/hook.ts`

Sometimes you need a one-off escape hatch
(`LEAKLATCH_DISABLE=1 git commit …`). When set, `scan` should print a clear
warning to stderr and exit `0`. Update the installed hook comment to mention it.

**Acceptance:** with the env var set, a commit containing a fake secret is
allowed, and a warning is printed. Add a test covering the CLI branch.
