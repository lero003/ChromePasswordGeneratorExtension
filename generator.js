const DEFAULT_PASSWORD_OPTIONS = {
  length: 16,
  lower: true,
  upper: true,
  digits: true,
  symbols: false,
  excludeSimilar: false,
  noAmbiguous: false,
  noRepeat: false,
};

const DEFAULT_PASSPHRASE_OPTIONS = {
  wordCount: 4,
  delimiter: '-',
  capitalizeWords: false,
  includeNumberWord: false,
  includeSymbolWord: false,
  excludeSimilar: false,
  noAmbiguous: false,
};

const CHAR_SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
};

const SIMILAR_CHARACTERS = new Set(['0', 'O', 'o', '1', 'l', 'I', '5', 'S', '2', 'Z', '8', 'B']);
const AMBIGUOUS_SYMBOLS = new Set(['{', '}', '[', ']', '(', ')', '/', '\\', "'", '"', '`', '~', ',', ';', ':', '.', '<', '>']);

const WORD_LIST = [
  'acorn', 'amber', 'anchor', 'apex', 'aster', 'aurora', 'badge', 'bamboo', 'beacon', 'binary', 'blossom', 'breeze',
  'canyon', 'cascade', 'cedar', 'citadel', 'cobalt', 'coral', 'crystal', 'dawn', 'delta', 'dune', 'ember', 'falcon',
  'fable', 'flint', 'forest', 'galaxy', 'garnet', 'glimmer', 'grove', 'harbor', 'harvest', 'horizon', 'hydra', 'inspire',
  'iris', 'island', 'jade', 'journey', 'juniper', 'keystone', 'lagoon', 'lantern', 'legend', 'lilac', 'meadow', 'meteor',
  'nebula', 'nectar', 'onyx', 'oracle', 'oxygen', 'pebble', 'pinnacle', 'plume', 'prism', 'quartz', 'quill', 'raven',
  'ripple', 'saffron', 'solstice', 'spruce', 'stellar', 'summit', 'sunrise', 'tidal', 'topaz', 'umbra', 'valor', 'velvet',
  'vertex', 'violet', 'voyage', 'willow', 'wisdom', 'xenon', 'yonder', 'zenith'
];

function ensureCrypto() {
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    return globalThis.crypto;
  }
  try {
    // eslint-disable-next-line global-require
    const { webcrypto } = require('node:crypto');
    if (webcrypto && typeof webcrypto.getRandomValues === 'function') {
      return webcrypto;
    }
  } catch (error) {
    // ignore and throw below
  }
  throw new Error('Secure random generator is not available.');
}

const cryptoObj = ensureCrypto();

function randomIndex(max) {
  if (max <= 0) throw new Error('Random index range must be positive.');
  const array = new Uint32Array(1);
  const upperBound = Math.floor(0xffffffff / max) * max;
  let value;
  do {
    cryptoObj.getRandomValues(array);
    value = array[0];
  } while (value >= upperBound);
  return value % max;
}

function filterCharacters(characters, options) {
  let filtered = Array.from(characters);
  if (options.excludeSimilar) {
    filtered = filtered.filter((ch) => !SIMILAR_CHARACTERS.has(ch));
  }
  if (options.noAmbiguous && characters === CHAR_SETS.symbols) {
    filtered = filtered.filter((ch) => !AMBIGUOUS_SYMBOLS.has(ch));
  }
  return filtered.join('');
}

function normalizeLength(value, min, max, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  const length = Math.floor(parsed);
  if (!Number.isFinite(length)) return fallback;
  return Math.min(Math.max(length, min), max);
}

function buildActiveCategories(options) {
  const categories = [];
  if (options.lower) {
    const chars = filterCharacters(CHAR_SETS.lower, options);
    if (!chars) throw new Error('No lower-case characters available.');
    categories.push({ key: 'lower', chars });
  }
  if (options.upper) {
    const chars = filterCharacters(CHAR_SETS.upper, options);
    if (!chars) throw new Error('No upper-case characters available.');
    categories.push({ key: 'upper', chars });
  }
  if (options.digits) {
    const chars = filterCharacters(CHAR_SETS.digits, options);
    if (!chars) throw new Error('No digits available.');
    categories.push({ key: 'digits', chars });
  }
  if (options.symbols) {
    const chars = filterCharacters(CHAR_SETS.symbols, options);
    if (!chars) throw new Error('No symbols available.');
    categories.push({ key: 'symbols', chars });
  }
  return categories;
}

