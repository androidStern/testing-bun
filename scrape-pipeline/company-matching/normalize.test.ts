import { describe, test, expect } from 'bun:test';
import { normalize, normalizedKey, tokenize, normalizeForPhonetic } from './normalize';

describe('normalize()', () => {
  test('converts to lowercase', () => {
    expect(normalize('WALMART')).toBe('walmart');
    expect(normalize('McDonald')).toBe('mcdonald');
  });

  test('replaces hyphens with space', () => {
    expect(normalize('Wal-Mart')).toBe('wal mart');
    expect(normalize('7-Eleven')).toBe('7 eleven');
  });

  test('removes apostrophes', () => {
    expect(normalize("McDonald's")).toBe('mcdonalds');
    expect(normalize("Lowe's")).toBe('lowes');
  });

  test('replaces & with and', () => {
    expect(normalize('AT&T')).toBe('at and t');
    expect(normalize('Procter & Gamble')).toBe('procter and gamble');
  });

  test('removes legal suffixes', () => {
    expect(normalize('Acme Inc.')).toBe('acme');
    expect(normalize('Acme LLC')).toBe('acme');
    expect(normalize('Acme Corporation')).toBe('acme');
    expect(normalize('The Home Depot Inc')).toBe('home depot');
  });

  test('handles empty string', () => {
    expect(normalize('')).toBe('');
  });

  test('handles null/undefined gracefully', () => {
    expect(normalize(null as any)).toBe('');
    expect(normalize(undefined as any)).toBe('');
  });

  test('collapses multiple spaces', () => {
    expect(normalize('Taco   Bell')).toBe('taco bell');
  });

  test('trims whitespace', () => {
    expect(normalize('  Walmart  ')).toBe('walmart');
  });
});

describe('normalizedKey()', () => {
  // CRITICAL: Keys must match for Redis lookup regardless of hyphenation
  test('Wal-Mart and Walmart produce same key', () => {
    expect(normalizedKey('Wal-Mart')).toBe(normalizedKey('Walmart'));
    expect(normalizedKey('Wal-Mart')).toBe('walmart');
  });

  test("McDonald's and McDonalds produce same key", () => {
    expect(normalizedKey("McDonald's")).toBe(normalizedKey('McDonalds'));
    expect(normalizedKey("McDonald's")).toBe('mcdonalds');
  });

  test('strips all whitespace', () => {
    expect(normalizedKey('Taco Bell')).toBe('tacobell');
    expect(normalizedKey('Home Depot Inc.')).toBe('homedepot');
    expect(normalizedKey('The Cheesecake Factory')).toBe('cheesecakefactory');
  });

  test('handles compound names with hyphens', () => {
    expect(normalizedKey('7-Eleven')).toBe('7eleven');
    expect(normalizedKey('Chick-fil-A')).toBe('chickfila');
  });

  test('handles names with &', () => {
    expect(normalizedKey('AT&T')).toBe('atandt');
    expect(normalizedKey('H&M')).toBe('handm');
  });

  test('empty string returns empty', () => {
    expect(normalizedKey('')).toBe('');
  });
});

describe('tokenize()', () => {
  test('splits normalized name into tokens', () => {
    expect(tokenize('Taco Bell')).toEqual(['taco', 'bell']);
    expect(tokenize('The Home Depot Inc.')).toEqual(['home', 'depot']);
  });

  test('empty string returns empty array', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('normalizeForPhonetic()', () => {
  test('removes numbers', () => {
    expect(normalizeForPhonetic('7-Eleven')).toBe('eleven');
    expect(normalizeForPhonetic('3M')).toBe('');
  });

  test('removes single-character tokens', () => {
    // 'at' is 2 chars so it stays, only single chars are removed
    expect(normalizeForPhonetic('AT&T')).toBe('at and');
    // Single char 't' at end would be removed
    expect(normalizeForPhonetic('A B C')).toBe('');
  });
});
