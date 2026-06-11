const fs = require('fs');
const content = fs.readFileSync('src/components/strategy/StrategyPage.tsx', 'utf8');
const lines = content.split('\n');

// Base imports used by most sub-components
const reactImport = "import React from 'react';\nimport i18n from '../../i18n';\n";
const antdImport = "import { Modal } from 'antd';\n";

const components = [
  {
    name: 'ModeSelector',
    start: 129, end: 195,
    imports: reactImport,
  },
  {
    name: 'AICreator',
    start: 197, end: 374,
    imports: reactImport + "import { useState, useCallback } from 'react';\nimport { parseNL } from '../../lib/bridge-api';\n",
  },
  {
    name: 'BacktestPanel',
    start: 376, end: 479,
    imports: reactImport,
  },
  {
    name: 'MetricCard',
    start: 427, end: 435,
    imports: reactImport,
  },
  {
    name: 'EquityChart',
    start: 436, end: 479,
    imports: reactImport + "import { useMemo } from 'react';\n",
  },
  {
    name: 'TemplateBrowser',
    start: 481, end: 555,
    imports: reactImport + "import { useState } from 'react';\n",
  },
  {
    name: 'FormCreator',
    start: 557, end: 708,
    imports: reactImport + "import { useCallback } from 'react';\n",
  },
  {
    name: 'SliderInput',
    start: 696, end: 708,
    imports: reactImport,
  },
  {
    name: 'MyStrategies',
    start: 710, end: 780,
    imports: reactImport + antdImport + "import { useState } from 'react';\n",
  },
  {
    name: 'StrategyDetail',
    start: 782, end: lines.length,
    imports: reactImport + "import { useState, useEffect } from 'react';\nimport * as api from '../../lib/bridge-api';\n",
  },
];

for (const comp of components) {
  const body = lines.slice(comp.start - 1, comp.end).join('\n');
  const full = comp.imports + '\n' + body + '\n';
  fs.writeFileSync('src/components/strategy/StrategyPage/' + comp.name + '.tsx', full);
  console.log('Created: ' + comp.name + ' (' + body.split('\n').length + ' lines)');
}

console.log('\nDone! Extracted ' + components.length + ' components');
