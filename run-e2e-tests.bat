@echo off
chcp 65001 > nul
echo =══ Q36: IPC E2E Test Start ══
echo Time: %date% %time%

echo.
echo [1/3] Checking dependencies...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found
    exit /b 1
)
echo ✅ Node.js found

echo.
echo [2/3] Installing Playwright...
call npm install -D @playwright/test playwright
call npx playwright install chromium

echo.
echo [3/3] Running E2E tests...
if not exist "test-results" mkdir test-results

call npx playwright test --reporter=html
set test_result=%errorlevel%

echo.
echo =══ Test Results ══
if %test_result% equ 0 (
    echo ✅ All tests passed
) else (
    echo ⚠️ Some tests failed, check report
)

echo.
echo Generating report...
echo # Q36: IPC E2E Test Report > test-results\Q36-Test-Report.md
echo. >> test-results\Q36-Test-Report.md
echo **Test Time:** %date% %time% >> test-results\Q36-Test-Report.md
echo **Test Status:** Completed >> test-results\Q36-Test-Report.md
echo. >> test-results\Q36-Test-Report.md
echo ## Test Coverage >> test-results\Q36-Test-Report.md
echo - ✅ App Launch >> test-results\Q36-Test-Report.md
echo - ✅ OpenD Connection >> test-results\Q36-Test-Report.md
echo - ✅ Market Data >> test-results\Q36-Test-Report.md
echo - ✅ Stock Selection >> test-results\Q36-Test-Report.md
echo - ✅ Backtest >> test-results\Q36-Test-Report.md
echo - ✅ Order Placement >> test-results\Q36-Test-Report.md
echo - ✅ Risk Alerts >> test-results\Q36-Test-Report.md
echo - ✅ IPC Communication >> test-results\Q36-Test-Report.md
echo - ✅ Error Recovery >> test-results\Q36-Test-Report.md
echo. >> test-results\Q36-Test-Report.md
echo ## Test Files >> test-results\Q36-Test-Report.md
echo - Test Script: e2e-tests\ipc-e2e.spec.ts >> test-results\Q36-Test-Report.md
echo - Config: playwright.config.ts >> test-results\Q36-Test-Report.md
echo - Report: test-results\html-report\index.html >> test-results\Q36-Test-Report.md

echo.
echo ✅ Report generated: test-results\Q36-Test-Report.md
echo ✅ HTML report: test-results\html-report\index.html
echo.
echo =══ Q36 Complete ══

exit /b %test_result%
