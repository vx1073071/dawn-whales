/**
 * P0-11: Factor Calculator Mapping Analyzer
 * LOBEHUB R244 — 后端管线虾
 *
 * 分析240因子与6个Calculator文件的映射关系。
 * 输出: 映射表 (factorId → calculator file → function → status)
 *       统计: 完整/缺失/存根/幽灵
 *
 * 6 Calculator文件:
 *   1. green-factor-calculators.ts — 牛市因子
 *   2. yellow-factor-calculators.ts — 中性因子
 *   3. market-yellow-calculators.ts — 市场特定
 *   4. pro-factor-calculators.ts — 高级因子
 *   5. factor-calculator-stubs.ts — 存根
 *   6. WasmFactorCalculator.ts — WASM加速(22核心)
 */

import * as fs from 'fs';
import * as path from 'path';

const ENGINE_DIR = 'C:/Users/vx107/.easyclaw/workspace/quant-moo/electron/engine';
const FACTORS_DIR = path.join(ENGINE_DIR, 'factors');
const REGISTRY_FILE = path.join(FACTORS_DIR, 'factor-id-registry.ts');

// ── 1. 从注册表提取240因子ID ─────────────────────────────────────

interface FactorEntry {
  id: string;
  nameEn: string;
  nameCn: string;
  level1: string;
  level2: string;
}

