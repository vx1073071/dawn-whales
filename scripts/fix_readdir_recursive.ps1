# fix_readdir_recursive.ps1 — Replace flat readdirSync with recursive walk in regression gate tests
$td = "C:\Users\vx107\.easyclaw\workspace\dawn-whales\tests"
$hp = "C:\Users\vx107\.easyclaw\workspace\dawn-whales\tests\helpers\engine-paths.ts"

# Inline recursive function to inject (placed after imports)
$injectHelper = @"
// [R92] Recursive directory walker for restructured engine subdirs
function _walkRecursive(dir: string): string[] {
  let r: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true } as any)) {
    if ((e as any).isDirectory()) r = r.concat(_walkRecursive(require('path').join(dir, (e as any).name)));
    else r.push((e as any).name);
  }
  return r;
}
"@

# Files that need recursive readdir fix (from batch test output)
$files = @(
  "q60-03-regression.test.ts",
  "q61-03-regression.test.ts",
  "q63-03-regression.test.ts",
  "q69-02-guest-perf-e2e.test.ts",
  "q70-02-deploy-fullchain-e2e.test.ts",
  "q71-02-regression-gate-5600.test.ts",
  "q72-01-community-e2e-feed.test.ts",
  "q72-02-factor-compare-portfolio.test.ts",
  "q72-03-monitoring-regression.test.ts",
  "q73-03-regression-gate-5800.test.ts",
  "q74-01-build-deploy-verify.test.ts",
  "q74-02-regression-gate-5800.test.ts",
  "q75-03-regression-gate-5800.test.ts",
  "q76-03-regression-gate-6000.test.ts",
  "q77-01-security-e2e.test.ts",
  "q77-02-etimedout-fix.test.ts",
  "q78-03-regression-6250.test.ts",
  "q79-01-i18n-consistency.test.ts",
  "q79-02-coverage-gate-60.test.ts",
  "q79-05-regression-6400.test.ts",
  "q80-01-growth-funnel-invite.test.ts",
  "q80-03-regression-6500.test.ts",
  "q81-01-regression-6500-5r.test.ts",
  "q81-02-fullchain-e2e-final.test.ts"
)

$fixed = 0
foreach ($f in $files) {
  $p = Join-Path $td $f
  if (-not (Test-Path $p)) { Write-Host "NOT FOUND: $f"; continue }
  $c = Get-Content $p -Raw -Encoding utf8
  $original = $c

  # Inject helper after first import or first line
  if (-not $c.Contains("_walkRecursive")) {
    # Find a good injection point: after last import line
    $lines = $c -split "`n"
    $lastImportIdx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match "^import ") { $lastImportIdx = $i }
    }
    if ($lastImportIdx -ge 0) {
      $before = $lines[0..$lastImportIdx] -join "`n"
      $after = $lines[($lastImportIdx+1)..($lines.Count-1)] -join "`n"
      $c = "$before`n$injectHelper`n$after"
    } else {
      $c = "$injectHelper`n$c"
    }
  }

  # Replace flat readdirSync patterns with recursive
  # Pattern: fs.readdirSync(engineDir).filter(f => f.endsWith('.ts'))
  $c = $c -replace "fs\.readdirSync\((\w+)\)\.filter\(\s*f\s*=>\s*f\.endsWith\(['\`"]\.ts['\`"]\)\s*\)", '_walkRecursive($1).filter(f => f.endsWith(''.ts''))'
  # Pattern: fs.readdirSync(engineDir).filter(function(f) { return f.endsWith('.ts') })
  $c = $c -replace "fs\.readdirSync\((\w+)\)\.filter\(function\(\s*f[^)]*\)\s*\{\s*return\s*f\.endsWith\(['\`"]\.ts['\`"]\)\s*;?\s*\}\)", '_walkRecursive($1).filter(function(f: string) { return f.endsWith(''.ts''); })'
  # Pattern: fs.readdirSync(ENGINE).filter(...)  (variable named ENGINE)
  $c = $c -replace "fs\.readdirSync\((ENGINE)\)\.filter\(\s*f\s*=>\s*f\.endsWith\(['\`"]\.ts['\`"]\)\s*\)", '_walkRecursive($1).filter(f => f.endsWith(''.ts''))'
  # Pattern: fs.readdirSync(engineDir) in for-of loops (no filter)
  $c = $c -replace "for \(const f of fs\.readdirSync\((\w+)\)\)", 'for (const f of _walkRecursive($1))'
  # Pattern: count += fs.readdirSync(engineDir).length
  $c = $c -replace "count \+= fs\.readdirSync\((\w+)\)\.length", 'count += _walkRecursive($1).length'

  if ($c -ne $original) {
    Set-Content $p $c -Encoding utf8 -NoNewline
    $fixed++
    Write-Host "Fixed: $f"
  } else {
    Write-Host "No changes: $f"
  }
}

Write-Host "`nRecursive readdir fix: $fixed files updated"
