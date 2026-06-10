#!/usr/bin/env python3
"""
R88 M-01: FINAL safe i18n — only >pureCN< JSX text nodes.
STRICTLY skip: object properties, ternaries, arrays, template strings.
"""
import re, glob, os

file_map = {}
for f in glob.glob("src/**/*.tsx", recursive=True):
    file_map[os.path.basename(f)] = f

# PM-specified 10 + top hardcoded files
targets = [
    "HelpCenter.tsx", "LandingPageV18.tsx", "AIDailyDigestPanel.tsx",
    "DataQualityPage.tsx", "StrategyPage.tsx", "SentimentDashboardPage.tsx",
    "AgentCollaborationPanel.tsx", "AIDrawingPatternPanel.tsx",
    "BacktestReportPage.tsx", "StrategyMarketplace.tsx",
    "OnboardingFullKit.tsx", "AIAdvisorPage.tsx",
    "MonteCarloPage.tsx", "GAFinalPanel.tsx", "GrowthPanel.tsx",
    "DemoCasePage.tsx", "MarketplacePage.tsx", "ReleasePage.tsx",
    "DataExportPage.tsx", "IBKRBrokerPanel.tsx", "SmartPickerPage.tsx",
    "AutoUpdatePanel.tsx", "BacktestPerformancePanel.tsx",
    "SignalBacktestNewsPanel.tsx", "DailyReportPage.tsx",
    "OnboardingModal.tsx", "ErrorBoundary.tsx", "I18nProvider.tsx",
]

def is_safe_cn(text):
    """Only allow pure CN text without any special chars that could break syntax"""
    t = text.strip()
    if not t: return False
    if not re.search(r'[\u4e00-\u9fff]', t): return False
    for ch in '<>{}`$\\':
        if ch in t: return False
    return True

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
        # Skip non-CN lines
        if not re.search(r'[\u4e00-\u9fff]', line):
            new_lines.append(line); continue
        # Skip already-t() lines
        if re.search(r'\bt\s*\(', line):
            new_lines.append(line); continue
        # Skip comments
        s = line.strip()
        if s.startswith('//') or s.startswith('*') or s.startswith('/*'):
            new_lines.append(line); continue
        # Skip object property lines (word: '...')
        if re.match(r'^\s*\w+\s*:\s*', s):
            new_lines.append(line); continue
        # Skip import/export/type
        if re.match(r'^\s*(import|export|type|interface|const|let|var)\s', line):
            new_lines.append(line); continue
        
        # Replace >CN< -> >{t('CN')}< only for pure, safe CN text
        def replacer(m):
            inner = m.group(1)
            if is_safe_cn(inner):
                q = "'" if "'" not in inner else '"'
                return '>{t(' + q + inner.strip() + q + ')}<'
            return m.group(0)
        
        nl = re.sub(r'>([^<>]*)<', replacer, line)
        if nl != line: cnt += 1
        new_lines.append(nl)
    
    if cnt:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print(f"{name}: {cnt}")
        total += cnt

print(f"\nTotal: {total} safe JSX text replacements")
