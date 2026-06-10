import re, glob

# Key patterns: replace standalone Chinese in JSX
# Match: whitespace-separated Chinese text between tags
cn_words = [
    '历史', '删除', '触发历史', '暂无触发记录', '上次触发', '累计', '次',
    '止损价', '止盈价', '委托价', '成交价', '委托量', '成交量',
    '暂停', '恢复', '停止', '运行中', '已暂停', '已停止',
    '新建策略', '导入策略', '导出策略', '复制策略', '分享策略',
    '参数优化', '因子分析', '相关性', '业绩归因',
    '日', '周', '月', '年', '全部', '买入', '卖出',
    '收益率', '年化收益率', '累计收益率', '盈亏',
]

jvs_dirs = [
    'src/components/trading',
    'src/components/ai',
    'src/components/backtest',
    'src/components/tools',
    'src/components/release',
    'src/components/pm',
    # also do remaining small dirs  
    'src/components/common',
    'src/components/mobile',
    'src/components/data',
    'src/components/header',
]

total = 0
for d in jvs_dirs:
    for f in glob.glob(f'{d}/**/*.tsx', recursive=True):
        with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
            content = fh.read()
        
        original = content
        reps = 0
        
        for cn in sorted(cn_words, key=lambda x: -len(x)):
            # Match inside JSX text nodes (between > and <, possibly with whitespace)
            pattern = re.compile(r'((?:^|\n)\s*' + re.escape(cn) + r'\s*(?:\n|$|<)|>' + re.escape(cn) + r'<|>\s*' + re.escape(cn) + r'\s*<)')
            # simpler: just replace the text if it appears in JSX context
            for m in re.finditer(r'>\s*' + re.escape(cn) + r'\s*<', content):
                start, end = m.span()
                before = content[max(0, start-30):start]
                if 't(' in before[-8:] or '{t(' in before[-10:]:
                    continue
                # Replace the Chinese with t() call
                match_text = m.group(0)
                replacement = match_text.replace(cn, '{t("components.' + cn + '")}')
                content = content.replace(match_text, replacement, 1)
                reps += 1
                break  # One at a time to avoid overlap
        
        if reps > 0:
            if 'useTranslation' not in content:
                content = re.sub(
                    r"(import\s+.*from\s+['\"]react['\"]\s*;)",
                    r"\1\nimport { useTranslation } from 'react-i18next';",
                    content
                )
            if re.search(r'export\s+default\s+function', content) and 'const { t } = useTranslation()' not in content:
                content = re.sub(
                    r'(export\s+default\s+function\s+\w+\([^)]*\)\s*\{)',
                    r'\1\n  const { t } = useTranslation();',
                    content
                )
            
            with open(f, 'w', encoding='utf-8') as fh:
                fh.write(content)
            total += reps
            print(f'  {f}: {reps}')

print(f'\nTotal replacements: {total}')
