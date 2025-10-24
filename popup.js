const WORD_LIST = [
  'apple','anchor','autumn','breeze','bridge','candle','canvas','cherry','cloud','cobalt',
  'daisy','delta','ember','feather','forest','galaxy','garden','harbor','honey','island',
  'ivory','jungle','lantern','lemon','meadow','meteor','mist','moon','mountain','nebula',
  'oasis','ocean','opal','orchid','panda','pearl','piano','poppy','prairie','quartz',
  'quill','raven','river','saffron','shadow','sprout','star','stone','sunset','thunder',
  'tiger','valley','velvet','violet','walnut','willow','winter','zenith','zephyr','zinnia'
];

const SYMBOLS_BASE = "!\"#$%&'()*+,-./:;<=>?@[\\]^_{|}~";
const AMBIGUOUS_SYMBOLS = new Set("{}[]()/\\'\"`~,;:.<>");
const SIMILAR_CHARS = new Set(['0', 'O', 'o', '1', 'l', 'I', 'S', '5', '2', 'Z']);

const els = (() => {
  const ids = [
    'output','generateBtn','copyBtn','strengthBar','strengthLabel','length','lower','upper','digits','symbols',
    'excludeSimilar','noAmbiguous','noRepeat','passphraseMode','wordCount','delimiter','capitalizeWords',
    'includeNumberWord','includeSymbolWord'
  ];
  const map = Object.create(null);
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`必要な要素 #${id} が見つかりません`);
    }
    map[id] = el;
  });
  map.passphraseRows = Array.from(document.querySelectorAll('.passphrase'));
  return map;
})();


function cryptoRandomInt(max) {
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error('乱数の上限が不正です');
  }
  const rangeLimit = Math.floor((0x100000000 / max)) * max;
  const buf = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= rangeLimit);
  return value % max;
}


function pickRandom(arrayLike) {
  if (!arrayLike.length) {
    throw new Error('候補が存在しません');
  }
  const index = cryptoRandomInt(arrayLike.length);
  return arrayLike[index];
}


function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = cryptoRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


function readOptionsFromUI() {
  const length = parseInt(els.length.value, 10);
  if (!Number.isInteger(length) || length < Number(els.length.min) || length > Number(els.length.max)) {
    throw new Error('長さは6〜128の整数で入力してください');
  }

  const wordCount = parseInt(els.wordCount.value, 10);
  if (!Number.isInteger(wordCount) || wordCount < Number(els.wordCount.min) || wordCount > Number(els.wordCount.max)) {
    throw new Error('単語数は3〜12の整数で入力してください');
  }

  const delimiter = els.delimiter.value ?? '';
  if (delimiter.length > parseInt(els.delimiter.maxLength ?? 2, 10)) {
    throw new Error('区切りは最大2文字までです');
  }

  return {
    length,
    lower: Boolean(els.lower.checked),
    upper: Boolean(els.upper.checked),
    digits: Boolean(els.digits.checked),
    symbols: Boolean(els.symbols.checked),
    excludeSimilar: Boolean(els.excludeSimilar.checked),
    noAmbiguous: Boolean(els.noAmbiguous.checked),
    noRepeat: Boolean(els.noRepeat.checked),
    passphraseMode: Boolean(els.passphraseMode.checked),
    wordCount,
    delimiter,
    capitalizeWords: Boolean(els.capitalizeWords.checked),
    includeNumberWord: Boolean(els.includeNumberWord.checked),
    includeSymbolWord: Boolean(els.includeSymbolWord.checked),
  };
}


function buildCharSet(opts) {
  let lower = 'abcdefghijklmnopqrstuvwxyz';
  let upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let digits = '0123456789';
  let symbols = SYMBOLS_BASE;

  if (opts.excludeSimilar) {
    const filterSimilar = str => str.split('').filter(ch => !SIMILAR_CHARS.has(ch)).join('');
    lower = filterSimilar(lower);
    upper = filterSimilar(upper);
    digits = filterSimilar(digits);
  }

  if (opts.noAmbiguous) {
    symbols = symbols.split('').filter(ch => !AMBIGUOUS_SYMBOLS.has(ch)).join('');
  }

  const groups = [];
  if (opts.lower && lower.length) groups.push(lower);
  if (opts.upper && upper.length) groups.push(upper);
  if (opts.digits && digits.length) groups.push(digits);
  if (opts.symbols && symbols.length) groups.push(symbols);

  if (!groups.length) {
    throw new Error('少なくとも1種類の文字を選択してください');
  }

  return groups;
}


function generatePassword(opts) {
  const groups = buildCharSet(opts);
  const pool = groups.join('');
  if (opts.length < groups.length) {
    throw new Error('長さが不足しています。より長い値を指定してください');
  }

  const resultChars = [];
  groups.forEach(group => {
    resultChars.push(pickRandom(group));
  });

  while (resultChars.length < opts.length) {
    let ch;
    do {
      ch = pickRandom(pool);
    } while (opts.noRepeat && resultChars.length && ch === resultChars[resultChars.length - 1] && pool.length > 1);
    resultChars.push(ch);
  }

  shuffleInPlace(resultChars);

  if (opts.noRepeat) {
    for (let i = 1; i < resultChars.length; i += 1) {
      if (resultChars[i] === resultChars[i - 1]) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const replacement = pickRandom(pool);
          if (replacement !== resultChars[i - 1]) {
            resultChars[i] = replacement;
            break;
          }
        }
      }
    }
  }

  return resultChars.join('');
}


