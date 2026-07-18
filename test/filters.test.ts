import { describe, it, expect } from 'vitest';
import {
  isPlaceholder,
  isTestPath,
  isLowInformation,
  isFalsePositive,
} from '../src/detect/filters.js';

describe('isPlaceholder', () => {
  it.each([
    'xxxxxxxx',
    'changeme',
    'change-me',
    'your-api-key-here',
    'YOUR_TOKEN',
    'my-secret',
    'replace-me',
    '<your-token>',
    '${ENV_VAR}',
    '{{handlebars}}',
    'foobar',
    '00000000',
    'example-value',
    'REDACTED',
  ])('flags %s as a placeholder', (value) => {
    expect(isPlaceholder(value)).toBe(true);
  });

  it('does not flag a real-looking secret', () => {
    expect(isPlaceholder('AKIA' + 'IOSFODNN7ZZ12CD3')).toBe(false);
  });

  it('flags empty/whitespace', () => {
    expect(isPlaceholder('   ')).toBe(true);
  });
});

describe('isTestPath', () => {
  it.each([
    'test/foo.ts',
    'src/__tests__/a.ts',
    'lib/fixtures/data.env',
    'a/b/example/c.txt',
    'foo.test.ts',
    'bar.spec.tsx',
    'testdata/x',
  ])('recognizes %s as a test path', (p) => {
    expect(isTestPath(p)).toBe(true);
  });

  it('does not flag production paths', () => {
    expect(isTestPath('src/app/server.ts')).toBe(false);
  });

  it('normalizes windows separators', () => {
    expect(isTestPath('src\\__tests__\\a.ts')).toBe(true);
  });
});

describe('isLowInformation', () => {
  it('flags common dictionary words', () => {
    expect(isLowInformation('password')).toBe(true);
    expect(isLowInformation('localhost')).toBe(true);
  });

  it('flags single-class low-entropy values', () => {
    expect(isLowInformation('aaaabbbbcccc')).toBe(true);
  });

  it('does not flag mixed high-entropy values', () => {
    expect(isLowInformation('aZ3kR9mQ2pL7xW4nB8')).toBe(false);
  });
});

describe('isFalsePositive', () => {
  it('rejects placeholders even in strict mode', () => {
    expect(isFalsePositive('your-key-here', 'src/app.ts', { strict: true })).toBe(true);
  });

  it('strict mode ignores test-path and low-info gates', () => {
    // A strict, non-placeholder value in a test path is NOT a false positive.
    expect(isFalsePositive('AKIA' + 'IOSFODNN7ZZ12CD3', 'test/a.ts', { strict: true })).toBe(false);
  });

  it('non-strict mode rejects secrets in test paths', () => {
    expect(isFalsePositive('aZ3kR9mQ2pL7xW4nB8', 'test/a.ts')).toBe(true);
  });

  it('non-strict mode rejects low-information values', () => {
    expect(isFalsePositive('password', 'src/a.ts')).toBe(true);
  });

  it('accepts a genuine-looking secret in a production path', () => {
    expect(isFalsePositive('aZ3kR9mQ2pL7xW4nB8', 'src/a.ts')).toBe(false);
  });
});
