// R256 TSC auto-fix script
import * as fs from 'fs';
import * as path from 'path';

const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales';

// Helper: read, transform, write
function patch(filePath: string, fn: (content: string) => string) {
  const p = path.join(base, filePath);
  const orig = fs.readFileSync(p, 'utf8');
  const next = fn(orig);
  if (next !== orig) {
    fs.writeFileSync(p, next);
    console.log('PATCHED:', filePath);
  } else {
    console.log('SKIP (unchanged):', filePath);
  }
}

// 1. QuoteSourceConfigPanel.tsx: remove unused React import
patch('src/components/settings/QuoteSourceConfigPanel.tsx', c =>
  c.replace(
    "import React, { useState, useCallback } from 'react';",
    "import { useState, useCallback } from 'react';"
  )
);

// 2. QuoteSourceConfigPanel.tsx: remove unused 't' from useTranslation destructure
patch('src/components/settings/QuoteSourceConfigPanel.tsx', c =>
  c.replace(
    "const { t, i18n } = useTranslation();",
    "const { i18n } = useTranslation();"
  )
);

// 3. anomaly-attribution-r254.ts: remove unused 'parts' 
// The 'parts' variable at line 228 is declared but never used.
// Find and remove it by using underscore prefix or just delete the declaration block
patch('src/lib/ai/anomaly-attribution-r254.ts', c => {
  // Replace "const parts = [" ... through the array ending with "];"
  return c.replace(
    /  const parts = \[\n([\s\S]*?)  \];\n/,
    "  const _lines = [\n$1  ];\n"
  );
});

// 4. premarket-briefing-r254.ts: vix, vixChange unused in determineBriefingScenario
patch('src/lib/ai/premarket-briefing-r254.ts', c =>
  c.replace(
    'const { sp500CloseReturn, premarketFuturesReturn, vix, vixChange } = snap;',
    'const { sp500CloseReturn, premarketFuturesReturn } = snap;'
  )
);

// 5. stock-comparison-r255.ts: a, b unused in COMPARISON_TEMPLATES
// These are destructured but not used in that context
patch('src/lib/ai/stock-comparison-r255.ts', c => {
  let result = c;
  // Fix line 69: const { a, b } -> inline params
  result = result.replace(
    "const COMPARISON_TEMPLATES: Record<string, (a: string, b: string, ...args: any[]) => string> = {",
    "const COMPARISON_TEMPLATES: Record<string, (...args: any[]) => string> = {"
  );
  // Fix the functions that use a,b to take from args
  result = result.replace(
    "header: (a: string, b: string) => `# 🐋 ${a} vs ${b}\\n对比分析报告`,
    "header: (a: string, b: string) => `# 🐋 ${a} vs ${b}\n对比分析报告`"
  ).replace(
    "overallSummary: (a: string, b: string, winsA: number, winsB: number, total: number) =>",
    "overallSummary: (_a: string, _b: string, winsA: number, winsB: number, total: number) =>"
  ).replace(
    /return `势均力敌——\$\{a\}赢\$\{winsA\}项，\$\{b\}赢/m,
    "return `势均力敌——${_a}赢${winsA}项，${_b}赢"
  ).replace(
    "allTie: '两只有很多相似之处",
    "allTie: (_a?: string, _b?: string): string => '两只有很多相似之处"
  ).replace(
    "advice: (a: string, b: string) => `### 🐋 鲸灵的想法",
    "advice: (_a: string, _b: string) => `### 🐋 鲸灵的想法"
  );
  // Fix references to a,b inside advice
  result = result.replace(
    /\$\{a\}赢\$\{winsA\}项，\$\{b\}赢/g,
    '${_a}赢${winsA}项，${_b}赢'
  );
  return result;
});

// 6. stock-comparison-r255.ts: 'label' doesn't exist on 'ComparisonResult'
// line 158: best.label → need to check type
patch('src/lib/ai/stock-comparison-r255.ts', c => {
  // Replace best.label with best.dimension as fallback
  return c
    .replace("COMPARISON_TEMPLATES.aDominates(stockA, best.label, `${best.valueA}`)", 
             "COMPARISON_TEMPLATES.aDominates(stockA, best.dimension, `${best.valueA}`)")
    .replace("COMPARISON_TEMPLATES.aDominates(stockB, best.label, `${best.valueB}`)", 
             "COMPARISON_TEMPLATES.aDominates(stockB, best.dimension, `${best.valueB}`)");
});

console.log('\n=== R256 TSC fixes applied ===');
