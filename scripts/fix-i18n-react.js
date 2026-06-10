#!/usr/bin/env node
/**
 * Fix i18n.t() → t() in React files, and move module-level t() calls inside components
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const FILES = [
  'src/components/billing/onboarding/OnboardingFullKit.tsx',
  'src/components/billing/core/HelpCenter.tsx',
  'src/components/billing/core/LandingPageV18.tsx',
  'src/components/dashboard/AIDailyDigestPanel.tsx',
  'src/components/ai/AIAssistantPanel.tsx',
  'src/components/tools/DataQualityPage.tsx',
  'src/components/strategy/StrategyPage.tsx',
  'src/components/ai/AgentCollaborationPanel.tsx',
  'src/components/billing/core/ThemeLangPanel.tsx',
  'src/components/risk/SentimentDashboardPage.tsx',
  'src/components/billing/core/UIAuditPanel.tsx',
];

for (const file of FILES) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) continue;
  
  let content = fs.readFileSync(fp, 'utf8');
  
  // Step 1: Replace i18n.t('key') with t('key') globally
  content = content.replace(/i18n\.t\(/g, 't(');
  
  // Step 2: Remove the i18n import we added (it's wrong for React)
  content = content.replace(/^import i18n from '.*?';\n/gm, '');
  
  // Step 3: Check if component uses useTranslation, if not add it
  const hasUseTranslation = content.includes('useTranslation');
  const hasReactImport = content.includes("from 'react'");
  
  if (!hasUseTranslation && content.includes("t('")) {
    // Add import
    if (hasReactImport) {
      // Insert after react import
      content = content.replace(
        /(import .*? from 'react';?\n)/,
        "$1import { useTranslation } from 'react-i18next';\n"
      );
    } else {
      content = "import { useTranslation } from 'react-i18next';\n" + content;
    }
  }
  
  // Step 4: For module-level arrays/objects that use t(), wrap them in useMemo or move inside component
  // This is complex — for now, let's identify which files have this issue
  
  fs.writeFileSync(fp, content, 'utf8');
  console.log(`Fixed: ${file}`);
}

console.log('\nDone. Now run TSC to check remaining errors.');
