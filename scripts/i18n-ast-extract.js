/**
 * i18n AST-based CJK extraction
 * Uses Babel parser to safely find and replace CJK in JSX text and string literals
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const SRC = path.join(__dirname, '..', 'src');
const LOCALE_DIR = path.join(SRC, 'i18n', 'locales');
const SKIP_DIRS = new Set(['node_modules','dist','i18n','locales','coverage','.next','.git']);
const SKIP_FILES = new Set(['i18n-data.ts','i18n-data-complete.ts']);

// Load locales
const zhLocale = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, 'zh-CN.json'), 'utf8'));
const zhHkLocale = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, 'zh-HK.json'), 'utf8'));
const enLocale = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, 'en.json'), 'utf8'));

let totalReplaced = 0;
let filesModified = 0;

function getImportPath(filePath) {
  const fileDir = path.dirname(filePath);
  const i18nFile = path.join(SRC, 'i18n', 'index.ts');
  let rel = path.relative(fileDir, i18nFile).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  rel = rel.replace(/\.ts$/, '');
  return rel;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(SRC, filePath).replace(/\\/g, '/');
  const baseName = path.basename(filePath).replace(/\.\w+$/, '');
  
  if (!CJK_RE.test(content)) return;

  let ast;
  try {
    ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch (e) {
    console.log(`  SKIP ${relPath}: parse error: ${e.message.substring(0, 80)}`);
    return;
  }

  let modified = false;
  let needsImport = false;
  const replacements = [];

  traverse(ast, {
    // Handle JSX text: >Chinese text<
    JSXText(p) {
      const val = p.node.value;
      if (!CJK_RE.test(val)) return;
      // Skip if already wrapped in i18n.t
      const trimmed = val.trim();
      if (trimmed.length < 1) return;
      
      const key = `${baseName}.r92_${crypto.randomBytes(2).toString('hex')}`;
      zhLocale[key] = trimmed;
      zhHkLocale[key] = trimmed;
      enLocale[key] = trimmed;
      
      // Replace JSXText with JSXExpressionContainer containing i18n.t()
      p.replaceWith(
        t.jsxExpressionContainer(
          t.callExpression(
            t.memberExpression(t.identifier('i18n'), t.identifier('t')),
            [t.stringLiteral(key)]
          )
        )
      );
      modified = true;
      needsImport = true;
      totalReplaced++;
    },

    // Handle StringLiteral in JSX attributes: title="Chinese"
    StringLiteral(p) {
      const val = p.node.value;
      if (!CJK_RE.test(val)) return;
      if (val.length < 2) return;
      // Skip if parent is an import
      if (p.parentPath.isImportDeclaration()) return;
      // Skip if already inside i18n.t() call
      if (p.parentPath.isCallExpression() && 
          p.parentPath.node.callee &&
          p.parentPath.node.callee.property &&
          p.parentPath.node.callee.property.name === 't') return;
      // Skip JSON-like keys
      if (val.includes('.') && val.split('.').length > 2) return;
      // Skip if looks like a CSS value or path
      if (/^[#/.]/.test(val)) return;
      // Skip very short CJK segments
      const cjkChars = val.match(/[\u4e00-\u9fff]/g);
      if (!cjkChars || cjkChars.length < 2) return;

      const key = `${baseName}.r92_${crypto.randomBytes(2).toString('hex')}`;
      zhLocale[key] = val;
      zhHkLocale[key] = val;
      enLocale[key] = val;
      
      const callExpr = t.callExpression(
        t.memberExpression(t.identifier('i18n'), t.identifier('t')),
        [t.stringLiteral(key)]
      );
      // If inside a JSXAttribute, wrap in JSXExpressionContainer
      if (p.parentPath.isJSXAttribute()) {
        p.replaceWith(t.jsxExpressionContainer(callExpr));
      } else {
        p.replaceWith(callExpr);
      }
      modified = true;
      needsImport = true;
      totalReplaced++;
    },

    // Handle template literals with CJK: `Chinese ${expr} text`
    TemplateLiteral(p) {
      for (const quasi of p.node.quasis) {
        if (CJK_RE.test(quasi.value.raw)) {
          // This is complex - skip for now, handle simple cases only
          const raw = quasi.value.raw;
          if (raw.length >= 2 && p.node.expressions.length === 0) {
            const key = `${baseName}.r92_${crypto.randomBytes(2).toString('hex')}`;
            zhLocale[key] = raw;
            zhHkLocale[key] = raw;
            enLocale[key] = raw;
            
            p.replaceWith(
              t.callExpression(
                t.memberExpression(t.identifier('i18n'), t.identifier('t')),
                [t.stringLiteral(key)]
              )
            );
            modified = true;
            needsImport = true;
            totalReplaced++;
          }
        }
      }
    },
  });

  if (modified) {
    let output;
    try {
      output = generate(ast, {
        retainLines: true,
        compact: false,
        jsescOption: { minimal: true },
      });
    } catch (e) {
      console.log(`  SKIP ${relPath}: generate error: ${e.message.substring(0, 80)}`);
      return;
    }

    let code = output.code;
    
    // Add i18n import if needed
    if (needsImport && !code.includes("import i18n from")) {
      const importPath = getImportPath(filePath);
      code = `import i18n from '${importPath}';\n` + code;
    }

    fs.writeFileSync(filePath, code);
    filesModified++;
    console.log(`  ✓ ${relPath}`);
  }
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const s = fs.statSync(fp);
    if (s.isDirectory()) {
      if (!SKIP_DIRS.has(f)) walk(fp);
    } else if (/\.(tsx?|jsx?)$/.test(f) && !SKIP_FILES.has(f) && !f.includes('.test.') && !f.includes('.spec.')) {
      processFile(fp);
    }
  }
}

console.log('Starting AST-based CJK extraction...\n');
walk(SRC);

// Save locales
fs.writeFileSync(path.join(LOCALE_DIR, 'zh-CN.json'), JSON.stringify(zhLocale, null, 2));
fs.writeFileSync(path.join(LOCALE_DIR, 'zh-HK.json'), JSON.stringify(zhHkLocale, null, 2));
fs.writeFileSync(path.join(LOCALE_DIR, 'en.json'), JSON.stringify(enLocale, null, 2));

console.log(`\nDone: ${totalReplaced} replacements across ${filesModified} files`);
console.log(`zh.json keys: ${Object.keys(zhLocale).length}`);
