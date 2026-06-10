#!/usr/bin/env python3
"""Fix ternary/expression {t('...')} -> t('...') in non-JSX attribute contexts"""
import re, glob

files = [
    "src/components/ai/AgentCollaborationPanel.tsx",
    "src/components/billing/community/GrowthPanel.tsx",
    "src/components/billing/community/StrategyMarketplace.tsx",
    "src/components/dashboard/AIDailyDigestPanel.tsx",
    "src/components/tools/DataQualityPage.tsx",
]

for fp in files:
    with open(fp, 'r', encoding='utf-8') as f:
        orig = f.read()
    
    # Pattern 1: ? {t('xxx')} :  -> ? t('xxx') :
    # Pattern 2: : {t('xxx')}   -> : t('xxx')
    # But only outside JSX attribute context (which uses ={t('xxx')})
    
    fixed = re.sub(r'(\?)\s*\{t\(([^)]*)\)\}', r'\1 t(\2)', orig)
    fixed = re.sub(r'(:)\s*\{t\(([^)]*)\)\}', r'\1 t(\2)', fixed)
    
    if fixed != orig:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print(f'Fixed: {fp}')
    else:
        print(f'No changes: {fp}')
