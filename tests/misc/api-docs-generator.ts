#!/usr/bin/env node
// tests/api-docs-generator.ts
// Generate Markdown API documentation from TypeScript source files
// Run: npx tsx tests/api-docs-generator.ts [engine-dir]

import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────

interface ApiItem {
  name: string;
  kind: 'class' | 'function' | 'interface' | 'type' | 'enum' | 'const';
  signature: string;
  description: string;
  params?: { name: string; type: string; description: string }[];
  returns?: string;
  example?: string;
}

interface ModuleDocs {
  module: string;
  file: string;
  description: string;
  items: ApiItem[];
}

// ── Parser ────────────────────────────────────────────────────────

/** Extract doc comments from a TypeScript source file */
function extractDocs(filePath: string): ModuleDocs {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  const module = path.basename(filePath, '.ts');
  const file = filePath;

  const items: ApiItem[] = [];

  // Match JSDoc-style comments
  const commentRe = /\/\*\*([\s\S]*?)\*\/\s*(export\s+(?:class|function|interface|type|enum|const|async\s+function)\s+(\w+)|(?:export\s+)?(?:class|function|interface|type|enum|const|async\s+function)\s+(\w+))/g;

  let match: RegExpExecArray | null;
  while ((match = commentRe.exec(content)) !== null) {
    const raw = match[1] || '';
    const name = match[2] || match[3] || match[4] || '';
    const isExport = !!match[2] || !!match[4];

    if (!name || !isExport) continue;

    const kind = detectKind(content, name);
    const description = extractDescription(raw);
    const params = extractParams(raw);
    const returns = extractReturns(raw);
    const example = extractExample(raw);

    items.push({ name, kind, signature: extractSignature(content, name), description, params, returns, example });
  }

  const moduleDesc = extractModuleDescription(content);

  return { module, file, description: moduleDesc, items };
}

function detectKind(content: string, name: string): ApiItem['kind'] {
  if (/\bclass\s+\w+\b/.test(content)) return 'class';
  if (/\b(?:type|interface)\s+${name}\b/.test(content)) return 'interface';
  if (/\benum\s+${name}\b/.test(content)) return 'enum';
  return 'function';
}

function extractDescription(raw: string): string {
  const lines = raw.split('\n')
    .map(l => l.replace(/^\s*\*\s?/, '').replace(/^\s*@.*/, '').trim())
    .filter(Boolean);
  return lines.join(' ').slice(0, 200);
}

function extractParams(raw: string): ApiItem['params'] {
  const params: ApiItem['params'] = [];
  const re = /@param\s+(?:\{([^}]+)\}\s+)?(\w+)\s+-\s+(.+)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    params.push({ type: m[1] || 'any', name: m[2], description: m[3].replace(/\s+/g, ' ').trim() });
  }
  return params;
}

function extractReturns(raw: string): string | undefined {
  const m = /@returns?\s+-\s+(.+)/.exec(raw);
  return m ? m[1].replace(/\s+/g, ' ').trim() : undefined;
}

function extractExample(raw: string): string | undefined {
  const m = /@example\s*\n([\s\S]*?)(?=@|$)/.exec(raw);
  if (!m) return undefined;
  return m[1].split('\n').map(l => l.replace(/^\s*\*?\s*/, '')).join('\n').trim();
}

function extractSignature(content: string, name: string): string {
  // Find the export declaration line
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes(`export`) && line.includes(name)) {
      return line.replace(/\s+/g, ' ').trim();
    }
  }
  return name;
}

function extractModuleDescription(content: string): string {
  const m = /\/\*\*\s*\n([\s\S]*?)\*\//.exec(content);
  if (!m) return '';
  return m[1].split('\n')
    .map(l => l.replace(/^\s*\*\s?/, '').replace(/^\s*@.*/, '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 300);
}

// ── Markdown Generator ────────────────────────────────────────────

function toMarkdown(docs: ModuleDocs[]): string {
  const lines: string[] = [];
  const title = 'DAWN WHALES — API Reference';
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString().split('T')[0]} | ${docs.length} modules`);
  lines.push('');
  lines.push('## Table of Contents');
  for (const d of docs) {
    if (d.items.length > 0) {
      lines.push(`- [${d.module}](#${d.module.replace(/\./g, '-')})`);
    }
  }
  lines.push('');

  for (const d of docs) {
    if (d.items.length === 0) continue;

    lines.push(`## ${d.module}`);
    lines.push('');
    if (d.description) {
      lines.push(`_${d.description}_`);
      lines.push('');
    }
    lines.push(`**File:** \`${d.file.replace(/\\/g, '/')}\``);
    lines.push('');

    for (const item of d.items) {
      lines.push(`### \`${item.name}\``);
      lines.push('');
      lines.push(`**Kind:** ${item.kind}  `);

      if (item.description) {
        lines.push('');
        lines.push(item.description);
      }

      if (item.params && item.params.length > 0) {
        lines.push('');
        lines.push('**Parameters**');
        lines.push('');
        lines.push('| Name | Type | Description |');
        lines.push('|------|------|-------------|');
        for (const p of item.params) {
          lines.push(`| \`${p.name}\` | \`${p.type}\` | ${p.description} |`);
        }
      }

      if (item.returns) {
        lines.push('');
        lines.push(`**Returns:** \`${item.returns}\` — ${item.returns}`);
      }

      if (item.example) {
        lines.push('');
        lines.push('**Example**');
        lines.push('');
        lines.push('```typescript');
        lines.push(item.example);
        lines.push('```');
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  const engineDir = process.argv[2] || 'electron/engine';
  const outPath = process.argv[3] || 'docs/API.md';

  if (!fs.existsSync(engineDir)) {
    console.error(`Directory not found: ${engineDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(engineDir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => path.join(engineDir, f))
    .sort();

  console.log(`Scanning ${files.length} TypeScript files...`);

  const docs = files.map(f => extractDocs(f)).filter(d => d.items.length > 0);

  console.log(`Found ${docs.reduce((s, d) => s + d.items.length, 0)} exported items in ${docs.length} modules`);

  const md = toMarkdown(docs);
  fs.writeFileSync(outPath, md, 'utf-8');
  console.log(`API docs written to: ${outPath}`);

  // Also print summary
  for (const d of docs) {
    if (d.items.length > 0) {
      console.log(`  ${d.module}: ${d.items.map(i => i.name).join(', ')}`);
    }
  }
}

main();
