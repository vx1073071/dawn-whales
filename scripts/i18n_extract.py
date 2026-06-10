import os, re, glob, json
from collections import Counter

def slugify(text):
    """Convert Chinese text to a safe i18n key prefix"""
    # Try to use pinyin-like approach: just use category prefix
    return re.sub(r'[^\w]', '_', text.lower())[:40]

files = glob.glob('src/components/**/*.tsx', recursive=True)

# Collect all Chinese strings
cn_strings = Counter()
for f in files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
        content = fh.read()
    # JSX text
    for m in re.finditer(r'>([^<]{2,})<', content):
        s = m.group(1).strip()
        if re.search(r'[\u4e00-\u9fff]', s) and len(s) >= 2:
            cn_strings[s] += 1
    # Single-quoted strings
    for m in re.finditer(r"'([^']{2,})'", content):
        s = m.group(1).strip()
        if re.search(r'[\u4e00-\u9fff]', s) and len(s) >= 2:
            cn_strings[s] += 1
    # Double-quoted (non-path)
    for m in re.finditer(r'"([^"]{2,})"', content):
        s = m.group(1).strip()
        if re.search(r'[\u4e00-\u9fff]', s) and not s.startswith('/') and not s.startswith('#'):
            cn_strings[s] += 1

# Get strings appearing 3+ times
high_freq = {s: cnt for s, cnt in cn_strings.items() if cnt >= 3}
print(f"High-frequency CN strings (3+): {len(high_freq)}")
print(f"Total occurrences: {sum(high_freq.values())}")

# Generate i18n keys
new_keys = {}
for i, (s, cnt) in enumerate(sorted(high_freq.items(), key=lambda x: -x[1])):
    key = f"auto_{i:04d}"
    new_keys[s] = key
    if i < 30:
        print(f"  [{cnt}] {s[:60]} -> {key}")

# Load existing zh-CN.json
zh_cn_path = 'src/i18n/locales/zh-CN.json'
with open(zh_cn_path, 'r', encoding='utf-8') as fh:
    zh_cn = json.load(fh)

# Add new keys to a 'components' namespace
if 'components' not in zh_cn:
    zh_cn['components'] = {}
added = 0
for cn_text, key in new_keys.items():
    if key not in zh_cn['components']:
        zh_cn['components'][key] = cn_text
        added += 1

with open(zh_cn_path, 'w', encoding='utf-8') as fh:
    json.dump(zh_cn, fh, ensure_ascii=False, indent=2)

print(f"\nAdded {added} keys to zh-CN.json (total keys now: {len(zh_cn.get('components', {}))})")
print(f"zh-CN.json components size: {len(json.dumps(zh_cn.get('components', {}), ensure_ascii=False))} chars")
