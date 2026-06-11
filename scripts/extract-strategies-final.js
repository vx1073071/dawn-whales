const { execSync } = require('child_process');
const fs = require('fs');

const content = execSync('git show HEAD:src/components/strategy/StrategyPage.tsx', { encoding: 'utf8' });
const lines = content.split('\n');

const components = [
  { name: 'ModeSelector', start: 128, end: 195 },
  { name: 'AICreator', start: 196, end: 374 },
  { name: 'BacktestPanel', start: 375, end: 479 },
  { name: 'TemplateBrowser', start: 480, end: 555 },
  { name: 'FormCreator', start: 556, end: 708 },
  { name: 'MyStrategies', start: 709, end: 780 },
  { name: 'StrategyDetail', start: 781, end: lines.length - 1 },
];

const baseImport = "import React from 'react';\nimport i18n from '../../i18n';\n";
const antdImport = "import { Modal } from 'antd';\n";

for (const comp of components) {
  const startIdx = comp.start - 1;
  const endIdx = comp.end;
  const body = lines.slice(startIdx, endIdx + 1).join('\n');

  const extraImports = [];
  if (body.includes('Modal.')) extraImports.push(antdImport);
  if (body.includes('parseNL(')) extraImports.push("import { parseNL } from '../../lib/bridge-api';\n");
  if (body.includes('api.')) extraImports.push("import * as api from '../../lib/bridge-api';\n");
  if (body.includes('EngineError')) extraImports.push("import { EngineError } from '../../../electron/engine/core/engine-error';\n");
  if (body.includes('useState')) extraImports.push("import { useState } from 'react';\n");
  if (body.includes('useCallback')) extraImports.push("import { useCallback } from 'react';\n");
  if (body.includes('useEffect')) extraImports.push("import { useEffect } from 'react';\n");
  if (body.includes('useMemo')) extraImports.push("import { useMemo } from 'react';\n");
  if (body.includes('useRef')) extraImports.push("import { useRef } from 'react';\n");
  if (body.includes('createStrategy')) extraImports.push("import { createStrategy } from '../../lib/bridge-api';\n");

  let full = baseImport + extraImports.join('') + '\n' + body + '\n';
  full = full.replace(/^(function )/m, 'export function ');

  // Remove duplicate imports
  const lines2 = full.split('\n');
  const seenImports = new Set();
  const deduped = [];
  for (let i = 0; i < lines2.length; i++) {
    const l = lines2[i];
    if (l.startsWith('import {') && l.includes("from '")) {
      if (seenImports.has(l)) continue;
      seenImports.add(l);
    }
    deduped.push(l);
  }
  full = deduped.join('\n') + '\n';

  fs.writeFileSync('src/components/strategy/StrategyPage/' + comp.name + '.tsx', full);
  const bodyLines = body.split('\n').length;
  console.log('Created: ' + comp.name + ' (' + bodyLines + ' lines, ' + Math.round(full.length/1024*10)/10 + ' KB)');
}
console.log('\nDone! ' + components.length + ' components extracted.');
