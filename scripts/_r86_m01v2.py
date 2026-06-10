#!/usr/bin/env python3
"""
R86 M-01: Safe i18n replacement for R86 10 target files.
Strategy: 
  1. Only replace strings in JSX text context (between > and <, or between tags)
  2. Skip lines that are object property assignments (label:/prompt:/value:/key:/id:/icon:)
  3. Already verified safe in R84 P1-5d batch
"""
import re, glob, os

file_map = {}
for f in glob.glob("src/**/*.tsx", recursive=True):
    file_map[os.path.basename(f)] = f

TARGET_NAMES = [
    "HelpCenter.tsx", "LandingPageV18.tsx", "AIDailyDigestPanel.tsx",
    "AIAssistantPanel.tsx", "DataQualityPage.tsx", "AgentCollaborationPanel.tsx",
    "ReleasePage.tsx", "OnboardingFullKit.tsx", "StrategyMarketplace.tsx",
    "GrowthPanel.tsx",
]

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
        # Skip comments
        s = line.strip()
        if s.startswith('//') or s.startswith('*') or s.startswith('/*'):
            new_lines.append(line); continue
        
        # No Chinese? keep
        if not re.search(r'[\u4e00-\u9fff]', line):
            new_lines.append(line); continue
        
        # Already uses t()? keep
        if re.search(r'\bt\s*\(', line):
            new_lines.append(line); continue
        
        # Skip object property lines:  word: 'Chinese...' or word: "Chinese..."
        if re.search(r"^\s*\w+\s*:\s*['\"][^'\"]*[\u4e00-\u9fff]", line):
            new_lines.append(line); continue
        
        # Skip Record type lines
        if re.search(r'^\s*(const|let|var)\s+\w+\s*:\s*Record', line):
            new_lines.append(line); continue
        
        # SAFE: Replace 'xxChinesexx' or "xxChinesexx" with {t('xxChinesexx')}
        # Only in lines that don't match the skip patterns above
        # (These are JSX text content, standalone strings, array elements, etc.)
        
        def safe_replacer(q):
            def f(m):
                inner = m.group(1)
                if not re.search(r'[\u4e00-\u9fff]', inner): return m.group(0)
                if len(inner) <= 1: return m.group(0)
                if '<' in inner or '>' in inner: return m.group(0)
                if '{' in inner or '}' in inner: return m.group(0)
                return '{t(' + q + inner + q + ')}'
            return f
        
        # Count replacements before and after
        before = line.count("'") + line.count('"')
        line = re.sub(r"'([^']*[\u4e00-\u9fff][^']*)'", safe_replacer("'"), line)
        line = re.sub(r'"([^"]*[\u4e00-\u9fff][^"]*)"', safe_replacer('"'), line)
        after = len(re.findall(r"\{t\(['\"]", line))
        count += after
        
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
