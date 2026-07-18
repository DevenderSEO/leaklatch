import { describe, it, expect } from 'vitest';
import { RULES, ruleById } from '../src/detect/rules.js';
import { detectLines } from '../src/detect/detector.js';
import type { ScanLine } from '../src/types.js';

function line(content: string, file = 'src/app.ts'): ScanLine {
  return { file, line: 1, content };
}

/**
 * Each entry: a rule id and a source line that should trigger it.
 * All secrets here are obviously fake / structurally valid but not real.
 */
const POSITIVE_CASES: Array<{ id: string; content: string }> = [
  { id: 'aws-access-key-id', content: 'aws_key = "AKIA' + 'IOSFODNN7ZZ12CD3"' },
  {
    id: 'aws-secret-access-key',
    content: 'aws_secret_access_key = "abcdEFGH1234ijklMNOP' + '5678qrstUVWX9012yzAB"',
  },
  { id: 'github-pat', content: 'token=ghp_' + '1234567890abcdefABCDEF1234567890abcd' },
  { id: 'github-oauth', content: 'gho_' + '1234567890abcdefABCDEF1234567890abcd' },
  {
    id: 'github-fine-grained-pat',
    content: 'github_pat_' + '11ABCDEFG0abcdefghijklmnopqrstuvwxyz1234567890',
  },
  { id: 'openai-key', content: 'OPENAI_API_KEY=sk-abcDEF1234ghiJKL5678mnoPQR' },
  { id: 'anthropic-key', content: 'ANTHROPIC=sk-ant-' + 'abcDEF1234ghiJKL5678mnoPQRst' },
  { id: 'google-api-key', content: 'key=AIza' + 'SyA1234567890abcdefghijklmnopqrstuv' },
  { id: 'stripe-secret-key', content: 'STRIPE=sk_live_' + 'abcdefghijklmnopqrstuvwx1234' },
  { id: 'slack-token', content: 'xoxb-' + '1234567890-abcdefghijklmnop' },
  {
    id: 'slack-webhook',
    content: 'url=https://hooks.slack.com/services/T00000000/B11111111/abcXYZ123456',
  },
  { id: 'private-key', content: '-----BEGIN RSA PRIVATE KEY-----' },
  {
    id: 'jwt',
    content:
      'auth=eyJ' +
      'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N',
  },
  { id: 'npm-token', content: 'npm_' + '1234567890abcdefABCDEF1234567890abcd' },
  { id: 'generic-assignment', content: 'DB_PASSWORD=Xk9mQ2pL7wZ4nB8rT3vY' },
];

describe('rule pack — positive detections', () => {
  it.each(POSITIVE_CASES)('detects $id', ({ id, content }) => {
    const findings = detectLines([line(content)]);
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain(id);
  });
});

describe('rule pack — negative (placeholder) rejections', () => {
  it.each([
    'sk-your-openai-key-here',
    'DB_PASSWORD=changeme',
    'API_KEY=xxxxxxxxxxxxxxxx',
    'token=your-token-here',
  ])('does not flag placeholder: %s', (content) => {
    const findings = detectLines([line(content)]);
    expect(findings).toHaveLength(0);
  });
});

describe('ruleById', () => {
  it('finds a known rule', () => {
    expect(ruleById('github-pat')?.id).toBe('github-pat');
  });
  it('returns undefined for an unknown id', () => {
    expect(ruleById('nope')).toBeUndefined();
  });
});

describe('rule pack integrity', () => {
  it('every rule regex uses the global flag', () => {
    for (const r of RULES) {
      expect(r.regex.global, `${r.id} must be global`).toBe(true);
    }
  });
  it('rule ids are unique', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
