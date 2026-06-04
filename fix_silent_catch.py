#!/usr/bin/env python3
"""Fix silent catch blocks in TypeScript/TSX files.

Handles:
  Pattern 1 (inline):    } catch { /* silent */ }
  Pattern 2 (inline):   } catch { }
  Pattern 3 (multi-line): } catch {
                            // silent
                          }

Replaces with: } catch (e) { console.error('...', e); }
"""

import re
from pathlib import Path

SRC_ROOT = Path(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales')
ELECTRON_ROOT = SRC_ROOT / 'electron'
FRONTEND_ROOT = SRC_ROOT / 'src'

def is_comment_only(line: str) -> bool:
    s = line.strip()
    if not s or s.startswith('//') or s.startswith('/*') or s.startswith('*') or s == '*/':
        return True
    return False

def get_error_stmt(fp: Path, is_backend: bool) -> str:
    name = fp.stem
    if is_backend:
        return f"logger.error('[backend:{name}]', e);"
    return f"console.error('[Error:{name}]', e);"

def fix_file(fp: Path, is_backend: bool) -> list[str]:
    content = fp.read_text(encoding='utf-8')
    lines = content.splitlines()
    n = len(lines)
    fixes = []
    i = 0
    
    while i < n:
        line = lines[i]
        
        # ── Check if this line has a catch { ... } on ONE line ──────────────
        # Pattern: ... } catch { ...body... } ...
        # We use search (not match) because there may be leading content
        inline = re.search(r'catch(?:\s*\([^)]*\))?\s*\{', line)
        if inline:
            # Find the { position
            brace_pos = inline.start()
            
            # Extract what comes before the catch (should include leading whitespace + })
            before_catch = line[:brace_pos]
            
            # Check: before_catch should end with } (or whitespace + })
            before_stripped = before_catch.strip()
            if not before_stripped.startswith('}'):
                i += 1
                continue
            
            # Get content after the opening {
            after_open = line[inline.end():]
            
            # Find the matching closing } for THIS catch block
            # If } is on the SAME LINE as { - easy
            if '}' in after_open:
                # Single-line catch
                # Extract the body between { and }
                after_open_stripped = after_open.lstrip()
                if after_open_stripped.startswith('}'):
                    # Empty body: } catch { }
                    err = get_error_stmt(fp, is_backend)
                    new_clause = f"catch (e) {{ {err} }}"
                    new_line = before_catch + new_clause
                    fixes.append(f"  L{i+1}: empty catch → {new_line.strip()[:70]}")
                    lines[i] = new_line
                    i += 1
                    continue
                else:
                    # Body has content - check if it's comment-only
                    # Extract body: text before the closing }
                    idx_close = after_open.rindex('}')
                    body = after_open[:idx_close]
                    # Remove comments
                    body_no_comments = re.sub(r'//[^\n]*', '', body)  # remove //
                    body_no_comments = re.sub(r'/\*[^*]*\*(?!/)*/', '', body_no_comments)  # remove /* */
                    body_no_comments = body_no_comments.strip()
                    
                    if body_no_comments == '':
                        # Comment-only body - fix it
                        err = get_error_stmt(fp, is_backend)
                        new_clause = f"catch (e) {{ {err} }}"
                        new_line = before_catch + new_clause
                        fixes.append(f"  L{i+1}: silent catch → {new_line.strip()[:70]}")
                        lines[i] = new_line
                        i += 1
                        continue
            
            # ── Multi-line catch: { is on this line but } is not ───────────
            # Verify this line has a { but no } after it
            uncommented = re.sub(r'//.*', '', after_open)
            if '{' in uncommented and '}' not in uncommented:
                # Multi-line catch - find the closing }
                depth = 1  # already inside the catch { 
                close_idx = -1
                for j in range(i + 1, n):
                    lj = lines[j]
                    uncommented_j = re.sub(r'//.*', '', lj)
                    depth += uncommented_j.count('{')
                    depth -= uncommented_j.count('}')
                    if depth == 0:
                        close_idx = j
                        break
                
                if close_idx > i:
                    body_lines = lines[i+1:close_idx]
                    if all(is_comment_only(bl) for bl in body_lines):
                        err = get_error_stmt(fp, is_backend)
                        # Find indentation of the catch line
                        indent = len(before_catch) - len(before_catch.lstrip())
                        indent_str = ' ' * indent
                        new_clause = f"catch (e) {{ {err} }}"
                        new_line = indent_str + before_stripped + ' ' + new_clause
                        fixes.append(f"  L{i+1}..L{close_idx+1}: multi-line silent catch")
                        lines[i] = new_line
                        for k in range(i + 1, close_idx + 1):
                            lines[k] = None
                        i = close_idx + 1
                        continue
        
        i += 1
    
    if fixes:
        result = [l for l in lines if l is not None]
        fp.write_text('\n'.join(result) + '\n', encoding='utf-8')
    
    return fixes


def main():
    all_changes = {}
    total = 0

    for root, label in [(ELECTRON_ROOT, 'electron'), (FRONTEND_ROOT, 'src')]:
        is_backend = (label == 'electron')
        pattern = '*.ts' if is_backend else '*.tsx'
        for fp in sorted(root.rglob(pattern)):
            fixes = fix_file(fp, is_backend)
            if fixes:
                rel = str(fp.relative_to(root))
                all_changes[rel] = fixes
                total += len(fixes)

    print(f"Total silent catches fixed: {total}")
    print(f"Files modified: {len(all_changes)}")
    print()
    for fname, fixes in sorted(all_changes.items()):
        print(f"  {fname}: {len(fixes)} catch(es)")
        for f in fixes[:3]:
            print(f)


if __name__ == '__main__':
    main()
