@echo off
REM Initialize 14 agent workspaces by copying dawn-whales source
setlocal enabledelayedexpansion

echo ==========================================
echo  14-Agent Workspace Initialization
echo ==========================================
echo.

set SOURCE=C:\Users\vx107\.easyclaw\workspace\dawn-whales
set BASE=C:\Users\vx107\.easyclaw\workspace

set AGENTS=market account history futu intl strategy risk exec auto ui-trade ui-mon ui-config qa devops

set START_TIME=%TIME%
echo Start time: %START_TIME%
echo.

for %%A in (%AGENTS%) do (
  echo [*] Initializing agent-%%A ...
  set TARGET=!BASE!\agent-%%A

  if exist "!TARGET!\package.json" (
    echo     Already initialized, skipping.
  ) else (
    echo     Copying source files...
    robocopy "!SOURCE!" "!TARGET!" /E /XD node_modules .git dist dist-electron /XF *.log /NJH /NJS /NP >nul 2>&1

    echo     Initializing git...
    cd /d "!TARGET!"
    git init >nul 2>&1
    git checkout -b agent-%%A >nul 2>&1
    git add . >nul 2>&1
    git commit -m "Initial commit for agent-%%A" >nul 2>&1

    echo     Creating .env.agent file...
    echo AGENT_ROLE=%%A> "!TARGET!\.env.agent"
    echo AGENT_ID=agent-%%A>> "!TARGET!\.env.agent"

    echo     Done.
  )
  echo.
)

echo ==========================================
echo  Initialization Complete!
echo  Start time: %START_TIME%
echo  End time:   %TIME%
echo ==========================================
