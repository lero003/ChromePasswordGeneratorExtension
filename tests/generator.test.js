import { describe, expect, it } from 'vitest';
import generator from '../generator.js';

const {
  generatePassword,
  generatePassphrase,
  CHAR_SETS,
  SIMILAR_CHARACTERS,
  AMBIGUOUS_SYMBOLS,
} = generator;

function hasCharFromSet(text, characters) {
  return [...text].some((char) => characters.includes(char));
}

function createSequenceRandomIndex(sequence, fallback = 0) {
  let index = 0;
  return (max) => {
    const value = index < sequence.length ? sequence[index] : fallback;
    if (index < sequence.length) {
      index += 1;
    }
    return value % max;
  };
}

describe('generatePassword', () => {
  it('creates a password with the requested length and characters', () => {
    const options = { length: 24, lower: true, upper: true, digits: true, symbols: true };
    const result = generatePassword(options);
    expect(result).toHaveLength(24);

    const allowed = new Set([
      ...CHAR_SETS.lower,
      ...CHAR_SETS.upper,
      ...CHAR_SETS.digits,
      ...CHAR_SETS.symbols,
    ]);
    for (const char of result) {
      expect(allowed.has(char)).toBe(true);
    }
  });

  it('excludes similar looking characters when excludeSimilar is enabled', () => {
    const result = generatePassword({
      length: 32,
      lower: true,
      upper: true,
      digits: true,
      symbols: false,
      excludeSimilar: true,
    });
    for (const char of result) {
      expect(SIMILAR_CHARACTERS.has(char)).toBe(false);
    }
  });

  it('applies the noAmbiguous option to symbols', () => {
    const result = generatePassword({
      length: 30,
      lower: false,
      upper: false,
      digits: false,
      symbols: true,
      noAmbiguous: true,
    });
    for (const char of result) {
      expect(AMBIGUOUS_SYMBOLS.has(char)).toBe(false);
      expect(CHAR_SETS.symbols.includes(char)).toBe(true);
    }
  });

  it('enforces no repeat rule for adjacent characters', () => {
    const result = generatePassword({ length: 40, lower: true, upper: false, digits: false, symbols: false, noRepeat: true });
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i]).not.toBe(result[i - 1]);
    }
  });

  it('always contains characters from each selected category', () => {
    const result = generatePassword({ length: 20, lower: true, upper: true, digits: true, symbols: true });
    expect(hasCharFromSet(result, CHAR_SETS.lower)).toBe(true);
    expect(hasCharFromSet(result, CHAR_SETS.upper)).toBe(true);
    expect(hasCharFromSet(result, CHAR_SETS.digits)).toBe(true);
    expect(hasCharFromSet(result, CHAR_SETS.symbols)).toBe(true);
  });

  it('ensures coverage for short lengths without overwriting categories', () => {
    const deterministicRandom = createSequenceRandomIndex([0, 0, 0, 0, 0, 0, 1, 0]);
    const result = generatePassword({
      length: 3,
      lower: true,
      upper: true,
      digits: true,
      symbols: false,
      randomIndex: deterministicRandom,
    });
    expect(result).toHaveLength(3);
    expect(hasCharFromSet(result, CHAR_SETS.lower)).toBe(true);
    expect(hasCharFromSet(result, CHAR_SETS.upper)).toBe(true);
    expect(hasCharFromSet(result, CHAR_SETS.digits)).toBe(true);
  });

  it('throws when no character sets are enabled', () => {
    expect(() => generatePassword({ length: 16, lower: false, upper: false, digits: false, symbols: false })).toThrow();
  });

  it('throws when the requested length is shorter than the number of enabled categories', () => {
    expect(() => generatePassword({
      length: 2,
      lower: true,
      upper: true,
      digits: true,
      symbols: true,
    })).toThrow('Password length must be at least the number of enabled character sets.');
  });
});

describe('generatePassphrase', () => {
  it('returns the requested number of words separated by the delimiter', () => {
    const result = generatePassphrase({ wordCount: 6, delimiter: '.' });
    const parts = result.split('.');
    expect(parts).toHaveLength(6);
  });

  it('capitalizes words when requested', () => {
    const result = generatePassphrase({ wordCount: 4, capitalizeWords: true, delimiter: ' ' });
    const parts = result.split(' ');
    for (const token of parts) {
      if (/^[A-Za-z]/.test(token)) {
        expect(token[0]).toMatch(/[A-Z]/);
      }
    }
  });

  it('injects a number token when includeNumberWord is enabled', () => {
    const result = generatePassphrase({ wordCount: 5, includeNumberWord: true, excludeSimilar: true, delimiter: ' ' });
    const parts = result.split(' ');
    const numericTokens = parts.filter((token) => /^\d$/.test(token));
    expect(numericTokens.length).toBeGreaterThanOrEqual(1);
    for (const token of numericTokens) {
      for (const char of token) {
        expect(SIMILAR_CHARACTERS.has(char)).toBe(false);
      }
    }
  });

  it('injects a symbol token when includeSymbolWord is enabled', () => {
    const result = generatePassphrase({ wordCount: 5, includeSymbolWord: true, noAmbiguous: true, delimiter: ' ' });
    const parts = result.split(' ');
    const symbolTokens = parts.filter((token) => token.length === 1 && CHAR_SETS.symbols.includes(token));
    expect(symbolTokens.length).toBeGreaterThanOrEqual(1);
    for (const token of symbolTokens) {
      expect(AMBIGUOUS_SYMBOLS.has(token)).toBe(false);
    }
  });

  it('allows both number and symbol tokens simultaneously', () => {
    const result = generatePassphrase({
      wordCount: 6,
      includeNumberWord: true,
      includeSymbolWord: true,
      delimiter: '-',
      excludeSimilar: true,
      noAmbiguous: true,
    });
    const parts = result.split('-');
    expect(parts.some((token) => /^\d$/.test(token))).toBe(true);
    expect(parts.some((token) => token.length === 1 && CHAR_SETS.symbols.includes(token))).toBe(true);
  });
});
