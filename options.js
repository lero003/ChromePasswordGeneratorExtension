const defaults = {
length: 16,
lower: true,
upper: true,
digits: true,
symbols: false,
excludeSimilar: false,
noAmbiguous: false,
noRepeat: false,
passphraseMode: false,
wordCount: 4,
delimiter: '-',
capitalizeWords: false,
includeNumberWord: false,
includeSymbolWord: false,
};


function $(id){ return document.getElementById(id); }


async function load() {
const { pwgen_settings } = await chrome.storage.sync.get('pwgen_settings');
const data = { ...defaults, ...(pwgen_settings||{}) };
Object.keys(defaults).forEach(k => {
const el = $(k);
if (!el) return;
if (typeof el.checked === 'boolean') el.checked = Boolean(data[k]);
else if ('value' in el) el.value = data[k];
});
}


async function save() {
const data = {};
Object.keys(defaults).forEach(k => {
const el = $(k);
if (!el) return;
data[k] = (typeof el.checked === 'boolean') ? el.checked : el.value;
});
await chrome.storage.sync.set({ pwgen_settings: data });
alert('保存しました');
}


async function reset() {
await chrome.storage.sync.set({ pwgen_settings: defaults });
await load();
alert('既定値に戻しました');
}


window.addEventListener('DOMContentLoaded', () => {
load();
$('saveBtn').addEventListener('click', save);
$('resetBtn').addEventListener('click', reset);
attachDescriptions();
});


function attachDescriptions() {
const descriptions = {
length: 'desc-length',
lower: 'desc-lower',
upper: 'desc-upper',
digits: 'desc-digits',
symbols: 'desc-symbols',
excludeSimilar: 'desc-excludeSimilar',
noAmbiguous: 'desc-noAmbiguous',
noRepeat: 'desc-noRepeat',
passphraseMode: 'desc-passphraseMode',
wordCount: 'desc-wordCount',
delimiter: 'desc-delimiter',
capitalizeWords: 'desc-capitalizeWords',
includeNumberWord: 'desc-includeNumberWord',
includeSymbolWord: 'desc-includeSymbolWord',
saveBtn: 'desc-saveBtn',
resetBtn: 'desc-resetBtn',
};

Object.entries(descriptions).forEach(([id, descId]) => {
const el = $(id);
const desc = document.getElementById(descId);
if (!el || !desc) return;
el.setAttribute('aria-describedby', descId);
});
}