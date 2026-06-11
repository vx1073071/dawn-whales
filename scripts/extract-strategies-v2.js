const fs = require('fs');
const content = fs.readFileSync('src/components/strategy/StrategyPage.tsx', 'utf8');
const lines = content.split('\n');

// Line mappings: each sub-component starts at [startLine] (1-indexed)
// StrategyPage body ends at line 127, then sub-components start at proper section delimiters

const components = [
  {
    name: 'ModeSelector',
    start: 128, end: 195,
    type: 'component',
  },
  {
    name: 'AICreator',
    start: 196, end: 374,
    type: 'component',
  },
  {
    name: 'BacktestPanel',  // includes MetricCard + EquityChart (they are used within this context)
    start: 375, end: 479,
    type: 'component',
  },
  {
    name: 'TemplateBrowser',
    start: 480, end: 555,
    type: 'component',
  },
  {
    name: 'FormCreator',  // includes SliderInput
    start: 556, end: 708,
    type: 'component',
  },
  {
    name: 'MyStrategies',
    start: 709, end: 780,
    type: 'component',
  },
  {
    name: 'StrategyDetail',
    start: 781, end: lines.length,
    type: 'component',
  },
];

const baseImport = "import React from 'react';\nimport i18n from '../../i18n';\n";
const antdImport = "import { Modal } from 'antd';\n";

for (const comp of components) {
  // Find the exact function boundary
  let startIdx = comp.start - 1; // 0-indexed
  let endIdx = comp.end - 1;

  // Find actual function start line
  while (startIdx < lines.length && !lines[startIdx].match(/^(function|export function)/)) {
    // Include the section comment if present
    if (!lines[startIdx].match(/^\/\/ ──/)) startIdx++;
    else break;
  }

  // Find actual function end (closing brace)
  let braceCount = 0;
  let inFunction = false;
  for (let i = startIdx; i <= endIdx; i++) {
    const line = lines[i];
    if (line.match(/^(function|export default)/)) inFunction = true;
    if (inFunction) {
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      if (braceCount === 0 && braceCount !== undefined) {
        endIdx = i;
        break;
      }
    }
  }

  const body = lines.slice(startIdx, endIdx + 1).join('\n');
  const extraImports = [];
  if (body.includes('Modal.')) extraImports.push(antdImport);
  if (body.includes('parseNL')) extraImports.push("import { parseNL } from '../../lib/bridge-api';\n");
  if (body.includes('api.')) extraImports.push("import * as api from '../../lib/bridge-api';\n");
  if (body.includes('EngineError')) extraImports.push("import { EngineError } from '../../electron/engine/core/engine-error';\n");
  if (body.includes('useState') && !body.includes('import { useState')) extraImports.push("import { useState } from 'react';\n");
  if (body.includes('useCallback') && !body.includes('import { useCallback')) extraImports.push("import { useCallback } from 'react';\n");
  if (body.includes('useEffect') && !body.includes('import { useEffect')) extraImports.push("import { useEffect } from 'react';\n");
  if (body.includes('useMemo') && !body.includes('import { useMemo')) extraImports.push("import { useMemo } from 'react';\n");
  if (body.includes('useRef') && !body.includes('import { useRef')) extraImports.push("import { useRef } from 'react';\n");

  let full = baseImport + extraImports.join('') + '\n' + body + '\n';
  // Add export keyword
  full = full.replace(/^(function )/m, 'export function ');
  fs.writeFileSync('src/components/strategy/StrategyPage/' + comp.name + '.tsx', full);
  console.log('Created: ' + comp.name + ' (' + body.split('\n').length + ' lines, ' + Math.round(body.length/1024*10)/10 + ' KB)');
}
console.log('\nDone!');
