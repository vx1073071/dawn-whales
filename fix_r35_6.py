with open('tests/closed-loop-integration.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    "import { describe, it, expect, beforeEach } from 'vitest';",
    "import { describe, it, expect, beforeEach, vi } from 'vitest';"
)
with open('tests/closed-loop-integration.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('vi imported ok')