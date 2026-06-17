// R256 TSC fix - round 2: fix remaining errors
const fs = require('fs');

// ─── Fix stock-comparison-r255.ts ───
let scr = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/ai/stock-comparison-r255.ts', 'utf8');

// Fix overallSummary: ${a}→${_a}, ${b}→${_b}  
// Line: "if (ratio > 0.6) return `${a}在${winsA}/${total}个维度上领先——表现更全面。但别急着下结论，看下文中的"冠军维度"——${b}可能在某个关键指标上碾压${a}。`;"
scr = scr.replace(
  "return `${a}在${winsA}/${total}个维度上领先——表现更全面。但别急着下结论，看下文中的\"冠军维度\"——${b}可能在某个关键指标上碾压${a}。`;",
  "return `${_a}在${winsA}/${total}个维度上领先——表现更全面。但别急着下结论，看下文中的\"冠军维度\"——${_b}可能在某个关键指标上碾压${_a}。`;"
);

// "return `${b}在${winsB}/${total}个维度上领先——表现更全面。但这不意味着${a}没有价值——看下文中的"冠军维度"——${a}可能在某个领域是绝对的王者。`;"
scr = scr.replace(
  "return `${b}在${winsB}/${total}个维度上领先——表现更全面。但这不意味着${a}没有价值——看下文中的\"冠军维度\"——${a}可能在某个领域是绝对的王者。`;",
  "return `${_b}在${winsB}/${total}个维度上领先——表现更全面。但这不意味着${_a}没有价值——看下文中的\"冠军维度\"——${_a}可能在某个领域是绝对的王者。`;"
);

// "return `势均力敌——${a}赢${winsA}项，${b}赢${winsB}项。胜负取决于你在意什么维度。`;"
scr = scr.replace(
  "return `势均力敌——${a}赢${winsA}项，${b}赢${winsB}项。胜负取决于你在意什么维度。`;",
  "return `势均力敌——${_a}赢${winsA}项，${_b}赢${winsB}项。胜负取决于你在意什么维度。`;"
);

// Fix aDominates: ${stock}→${_stock}, ${dimLabel}→${_dimLabel}, ${value}→${_value}
scr = scr.replace(
  "`🥇 **冠军维度**：${stock}在 **${dimLabel}** 上碾压——${value}。这是它在这次对比中最大的亮点。如果你的策略最看重这个维度，${stock}是你的答案。`",
  "`🥇 **冠军维度**：${_stock}在 **${_dimLabel}** 上碾压——${_value}。这是它在这次对比中最大的亮点。如果你的策略最看重这个维度，${_stock}是你的答案。`"
);

// Fix r.label → r.dimension (lines 158/165)
scr = scr.replace(
  "`### ${COMPARISON_DIMENSIONS.find(d => d.id === r.dimension)?.emoji || ''} ${r.label}\n${r.insight}\n`",
  "`### ${COMPARISON_DIMENSIONS.find(d => d.id === r.dimension)?.emoji || ''} ${r.dimension}\n${r.insight}\n`"
);

fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/ai/stock-comparison-r255.ts', scr, 'utf8');
console.log('PATCHED: stock-comparison-r255.ts');

// ─── Fix anomaly-attribution-r254.ts: _parts unused ───
// The _parts array is built but never returned - need to prefix the array name but also check if it's used
// Actually the function returns early with a different object. Let's just remove _parts entirely.
let anom = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/ai/anomaly-attribution-r254.ts', 'utf8');

// The _parts is dead code - let's comment it out
anom = anom.replace(
  "  const _parts = [\n    `${sev.emoji} **${attr.typeEmoji} ${attr.typeName}** — ${sev.label}`,\n    '',\n    `### 发生了什么`,\n    attribution,\n    '',\n    `### 可能意味着什么`,\n    attr.whatItSuggests,\n    '',\n    `### 归因可信度`,\n    attr.confidenceLevel,\n    '',\n    `### 建议下一步`,\n    attr.nextStep,\n    '',\n    `### 常见原因参考`,\n    ...attr.commonCauses.map(c => `· ${c}`),\n  ];",
  "  // R256: dead code removed - _parts was declared but never used\n  /*\n  const _parts = [\n    `${sev.emoji} **${attr.typeEmoji} ${attr.typeName}** — ${sev.label}`,\n    '',\n    `### 发生了什么`,\n    attribution,\n    '',\n    `### 可能意味着什么`,\n    attr.whatItSuggests,\n    '',\n    `### 归因可信度`,\n    attr.confidenceLevel,\n    '',\n    `### 建议下一步`,\n    attr.nextStep,\n    '',\n    `### 常见原因参考`,\n    ...attr.commonCauses.map(c => `· ${c}`),\n  ];\n  */"
);

fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/ai/anomaly-attribution-r254.ts', anom, 'utf8');
console.log('PATCHED: anomaly-attribution-r254.ts');

// ─── Fix bridge-api-types.ts: duplicate Window.api ───
// Search for other declarations of Window.api
let bat = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/bridge-api-types.ts', 'utf8');
// The duplicate is from another file that also declares Window.api. Need to find it.
console.log('bridge-api-types.ts lines:', bat.split('\n').length);
console.log('=== All fixes applied ===');
