#!/usr/bin/env python3
"""Fix StrategyPage.tsx: restore finally blocks."""
from pathlib import Path

fp = Path(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\src\components\strategy\StrategyPage.tsx')
text = fp.read_text(encoding='utf-8')
lines = text.split('\n')

import re

fixed = 0
for i, line in enumerate(lines):
    if '} catch (e) { console.error' in line and '[Error:StrategyPage]' in line:
        stripped = line.rstrip()
        if stripped.endswith('};'):
            # Calculate indent of this line
            indent = len(line) - len(line.lstrip())
            
            # Check next lines
            if i + 2 < len(lines):
                next_line = lines[i + 1]
                next2_line = lines[i + 2]
                
                if 'set' in next_line and '(false)' in next_line:
                    set_indent = len(next_line) - len(next_line.lstrip())
                    close_indent = len(next2_line) - len(next2_line.lstrip())
                    
                    print(f"L{i+1}: {repr(line)}")
                    print(f"L{i+2}: {repr(next_line)}")
                    print(f"L{i+3}: {repr(next2_line)}")
                    
                    # Build correct replacement
                    # catch line: add ' finally {' before the final ';' 
                    # The line ends with '};' - replace with '}; } finally {'
                    # Actually: '} catch (e) { ... }; ' → '} catch (e) { ... }; } finally {'
                    new_catch = line.rstrip()[:-1] + ' } finally {'
                    
                    # setXXX line: should be 2 more indent than catch
                    expected_indent = indent + 2
                    if set_indent != expected_indent:
                        new_stmt = ' ' * expected_indent + next_line.lstrip()
                    else:
                        new_stmt = next_line
                    
                    # close brace: should match catch indent
                    new_close = ' ' * indent + '}'
                    
                    print(f"  -> L{i+1}: {repr(new_catch)}")
                    print(f"  -> L{i+2}: {repr(new_stmt)}")
                    print(f"  -> L{i+3}: {repr(new_close)}")
                    
                    lines[i] = new_catch
                    lines[i + 1] = new_stmt
                    lines[i + 2] = new_close
                    fixed += 1
                    print()

print(f"Fixed {fixed} instances")
if fixed:
    result = '\n'.join(lines)
    fp.write_text(result, encoding='utf-8', newline='\n')
    print("Written!")
