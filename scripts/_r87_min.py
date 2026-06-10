#!/usr/bin/env python3
"""R87 M-01 MINIMAL safe: only >pureCNtext< patterns, no special chars"""
import re, glob, os

def is_pure_cn_text(text):
    """Check if text is safe to wrap in t()"""
    t = text.strip()
    if not t: return False
    if not re.search(r'[\u4e00-\u9fff]', t): return False
    # No special chars that break JSX/TS
    for ch in '<>{}\\`$':
        if ch in t: return False
    return True

file_map = {}
for f in glob.glob("src/**/*.tsx", recursive=True):
    file_map[os.path.basename(f)] = f

# ALL files from top 15 + a few more
targets = list(set([
    "AIAssistantPanel.tsx", "DataQualityPage.tsx", "AIDrawingPatternPanel.tsx",
    "SentimentDashboardPage.tsx", "DailyReportPage.tsx", "AIAdvisorPage.tsx",
    "SignalBacktestNewsPanel.tsx", "BacktestReportPage.tsx", "OnboardingModal.tsx",
    "ErrorBoundary.tsx", "DataExportPage.tsx", "MarketplacePage.tsx",
    "DemoCasePage.tsx", "MarketplaceDetail.tsx", "GAFinalPanel.tsx",
    "HelpCenter.tsx", "LandingPageV18.tsx", "AgentCollaborationPanel.tsx",
    "GrowthPanel.tsx", "StrategyMarketplace.tsx", "OnboardingFullKit.tsx",
    "IBKRBrokerPanel.tsx", "SmartPickerPage.tsx", "AutoUpdatePanel.tsx",
    "BacktestPerformancePanel.tsx", "MonteCarloPage.tsx", "StrategyPage.tsx",
    "ReleasePage.tsx", "I18nProvider.tsx",
]))

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
        # Skip if already has t()
        if re.search(r'\bt\s*\(', line):
            new_lines.append(line); continue
        s = line.strip()
        # Skip comments
        if s.startswith('//') or s.startswith('*'): 
            new_lines.append(line); continue
        # STRICTLY skip object property lines
        if re.match(r'^\s*\w+\s*:\s*', s):
            new_lines.append(line); continue
        # STRICTLY skip import/export/type lines
        if re.match(r'^\s*(import|export|type|interface)\s', line):
            new_lines.append(line); continue
        
        # Replace >CN< with >{t('CN')}< only for pure CN text
        def replacer(m):
            inner = m.group(1)
            if is_pure_cn_text(inner):
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

print(f"\nTotal: {total}")
