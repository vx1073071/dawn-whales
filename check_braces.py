import sys
sys.stdout.reconfigure(encoding='utf-8')

def check_braces(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    depth = 0
    for i, line in enumerate(lines):
        in_single = False
        in_double = False
        in_backtick = False
        j = 0
        while j < len(line):
            c = line[j]
            if in_single:
                if c == '\\':
                    j += 2
                    continue
                if c == "'":
                    in_single = False
            elif in_double:
                if c == '\\':
                    j += 2
                    continue
                if c == '"':
                    in_double = False
            elif in_backtick:
                if c == '\\':
                    j += 2
                    continue
                if c == '`':
                    in_backtick = False
            else:
                if c == "'":
                    in_single = True
                elif c == '"':
                    in_double = True
                elif c == '`':
                    in_backtick = True
                elif c == '/':
                    # Check for line comment
                    if j + 1 < len(line) and line[j+1] == '/':
                        break  # Rest of line is comment
                    elif j + 1 < len(line) and line[j+1] == '*':
                        # Block comment - skip until */
                        j += 2
                        while j + 1 < len(line):
                            if line[j] == '*' and line[j+1] == '/':
                                j += 2
                                break
                            j += 1
                        else:
                            break
                        continue
                elif c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth < 0:
                        print(f'  NEGATIVE DEPTH at line {i+1}: depth={depth}')
            j += 1
    
    print(f'  {filepath}: final depth = {depth} (should be 0)')
    return depth

print('Checking bridge-api.ts...')
check_braces('src/lib/bridge-api.ts')

print('\nChecking MarketPage.tsx...')
check_braces('src/components/market/MarketPage.tsx')

print('\nChecking TradingDeskPage.tsx...')
check_braces('src/components/orders/TradingDeskPage.tsx')
