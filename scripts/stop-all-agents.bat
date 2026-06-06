@echo off
REM Stop all agent processes

echo Stopping all agent processes...

taskkill /F /FI "WINDOWTITLE eq agent-*" 2>nul
taskkill /F /IM "node.exe" /FI "COMMANDLINE eq *AGENT_HEADLESS*" 2>nul

echo All agents stopped.
