/**
 * The rule pack: regex + optional validators for well-known credential formats.
 *
 * Design principle: each rule aims for a *narrow* regex plus a validator so we
 * catch the real thing and reject look-alikes. Prefix-anchored tokens
 * (ghp_, sk-ant-, AKIA…) are high-confidence and need little entropy gating;
 * generic assignments lean on the entropy layer instead.
 */

import { shannonEntropy } from './entropy.js';
import type { Rule } from '../types.js';

/** Luhn-independent helper: reject values that are a single repeated char. */
function notRepeated(value: string): boolean {
  return !/^(.)\1+$/.test(value);
}

/** Base64/hex-ish check used by several validators. */
function isSecretLike(value: string): boolean {
  return notRepeated(value) && shannonEntropy(value) >= 3.0;
}

export const RULES: Rule[] = [
  {
    id: 'aws-access-key-id',
    description: 'AWS Access Key ID',
    // AKIA/ASIA/AGPA/AIDA/AROA + 16 uppercase alphanumerics
    regex: /\b((?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z0-9]{16})\b/g,
    secretGroup: 1,
    severity: 'critical',
    remediation: 'Rotate the AWS key immediately in IAM and remove it from source.',
    keywords: ['AKIA', 'ASIA', 'AGPA', 'AIDA', 'AROA'],
  },
  {
    id: 'aws-secret-access-key',
    description: 'AWS Secret Access Key',
    // Only fire on an explicit aws secret assignment to avoid matching any 40-char base64.
    regex: /aws_?secret_?access_?key["'\s:=]+([A-Za-z0-9/+=]{40})\b/gi,
    secretGroup: 1,
    entropy: 4.2,
    severity: 'critical',
    remediation: 'Rotate the AWS secret key in IAM and purge it from git history.',
    validator: isSecretLike,
    keywords: ['aws', 'secret'],
  },
  {
    id: 'github-pat',
    description: 'GitHub Personal Access Token',
    regex: /\b(ghp_[A-Za-z0-9]{36})\b/g,
    secretGroup: 1,
    severity: 'critical',
    remediation: 'Revoke the token at github.com/settings/tokens and rotate.',
    validator: notRepeated,
    keywords: ['ghp_'],
  },
  {
    id: 'github-oauth',
    description: 'GitHub OAuth / App token',
    regex: /\b((?:gho|ghu|ghs|ghr)_[A-Za-z0-9]{36})\b/g,
    secretGroup: 1,
    severity: 'critical',
    remediation: 'Revoke the GitHub OAuth/app token and rotate the client secret.',
    validator: notRepeated,
    keywords: ['gho_', 'ghu_', 'ghs_', 'ghr_'],
  },
  {
    id: 'github-fine-grained-pat',
    description: 'GitHub fine-grained PAT',
    regex: /\b(github_pat_[A-Za-z0-9_]{22,})\b/g,
    secretGroup: 1,
    severity: 'critical',
    remediation: 'Revoke the fine-grained PAT in GitHub developer settings.',
    validator: notRepeated,
    keywords: ['github_pat_'],
  },
  {
    id: 'openai-key',
    description: 'OpenAI API key',
    // sk- followed by >=20 base62; excludes sk-ant- (handled separately).
    regex: /\b(sk-(?!ant-)[A-Za-z0-9_-]{20,})\b/g,
    secretGroup: 1,
    entropy: 3.4,
    severity: 'critical',
    remediation: 'Revoke the key in the OpenAI dashboard and issue a new one.',
    validator: isSecretLike,
    keywords: ['sk-'],
  },
  {
    id: 'anthropic-key',
    description: 'Anthropic API key',
    regex: /\b(sk-ant-[A-Za-z0-9_-]{20,})\b/g,
    secretGroup: 1,
    entropy: 3.4,
    severity: 'critical',
    remediation: 'Revoke the key in the Anthropic Console and rotate.',
    validator: isSecretLike,
    keywords: ['sk-ant-'],
  },
  {
    id: 'google-api-key',
    description: 'Google API key',
    regex: /\b(AIza[A-Za-z0-9_-]{35})\b/g,
    secretGroup: 1,
    severity: 'high',
    remediation: 'Restrict/rotate the key in Google Cloud Console credentials.',
    validator: notRepeated,
    keywords: ['AIza'],
  },
  {
    id: 'stripe-secret-key',
    description: 'Stripe live secret/restricted key',
    regex: /\b((?:sk|rk)_live_[A-Za-z0-9]{24,})\b/g,
    secretGroup: 1,
    severity: 'critical',
    remediation: 'Roll the key in the Stripe dashboard immediately.',
    validator: notRepeated,
    keywords: ['sk_live_', 'rk_live_'],
  },
  {
    id: 'slack-token',
    description: 'Slack token',
    regex: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    secretGroup: 1,
    severity: 'high',
    remediation: 'Revoke the Slack token in the app/admin settings.',
    validator: notRepeated,
    keywords: ['xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
  },
  {
    id: 'slack-webhook',
    description: 'Slack incoming webhook URL',
    regex: /(https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9_]+\/B[A-Za-z0-9_]+\/[A-Za-z0-9]+)/g,
    secretGroup: 1,
    severity: 'medium',
    remediation: 'Delete and recreate the Slack webhook.',
    keywords: ['hooks.slack.com'],
  },
  {
    id: 'private-key',
    description: 'Private key block',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
    secretGroup: 0,
    severity: 'critical',
    remediation: 'Remove the private key and rotate the corresponding key pair.',
    keywords: ['PRIVATE KEY'],
  },
  {
    id: 'jwt',
    description: 'JSON Web Token',
    regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    secretGroup: 1,
    severity: 'medium',
    remediation: 'If this JWT is a real credential, invalidate the session/secret.',
    validator: notRepeated,
    keywords: ['eyJ'],
  },
  {
    id: 'npm-token',
    description: 'npm access token',
    regex: /\b(npm_[A-Za-z0-9]{36})\b/g,
    secretGroup: 1,
    severity: 'high',
    remediation: 'Revoke the npm token with `npm token revoke`.',
    validator: notRepeated,
    keywords: ['npm_'],
  },
  {
    id: 'generic-assignment',
    description: 'Generic secret assignment (KEY/SECRET/TOKEN/PASSWORD)',
    // key-like identifier = value; value captured in group 2.
    regex:
      /(?:^|[^A-Za-z0-9_])((?:[A-Za-z0-9_]*)(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|APIKEY|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIALS?))\s*[:=]\s*["']?([^\s"']{8,})["']?/gi,
    secretGroup: 2,
    entropy: 3.5,
    severity: 'high',
    remediation: 'Move the value to an env var / secrets manager and rotate it.',
    validator: isSecretLike,
    keywords: ['key', 'secret', 'token', 'password', 'passwd', 'pwd', 'credential'],
  },
];

/** Look up a rule by id. */
export function ruleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}
