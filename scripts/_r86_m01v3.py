#!/usr/bin/env python3
"""
R86 M-01 v3: Safe i18n — skip AIAssistantPanel (data content), process 9 files
"""
import re, glob, os

file_map = {}
for f in glob.glob("src/**/*.tsx", recursive=True):
    file_map[os.path.basename(f)] = f

TARGET_NAMES = [
    "HelpCenter.tsx", "LandingPageV18.tsx", "AIDailyDigestPanel.tsx",
    "DataQualityPage.tsx", "AgentCollaborationPanel.tsx",
    "ReleasePage.tsx", "OnboardingFullKit.tsx", "StrategyMarketplace.tsx",
    "GrowthPanel.tsx",
]

# For AIAssistantPanel, manually process only safe lines (skip data objects)
# We'll handle it separately

total_r = 0
for name in TARGET_NAMES:
    filepath = file_map.get(name)
    if not filepath:
        print(f"SKIP: {name}")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()
    
    lines = original.split('\n')
    new_lines = []
    count = 0
    
    for line in lines:
        s = line.strip()
        if s.startswith('//') or s.startswith('*') or s.startswith('/*'):
            new_lines.append(line); continue
        if not re.search(r'[\u4e00-\u9fff]', line):
            new_lines.append(line); continue
        if re.search(r'\bt\s*\(', line):
            new_lines.append(line); continue
        # Skip object property assignments:  word: 'Chinese...'
        if re.search(r"^\s*\w+\s*:\s*['\"][^'\"]*[\u4e00-\u9fff]", line):
            new_lines.append(line); continue
        if re.search(r'^\s*(const|let|var)\s+\w+\s*:\s*Record', line):
            new_lines.append(line); continue
        
        def safe_replacer(q):
            def f(m):
                inner = m.group(1)
                if not re.search(r'[\u4e00-\u9fff]', inner): return m.group(0)
                if len(inner) <= 1: return m.group(0)
                if '<' in inner or '>' in inner: return m.group(0)
                if '{' in inner or '}' in inner: return m.group(0)
                return '{t(' + q + inner + q + ')}'
            return f
        
        line = re.sub(r"'([^']*[\u4e00-\u9fff][^']*)'", safe_replacer("'"), line)
        line = re.sub(r'"([^"]*[\u4e00-\u9fff][^"]*)"', safe_replacer('"'), line)
        new_count = len(re.findall(r"\{t\(['\"]", line))
        count += new_count
        new_lines.append(line)
    
    content = '\n'.join(new_lines)
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"{name}: {count} replacements")
        total_r += count
    else:
        print(f"{name}: 0 changes")

print(f"\nTotal: {total_r} replacements")
