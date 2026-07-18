import { describe, it, expect } from 'vitest';
import { shannonEntropy, characterClasses, looksRandom } from '../src/detect/entropy.js';

describe('shannonEntropy', () => {
  it('returns 0 for an empty string', () => {
    expect(shannonEntropy('')).toBe(0);
  });

  it('returns 0 for a single repeated character', () => {
    expect(shannonEntropy('aaaaaaaa')).toBe(0);
  });

  it('is higher for random-looking strings than for words', () => {
    const random = shannonEntropy('aZ3$kR9!mQ2#pL7&');
    const word = shannonEntropy('passwordpassword');
    expect(random).toBeGreaterThan(word);
  });

  it('computes a known value for a two-symbol balanced string', () => {
    // "abab" -> two symbols, equal probability -> 1 bit/char.
    expect(shannonEntropy('abab')).toBeCloseTo(1, 5);
  });
});

describe('characterClasses', () => {
  it('counts distinct classes', () => {
    expect(characterClasses('abc')).toBe(1);
    expect(characterClasses('abcABC')).toBe(2);
    expect(characterClasses('abcABC123')).toBe(3);
    expect(characterClasses('abcABC123!@#')).toBe(4);
  });

  it('returns 0 for an empty string', () => {
    expect(characterClasses('')).toBe(0);
  });
});

describe('looksRandom', () => {
  it('rejects short strings regardless of entropy', () => {
    expect(looksRandom('aZ3$', 3)).toBe(false);
  });

  it('rejects single-class strings even if long', () => {
    expect(looksRandom('abcdefghijklmnop', 2)).toBe(false);
  });

  it('accepts long multi-class high-entropy strings', () => {
    expect(looksRandom('aZ3kR9mQ2pL7xW4nB8', 3)).toBe(true);
  });

  it('rejects when entropy is below the threshold', () => {
    expect(looksRandom('aaaaaaaaaaaaBBBB', 4.5)).toBe(false);
  });

  it('rejects file paths (contain a separator)', () => {
    expect(looksRandom('.github/workflows/pages.yml', 3)).toBe(false);
    expect(looksRandom('src\\config\\settings.ts', 3)).toBe(false);
  });

  it('rejects purely-alphabetic camelCase identifiers', () => {
    expect(looksRandom('noUncheckedIndexedAccess', 3)).toBe(false);
    expect(looksRandom('verbatimModuleSyntax', 3)).toBe(false);
  });
});
