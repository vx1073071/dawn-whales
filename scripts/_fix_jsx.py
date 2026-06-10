import re,glob
for f in glob.glob('src/**/*.tsx', recursive=True):
    with open(f,'r',encoding='utf-8') as fh:
        orig=fh.read()
    # Fix double-braced t() in JSX object props
    # pattern:  word: {t('CN text')}  ->  word: t('CN text')
    fixed = re.sub(
        r"(\w+):\s*\{t\((['\"])([^'\"]*[\u4e00-\u9fff][^'\"]*)\2\)\}",
        r"\1: t(\2\3\2)",
        orig
    )
    if fixed!=orig:
        with open(f,'w',encoding='utf-8') as fh:
            fh.write(fixed)
        print(f'Fixed: {f}')
print('done')
