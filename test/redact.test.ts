import { describe, it, expect } from 'vitest';
import { redact, redactLine } from '../src/detect/redact.js';

describe('redact', () => {
  it('fully masks short values', () => {
    expect(redact('abc')).toBe('***');
    expect(redact('abcdef')).toBe('******');
  });

  it('keeps first and last two chars for longer values', () => {
    const r = redact('AKIA' + 'IOSFODNN7ZZ12CD3');
    expect(r.startsWith('AK')).toBe(true);
    expect(r.endsWith('D3')).toBe(true);
    expect(r).not.toContain('IOSF');
  });

  it('caps the mask length', () => {
    const r = redact('a'.repeat(100));
    // 2 head + up to 12 stars + 2 tail
    expect(r.length).toBeLessThanOrEqual(16);
  });
});

describe('redactLine', () => {
  it('replaces the secret within the line', () => {
    const line = 'const k = "AKIA' + 'IOSFODNN7ZZ12CD3";';
    const out = redactLine(line, 'AKIA' + 'IOSFODNN7ZZ12CD3');
    expect(out).not.toContain('IOSFODNN');
    expect(out).toContain('AK');
  });

  it('returns trimmed line when secret is absent', () => {
    expect(redactLine('  hello world  ', 'nope')).toBe('hello world');
  });

  it('truncates very long lines', () => {
    const long = 'x'.repeat(300);
    expect(redactLine(long, 'absent').length).toBeLessThanOrEqual(120);
  });

  it('handles an empty secret gracefully', () => {
    expect(redactLine('some line', '')).toBe('some line');
  });
});
