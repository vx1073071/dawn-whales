import os

f = r"C:\Users\vx107\.jvs\.openclaw\workspace\dawn-whales\electron\engine\strategy-engine.ts"

with open(f, "rb") as fh:
    data = fh.read()

# Fix corrupted byte sequence: E7 95 3F 3B -> E7 95 A5 27 3B
# (策略';) where 略 was corrupted
old = b'\xe7\x95\x3f\x3b'
new = b'\xe7\x95\xa5\x27\x3b'

count = data.count(old)
print(f"Found {count} occurrences of corrupted sequence")

if count > 0:
    data = data.replace(old, new)
    with open(f, "wb") as fh:
        fh.write(data)
    print("Fixed!")
else:
    print("No corrupted sequences found")
