const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const i18nDir = path.join(ROOT, 'src/i18n/locales');
const transFile = path.join(__dirname, 'i18n-react-i18nimport-translations.json');
const trans = JSON.parse(fs.readFileSync(transFile, 'utf8'));

// Group by namespace
const byNs = {};
for (const [k, v] of Object.entries(trans)) {
  const [ns, ...rest] = k.split('.');
  const subKey = rest.join('.');
  if (!byNs[ns]) byNs[ns] = {};
  byNs[ns][subKey] = v;
}

const locales = ['zh-CN', 'en', 'zh-HK', 'zh-TW', 'ja', 'ko', 'fr', 'de', 'it', 'es', 'ru'];
for (const loc of locales) {
  const fp = path.join(i18nDir, loc + '.json');
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  for (const [ns, keys] of Object.entries(byNs)) {
    if (!data[ns]) data[ns] = {};
    Object.assign(data[ns], keys);
  }
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${loc}: +${Object.keys(trans).length} keys`);
}
