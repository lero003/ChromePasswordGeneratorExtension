const generatorModule = window.pwGenerator;
if (!generatorModule) {
  throw new Error('Password generator module failed to load.');
}

const {
  generatePassword: coreGeneratePassword,
  generatePassphrase: coreGeneratePassphrase,
  filterCharacters,
  CHAR_SETS,
  WORD_LIST,
} = generatorModule;

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


function buildActiveGroups(opts) {
  const groups = [];
  if (opts.lower) groups.push(filterCharacters(CHAR_SETS.lower, opts));
  if (opts.upper) groups.push(filterCharacters(CHAR_SETS.upper, opts));
  if (opts.digits) groups.push(filterCharacters(CHAR_SETS.digits, opts));
  if (opts.symbols) groups.push(filterCharacters(CHAR_SETS.symbols, opts));
  return groups.filter(group => typeof group === 'string' && group.length > 0);
}


function estimateEntropy(text, opts) {
  if (!text) return 0;
  if (opts.passphraseMode) {
    let entropy = opts.wordCount * Math.log2(WORD_LIST.length);
    if (opts.includeNumberWord) {
      const digits = filterCharacters(CHAR_SETS.digits, opts);
      if (digits.length) {
        entropy += Math.log2(digits.length);
      }
    }
    if (opts.includeSymbolWord) {
      const symbols = filterCharacters(CHAR_SETS.symbols, opts);
      if (symbols.length) {
        entropy += Math.log2(symbols.length);
      }
    }
    return entropy;
  }

  const groups = buildActiveGroups(opts);
  if (!groups.length) return 0;
  const uniqueChars = new Set(groups.join('').split(''));
  if (!uniqueChars.size) return 0;
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
    if (!opts.passphraseMode) {
      const groups = buildActiveGroups(opts);
      if (!groups.length) {
        throw new Error('少なくとも1種類の文字を選択してください');
      }
      if (opts.length < groups.length) {
        throw new Error('長さが不足しています。より長い値を指定してください');
      }
    }
    text = opts.passphraseMode
      ? coreGeneratePassphrase(opts)
      : coreGeneratePassword(opts);
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

