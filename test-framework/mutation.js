// QTest Mutation Tester
// Q46: 变异测试（Mutation Testing）
//
// Usage:
//   import { runMutationTest } from './test-framework/mutation.js';
//   const report = await runMutationTest({ files: ['src/**/*.ts'], testRunner: './run-qtest.js' });
//
// CLI:
//   node --input-type=module < test-framework/mutation.js run --files 'src/**/*.ts'

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

// ============ Mutation operators ============

export const MUTATION_OPERATORS = [
  {
    name: 'Conditional Bounder Flip',
    description: 'Flip < to >=, > to <=, etc.',
    apply: (code) => {
      const map = { '<': '<=', '>': '>=', '<=': '<', '>=': '>', '===': '!==', '!==': '===' };
      let result = code;
      for (const [from, to] of Object.entries(map)) {
        result = result.split(' ' + from + ' ').join(' ' + to + ' ');
      }
      return result === code ? null : result;
    },
  },
  {
    name: 'Arithmetic Operator Mutation',
    description: 'Replace + with -, * with /, etc.',
    apply: (code) => {
      const ops = ['+', '-', '*', '/', '%'];
      let result = code;
      let mutated = false;
      for (const op of ops) {
        const re = new RegExp('\\\\' + op + '(?= )', 'g');
        if (result.includes(' ' + op + ' ')) {
          const replacements = ops.filter(o => o !== op);
          const randOp = replacements[Math.floor(Math.random() * replacements.length)];
          result = result.replace(' ' + op + ' ', ' ' + randOp + ' ');
          mutated = true;
          break;
        }
      }
      return mutated ? result : null;
    },
  },
  {
    name: 'Boolean Literal Mutation',
    description: 'Replace true with false and vice versa.',
    apply: (code) => {
      let result = code.replace(/\btrue\b/g, '__Q_MUT_BOOL__');
      result = result.replace(/\bfalse\b/g, 'true');
      result = result.replace(/__Q_MUT_BOOL__/g, 'false');
      return result === code ? null : result;
    },
  },
  {
    name: 'Number Literal Mutation',
    description: 'Replace numbers with boundary values.',
    apply: (code) => {
      const nums = [...code.matchAll(/\b(\d+(\.\d+)?)\b/g)];
      if (nums.length === 0) return null;
      const replacements = [0, 1, -1, 99999];
      const idx = Math.floor(Math.random() * nums.length);
      const m = nums[idx];
      const num = parseFloat(m[1]);
      if (isNaN(num)) return null;
      const repl = replacements[Math.floor(Math.random() * replacements.length)];
      return code.replace(m[1], String(repl));
    },
  },
  {
    name: 'String Literal Deletion',
    description: 'Replace string literals with empty string.',
    apply: (code) => {
      if (!code.includes("'") && !code.includes('"')) return null;
      let result = code.replace(/'[^']*'/, "''");
      return result === code ? null : result;
    },
  },
];

// ============ Core mutation logic ============

export async function runMutationTest({ files, testRunner, testFiles, timeout = 10000 } = {}) {
  const allFiles = await expandGlob(files);
  const mutationResults = [];
  let totalMutants = 0;
  let killed = 0;
  let survived = 0;
  let errored = 0;
  const details = [];

  for (const file of allFiles) {
    const code = await readFile(file, 'utf-8');
    const mutants = generateMutants(code, file);
    totalMutants += mutants.length;

    for (const mutant of mutants) {
      const { name, mutatedCode, operator, line } = mutant;
      const tmpFile = file + '.mutation.tmp';
      try {
        await writeFile(tmpFile, mutatedCode, 'utf-8');
        const result = await runTestAgainst(tmpFile, testRunner, testFiles, timeout);

        if (result.killed) {
          killed++;
        } else if (result.survived) {
          survived++;
        } else {
          errored++;
        }

        details.push({
          file,
          line,
          operator: name,
          killed: result.killed,
          survived: result.survived,
          error: result.error,
        });
      } finally {
        try { await writeFile(file, code, 'utf-8'); } catch {}
        try { execSync('del "' + tmpFile + '"', { stdio: 'ignore' }); } catch {}
      }
    }
  }

  const score = totalMutants > 0 ? Math.round(killed / totalMutants * 100) : 0;
  return {
    totalMutants,
    killed,
    survived,
    errored,
    score,
    details,
    summary: { killed, survived, errored, score },
  };
}

