const f = require('fs').readFileSync('c:\\Users\\vx107\\.easyclaw\\workspace\\quant-moo\\electron\\engine\\strategies\\factor-strategy-templates.ts', 'utf-8');

// Verify signal push counts
const sigPushCount = (f.match(/touchpointId:\s*'AI_FACTOR_SIGNAL_PUSH'/g) || []).length;
console.log('Signal push coverage:', sigPushCount, '/ 44 =', (sigPushCount / 44 * 100).toFixed(0) + '%');

// Verify holdingDays
const holdingDaysFields = (f.match(/holdingDays:\s*\{[^}]+\}/g) || []);
console.log('holdingDays instances:', holdingDaysFields.length);
console.log('First 3 holdingDays:', holdingDaysFields.slice(0, 3).map(h => h.trim()));

// Verify AI trigger point counts per template
const templateIds = [...f.matchAll(/\{\s*\n\s+id:\s*'([^']+)'/g)].map(m => m[1]);
console.log('Template count:', templateIds.length);

const tpCounts = {};
const blockStarts = [];
for (let i = 0; i < templateIds.length; i++) {
  const id = templateIds[i];
  const idx = f.indexOf("id: '" + id + "'");
  blockStarts.push(idx);
}
blockStarts.push(f.length);

for (let i = 0; i < templateIds.length; i++) {
  const block = f.substring(blockStarts[i], blockStarts[i + 1]);
  const count = (block.match(/AITriggerPoint/g) || []).length;
  tpCounts[count] = (tpCounts[count] || 0) + 1;
}
console.log('AI trigger point distribution:', JSON.stringify(tpCounts));

// Verify weight sums
const combos = [...f.matchAll(/factorCombo:\s*\[([\s\S]*?)\],\s*\n\s+aiTriggerPoints/g)];
let weightIssues = 0;
for (const c of combos) {
  const weights = [...c[1].matchAll(/weight:\s*(\d+)/g)].map(m => parseInt(m[1]));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 1) { weightIssues++; console.log('Weight issue:', sum); }
}
console.log('Weight sum issues:', weightIssues);

// Check for duplicate AI trigger IDs
let dupCount = 0;
for (let i = 0; i < templateIds.length; i++) {
  const block = f.substring(blockStarts[i], blockStarts[i + 1]);
  const tpIds = [...block.matchAll(/\{ id: '([^']+)'/g)].map(m => m[1]);
  const dups = tpIds.filter((id, j) => tpIds.indexOf(id) !== j);
  if (dups.length > 0) { dupCount++; console.log('Duplicate trigger in', templateIds[i], ':', [...new Set(dups)]); }
}
console.log('Templates with duplicate trigger IDs:', dupCount);

console.log('Done.');
