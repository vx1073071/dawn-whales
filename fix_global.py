import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/lib/bridge-api.ts', 'rb') as f:
    data = f.read()

# The declare global block needs to close. Find the pattern:
# };  (closes api object)
# }   (closes Window interface)  
# (missing })  (should close declare global)
# 
# function hasIPC

# Look for the pattern
pattern1 = b'    };\r\n  }\r\n\r\nfunction hasIPC'
pattern2 = b'    };\n  }\n\nfunction hasIPC'
pattern3 = b'    };\r\n  }\r\nfunction hasIPC'
pattern4 = b'    };\n  }\nfunction hasIPC'

if pattern1 in data:
    data = data.replace(pattern1, b'    };\r\n  }\r\n}\r\n\r\nfunction hasIPC', 1)
    print('Fixed: added declare global close (CRLF)')
elif pattern2 in data:
    data = data.replace(pattern2, b'    };\n  }\n}\n\nfunction hasIPC', 1)
    print('Fixed: added declare global close (LF)')
elif pattern3 in data:
    data = data.replace(pattern3, b'    };\r\n  }\r\n}\r\nfunction hasIPC', 1)
    print('Fixed: added declare global close (CRLF, no blank)')
elif pattern4 in data:
    data = data.replace(pattern4, b'    };\n  }\n}\nfunction hasIPC', 1)
    print('Fixed: added declare global close (LF, no blank)')
else:
    print('Pattern not found!')
    # Show bytes around 'hasIPC'
    idx = data.find(b'function hasIPC')
    if idx >= 0:
        print(f'Context before hasIPC: {repr(data[idx-50:idx])}')
    # Show bytes around closing api
    idx2 = data.find(b'hasIPC')
    if idx2 >= 0:
        print(f'Bytes around hasIPC: {repr(data[idx2-30:idx2+20])}')

# Also remove the extra } at end if we added one earlier
if data.endswith(b'}\n') or data.endswith(b'}\r\n'):
    # Check if there's an extra }
    pass

# Count braces
opens = data.count(b'{')
closes = data.count(b'}')
print(f'Braces: open={opens}, close={closes}, diff={opens-closes}')

with open('src/lib/bridge-api.ts', 'wb') as f:
    f.write(data)
print('Saved')
