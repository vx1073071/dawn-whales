import subprocess, sys
result = subprocess.run(['git', 'diff', 'HEAD', '--', 'src/lib/bridge-api.ts'],
                        capture_output=True, errors='replace')
raw = result.stdout
try:
    text = raw.decode('utf-8-sig', errors='replace')
except:
    text = raw.decode('latin-1', errors='replace')
with open('diff_ba_out.txt', 'w', encoding='utf-8-sig') as f:
    f.write(text)
print('Written', len(text), 'chars')