function generateMutants(code, filePath) {
  const mutants = [];
  for (const op of MUTATION_OPERATORS) {
    const mutated = op.apply(code);
    if (mutated && mutated !== code) {
      mutants.push({
        name: op.name,
        description: op.description,
        operator: op.name,
        mutatedCode: mutated,
        file: filePath,
        line: findFirstDiffLine(code, mutated),
      });
    }
  }
  return mutants;
}

function findFirstDiffLine(original, mutated) {
  const oLines = original.split('\n');
  const mLines = mutated.split('\n');
  for (let i = 0; i < Math.min(oLines.length, mLines.length); i++) {
    if (oLines[i] !== mLines[i]) return i + 1;
  }
  return 0;
}

async function runTestAgainst(mutatedFile, testRunner, testFiles, timeout) {
  try {
    const result = execSync('node "' + mutatedFile + '"', { timeout, encoding: 'utf-8', stdio: 'pipe' });
    return { killed: false, survived: true, error: null };
  } catch (e) {
    if (e.status !== undefined) {
      return { killed: e.status !== 0, survived: e.status === 0, error: null };
    }
    return { killed: false, survived: false, error: e.message };
  }
}

async function expandGlob(patterns) {
  const files = [];
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const base = pattern.split('*')[0] || '.';
      const ext = pattern.endsWith('.ts') ? '.ts' : '.js';
      await collectFiles(base, ext, files);
    } else {
      files.push(pattern);
    }
  }
  return [...new Set(files)];
}

async function collectFiles(dir, ext, files) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      await collectFiles(fullPath, ext, files);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
}

// ============ HTML Report ============

export function generateMutationReport(result, outputPath) {
  const { totalMutants, killed, survived, errored, score, details } = result;
  const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Mutation Score: ' + score + '%</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; padding: 0; }\n    body { font-family: -apple-system, sans-serif; background: #0f1117; color: #c9d1d9; padding: 2rem; }\n    h1 { color: ' + (score > 80 ? '#3fb950' : score > 50 ? '#d29922' : '#f85149') + '; }\n    .score { font-size: 4rem; font-weight: 700; }\n    .cards { display: flex; gap: 1rem; margin: 2rem 0; flex-wrap: wrap; }\n    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.5rem; min-width: 120px; }\n    .card .label { color: #8b949e; font-size: 0.8rem; }\n    .card .value { font-size: 1.8rem; font-weight: 700; }\n    .card.killed .value { color: #3fb950; }\n    .card.survived .value { color: #f85149; }\n    .card.errored .value { color: #d29922; }\n    table { width: 100%; border-collapse: collapse; margin-top: 2rem; }\n    th { background: #1c2128; color: #8b949e; font-size: 0.8rem; text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #30363d; }\n    td { padding: 0.5rem 1rem; border-bottom: 1px solid #21262d; font-size: 0.85rem; font-family: monospace; }\n    .killed-row { color: #3fb950; }\n    .survived-row { color: #f85149; }\n    .errored-row { color: #d29922; }\n    .badge { padding: 0.15rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }\n    .badge.killed { background: rgba(63,185,80,0.15); color: #3fb950; }\n    .badge.survived { background: rgba(248,81,73,0.15); color: #f85149; }\n    .badge.errored { background: rgba(210,153,34,0.15); color: #d29922; }\n  </style>\n</head>\n<body>\n  <h1>Mutation Testing Report</h1>\n  <div class="score">' + score + '%</div>\n  <div class="cards">\n    <div class="card killed"><div class="label">Killed</div><div class="value">' + killed + '</div></div>\n    <div class="card survived"><div class="label">Survived</div><div class="value">' + survived + '</div></div>\n    <div class="card errored"><div class="label">Errored</div><div class="value">' + errored + '</div></div>\n    <div class="card"><div class="label">Total</div><div class="value">' + totalMutants + '</div></div>\n  </div>\n  <table>\n    <tr><th>File</th><th>Line</th><th>Operator</th><th>Status</th></tr>\n    ' + details.map(d => '\n    <tr class="' + (d.killed ? 'killed' : d.survived ? 'survived' : 'errored') + '-row">\n      <td>' + d.file + '</td><td>' + d.line + '</td><td>' + d.operator + '</td>\n      <td><span class="badge ' + (d.killed ? 'killed' : d.survived ? 'survived' : 'errored') + '">' + (d.killed ? 'KILLED' : d.survived ? 'SURVIVED' : 'ERROR') + '</span></td>\n    </tr>').join('') + '\n  </table>\n</body>\n</html>';
  const path = outputPath || resolve('mutation-score.html');
  writeFile(path, html, 'utf-8');
  return path;
}

export default { runMutationTest, generateMutationReport, MUTATION_OPERATORS };
