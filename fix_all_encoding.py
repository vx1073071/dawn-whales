#!/usr/bin/env python3
"""Fix UTF-8 corruption in IPC .ts files.

Corruption: GBK-encoded Chinese chars got byte-stuffed into Latin-1, then
re-encoded as UTF-8, producing U+FFFD (\xef\xbf\xbd) replacement chars.
Pattern at end of strings: '\xef\xbf\xbd?' or '\xef\xbf\xbd? '
Fix: remove the \xef\xbf\xbd? sequences, keep the closing ';
"""
from pathlib import Path

ROOT = Path(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\ipc')
# U+FFFD replacement char + ASCII '?' (byte 0x3f)
CORRUPT_SEQ = b'\xef\xbf\xbd?'

total_fixes = 0
total_files = 0

for fp in sorted(ROOT.glob('*.ts')):
    data = fp.read_bytes()
    if CORRUPT_SEQ not in data:
        continue

    count = data.count(CORRUPT_SEQ)
    new_data = data.replace(CORRUPT_SEQ, b'')
    
    if new_data != data:
        fp.write_bytes(new_data)
        total_fixes += count
        total_files += 1
        print(f"Fixed {fp.name}: {count} occurrence(s)")

print(f"\nTotal: {total_fixes} fixes in {total_files} files")
