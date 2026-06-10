import re

files = [
    'src/components/billing/onboarding/OnboardingFullKit.tsx',
    'src/components/billing/core/HelpCenter.tsx',
    'src/components/billing/core/LandingPageV18.tsx',
    'src/components/ai/AIAssistantPanel.tsx',
    'src/components/dashboard/AIDailyDigestPanel.tsx',
]

for f in files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
        content = fh.read()
    
    # Get lines with hardcoded Chinese
    ui_total = 0
    data_total = 0
    for i, line in enumerate(content.split('\n'), 1):
        cn = re.findall(r'[\u4e00-\u9fff]', line)
        if not cn: continue
        s = line.strip()
        if re.search(r"t\s*\(\s*['\"]", s) or s.startswith('//') or s.startswith('*') or s.startswith('import'):
            continue
        
        cn_text = ''.join(cn)
        # UI text: has JSX attributes, title, label, button text, etc
        is_ui = any(kw in s for kw in ['className=', 'title=', 'label=', 'placeholder=', 'desc', 'button', 'aria-', 'alt=', 'header', 'children', '{/*', '*/}'])
        # Data: stock names, strategy descriptions, demo content, mock JSON
        is_data = any(kw in s for kw in ['name:', 'content:', 'answer:', 'description:', 'question:', 'symbol:', 'desc:', 'ticker', 'stock', 'strategy', 'heading:', 'icon:'])
        
        if is_ui and not is_data:
            ui_total += len(cn_text)
        elif is_data:
            data_total += len(cn_text)
        else:
            ui_total += len(cn_text)  # default to UI
    
    name = f.split('/')[-1]
    print(f'{name}:  UI={ui_total}  Data/Mock={data_total}')

print()
print('Conclusion: if UI < 100, file is mostly mock data - skip i18n')
