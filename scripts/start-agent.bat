@echo off
REM Start a single agent in headless mode
set AGENT=%1
if "%AGENT%"=="" (
  echo Usage: start-agent.bat ^<agent-name^>
  echo Example: start-agent.bat market
  exit /b 1
)

echo Starting %AGENT% in headless mode...

set AGENT_MODE=headless
set AGENT_ROLE=%AGENT%

cd /d C:\Users\vx107\.easyclaw\workspace\agent-%AGENT%
if errorlevel 1 (
  echo ERROR: Workspace not found for agent-%AGENT%
  exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
  echo Installing dependencies for agent-%AGENT%...
  call npm install
)

call npm run dev:agent
