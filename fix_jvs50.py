with open('tests/jvs-50-realtime-quality-monitor.test.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f'Before: {len(lines)} lines')
for i, l in enumerate(lines):
    if "vi.mock('events')" in l:
        print(f'vi.mock at line {i+1} (0-indexed: {i}): {repr(l[:50])}')
        print(f'Deleting lines {i+1} and {i+2}')
        del lines[i]
        del lines[i]  # second del now points to what was line i+2
        print(f'After: {len(lines)} lines')
        break

with open('tests/jvs-50-realtime-quality-monitor.test.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)