function extractRegistryFactors(content: string): FactorEntry[] {
  const factors: FactorEntry[] = [];
  // 匹配 FACTOR_SPEC 数组中的条目
  const specMatch = content.match(/const FACTOR_SPEC[^=]*=\s*\[([\s\S]*?)\];/);
  if (!specMatch) {
    console.error('Failed to find FACTOR_SPEC in registry');
    return factors;
  }

  const specBody = specMatch[1];
  // 逐个匹配 [id, nameEn, nameCn, l1, l2]
  const entryRegex = /\['([A-Z][A-Za-z_0-9]*)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\]/g;
  let match;
  while ((match = entryRegex.exec(specBody)) !== null) {
    factors.push({
      id: match[1],
      nameEn: match[2],
      nameCn: match[3],
      level1: match[4],
      level2: match[5],
    });
  }
  return factors;
}

// ── 2. 从Calculator文件提取函数和引用的因子 ───────────────────────

interface CalcFunction {
  name: string;
  sourceFile: string;
  lineNumber: number;
  referencedFactorIds: string[];
}

interface CalcFileAnalysis {
  file: string;
  sizeBytes: number;
  lineCount: number;
  functions: CalcFunction[];
  uniqueReferencedIds: string[];
}

const CALC_FILES = [
  'green-factor-calculators.ts',
  'yellow-factor-calculators.ts',
  'market-yellow-calculators.ts',
  'pro-factor-calculators.ts',
  'factor-calculator-stubs.ts',
  'WasmFactorCalculator.ts',
];

function analyzeCalcFile(filePath: string): CalcFileAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // 提取函数/导出
  const functions: CalcFunction[] = [];
  const funcRegex = /(?:export\s+(?:async\s+)?function\s+|export\s+const\s+)([a-zA-Z_]\w*)/g;
  let funcMatch;
  while ((funcMatch = funcRegex.exec(content)) !== null) {
    const funcName = funcMatch[1];
    const lineNumber = content.substring(0, funcMatch.index).split('\n').length;

    // 在函数体内搜索引用的因子ID（在函数接下来的~50行内）
    const funcStart = funcMatch.index;
    const funcEnd = Math.min(funcStart + 3000, content.length);
    const funcBody = content.substring(funcStart, funcEnd);

    const idRegex = /['"]([A-Z][A-Z_0-9]{2,50})['"]/g;
    const referencedIds: string[] = [];
    let idMatch;
    while ((idMatch = idRegex.exec(funcBody)) !== null) {
      const id = idMatch[1];
      // 过滤掉非因子ID的字符串
      if (/^[A-Z][A-Z_0-9]{2,}$/.test(id) &&
          !['ERROR','OK','GET','POST','PUT','DEL','ALL','NEW',
            'API','URL','JSON','XML','UTC','ISO','GMT','PDF','CSV',
            'BUY','SELL','YES','YESNO','NONE','NULL','TRUE','FALSE'].includes(id)) {
        referencedIds.push(id);
      }
    }
    functions.push({ name: funcName, sourceFile: path.basename(filePath), lineNumber, referencedFactorIds: [...new Set(referencedIds)] });
  }

  // 全文件中提取所有看起来像因子ID的字符串
  const allIdRegex = /['"]([A-Z][A-Z_0-9]{2,50})['"]/g;
  const allIds = new Set<string>();
  let allMatch;
  while ((allMatch = allIdRegex.exec(content)) !== null) {
    const id = allMatch[1];
    if (/^[A-Z][A-Z_0-9]{2,}$/.test(id) &&
        !['ERROR','OK','GET','POST','PUT','DEL','ALL','NEW',
          'API','URL','JSON','XML','UTC','ISO','GMT','PDF','CSV',
          'BUY','SELL','YES','NO','NONE','NULL','TRUE','FALSE',
          'Strong','Moderate','export','type','interface','readonly',
          'private','public','static','extends','implements',
          'Seasonality','Default'].includes(id)) {
      allIds.add(id);
    }
  }

  return {
    file: path.basename(filePath),
    sizeBytes: content.length,
    lineCount: lines.length,
    functions,
    uniqueReferencedIds: [...allIds],
  };
}

// ── 3. 交叉匹配 ──────────────────────────────────────────────────

interface MappingResult {
  factorId: string;
  nameEn: string;
  nameCn: string;
  level1: string;
  level2: string;
  mappings: {
    file: string;
    functions: string[];
    directMatch: boolean;   // 函数名直接引用因子ID
    fuzzyMatch: boolean;    // 函数体中出现因子ID
  }[];
  hasAnyMatch: boolean;
  matchCount: number;
  status: 'complete' | 'partial' | 'stub_only' | 'missing' | 'wasm_only';
}

function generateMapping(
  registryFactors: FactorEntry[],
  calcAnalyses: CalcFileAnalysis[],
): { results: MappingResult[]; stats: Record<string, number> } {

  const results: MappingResult[] = [];

  for (const factor of registryFactors) {
    const mappings: MappingResult['mappings'] = [];

    for (const calc of calcAnalyses) {
      const directFunctions = calc.functions.filter(f =>
        f.referencedFactorIds.includes(factor.id) ||
        f.name.toUpperCase().includes(factor.id.toUpperCase())
      );
      const fuzzyFunctions = calc.functions.filter(f =>
        !directFunctions.includes(f) &&
        f.referencedFactorIds.some(id =>
          id.includes(factor.id) || factor.id.includes(id))
      );

      const allFuncs = [...new Set([
        ...directFunctions.map(f => f.name),
        ...fuzzyFunctions.map(f => f.name),
      ])];

      mappings.push({
        file: calc.file,
        functions: allFuncs,
        directMatch: directFunctions.length > 0,
        fuzzyMatch: fuzzyFunctions.length > 0,
      });
    }

    const matchCount = mappings.filter(m => m.directMatch || m.fuzzyMatch).length;
    const stubOnly = mappings.some(m => m.file === 'factor-calculator-stubs.ts' && (m.directMatch || m.fuzzyMatch));
    const wasmOnly = !matchCount && mappings.some(m => m.file === 'WasmFactorCalculator.ts' && (m.directMatch || m.fuzzyMatch));

    let status: MappingResult['status'];
    if (matchCount > 0 && !stubOnly) status = 'complete';
    else if (matchCount > 0 && stubOnly) status = 'stub_only';
    else if (wasmOnly) status = 'wasm_only';
    else if (matchCount > 0) status = 'partial';
    else status = 'missing';

    results.push({
      factorId: factor.id,
      nameEn: factor.nameEn,
      nameCn: factor.nameCn,
      level1: factor.level1,
      level2: factor.level2,
      mappings,
      hasAnyMatch: matchCount > 0,
      matchCount,
      status,
    });
  }

  const stats: Record<string, number> = {};
  for (const r of results) {
    stats[r.status] = (stats[r.status] || 0) + 1;
  }

  return { results, stats };
}

// ── 4. 生成报告 ──────────────────────────────────────────────────

function generateReport(results: MappingResult[], stats: Record<string, number>): string {
  const total = results.length;
  const matched = results.filter(r => r.hasAnyMatch).length;
  const complete = stats.complete || 0;
  const partial = stats.partial || 0;
  const stubOnly = stats.stub_only || 0;
  const wasmOnly = stats.wasm_only || 0;
  const missing = stats.missing || 0;

  let report = `# QUANT MOO Factor Calculator 映射分析报告

> R244 P0-11 | LOBEHUB | 引擎层分析
> ${new Date().toISOString().split('T')[0]}

---

## 总览

| 指标 | 值 |
|------|:--:|
| 因子注册总数 | **${total}** |
| 有 Calculator | **${matched}** (${((matched/total)*100).toFixed(1)}%) |
| 缺失 Calculator | **${missing}** (${((missing/total)*100).toFixed(1)}%) |

## 状态分布

| 状态 | 数量 | 占比 |
|------|:--:|:--:|
| ✅ 完整映射 | ${complete} | ${((complete/total)*100).toFixed(1)}% |
| 🟡 部分映射 | ${partial} | ${((partial/total)*100).toFixed(1)}% |
| 📦 存根(Stub) | ${stubOnly} | ${((stubOnly/total)*100).toFixed(1)}% |
| 🖥️ WASM仅 | ${wasmOnly} | ${((wasmOnly/total)*100).toFixed(1)}% |
| ❌ 缺失 | ${missing} | ${((missing/total)*100).toFixed(1)}% |

## Calculator文件覆盖

| 文件 | 引用的因子数 | 占比 |
|------|:--:|:--:|
`;

  const analyses = analyzeAll();
  for (const a of analyses) {
    report += `| ${a.file} | ${a.uniqueReferencedIds.length} | ${((a.uniqueReferencedIds.length/total)*100).toFixed(1)}% |\n`;
  }

  report += `
---

## ❌ 缺失Calculator的因子

> 以下因子在6个Calculator文件中均无匹配，需要补充计算实现。

| # | ID | 名称 | 中文 | 大类 | 建议文件 |
|--:|-----|------|------|------|------|
`;

  let idx = 1;
  for (const r of results) {
    if (r.status === 'missing') {
      const recFile = recommendFile(r.level1);
      report += `| ${idx++} | \`${r.factorId}\` | ${r.nameEn} | ${r.nameCn} | ${r.level1} | ${recFile} |\n`;
    }
  }

  // 存根因子
  report += `
## 📦 仅有存根(Stub)的因子

> 在factor-calculator-stubs.ts中有定义但无实际计算逻辑。

| # | ID | 名称 | 中文 | 大类 |
|--:|-----|------|------|------|
`;
  idx = 1;
  for (const r of results) {
    if (r.status === 'stub_only') {
      report += `| ${idx++} | \`${r.factorId}\` | ${r.nameEn} | ${r.nameCn} | ${r.level1} |\n`;
    }
  }

  // 按L1大类汇总
  report += `
## 按L1大类汇总

| L1大类 | 总数 | 完整 | 部分 | 存根 | 缺失 | 覆盖率 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
`;

  for (const l1 of [...new Set(results.map(r => r.level1))].sort()) {
    const items = results.filter(r => r.level1 === l1);
    const c = items.filter(i => i.status === 'complete').length;
    const p = items.filter(i => i.status === 'partial').length;
    const s = items.filter(i => i.status === 'stub_only').length;
    const m = items.filter(i => i.status === 'missing').length;
    report += `| ${l1} | ${items.length} | ${c} | ${p} | ${s} | ${m} | ${((1-m/items.length)*100).toFixed(0)}% |\n`;
  }

  report += `
---

## 修复建议优先级

### P0 (立即修复 — 阻断用户操作)
${results.filter(r => r.status === 'missing').slice(0, 10).map(r => `- \`${r.factorId}\` → 建议添加到 \`${recommendFile(r.level1)}\``).join('\n')}

### P1 (本周内)
- 存根因子(${stubOnly}个): 至少在factor-calculator-stubs.ts中提供基础计算实现
- 部分映射(${partial}个): 补充缺失的Compute函数

### P2 (功能增强)
- WASM-only(${wasmOnly})个: 添加JS fallback实现，确保非WASM环境可用

---

> 生成时间: ${new Date().toISOString()}
> 分析工具: R244 P0-11 Calculator Mapping Analyzer (LOBEHUB)
`;

  return report;
}

function recommendFile(l1: string): string {
  const map: Record<string, string> = {
    'L1_CLASSIC': 'factor-calculator.ts',
    'L1_FUNDAMENTAL': 'green-factor-calculators.ts',
    'L1_ANALYST': 'yellow-factor-calculators.ts',
    'L1_SENTIMENT': 'yellow-factor-calculators.ts',
    'L1_TECHNICAL': 'green-factor-calculators.ts',
    'L1_RISK': 'pro-factor-calculators.ts',
    'L1_MACRO': 'yellow-factor-calculators.ts',
    'L1_REVERSAL': 'WasmFactorCalculator.ts',
    'L1_US': 'market-yellow-calculators.ts',
    'L1_HK': 'market-yellow-calculators.ts',
    'L1_CRYPTO': 'market-yellow-calculators.ts',
    'L1_CROSS_ASSET': 'pro-factor-calculators.ts',
    'L1_EVENT': 'yellow-factor-calculators.ts',
    'L1_ESG': 'pro-factor-calculators.ts',
    'L1_LEGACY': 'factor-calculator-stubs.ts',
    'L1_COMMODITY': 'factor-calculator.ts',
  };
  return map[l1] || 'green-factor-calculators.ts';
}

let cachedAnalyses: CalcFileAnalysis[] | null = null;
function analyzeAll(): CalcFileAnalysis[] {
  if (cachedAnalyses) return cachedAnalyses;
  cachedAnalyses = [];
  for (const f of CALC_FILES) {
    const filePath = path.join(FACTORS_DIR, f);
    if (fs.existsSync(filePath)) {
      cachedAnalyses.push(analyzeCalcFile(filePath));
    }
  }
  return cachedAnalyses;
}

// ── Main ──────────────────────────────────────────────────────────

function main() {
  console.log('=== QUANT MOO Factor Calculator Mapping Analyzer ===');
  console.log('R244 P0-11 | LOBEHUB\n');

  // 读取注册表
  const registryContent = fs.readFileSync(REGISTRY_FILE, 'utf-8');
  const factors = extractRegistryFactors(registryContent);
  console.log(`Registry: ${factors.length} factors extracted from factor-id-registry.ts`);

  // 分析Calculator文件
  const calcAnalyses = analyzeAll();
  console.log(`\nCalculator files analyzed: ${calcAnalyses.length}`);
  for (const a of calcAnalyses) {
    console.log(`  ${a.file}: ${a.lineCount}L, ${a.functions.length} functions, ${a.uniqueReferencedIds.length} unique IDs`);
  }

  // 生成映射
  const { results, stats } = generateMapping(factors, calcAnalyses);

  console.log('\n=== Mapping Results ===');
  console.log(`Total: ${results.length}`);
  console.log(`Complete: ${stats.complete || 0} | Partial: ${stats.partial || 0} | Stub: ${stats.stub_only || 0} | WASM: ${stats.wasm_only || 0} | Missing: ${stats.missing || 0}`);

  // 缺失列表
  const missing = results.filter(r => r.status === 'missing');
  if (missing.length > 0) {
    console.log(`\n=== Missing (${missing.length}) ===`);
    missing.forEach(r => console.log(`  [${r.level1}] ${r.factorId} — ${r.nameEn} (${r.nameCn})`));
  }

  // 存根列表
  const stubs = results.filter(r => r.status === 'stub_only');
  if (stubs.length > 0) {
    console.log(`\n=== Stub Only (${stubs.length}) ===`);
    stubs.forEach(r => console.log(`  [${r.level1}] ${r.factorId} — ${r.nameEn} (${r.nameCn})`));
  }

  // 生成报告
  const report = generateReport(results, stats);
  const reportPath = 'C:/Users/vx107/.easyclaw/workspace/quant-moo/docs/audits/R244-factor-calculator-mapping-report.md';
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\nReport written: ${reportPath}`);

  // 生成机器可读JSON
  const jsonPath = 'C:/Users/vx107/.easyclaw/workspace/quant-moo/docs/audits/R244-factor-calculator-mapping.json';
  fs.writeFileSync(jsonPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalFactors: factors.length,
    stats,
    results: results.map(r => ({
      factorId: r.factorId,
      nameEn: r.nameEn,
      nameCn: r.nameCn,
      level1: r.level1,
      level2: r.level2,
      status: r.status,
      matchCount: r.matchCount,
      matchedIn: r.mappings.filter(m => m.directMatch || m.fuzzyMatch).map(m => m.file),
    })),
  }, null, 2), 'utf-8');
  console.log(`JSON written: ${jsonPath}`);
}

main();