function applyCapitalization(word) {
  if (!word) return word;
  return word[0].toUpperCase() + word.slice(1);
}


function generatePassphrase(opts) {
  if (!WORD_LIST.length) {
    throw new Error('単語リストが空です');
  }

  const tokens = [];
  for (let i = 0; i < opts.wordCount; i += 1) {
    let word = pickRandom(WORD_LIST);
    if (opts.capitalizeWords) {
      word = applyCapitalization(word);
    }
    tokens.push(word);
  }

  if (opts.includeNumberWord) {
    tokens.push(String(cryptoRandomInt(10)));
  }

  if (opts.includeSymbolWord) {
    const availableSymbols = opts.noAmbiguous
      ? SYMBOLS_BASE.split('').filter(ch => !AMBIGUOUS_SYMBOLS.has(ch))
      : SYMBOLS_BASE.split('');
    tokens.push(pickRandom(availableSymbols));
  }

  shuffleInPlace(tokens);

  return tokens.join(opts.delimiter);
}


function estimateEntropy(text, opts) {
  if (!text) return 0;
  if (opts.passphraseMode) {
    let entropy = opts.wordCount * Math.log2(WORD_LIST.length);
    if (opts.includeNumberWord) entropy += Math.log2(10);
    if (opts.includeSymbolWord) {
      const symbolPool = opts.noAmbiguous
        ? SYMBOLS_BASE.split('').filter(ch => !AMBIGUOUS_SYMBOLS.has(ch))
        : SYMBOLS_BASE.split('');
      entropy += Math.log2(symbolPool.length);
    }
    return entropy;
  }

  const groups = buildCharSet(opts);
  const uniqueChars = new Set(groups.join('').split(''));
  return text.length * Math.log2(uniqueChars.size);
}


function updateStrengthView(text, opts) {
  const entropy = Number.isFinite(opts.entropyOverride) ? opts.entropyOverride : estimateEntropy(text, opts);
  if (!text) {
    els.strengthBar.style.width = '0%';
    els.strengthBar.style.background = 'var(--danger)';
    els.strengthLabel.textContent = '強度: - / 推定エントロピー: - bit';
    return;
  }
  let label = '-';
  let color = 'var(--danger)';
  const thresholds = [
    { limit: 28, label: '弱い', color: 'var(--danger)' },
    { limit: 45, label: '普通', color: '#f59e0b' },
    { limit: 60, label: '強い', color: '#10b981' },
    { limit: Infinity, label: '非常に強い', color: 'var(--accent)' },
  ];

  for (const item of thresholds) {
    if (entropy <= item.limit) {
      label = item.label;
      color = item.color;
      break;
    }
  }

  const progress = Math.max(0, Math.min(100, Math.round((entropy / 80) * 100)));
  els.strengthBar.style.width = `${progress}%`;
  els.strengthBar.style.background = color;
  els.strengthLabel.textContent = `強度: ${label} / 推定エントロピー: ${entropy ? entropy.toFixed(1) : '-'} bit`;
}


function syncPassphraseVisibility() {
  const show = els.passphraseMode.checked;
  els.passphraseRows.forEach(row => {
    row.classList.toggle('show', show);
  });
}


async function saveSettings(opts) {
  try { await chrome.storage.sync.set({ pwgen_settings: opts }); } catch {}
}


async function loadSettings() {
  try {
    const { pwgen_settings } = await chrome.storage.sync.get('pwgen_settings');
    if (pwgen_settings) {
      Object.entries(pwgen_settings).forEach(([k, v]) => {
        if (k in els) {
          const el = els[k];
          if (typeof el.checked === 'boolean') el.checked = Boolean(v);
          else if ('value' in el) el.value = v;
        }
      });
    }
  } catch {}
}


function generateAndShow() {
  let opts;
  try {
    opts = readOptionsFromUI();
  } catch (e) {
    els.output.value = '';
    updateStrengthView('', { passphraseMode: false, entropyOverride: 0 });
    alert(e.message || '設定の読み取りに失敗しました');
    return;
  }

  let text = '';
  try {
    if (opts.passphraseMode) {
      text = generatePassphrase(opts);
    } else {
      text = generatePassword(opts);
    }
    els.output.value = text;
    updateStrengthView(text, opts);
    saveSettings(opts);
  } catch (e) {
    els.output.value = '';
    updateStrengthView('', { passphraseMode: false, entropyOverride: 0 });
    alert(e.message || '生成に失敗しました');
  }
}


async function copyToClipboard() {
  const val = els.output.value;
  if (!val) return;
  try {
    await navigator.clipboard.writeText(val);
    els.copyBtn.textContent = 'コピー済み✔';
    setTimeout(() => (els.copyBtn.textContent = 'コピー'), 900);
  } catch {
    // フォールバック
    els.output.select();
    document.execCommand('copy');
  }
}


// イベント
els.generateBtn.addEventListener('click', generateAndShow);
els.copyBtn.addEventListener('click', copyToClipboard);
[
  'length','lower','upper','digits','symbols','excludeSimilar','noAmbiguous','noRepeat','passphraseMode','wordCount','delimiter',
  'capitalizeWords','includeNumberWord','includeSymbolWord'
].forEach(id => {
  const el = els[id];
  el.addEventListener('change', () => {
    syncPassphraseVisibility();
    try {
      saveSettings(readOptionsFromUI());
    } catch {}
  });
});


// 初期化
(async function init(){
  await loadSettings();
  syncPassphraseVisibility();
  generateAndShow();
})();

