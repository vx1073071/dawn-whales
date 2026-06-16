/**
 * validate-factor-calculator-mapping.ts - R226→R246 FIX: 240因子Calculator映射全量校验
 *
 * Validates every canonical factor ID in factor-id-registry.ts maps to a
 * Calculator implementation (or safe stub). Outputs a detailed report to
 * docs/audits/R226-factor-calculator-map.md
 *
 * R246 FIX (Claw PM): Replaced 4 loose regex patterns that falsely matched
 * type names/variable names as "factor references" with precise factorId:
 * extraction — aligned with FactorCalculatorValidator. Previously reported
 * 100% false coverage; now reports true Calculator coverage.
 *
 * Matching rules (exact, same as FactorCalculatorValidator):
 *   1. factorId: 'XXX' — direct reference in createFactorCalculator() calls
 *   2. super({ factorId: 'XXX' — class-based calculator constructor calls
 *   3. PRO_FACTOR_CALCULATORS registry key matching
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────

interface FactorEntry {
  id: string;
  nameEn: string;
  nameCn: string;
  level1: string;
  level2: string;
}

interface CalculatorMatch {
  factorId: string;
  calculatorFile: string;
  calculatorName: string;
  matchType: 'direct' | 'stub' | 'unmapped';
  lineNumber?: number;
}

interface ValidationReport {
  timestamp: string;
  totalFactors: number;
  mapped: number;
  unmapped: number;
  stubCount: number;
  coveragePercent: string;
  details: CalculatorMatch[];
  byLevel1: Record<string, { total: number; mapped: number }>;
}

// ─── Parse Registry ──────────────────────────────────────────────────

function parseFactorRegistry(registryPath: string): FactorEntry[] {
  const content = fs.readFileSync(registryPath, 'utf-8');
  const facts: FactorEntry[] = [];

  // Parse FACTOR_SPEC entries
  const specMatch = content.match(/const FACTOR_SPEC:.*?=\s*\[([\s\S]*?)\];/);
  if (!specMatch) return facts;

  const specContent = specMatch[1];
  const entryRegex = /\['([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\]/g;

  let match;
  while ((match = entryRegex.exec(specContent)) !== null) {
    facts.push({
      id: match[1],
      nameEn: match[2],
      nameCn: match[3],
      level1: match[4],
      level2: match[5],
    });
  }

  return facts;
}

// ─── Scan Calculator Files (R246 FIX: precise factorId extraction only) ──

function scanCalculatorFiles(
  calcDirs: string[]
): Map<string, { path: string; name: string; line: number }[]> {
  const calcMap = new Map<string, { path: string; name: string; line: number }[]>();

  // R246 FIX: Only exact factorId references — no loose type/variable name matching.
  // These 3 patterns are aligned with FactorCalculatorValidator's extraction logic.
  const factorIdRegexes = [
    // Pattern 1: factorId: 'XXX' — used in createFactorCalculator() calls
    /factorId:\s*'([A-Z0-9_]+)'/g,
    // Pattern 2: super({ factorId: 'XXX' — used in class-based calculators
    /super\(\{\s*factorId:\s*'([A-Z0-9_]+)'/g,
  ];

  for (const dir of calcDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f =>
      f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.includes('.test.')
    );

    for (const file of files) {
      const fp = path.join(dir, file);
      const content = fs.readFileSync(fp, 'utf-8');

      for (const regex of factorIdRegexes) {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(content)) !== null) {
          const id = match[1];
          if (/^[A-Z][A-Z0-9_]+$/.test(id) && id.length >= 2) {
            const lineNum = content.substring(0, match.index).split('\n').length;

            const existing = calcMap.get(id) || [];
            if (!existing.find(e => e.path === fp)) {
              existing.push({ path: fp, name: id, line: lineNum });
              calcMap.set(id, existing);
            }
          }
        }
      }

      // Pattern 3: PRO_FACTOR_CALCULATORS object keys (class-based registry)
      // Matches lines like: "  EBITDA_EV: EBITDA_EV_Calculator,"
      if (file.includes('pro-factor-calculators')) {
        const proRegistryRegex = /^\s*([A-Z][A-Z0-9_]+):\s*\1_Calculator,/gm;
        let m;
        while ((m = proRegistryRegex.exec(content)) !== null) {
          const id = m[1];
          if (id.length >= 2) {
            const lineNum = content.substring(0, m.index).split('\n').length;
            const existing = calcMap.get(id) || [];
            if (!existing.find(e => e.path === fp)) {
              existing.push({ path: fp, name: id, line: lineNum });
              calcMap.set(id, existing);
            }
          }
        }
      }
    }
  }

  return calcMap;
}

// ─── Generate Stub File ─────────────────────────────────────────────

function generateAllStubs(factors: FactorEntry[], existingIds: Set<string>): string {
  const missing = factors.filter(f => !existingIds.has(f.id));

  const lines: string[] = [
    '/**',
    ' * factor-calculator-stubs.ts - R226 JVS-1.2b: Safe Calculator Stubs',
    ' *',
    ` * Auto-generated stubs for ${missing.length} factors without dedicated calculators.`,
    ' * Each stub returns a friendly "data unavailable" result instead of crashing.',
    ' *',
    ' * Generated by validate-factor-calculator-mapping.ts',
    ` * ${new Date().toISOString()}`,
    ' */',
    '',
    "import type { FactorCalcContext, FactorCalcResult } from './factor-calculator-types';",
    "import { i18n } from '../core/i18n';",
    '',
    '// ─── Generated Safe Stubs ─────────────────────────────────────',
    '',
  ];

  // Group by level1
  const byL1 = new Map<string, FactorEntry[]>();
  for (const f of missing) {
    const list = byL1.get(f.level1) || [];
    list.push(f);
    byL1.set(f.level1, list);
  }

  for (const [l1, facts] of byL1) {
    lines.push(`// ── ${l1} (${facts.length} stubs) ──`);
    lines.push('');

    for (const f of facts) {
      lines.push(`/** ${f.nameCn} - ${f.nameEn} */`);
      lines.push(`export function calc${f.id}(ctx: FactorCalcContext): FactorCalcResult {`);
      lines.push(`  return {`);
      lines.push(`    factorId: '${f.id}',`);
      lines.push(`    value: null,`);
      lines.push(`    confidence: 0,`);
      lines.push(`    status: 'unavailable' as const,`);
      lines.push(`    reason: 'stub_data_not_available',`);
      lines.push(`    message: i18n.t('factor.stub.${f.id}', '${f.nameCn}数据暂不可用，我们正在接入数据源'),`);
      lines.push(`    timestamp: Date.now(),`);
      lines.push(`    level1: '${f.level1}',`);
      lines.push(`    level2: '${f.level2}',`);
      lines.push(`  };`);
      lines.push(`}`);
      lines.push('');
    }
  }

  lines.push('/**');
  lines.push(' * STUB_REGISTRY: maps every stubbed factor ID to its stub function.');
  lines.push(' * Used by the unified calculator dispatcher to resolve any factor.');
  lines.push(' */');
  lines.push('export const STUB_REGISTRY: Record<string, (ctx: FactorCalcContext) => FactorCalcResult> = {');
  for (const f of missing) {
    const escapedCn = f.nameCn.replace(/'/g, "\\'");
    lines.push(`  '${f.id}': calc${f.id},  // ${escapedCn}`);
  }
  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

// ─── Generate Report ────────────────────────────────────────────────

function generateReport(report: ValidationReport, factors: FactorEntry[]): string {
  const lines: string[] = [];
  lines.push('# R226 因子 Calculator 映射验证报告');
  lines.push('');
  lines.push(`**生成时间**: ${report.timestamp}`);
  lines.push(`**总因子数**: ${report.totalFactors}`);
  lines.push(`**已映射**: ${report.mapped} (${report.coveragePercent})`);
  lines.push(`**安全Stub**: ${report.stubCount}`);
  lines.push(`**未映射**: ${report.unmapped}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 按大类统计');
  lines.push('');
  lines.push('| L1 大类 | 总数 | 已映射 | 覆盖率 |');
  lines.push('|---------|------|--------|--------|');

  for (const [l1, stats] of Object.entries(report.byLevel1).sort()) {
    const pct = stats.total > 0 ? ((stats.mapped / stats.total) * 100).toFixed(0) : '0';
    const emoji = stats.mapped === stats.total ? '✅' : stats.mapped > stats.total * 0.5 ? '⚠️' : '❌';
    lines.push(`| ${emoji} ${l1.replace('L1_', '')} | ${stats.total} | ${stats.mapped} | ${pct}% |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 未映射因子详情');
  lines.push('');

  const unmapped = report.details.filter(d => d.matchType === 'unmapped');
  if (unmapped.length === 0) {
    lines.push('✅ 全部240因子已有映射或安全stub，无误。');
  } else {
    lines.push(`共 ${unmapped.length} 个因子缺少 Calculator 实现：`);
    lines.push('');
    lines.push('| 因子ID | 中文名 | L1大类 | L2子类 |');
    lines.push('|--------|--------|--------|--------|');
    for (const d of unmapped) {
      const f = factors.find(x => x.id === d.factorId);
      if (f) {
        lines.push(`| ${d.factorId} | ${f.nameCn} | ${f.level1} | ${f.level2} |`);
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 已映射因子 (前50)');
  lines.push('');

  const mapped = report.details.filter(d => d.matchType === 'direct');
  lines.push('| 因子ID | 计算器文件 | 类型 |');
  lines.push('|--------|-----------|------|');
  for (const d of mapped.slice(0, 50)) {
    const shortFile = d.calculatorFile.replace(/.*[\\/]/, '');
    lines.push(`| ${d.factorId} | ${shortFile}:${d.lineNumber} | ${d.matchType} |`);
  }

  if (mapped.length > 50) {
    lines.push(`| ... | ... (共${mapped.length}个) | ... |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Report generated by R226 JVS-1.2a validate-factor-calculator-mapping.ts*`);

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────

function main(): void {
  console.log('R226 JVS-1.2a: Factor Calculator Mapping Validator\n');

  const projectRoot = process.cwd();
  const registryPath = path.join(projectRoot, 'electron', 'engine', 'factors', 'factor-id-registry.ts');

  if (!fs.existsSync(registryPath)) {
    console.error(`Registry not found: ${registryPath}`);
    process.exit(1);
  }

  // 1. Parse registry
  const factors = parseFactorRegistry(registryPath);
  console.log(`Parsed ${factors.length} factor IDs from registry`);

  // 2. Scan calculator files
  const calcDirs = [
    path.join(projectRoot, 'electron', 'engine', 'factors'),
    path.join(projectRoot, 'electron', 'engine', 'data'),
    path.join(projectRoot, 'electron', 'engine', 'analysis'),
  ];

  const calcMap = scanCalculatorFiles(calcDirs);
  console.log(`Found references to ${calcMap.size} factor IDs in calculator files`);

  // 3. Match each factor to calculator (R246 FIX: only count REAL calculator matches)
  const existingIds = new Set(calcMap.keys());
  const details: CalculatorMatch[] = [];
  const byLevel1: Record<string, { total: number; mapped: number }> = {};

  for (const factor of factors) {
    byLevel1[factor.level1] = byLevel1[factor.level1] || { total: 0, mapped: 0 };
    byLevel1[factor.level1].total++;

    if (existingIds.has(factor.id)) {
      const calcs = calcMap.get(factor.id)!;
      for (const c of calcs) {
        details.push({
          factorId: factor.id,
          calculatorFile: c.path,
          calculatorName: c.name,
          matchType: 'direct',
          lineNumber: c.line,
        });
      }
      byLevel1[factor.level1].mapped++;  // Only count REAL calculator matches
    } else {
      details.push({
        factorId: factor.id,
        calculatorFile: 'factor-calculator-stubs.ts (auto-generated)',
        calculatorName: `calc${factor.id}`,
        matchType: 'unmapped',
      });
      // NOT incrementing byLevel1.mapped — stubs are not real calculators
    }
  }

  // 4. Generate stub file
  const stubContent = generateAllStubs(factors, existingIds);
  const stubPath = path.join(projectRoot, 'electron', 'engine', 'factors', 'factor-calculator-stubs.ts');
  fs.writeFileSync(stubPath, stubContent, 'utf-8');

  const stubCount = factors.filter(f => !existingIds.has(f.id)).length;
  console.log(`Generated ${stubCount} safe stubs → ${stubPath}`);

  // 5. Build report (R246 FIX: separate real coverage from stubs)
  const totalMapped = factors.filter(f => existingIds.has(f.id)).length;
  const stubOnly = factors.filter(f => !existingIds.has(f.id)).length;

  // REAL coverage = direct matches only (not including auto-stubs)
  const realCoveragePct = (totalMapped / factors.length * 100).toFixed(1) + '%';
  // WITH stubs = everything has at least a stub
  const withStubPct = ((totalMapped + stubOnly) / factors.length * 100).toFixed(1) + '%';

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    totalFactors: factors.length,
    mapped: totalMapped,
    unmapped: factors.length - totalMapped - stubOnly,
    stubCount: stubOnly,
    coveragePercent: realCoveragePct,  // R246 FIX: report REAL coverage, not stub-inflated
    details,
    byLevel1,
  };

  // 6. Write report
  const reportContent = generateReport(report, factors);
  const reportDir = path.join(projectRoot, 'docs', 'audits');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, 'R226-factor-calculator-map.md');
  fs.writeFileSync(reportPath, reportContent, 'utf-8');

  console.log(`Report written: ${reportPath}`);
  console.log(`\nResults: ${totalMapped} real calculators + ${stubOnly} stubs = ${withStubPct} total`);
  console.log(`REAL coverage (direct Calculator matches only): ${realCoveragePct}`);
  if (stubOnly > 0) {
    console.log(`⚠️  ${stubOnly} factors have NO real Calculator — only auto-generated stubs`);
  }

  // Summary (R246 FIX: show REAL coverage, not stub-inflated)
  console.log('\n=== REAL Coverage by L1 (direct Calculator matches, no stubs) ===');
  for (const [l1, stats] of Object.entries(byLevel1).sort()) {
    // Recalculate without stub contamination:
    // byLevel1.mapped currently includes stubs. Need to compute real-only per L1.
    const realMapped = factors.filter(f =>
      f.level1 === l1 && existingIds.has(f.id)
    ).length;
    const pct = stats.total > 0 ? (realMapped / stats.total * 100).toFixed(0) : '0';
    const bar = realMapped === stats.total ? '✅' : realMapped > stats.total * 0.5 ? '⚠️' : '❌';
    console.log(`  ${bar} ${l1.padEnd(18)} ${realMapped}/${stats.total} (${pct}%)`);
  }
}

main();
