#!/usr/bin/env node
/**
 * i18n React Tokenizer v4: Character-level string extraction
 * Solves the nested quote problem by parsing strings char-by-char.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const FILES = [
  'src/components/billing/onboarding/OnboardingFullKit.tsx',
  'src/components/billing/core/HelpCenter.tsx',
  'src/components/billing/core/LandingPageV18.tsx',
  'src/components/dashboard/AIDailyDigestPanel.tsx',
  'src/components/ai/AIAssistantPanel.tsx',
  'src/components/tools/DataQualityPage.tsx',
  'src/components/strategy/StrategyPage.tsx',
  'src/components/ai/AgentCollaborationPanel.tsx',
  'src/components/billing/core/ThemeLangPanel.tsx',
  'src/components/risk/SentimentDashboardPage.tsx',
  'src/components/billing/core/UIAuditPanel.tsx',
];

const CN = /[\u4e00-\u9fff]/;

function tokenizeAndReplace(content, ns) {
  const translations = {};
  let keyIdx = 0;
  let result = '';
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    // Skip block comments
    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2);
      if (end === -1) { result += content.slice(i); break; }
      result += content.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // Skip line comments
    if (ch === '/' && content[i + 1] === '/') {
      const end = content.indexOf('\n', i);
      if (end === -1) { result += content.slice(i); break; }
      result += content.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    // Skip JSX expression containers { ... } at top level — but we DO want to process strings inside {}
    // Actually, we want to process everything. The only thing we skip is comments.

    // Detect string literals
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let str = '';
      let j = i + 1;
      
      // Read until matching closing quote, handling escapes
      while (j < content.length) {
        if (content[j] === '\\') {
          str += content[j] + content[j + 1];
          j += 2;
          continue;
        }
        if (content[j] === quote) {
          // For template literals, also handle ${...} — skip them
          if (quote === '`') {
            // Check if this backtick is the real end
            break;
          }
          break;
        }
        // For template literals, handle ${...} interpolation
        if (quote === '`' && content[j] === '$' && content[j + 1] === '{') {
          // Find matching closing brace
          let depth = 1;
          let k = j + 2;
          while (k < content.length && depth > 0) {
            if (content[k] === '{') depth++;
            if (content[k] === '}') depth--;
            k++;
          }
          str += content.slice(j, k);
          j = k;
          continue;
        }
        str += content[j];
        j++;
      }

      if (j >= content.length) {
        // Unterminated string — just output as-is
        result += content.slice(i);
        break;
      }

      // Now we have the string content in `str`, from index i to j (inclusive of quotes)
      const fullString = content.slice(i, j + 1); // includes quotes

      if (CN.test(str) && quote !== '`') {
        // This string contains Chinese — replace it
        const key = `${ns}.k${++keyIdx}`;
        translations[key] = str;

        // Determine context: is this a JSX attribute value?
        // Look backwards from position i to see if there's `propName=` immediately before
        const before = result.slice(-50); // last 50 chars of result
        const attrMatch = before.match(/(\w+)=$/);

        if (attrMatch) {
          const prop = attrMatch[1];
          const skipProps = ['className', 'style', 'src', 'href', 'onClick', 'onChange', 'onSubmit', 'id', 'key', 'ref', 'type', 'name', 'method', 'target', 'rel', 'role', 'htmlFor', 'as'];
          if (skipProps.includes(prop)) {
            // Don't replace — output original string
            result += fullString;
          } else {
            // JSX attribute: prop="中文" → prop={i18n.t('key')}
            // Remove the = and replace with ={i18n.t('key')}
            result = result.slice(0, -(attrMatch[0].length)); // remove `prop=`
            result += `${prop}={i18n.t('${key}')}`;
          }
        } else {
          // Check if this is JSX text context: >...string...<
          // Look at last char of result
          const lastChar = result[result.length - 1];
          const nextChar = content[j + 1];
          if (lastChar === '>' && nextChar === '<') {
            // JSX text: >中文< → >{i18n.t('key')}<
            result += `{i18n.t('${key}')}`;
          } else {
            // Regular code context: "中文" → i18n.t('key')
            result += `i18n.t('${key}')`;
          }
        }
      } else {
        // No Chinese or template literal — output as-is
        result += fullString;
      }

      i = j + 1;
      continue;
    }

    // Regular character
    result += ch;
    i++;
  }

  return { result, translations, keys: keyIdx };
}

function addI18nImport(content, filePath) {
  const imp = `import i18n from '../../i18n';`;
  if (content.includes("import i18n from '")) return content;
  
  // Calculate relative path
  const fileDir = path.dirname(filePath);
  let rel = path.relative(fileDir, 'src/i18n').replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  const correctImp = `import i18n from '${rel}';`;
  
  const lines = content.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) lastImport = i;
  }
  lines.splice(lastImport + 1, 0, correctImp);
  return lines.join('\n');
}

function getNs(filePath) {
  return path.basename(filePath).replace(/\.(ts|tsx)$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ── Process all files ──
const allTranslations = {};
let totalRemoved = 0;

for (const file of FILES) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) { console.log(`SKIP: ${file} (not found)`); continue; }
  
  const ns = getNs(file);
  const orig = fs.readFileSync(fp, 'utf8');
  const origCn = (orig.match(/[\u4e00-\u9fff]/g) || []).length;
  
  const { result, translations, keys } = tokenizeAndReplace(orig, ns);
  
  if (keys === 0) { console.log(`SKIP: ${file} (no Chinese strings found)`); continue; }
  
  let content = addI18nImport(result, file);
  fs.writeFileSync(fp, content, 'utf8');
  
  const newCn = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  const removed = origCn - newCn;
  totalRemoved += removed;
  
  Object.assign(allTranslations, translations);
  console.log(`${file}: ${origCn} → ${newCn} (-${removed}, ${keys} keys)`);
}

console.log(`\nTotal removed: ${totalRemoved} chars`);
console.log(`Total keys: ${Object.keys(allTranslations).length}`);

// Save translations
fs.writeFileSync(path.join(__dirname, 'i18n-tokenizer-translations.json'), JSON.stringify(allTranslations, null, 2));
console.log('Translations saved.');
