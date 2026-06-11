#!/bin/bash
cd /c/Users/vx107/.easyclaw/workspace/dawn-whales
echo "=== EXCLUDE COUNT ==="
grep -c "'" vitest.config.ts | head -1
echo "---"
grep "^\s*'" vitest.config.ts | head -30
echo "=== END EXCLUDE ==="
echo ""
echo "=== RUNNING TESTS ==="
npx vitest run 2>&1 | grep -E "Tests|Test Files|passed|failed" | tail -10
echo "=== END TESTS ==="
echo ""
echo "=== FAIL SUMMARY ==="
npx vitest run 2>&1 | grep "FAIL\|×\|failed" | tail -30
echo "=== END FAIL ==="
