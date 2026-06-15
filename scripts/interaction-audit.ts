/**
 * R225-ML#1: 全量组件交互一致性终审
 * 扫描 ~345 组件, 检测 10 维交互合规性
 * 输出: docs/audits/interaction/r225-interaction-audit.md
 */
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const COMPONENTS_DIR = path.resolve(__dirname, '..', 'src', 'components');
const OUTPUT = path.resolve(__dirname, '..', 'docs', 'audits', 'interaction', 'r225-interaction-audit.md');

interface AuditResult {
  file: string;
  hasLoading: boolean;
  hasError: boolean;
  hasEmpty: boolean;
  hasKeyboard: boolean;
  hasAria: boolean;
  hasTooltip: boolean;
  hasConfirm: boolean;
  hasFeedback: boolean;
  hasAnimation: boolean;
  hasI18n: boolean;
  issues: string[];
  score: number;
}

function analyzeComponent(filePath: string, source: string): AuditResult {
  const issues: string[] = [];
  let score = 100;

  // Check for loading state
  const hasLoading = /Loading|loading|skeleton|Skeleton|spinner|Spinner|Spin/.test(source);
  if (!hasLoading && source.includes('useEffect') && source.includes('fetch')) {
    issues.push('[Loading] 含异步fetch但无Loading状态');
    score -= 10;
  }

  // Check for error state
  const hasError = /Error|error|catch|try\s*\{|ErrorBoundary|errorBoundary/.test(source);
  if (!hasError && (source.includes('fetch') || source.includes('async'))) {
    issues.push('[Error] 含异步操作但无Error处理');
    score -= 10;
  }

  // Check for empty state
  const hasEmpty = /empty|Empty|no.?data|no.?result|no.?items|EmptyState/.test(source);
  if (!hasEmpty && (source.includes('.map(') || source.includes('.forEach('))) {
    issues.push('[Empty] 含列表渲染但无Empty状态');
    score -= 8;
  }

  // Check for keyboard support
  const hasKeyboard = /onKeyDown|onKeyUp|onKeyPress|keyboard|Keyboard|tabIndex|TabIndex/.test(source);
  if (!hasKeyboard && (source.includes('onClick') || source.includes('<button'))) {
    issues.push('[A11y] 含可点击元素但无键盘支持');
    score -= 8;
  }

  // Check for ARIA labels
  const hasAria = /aria-|role=|ariaLabel|aria-label/.test(source);
  if (!hasAria && source.includes('<div') && source.includes('onClick')) {
    issues.push('[A11y] 含交互div但无ARIA属性');
    score -= 5;
  }

  // Check for tooltips
  const hasTooltip = /Tooltip|tooltip|title=/.test(source);
  if (!hasTooltip && (source.match(/<Button|IconButton/g) || []).length > 3) {
    issues.push('[UX] 多处按钮无Tooltip');
    score -= 5;
  }

  // Check for confirm modals
  const hasConfirm = /Modal|confirm|Confirm|modal/.test(source);
  if (!hasConfirm && (source.includes('delete') || source.includes('remove') || source.includes('撤销'))) {
    issues.push('[UX] 含危险操作但无确认Modal');
    score -= 10;
  }

  // Check for user feedback
  const hasFeedback = /message\.|notification|Notification|toast|Toast/.test(source);
  if (!hasFeedback && (source.includes('onClick') || source.includes('onSubmit'))) {
    issues.push('[UX] 含用户操作但无反馈(Toast/Message)');
    score -= 5;
  }

  // Check for animations
  const hasAnimation = /transition|Transition|animate|Animate|@keyframes|animation/.test(source);
  if (!hasAnimation && source.includes('visible') && source.includes('setState')) {
    issues.push('[UX] 含状态切换但无过渡动画');
    score -= 3;
  }

  // Check for i18n usage
  const hasI18n = /useTranslation|t\(|i18n|I18nKey|\.t\(/.test(source);
  if (!hasI18n && /[\u4e00-\u9fff]/.test(source)) {
    issues.push('[i18n] 含硬编码中文但未用i18n');
    score -= 15;
  }

  return {
    file: path.relative(COMPONENTS_DIR, filePath).replace(/\\/g, '/'),
    hasLoading,
    hasError,
    hasEmpty,
    hasKeyboard,
    hasAria,
    hasTooltip,
    hasConfirm,
    hasFeedback,
    hasAnimation,
    hasI18n,
    issues,
    score: Math.max(0, score),
  };
}

async function main() {
  const files = glob.sync('src/components/**/*.tsx', {
    cwd: path.resolve(__dirname, '..'),
    absolute: true,
    ignore: ['**/*.test.*', '**/*.stories.*', '**/*.spec.*', '**/stories/**', '**/tests/**'],
  });

  const results: AuditResult[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    // Skip index files and type-only files
    const relative = path.relative(COMPONENTS_DIR, file);
    if (relative.includes('index.tsx') || source.length < 100) continue;
    results.push(analyzeComponent(file, source));
  }

  // Sort by score ascending (worst first)
  results.sort((a, b) => a.score - b.score);

  // Statistics
  const total = results.length;
  const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / total);
  const passing = results.filter(r => r.score >= 80).length;
  const failing = results.filter(r => r.score < 60).length;
  const warning = results.filter(r => r.score >= 60 && r.score < 80).length;

  const compliance = {
    loading: Math.round(results.filter(r => r.hasLoading).length / total * 100),
    error: Math.round(results.filter(r => r.hasError).length / total * 100),
    empty: Math.round(results.filter(r => r.hasEmpty).length / total * 100),
    keyboard: Math.round(results.filter(r => r.hasKeyboard).length / total * 100),
    aria: Math.round(results.filter(r => r.hasAria).length / total * 100),
    tooltip: Math.round(results.filter(r => r.hasTooltip).length / total * 100),
    confirm: Math.round(results.filter(r => r.hasConfirm).length / total * 100),
    feedback: Math.round(results.filter(r => r.hasFeedback).length / total * 100),
    animation: Math.round(results.filter(r => r.hasAnimation).length / total * 100),
    i18n: Math.round(results.filter(r => r.hasI18n).length / total * 100),
  };

  // Generate markdown report
  let report = `# R225 全量组件交互一致性终审报告

> **审计时间**: ${new Date().toISOString()}
> **审计范围**: ${total} 组件 (src/components/)
> **审计引擎**: interaction-audit.ts (10维自动检测)
> **审计人**: ML (R225-ML#1)

---

## 📊 总体评分

| 指标 | 值 |
|------|-----|
| 审计组件数 | ${total} |
| 平均得分 | **${avgScore}/100** |
| 优秀 (≥80) | ${passing} (${Math.round(passing/total*100)}%) |
| 警告 (60-79) | ${warning} (${Math.round(warning/total*100)}%) |
| 不合格 (<60) | ${failing} (${Math.round(failing/total*100)}%) |

## 📈 10维度合规率

| 维度 | 合规率 | 状态 |
|------|--------|:--:|
| Loading状态 | ${compliance.loading}% | ${compliance.loading >= 80 ? '✅' : compliance.loading >= 60 ? '⚠️' : '🔴'} |
| Error处理 | ${compliance.error}% | ${compliance.error >= 80 ? '✅' : compliance.error >= 60 ? '⚠️' : '🔴'} |
| Empty状态 | ${compliance.empty}% | ${compliance.empty >= 80 ? '✅' : compliance.empty >= 60 ? '⚠️' : '🔴'} |
| 键盘支持 | ${compliance.keyboard}% | ${compliance.keyboard >= 80 ? '✅' : compliance.keyboard >= 60 ? '⚠️' : '🔴'} |
| ARIA标签 | ${compliance.aria}% | ${compliance.aria >= 80 ? '✅' : compliance.aria >= 60 ? '⚠️' : '🔴'} |
| Tooltip提示 | ${compliance.tooltip}% | ${compliance.tooltip >= 80 ? '✅' : compliance.tooltip >= 60 ? '⚠️' : '🔴'} |
| 确认Modal | ${compliance.confirm}% | ${compliance.confirm >= 80 ? '✅' : compliance.confirm >= 60 ? '⚠️' : '🔴'} |
| 操作反馈 | ${compliance.feedback}% | ${compliance.feedback >= 80 ? '✅' : compliance.feedback >= 60 ? '⚠️' : '🔴'} |
| 过渡动画 | ${compliance.animation}% | ${compliance.animation >= 80 ? '✅' : compliance.animation >= 60 ? '⚠️' : '🔴'} |
| i18n国际化 | ${compliance.i18n}% | ${compliance.i18n >= 80 ? '✅' : compliance.i18n >= 60 ? '⚠️' : '🔴'} |

## 🎯 综合评级: **${avgScore >= 85 ? 'A (优秀)' : avgScore >= 70 ? 'B (良好)' : avgScore >= 60 ? 'C (及格)' : 'D (需改进)'}**

---

## 📋 全部组件审计明细

| # | 组件 | 得分 | L | E | Em | K | A | T | C | F | An | I | 问题 |
|---|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|------|
`;

  // Table rows
  results.forEach((r, i) => {
    const dim = (v: boolean) => v ? '✓' : '✗';
    const shortFile = r.file.split('/').pop()?.replace('.tsx', '') || r.file;
    const issuesShort = r.issues.length > 0
      ? r.issues.map(iss => iss.split('] ')[1]?.substring(0, 30)).join(', ')
      : '—';
    report += `| ${i+1} | ${shortFile} | ${r.score} | ${dim(r.hasLoading)} | ${dim(r.hasError)} | ${dim(r.hasEmpty)} | ${dim(r.hasKeyboard)} | ${dim(r.hasAria)} | ${dim(r.hasTooltip)} | ${dim(r.hasConfirm)} | ${dim(r.hasFeedback)} | ${dim(r.hasAnimation)} | ${dim(r.hasI18n)} | ${issuesShort} |\n`;
  });

  // Top issues summary
  report += `\n---\n\n## 🔴 Top 20 需修复组件\n\n`;
  const topIssues = results.filter(r => r.issues.length > 0).slice(0, 20);
  topIssues.forEach((r, i) => {
    report += `### ${i+1}. \`${r.file}\` — 得分 ${r.score}/100\n\n`;
    r.issues.forEach(iss => { report += `- ${iss}\n`; });
    report += '\n';
  });

  // Recommendations
  report += `\n---\n\n## 💡 改进建议\n\n`;
  report += `### P0 紧急 (得分<60, ${failing}个组件)\n`;
  report += `- 全部添加 Loading/Error/Empty 三态覆盖\n`;
  report += `- 清理硬编码中文, 接入 i18n\n`;
  report += `- 危险操作添加确认 Modal\n\n`;

  report += `### P1 重要 (警告, ${warning}个组件)\n`;
  report += `- 补齐 ARIA 属性和键盘导航\n`;
  report += `- 为纯图标按钮添加 Tooltip\n`;
  report += `- 添加操作成功/失败的 Toast 反馈\n\n`;

  report += `### P2 优化 (得分≥80但可提升)\n`;
  report += `- 为状态切换添加 CSS transition\n`;
  report += `- 统一使用 EmptyState 组件而非内联空状态\n`;
  report += `- 统一 ErrorBoundary 包裹策略\n\n`;

  report += `---\n\n## ✅ 审计结论\n\n`;
  report += `- 审计覆盖率: **100%** (${total}/${total} 组件)\n`;
  report += `- 本次为 v2.3.0 CRYSTAL 最终交互终审\n`;
  report += `- 整体交互质量: **${avgScore >= 80 ? '可发布' : '需修复后发布'}**\n`;
  report += `- 建议: ${avgScore >= 80 ? 'v2.3.0 可发布, P1改进列入v2.4.0' : '修复P0问题后再发布v2.3.0'}\n`;

  fs.writeFileSync(OUTPUT, report, 'utf8');
  console.log(`✅ 审计完成: ${total} 组件, 平均 ${avgScore}/100`);
  console.log(`   优秀: ${passing}, 警告: ${warning}, 不合格: ${failing}`);
  console.log(`   报告: ${OUTPUT}`);
}

main().catch(console.error);
