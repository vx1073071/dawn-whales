# 14-Lobster Launch Script
# 在14个独立PowerShell窗口中启动WorkBuddy会话
# 每个窗口绑定一个agent workspace

$AGENTS = @(
    @{Name="market";    Emoji="📊"; Desc="行情数据虾"},
    @{Name="account";   Emoji="💰"; Desc="账户数据虾"},
    @{Name="history";   Emoji="📚"; Desc="历史数据虾"},
    @{Name="futu";      Emoji="🇭🇰"; Desc="富途适配虾"},
    @{Name="intl";      Emoji="🌍"; Desc="海外券商虾"},
    @{Name="strategy";  Emoji="🧠"; Desc="策略引擎虾"},
    @{Name="risk";      Emoji="🛡️"; Desc="风控引擎虾"},
    @{Name="exec";      Emoji="⚡"; Desc="交易执行虾"},
    @{Name="auto";      Emoji="🤖"; Desc="自动化虾"},
    @{Name="ui-trade";  Emoji="🖥️"; Desc="交易UI虾"},
    @{Name="ui-mon";    Emoji="📈"; Desc="监控UI虾"},
    @{Name="ui-config"; Emoji="⚙️"; Desc="配置UI虾"},
    @{Name="qa";        Emoji="🧪"; Desc="QA虾"},
    @{Name="devops";    Emoji="🚀"; Desc="DevOps虾"}
)

$BASE = "C:\Users\vx107\.easyclaw\workspace"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  14-Lobster Fleet Launch" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will open 14 PowerShell windows." -ForegroundColor Yellow
Write-Host "Each window will run a WorkBuddy session for one agent." -ForegroundColor Yellow
Write-Host ""

foreach ($agent in $AGENTS) {
    $dir = "$BASE\agent-$($agent.Name)"
    $title = "$($agent.Emoji) $($agent.Desc)"

    Write-Host "  Launching $title at $dir" -ForegroundColor Green

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$host.UI.RawUI.WindowTitle='$title'; Write-Host '$title ready - cwd: $dir' -ForegroundColor Green; Set-Location '$dir'"
    )

    Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "All 14 agents launched!" -ForegroundColor Green
Write-Host "Now open WorkBuddy Desktop and point each session to its workspace:" -ForegroundColor Yellow
Write-Host "  File → Open Workspace → C:\Users\vx107\.easyclaw\workspace\agent-xxx" -ForegroundColor Yellow
