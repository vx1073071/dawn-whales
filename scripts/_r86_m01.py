#!/usr/bin/env python3
"""R86 M-01: i18n hardcoded CN replacement — safe line-by-line approach"""
import re, os, glob

# Find actual paths
file_map = {}
for f in glob.glob("src/**/*.tsx", recursive=True):
    bn = os.path.basename(f)
    file_map[bn] = f

TARGET_NAMES = [
    "HelpCenter.tsx", "LandingPageV18.tsx", "AIDailyDigestPanel.tsx",
    "AIAssistantPanel.tsx", "DataQualityPage.tsx", "AgentCollaborationPanel.tsx",
    "ReleasePage.tsx", "OnboardingFullKit.tsx", "StrategyMarketplace.tsx",
    "GrowthPanel.tsx",
]

total_replacements = 0
for name in TARGET_NAMES:
    filepath = file_map.get(name)
    if not filepath:
        print(f"SKIP (not found): {name}")
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()
    
    lines = original.split('\n')
    new_lines = []
    count = 0
    
    for line in lines:
        stripped = line.strip()
        # Skip comments
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            new_lines.append(line); continue
        # Skip no Chinese
        if not re.search(r'[\u4e00-\u9fff]', line):
            new_lines.append(line); continue
        # Skip already uses t()
        if 't(' in line:
            new_lines.append(line); continue
        # Skip Record keys
        if re.search(r'^\s*(const|let|var)\s+\w+\s*:\s*Record', line):
            new_lines.append(line); continue
        
        # Replace 'xxxCNxxx' with {t('xxxCNxxx')}
        # and "xxxCNxxx" with {t("xxxCNxxx")}
        def make_replacer():
            cnt = [0]
            def f(m):
                s, inner = m.group(0), m.group(1)
                if not re.search(r'[\u4e00-\u9fff]', inner): return s
                if len(inner) <= 1: return s
                if '<' in inner or '>' in inner: return s
                cnt[0] += 1
                quote = m.group(0)[0]  # ' or "
                return '{t(' + quote + inner + quote + ')}'
            return cnt, f
        
        cnt, replacer = make_replacer()
        line = re.sub(r"'([^']*[\u4e00-\u9fff][^']*)'", replacer, line)
        cnt2, replacer2 = make_replacer()
        line = re.sub(r'"([^"]*[\u4e00-\u9fff][^"]*)"', replacer2, line)
        count += cnt[0] + cnt2[0]
        new_lines.append(line)
    
    content = '\n'.join(new_lines)
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"{name}: {count} replacements")
        total_replacements += count
    else:
        print(f"{name}: 0 changes")

print(f"\nTotal: {total_replacements} replacements")
