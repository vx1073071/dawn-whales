@echo off
REM Start all 14 agents in headless mode
REM PM (WorkBuddy) is started separately in window mode

echo ==========================================
echo Starting 14 Lobster Agent Fleet
echo ==========================================

set AGENTS=agent-market agent-account agent-history agent-futu agent-intl agent-strategy agent-risk agent-exec agent-auto agent-ui-trade agent-ui-mon agent-ui-config agent-qa agent-devops

for %%%%A in (%AGENTS%) do (
  echo Starting %%%%A...
  start "%%%%A" /min cmd /c "C:\Users\vx107\.easyclaw\workspace\dawn-whales\scripts\start-agent.bat %%%%A"
  timeout /t 2 /nobreak >nul
)

echo ==========================================
echo All 14 agents started!
echo Use PM dashboard to monitor status.
echo ==========================================
