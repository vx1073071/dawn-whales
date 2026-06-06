with open('tests/jvs-37-ipc-validation.test.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find describe('JVS-37: IPC Handler Validation'
desc_line = None
for i, l in enumerate(lines):
    if "describe('JVS-37:" in l:
        desc_line = i
        print(f'describe at {i+1}: {l[:80].strip()}')
        break

# Find ALL_HANDLERS insertion point (after describe line + opening brace)
if desc_line is not None:
    # The ALL_HANDLERS block was inserted before the describe line (lines[64])
    # Need to find and remove it from there
    # Lines after describe line:
    print(f'Lines after describe:')
    for i in range(desc_line, min(desc_line + 5, len(lines))):
        print(f'  {i+1}: {lines[i].rstrip()[:80]}')
    
    # Find where ALL_HANDLERS const ends and beforeEach starts
    # They should be right after the describe line (at desc_line+1)
    for i in range(desc_line + 1, min(desc_line + 20, len(lines))):
        if 'beforeEach' in lines[i]:
            print(f'beforeEach at {i+1}: {lines[i].rstrip()[:80]}')
            break
    for i in range(desc_line + 1, min(desc_line + 20, len(lines))):
        if 'describe' in lines[i] and 'JVS-36' in lines[i]:
            print(f'First real sub-describe at {i+1}: {lines[i].rstrip()[:80]}')
            break