import re, glob

ml_files = [
    'src/components/dashboard/AIDailyDigestPanel.tsx',
    'src/components/strategy/StrategyPage.tsx',
    'src/components/billing/core/ThemeLangPanel.tsx',
    'src/components/billing/core/CopyPolish.tsx',
    'src/components/billing/core/UIAuditPanel.tsx',
    'src/components/marketplace/MarketplacePage.tsx',
    'src/components/marketplace/MarketplacePublishPanel.tsx',
]

total = 0
for f in ml_files:
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    original = content
    
    # Add import if needed
    if 'useTranslation' not in content:
        content = re.sub(
            r"(import\s+.*from\s+['\"]react['\"]\s*;)",
            r"\1\nimport { useTranslation } from 'react-i18next';",
            content
        )
    
    count = 0
    def safe_replace(m):
        global count
        s = m.group(1)
        if not any(ord(c) > 127 for c in s):
            return m.group(0)
        if '<' in s or '>' in s or '{' in s or '}' in s:
            return m.group(0)
        before = content[max(0, m.start()-5):m.start()]
        if 't(' in before:
            return m.group(0)
        if s.startswith('/') or s.startswith('.') or '//' in s or 'http' in s:
            return m.group(0)
        count += 1
        return "t('" + s + "')"
    
    content = re.sub(r"'([^']*)'", safe_replace, content)
    
    if content != original:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(content)
        name = f.split('/')[-1]
        print(f'  {name}: {count}')
        total += count

print(f'\nTotal: {total} replacements')
