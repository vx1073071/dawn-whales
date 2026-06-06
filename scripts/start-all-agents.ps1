# Start all 14 agents
$agents = @(
    "market","account","history","futu","intl",
    "strategy","risk","exec","auto",
    "ui-trade","ui-mon","ui-config","qa","devops"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Starting 14 Lobster Agent Fleet" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$BASE = "C:\Users\vx107\.easyclaw\workspace"

foreach ($agent in $agents) {
    $dir = "$BASE\agent-$agent"
    Write-Host "[*] Starting agent-$agent ..." -ForegroundColor Green

    $env:AGENT_MODE = "headless"
    $env:AGENT_ROLE = $agent

    Start-Process -FilePath "cmd" -ArgumentList "/c cd /d `"$dir`" && npm run dev:agent" -WindowStyle Hidden

    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  All 14 agents started!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
