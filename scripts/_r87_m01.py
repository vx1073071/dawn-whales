#!/usr/bin/env python3
"""R87 M-01: i18n final push — hardcoded CN 16249 → <14000"""
import re, glob, os

def safe_replace_jsx_text(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()
    lines = original.split('\n')
    new_lines = []
    count = 0
    for line in lines:
        if not re.search(r'[\u4e00-\u9fff]', line):
            new_lines.append(line); continue
        if re.search(r'\bt\s*\(', line):
            new_lines.append(line); continue
        s = line.strip()
        if s.startswith('//') or s.startswith('*') or s.startswith('/*'):
            new_lines.append(line); continue
        if re.match(r'^\s*\w+\s*:\s*', s):
            new_lines.append(line); continue
        nl = re.sub(r'>([^<>]*[\u4e00-\u9fff][^<>]*)<',
            lambda m: '>{t(' + ("'" if "'" not in m.group(1) else '"') + m.group(1).strip() + ("'" if "'" not in m.group(1) else '"') + ')}<',
            line)
        if nl != line:
            count += 1
        new_lines.append(nl)
    content = '\n'.join(new_lines)
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    return count

# Get all TSX files
file_map = {}
for f in glob.glob("src/**/*.tsx", recursive=True):
    file_map[os.path.basename(f)] = f

# Target: all files with >50 hardcoded CN from the baseline
targets = [
    "DataQualityPage.tsx", "AIDrawingPatternPanel.tsx",
    "SentimentDashboardPage.tsx", "DailyReportPage.tsx",
    "AIAdvisorPage.tsx", "SignalBacktestNewsPanel.tsx",
    "BacktestReportPage.tsx", "OnboardingModal.tsx",
    "DataExportPage.tsx", "MarketplacePage.tsx",
    "DemoCasePage.tsx", "GAFinalPanel.tsx",
    "HelpCenter.tsx", "LandingPageV18.tsx",
    "AgentCollaborationPanel.tsx", "GrowthPanel.tsx",
    "StrategyMarketplace.tsx", "OnboardingFullKit.tsx",
    "IBKRBrokerPanel.tsx", "SmartPickerPage.tsx",
    "AutoUpdatePanel.tsx", "BacktestPerformancePanel.tsx",
    "MonteCarloPage.tsx", "StrategyPage.tsx",
    "ReleasePage.tsx",
]

total = 0
for name in targets:
    fp = file_map.get(name)
    if not fp: continue
    c = safe_replace_jsx_text(fp)
    if c:
        print(f"{name}: {c}")
        total += c
print(f"Total: {total} JSX text replacements")
