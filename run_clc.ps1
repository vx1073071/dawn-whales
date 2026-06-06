$old = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$out = & node node_modules/vitest/vitest.mjs run tests/closed-loop-executor.test.ts 2>&1
[Console]::OutputEncoding = $old
$out | Select-String -Pattern "× |Expected|received:|AssertionError|at " | Select-Object -First 30