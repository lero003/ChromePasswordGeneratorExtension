// ポップアップ UI のイベントと設定保存をまとめたメインスクリプト
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
const opts = readOptionsFromUI();
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
updateStrengthView('', { lower:false, upper:false, digits:false, symbols:false, excludeSimilar:false, noAmbiguous:false });
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
['length','lower','upper','digits','symbols','excludeSimilar','noAmbiguous','noRepeat','passphraseMode','wordCount','delimiter','capitalizeWords','includeNumberWord','includeSymbolWord']
.forEach(id => {
const el = els[id];
el.addEventListener('change', () => {
syncPassphraseVisibility();
saveSettings(readOptionsFromUI());
});
});


// 初期化
(async function init(){
await loadSettings();
syncPassphraseVisibility();
generateAndShow();
})();
