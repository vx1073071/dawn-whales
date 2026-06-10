#!/usr/bin/env python3
"""R87 M-01 safe: only JSX text nodes (>CN<) and standalone strings, skip object props"""
import re, glob, os

file_map = {}
for f in glob.glob("src/**/*.tsx", recursive=True):
    file_map[os.path.basename(f)] = f

targets = [
    "OnboardingModal.tsx", "AIAssistantPanel.tsx", "DemoCasePage.tsx",
    "DailyReportPage.tsx", "MarketplaceDetail.tsx", "AIAdvisorPage.tsx",
    "StrategyPage.tsx", "DataQualityPage.tsx", "LandingPageV18.tsx",
    "AIDrawingPatternPanel.tsx", "SentimentDashboardPage.tsx",
    "SignalBacktestNewsPanel.tsx", "BacktestReportPage.tsx",
    "DataExportPage.tsx", "MarketplacePage.tsx", "GAFinalPanel.tsx",
    "HelpCenter.tsx", "AgentCollaborationPanel.tsx", "GrowthPanel.tsx",
    "StrategyMarketplace.tsx", "OnboardingFullKit.tsx", "IBKRBrokerPanel.tsx",
    "SmartPickerPage.tsx", "AutoUpdatePanel.tsx", "BacktestPerformancePanel.tsx",
    "MonteCarloPage.tsx",
]

total = 0
for name in targets:
    fp = file_map.get(name)
    if not fp: continue
    with open(fp, 'r', encoding='utf-8') as f: orig = f.read()
    lines = orig.split('\n')
    new_lines = []
    cnt = 0
    for line in lines:
        if not re.search(r'[\u4e00-\u9fff]', line):
            new_lines.append(line); continue
        if re.search(r'\bt\s*\(', line):
            new_lines.append(line); continue
        s = line.strip()
        if s.startswith('//') or s.startswith('*') or s.startswith('/*'):
            new_lines.append(line); continue
        # STRICTLY skip object property lines:  word: '...' or word: {...}
        if re.match(r'^\s*\w+\s*:\s*', s):
            new_lines.append(line); continue
        
        # Replace JSX text >CN< with >{t('CN')}<
        def jsx_replacer(m):
            inner = m.group(1).strip()
            if not re.search(r'[\u4e00-\u9fff]', inner): return m.group(0)
            if '<' in inner or '>' in inner or '{' in inner or '}' in inner: return m.group(0)
            if '`' in inner or '$' in inner: return m.group(0)
            q = "'" if "'" not in inner else '"'
            return '>{t(' + q + inner + q + ')}<'
        
        nl = re.sub(r'>([^<>]*[\u4e00-\u9fff][^<>]*)<', jsx_replacer, line)
        if nl != line: cnt += 1
        new_lines.append(nl)
    
    if cnt:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print(f"{name}: {cnt}")
        total += cnt

print(f"Total: {total}")