function ensureCategoryCoverage(result, categories, options, rng = randomIndex) {
  if (result.length < categories.length) {
    throw new Error('Password length must be at least the number of enabled character sets.');
  }

  const counts = new Map(categories.map((category) => [category.key, 0]));
  const indexCategories = result.map((char) => {
    const matched = categories.find((category) => category.chars.includes(char));
    if (matched) {
      counts.set(matched.key, (counts.get(matched.key) || 0) + 1);
      return matched.key;
    }
    return null;
  });

  for (const category of categories) {
    if ((counts.get(category.key) || 0) > 0) {
      continue;
    }

    let placed = false;
    for (let attempt = 0; attempt < 400 && !placed; attempt += 1) {
      const replacementIndex = rng(result.length);
      const currentKey = indexCategories[replacementIndex];
      if (currentKey && (counts.get(currentKey) || 0) <= 1) {
        continue;
      }

      const candidateIndex = rng(category.chars.length);
      const candidate = category.chars[candidateIndex];

      if (options.noRepeat) {
        const prev = replacementIndex > 0 ? result[replacementIndex - 1] : null;
        const next = replacementIndex < result.length - 1 ? result[replacementIndex + 1] : null;
        if ((prev && prev === candidate) || (next && next === candidate)) {
          continue;
        }
      }

      if (currentKey) {
        counts.set(currentKey, (counts.get(currentKey) || 0) - 1);
      }
      result[replacementIndex] = candidate;
      indexCategories[replacementIndex] = category.key;
      counts.set(category.key, (counts.get(category.key) || 0) + 1);
      placed = true;
    }

    if (!placed) {
      throw new Error('Failed to satisfy required character categories.');
    }
  }
}

function generatePassword(inputOptions = {}) {
  const options = { ...DEFAULT_PASSWORD_OPTIONS, ...inputOptions };
  const randomIndexOverride = options.randomIndex;
  if (randomIndexOverride) {
    delete options.randomIndex;
  }
  options.length = normalizeLength(options.length, 1, 128, DEFAULT_PASSWORD_OPTIONS.length);
  const categories = buildActiveCategories(options);
  if (categories.length === 0) {
    throw new Error('At least one character set must be enabled.');
  }
  if (options.length < categories.length) {
    throw new Error('Password length must be at least the number of enabled character sets.');
  }
  const pool = categories.map((category) => category.chars).join('');
  if (!pool) {
    throw new Error('No characters available for generation.');
  }

  const rng = typeof randomIndexOverride === 'function'
    ? (max) => {
      const value = randomIndexOverride(max);
      if (!Number.isInteger(value) || value < 0 || value >= max) {
        throw new Error('randomIndex override must return an integer within range.');
      }
      return value;
    }
    : randomIndex;

  const passwordChars = [];
  while (passwordChars.length < options.length) {
    const candidate = pool[rng(pool.length)];
    if (options.noRepeat && passwordChars.length > 0) {
      const previous = passwordChars[passwordChars.length - 1];
      if (candidate === previous) {
        continue;
      }
    }
    passwordChars.push(candidate);
  }

  ensureCategoryCoverage(passwordChars, categories, options, rng);
  return passwordChars.join('');
}

function generatePassphrase(inputOptions = {}) {
  const options = { ...DEFAULT_PASSPHRASE_OPTIONS, ...inputOptions };
  options.wordCount = normalizeLength(options.wordCount, 3, 12, DEFAULT_PASSPHRASE_OPTIONS.wordCount);
  const delimiter = typeof options.delimiter === 'string' && options.delimiter.length > 0
    ? options.delimiter.slice(0, 2)
    : DEFAULT_PASSPHRASE_OPTIONS.delimiter;

  const words = [];
  for (let i = 0; i < options.wordCount; i += 1) {
    const word = WORD_LIST[randomIndex(WORD_LIST.length)];
    if (options.capitalizeWords) {
      words.push(word.charAt(0).toUpperCase() + word.slice(1));
    } else {
      words.push(word);
    }
  }

  const occupiedPositions = new Set();
  if (options.includeNumberWord) {
    const digits = filterCharacters(CHAR_SETS.digits, options);
    if (!digits) throw new Error('No digits available for passphrase.');
    const index = randomIndex(words.length);
    words[index] = digits[randomIndex(digits.length)];
    occupiedPositions.add(index);
  }

  if (options.includeSymbolWord) {
    const symbols = filterCharacters(CHAR_SETS.symbols, options);
    if (!symbols) throw new Error('No symbols available for passphrase.');
    let index;
    do {
      index = randomIndex(words.length);
    } while (occupiedPositions.has(index) && occupiedPositions.size < words.length);
    words[index] = symbols[randomIndex(symbols.length)];
    occupiedPositions.add(index);
  }

  return words.join(delimiter);
}

const exported = {
  generatePassword,
  generatePassphrase,
  filterCharacters,
  CHAR_SETS,
  SIMILAR_CHARACTERS,
  AMBIGUOUS_SYMBOLS,
  WORD_LIST,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}

if (typeof window !== 'undefined') {
  window.generatePassword = generatePassword;
  window.generatePassphrase = generatePassphrase;
  window.pwGenerator = exported;
}
