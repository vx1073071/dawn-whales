// R256 TSC auto-fix script (JavaScript)
const fs = require('fs');
const path = require('path');

const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales';

function patch(filePath, fn) {
  const p = path.join(base, filePath);
  const orig = fs.readFileSync(p, 'utf8');
  const next = fn(orig);
  if (next !== orig) {
    fs.writeFileSync(p, next, 'utf8');
    console.log('PATCHED:', filePath);
  } else {
    console.log('SKIP (no change):', filePath);
  }
}

// ─── 1. QuoteSourceConfigPanel.tsx: remove unused React import ───
var qscp = 'src/components/settings/QuoteSourceConfigPanel.tsx';
patch(qscp, function(c) {
  return c.replace(
    "import React, { useState, useCallback } from 'react';",
    "import { useState, useCallback } from 'react';"
  );
});

// ─── 2. QuoteSourceConfigPanel.tsx: remove unused 't' from destructure ───
patch(qscp, function(c) {
  return c.replace(
    "const { t, i18n } = useTranslation();",
    "const { i18n } = useTranslation();"
  );
});

// ─── 3. anomaly-attribution-r254.ts: line 228 'parts' unused ───
var anom = 'src/lib/ai/anomaly-attribution-r254.ts';
patch(anom, function(c) {
  // Replace "const parts = [" with "const _parts = ["
  return c.replace(/  const parts = \[/g, '  const _parts = [');
});

// ─── 4. premarket-briefing-r254.ts: vix, vixChange unused ───
var pmb = 'src/lib/ai/premarket-briefing-r254.ts';
patch(pmb, function(c) {
  return c.replace(
    "const { sp500CloseReturn, premarketFuturesReturn, vix, vixChange } = snap;",
    "const { sp500CloseReturn, premarketFuturesReturn } = snap;"
  );
});

// ─── 5. stock-comparison-r255.ts: 'a'/'b' params unused in COMPARISON_TEMPLATES ───
var scr = 'src/lib/ai/stock-comparison-r255.ts';
patch(scr, function(c) {
  // Fix header function
  c = c.replace(
    "header: (a: string, b: string) => `# 🐋 ${a} vs ${b}\n对比分析报告",
    "header: (_a: string, _b: string) => `# 🐋 ${_a} vs ${_b}\n对比分析报告"
  );
  // Fix overallSummary function
  c = c.replace(
    "overallSummary: (a: string, b: string, winsA: number, winsB: number, total: number) =>",
    "overallSummary: (_a: string, _b: string, winsA: number, winsB: number, total: number) =>"
  );
  // Fix a dominates
  c = c.replace(
    "aDominates: (stock: string, dimLabel: string, value: string | number) =>",
    "aDominates: (_stock: string, _dimLabel: string, _value: string | number) =>"
  );
  // Fix advice
  c = c.replace(
    "advice: (a: string, b: string) => `### 🐋 鲸灵的想法",
    "advice: (_a: string, _b: string) => `### 🐋 鲸灵的想法"
  );
  return c;
});

// ─── 6. stock-comparison-r255.ts: 'label' property doesn't exist on ComparisonResult ───
patch(scr, function(c) {
  // Replace .label with .dimension (the field that exists on ComparisonResult)
  c = c.replace(/best\.label/g, 'best.dimension');
  return c;
});

// ─── 7. bridge-api-types.ts: duplicate Window.api property ───
var bat = 'src/lib/bridge-api-types.ts';
patch(bat, function(c) {
  // The issue is that 'api' is declared twice with slightly different types.
  // The second declaration (line 23ish) overrides the first.
  // Remove the duplicate property line: "  api: {"
  // Actually, looking at the file - the issue is more subtle.
  // Let's read the specific section around line 23.
  return c;
});

console.log('\n=== R256 TSC fixes applied (except bridge-api-types) ===');
