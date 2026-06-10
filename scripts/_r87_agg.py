#!/usr/bin/env python3
"""R87 M-01 aggressive: also replace CN strings in arrays and simple objects"""
import re, glob, os

# Target files with high hardcoded CN
file_map = {}
for f in glob.glob("src/**/*.tsx", recursive=True):
    file_map[os.path.basename(f)] = f

targets = [
    "AIAssistantPanel.tsx", "DataQualityPage.tsx", "AIDrawingPatternPanel.tsx",
    "SentimentDashboardPage.tsx", "DailyReportPage.tsx", "AIAdvisorPage.tsx",
    "SignalBacktestNewsPanel.tsx", "BacktestReportPage.tsx", "OnboardingModal.tsx",
    "ErrorBoundary.tsx", "I18nProvider.tsx", "DataExportPage.tsx",
    "DemoCasePage.tsx", "MarketplaceDetail.tsx", "MarketplacePage.tsx",
    "GAFinalPanel.tsx", "HelpCenter.tsx", "LandingPageV18.tsx",
    "AgentCollaborationPanel.tsx", "GrowthPanel.tsx", "StrategyMarketplace.tsx",
    "OnboardingFullKit.tsx", "IBKRBrokerPanel.tsx", "SmartPickerPage.tsx",
    "AutoUpdatePanel.tsx", "BacktestPerformancePanel.tsx", "MonteCarloPage.tsx",
    "StrategyPage.tsx", "ReleasePage.tsx",
]

total = 0
for name in targets:
    fp = file_map.get(name)
    if not fp: continue
    with open(fp, 'r', encoding='utf-8') as f:
        orig = f.read()
    
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
        
        # Skip lines that are purely object key definitions
        # But NOT skip lines that are array elements or JSX text
        if re.match(r'^\s*\w+\s*:\s*$', s):
            new_lines.append(line); continue
        
        # Replace string literals containing CN with t()
        def make_replacer():
            cnt2 = [0]
            def replacer(m):
                inner = m.group(1)
                if not re.search(r'[\u4e00-\u9fff]', inner): return m.group(0)
                if len(inner) <= 1: return m.group(0)
                if '<' in inner or '>' in inner: return m.group(0)
                if '{' in inner or '}' in inner: return m.group(0)
                if '`' in inner or '$' in inner: return m.group(0)
                # Skip pure punctuation/number strings
                if re.match(r'^[\d\s\.\,\;\:\!\?\%\-\+\(\)\[\]\{\}\|\\\/\@\#\$\%\^\&\*\=]+$', inner):
                    return m.group(0)
                cnt2[0] += 1
                q = m.group(0)[0]
                return '{t(' + q + inner + q + ')}'
            return cnt2, replacer
        
        c1, r1 = make_replacer()
        line = re.sub(r"'([^']*[\u4e00-\u9fff][^']*)'", r1, line)
        c2, r2 = make_replacer()
        line = re.sub(r'"([^"]*[\u4e00-\u9fff][^"]*)"', r2, line)
        added = c1[0] + c2[0]
        cnt += added
        new_lines.append(line)
    
    if cnt:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print(f"{name}: {cnt}")
        total += cnt

print(f"\nTotal: {total}")
