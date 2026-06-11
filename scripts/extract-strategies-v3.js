const fs = require('fs');
const content = fs.readFileSync('src/components/strategy/StrategyPage.tsx', 'utf8');
const lines = content.split('\n');

// Manually verified line ranges from git diff
const components = [
  { name: 'ModeSelector', start: 128, end: 195 },
  { name: 'AICreator', start: 196, end: 374 },
  { name: 'BacktestPanel', start: 375, end: 479 },
  { name: 'TemplateBrowser', start: 480, end: 555 },
  { name: 'FormCreator', start: 556, end: 708 },
  { name: 'MyStrategies', start: 709, end: 780 },
  { name: 'StrategyDetail', start: 781, end: lines.length },
];

const baseImport = "import React from 'react';\nimport i18n from '../../i18n';\n";
const antdImport = "import { Modal } from 'antd';\n";

for (const comp of components) {
  const body = lines.slice(comp.start - 1, comp.end).join('\n');
  const extraImports = [];
  if (body.includes('Modal.')) extraImports.push(antdImport);
  if (body.includes('parseNL(') && body.includes("import {'")) extraImports.push("import { parseNL } from '../../lib/bridge-api';\n");
  if (body.includes('api.')) extraImports.push("import * as api from '../../lib/bridge-api';\n");
  if (body.includes('EngineError')) extraImports.push("import { EngineError } from '../../../electron/engine/core/engine-error';\n");
  if (body.includes('useState')) extraImports.push("import { useState } from 'react';\n");
  if (body.includes('useCallback')) extraImports.push("import { useCallback } from 'react';\n");
  if (body.includes('useEffect')) extraImports.push("import { useEffect } from 'react';\n");
  if (body.includes('useMemo')) extraImports.push("import { useMemo } from 'react';\n");
  if (body.includes('useRef')) extraImports.push("import { useRef } from 'react';\n");

  let full = baseImport + extraImports.join('') + '\n' + body + '\n';
  // Add export keyword
  full = full.replace(/^(function )/m, 'export function ');

  // Remove duplicate React/hook imports
  const lines2 = full.split('\n');
  const seenImports = new Set();
  const deduped = lines2.filter(l => {
    if (l.startsWith('import {') && l.includes('from')) {
      if (seenImports.has(l)) return false;
      seenImports.add(l);
    }
    return true;
  });
  full = deduped.join('\n') + '\n';

  fs.writeFileSync('src/components/strategy/StrategyPage/' + comp.name + '.tsx', full);
  console.log('Created: ' + comp.name + ' (' + body.split('\n').length + ' lines)');
}
console.log('\nDone!');
