@echo off
REM Quick Fix for Next.js Issues
REM Run this: .\quick-fix.bat

echo.
echo ========================================
echo   Next.js Quick Fix
echo ========================================
echo.

echo [1/5] Killing Node processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo   ✓ Node processes killed
) else (
    echo   - No Node processes found
)
timeout /t 1 /nobreak >nul

echo.
echo [2/5] Cleaning .next directory...
if exist ".next" (
    rmdir /s /q ".next"
    echo   ✓ .next directory removed
) else (
    echo   - .next directory doesn't exist
)

echo.
echo [3/5] Checking for lock files...
if exist ".next\dev\lock" (
    del /f ".next\dev\lock"
    echo   ✓ Lock file removed
) else (
    echo   - No lock file found
)

echo.
echo [4/5] Verifying dependencies...
if not exist "node_modules\date-fns" (
    echo   Installing date-fns...
    call npm install date-fns
) else (
    echo   ✓ date-fns already installed
)

echo.
echo [5/5] Checking environment variables...
if exist ".env.local" (
    findstr /C:"STRIPE_CLIENT_ID" .env.local >nul
    if %errorlevel% equ 0 (
        echo   ✓ .env.local exists
    ) else (
        echo   ⚠ STRIPE_CLIENT_ID missing in .env.local
    )
) else (
    echo   ⚠ .env.local not found!
)

echo.
echo ========================================
echo   Fix Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Update next.config.js (if needed)
echo 2. Verify .env.local has all variables
echo 3. Run: npm run dev
echo.
echo Press any key to start dev server...
pause >nul

echo.
echo Starting dev server...
npm run dev