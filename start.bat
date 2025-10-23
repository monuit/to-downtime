@echo off
REM Quick setup script for Toronto Downtime (Windows)

echo 🚇 Setting up Toronto Downtime...

REM Check if bun is available
where bun >nul 2>nul
if %errorlevel% equ 0 (
    echo ✓ Using Bun
    call bun install
    echo ✓ Dependencies installed
    echo.
    echo 🚀 Starting dev server...
    call bun run dev
) else (
    REM Try npm
    where npm >nul 2>nul
    if %errorlevel% equ 0 (
        echo ✓ Using npm
        call npm install
        echo ✓ Dependencies installed
        echo.
        echo 🚀 Starting dev server...
        call npm run dev
    ) else (
        echo ❌ Neither bun nor npm found. Please install Node.js or Bun.
        pause
        exit /b 1
    )
)
