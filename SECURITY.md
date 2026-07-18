# Security Policy

## Reporting a Vulnerability

leaklatch is a security tool, so we take vulnerabilities in it seriously.

**Please do not open a public issue for security reports.** Instead, use GitHub's
private vulnerability reporting:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.

If private reporting is unavailable, email the maintainer at the address on the
npm package / GitHub profile with the subject line `leaklatch security`.

Please include:

- A description of the issue and its impact
- Steps to reproduce (a minimal repo or diff is ideal)
- The leaklatch version (`leaklatch --version`) and your Node version

We aim to acknowledge reports within **72 hours** and to ship a fix or mitigation
for confirmed issues as quickly as is responsibly possible.

## Scope

Examples of in-scope issues:

- A detection bypass that lets a well-known credential format slip through
- A regression that causes leaklatch to **print a raw secret value** (it should
  always be redacted)
- A crash or hang that could be used to disable pre-commit scanning
- Path traversal or arbitrary file access during a scan

## A note on false negatives

No secret scanner catches everything. leaklatch is a strong safety net, **not** a
guarantee. Treat a leaked secret as compromised the moment it touches disk, and
rotate it — even if you caught it before pushing.
