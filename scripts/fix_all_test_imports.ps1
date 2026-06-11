# fix_all_test_imports.ps1 — Batch fix all test import paths for JVS engine restructure
# Maps flat electron/engine/<module> → electron/engine/<subdir>/<module>
param([switch]$DryRun)

$td = "C:\Users\vx107\.easyclaw\workspace\dawn-whales\tests"
$ed = "C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\engine"

# Build mapping from actual filesystem
$mapping = @{}
Get-ChildItem $ed -Recurse -Filter "*.ts" | Where-Object {
  $_.Name -ne "index.ts" -and $_.Name -notmatch "\.d\.ts$" -and $_.Name -notmatch "\.worker\."
} | ForEach-Object {
  $base = $_.BaseName
  $rel = $_.FullName.Replace("$ed\","").Replace("\","/")
  # subdir/file.ts → subdir
  $subdir = ($rel -split "/")[0]
  if ($subdir -ne "$base.ts") {
    $mapping[$base] = "$subdir/$base"
  }
}

Write-Host "Mapping built: $($mapping.Count) modules"

# Find all test files with old-style imports
$testFiles = Get-ChildItem $td -Filter "*.test.ts" -Recurse
$testFiles += Get-ChildItem $td -Filter "*.test.tsx" -Recurse
Write-Host "Test files found: $($testFiles.Count)"

$totalFixed = 0
$filesFixed = 0
$filesList = @()

foreach ($tf in $testFiles) {
  $content = Get-Content $tf.FullName -Raw -Encoding utf8
  if ($null -eq $content) { continue }
  $original = $content
  $fileFixes = 0

  foreach ($kv in $mapping.GetEnumerator()) {
    $old = $kv.Key
    $new = $kv.Value

    # Pattern 1: from '../electron/engine/<module>'
    $p1 = "electron/engine/$old'"
    $r1 = "electron/engine/$new'"
    if ($content.Contains($p1) -and -not $content.Contains($r1)) {
      $content = $content.Replace($p1, $r1)
      $fileFixes++
    }

    # Pattern 2: from "../electron/engine/<module>"
    $p2 = "electron/engine/$old`""
    $r2 = "electron/engine/$new`""
    if ($content.Contains($p2) -and -not $content.Contains($r2)) {
      $content = $content.Replace($p2, $r2)
      $fileFixes++
    }

    # Pattern 3: from '../electron/engine/<module>.js'
    $p3 = "electron/engine/$old.js'"
    $r3 = "electron/engine/$new.js'"
    if ($content.Contains($p3) -and -not $content.Contains($r3)) {
      $content = $content.Replace($p3, $r3)
      $fileFixes++
    }

    # Pattern 4: require('../electron/engine/<module>')
    $p4 = "electron/engine/$old')"
    $r4 = "electron/engine/$new')"
    if ($content.Contains($p4) -and -not $content.Contains($r4)) {
      $content = $content.Replace($p4, $r4)
      $fileFixes++
    }

    # Pattern 5: vi.mock path (without quotes variation)
    $p5 = "electron/engine/$old"
    # Already handled by p1/p2 but vi.mock might use different quote style
  }

  # Also fix case-sensitive issues: AI-to-execution-bridge vs ai-to-execution-bridge
  $content = $content.Replace("electron/engine/AI-to-execution-bridge", "electron/engine/agents/ai-to-execution-bridge")
  $content = $content.Replace("electron/engine/AI-To-Execution-Bridge", "electron/engine/agents/ai-to-execution-bridge")

  if ($content -ne $original) {
    if (-not $DryRun) {
      Set-Content $tf.FullName $content -Encoding utf8 -NoNewline
    }
    $totalFixed += $fileFixes
    $filesFixed++
    $filesList += $tf.Name
    Write-Host "  Fixed $($tf.Name): $fileFixes replacements"
  }
}

Write-Host "`n=== Summary ==="
Write-Host "Files fixed: $filesFixed"
Write-Host "Total replacements: $totalFixed"
if ($DryRun) { Write-Host "(DRY RUN — no files written)" }
