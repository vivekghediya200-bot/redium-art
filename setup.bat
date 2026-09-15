@echo off
REM Jay Mataji Redium Art - Quick Setup Script
REM This script will set up everything after Node.js is installed

echo.
echo ====================================
echo Jay Mataji Redium Art Setup
echo ====================================
echo.

REM Check if Node.js is installed
echo Checking for Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart your terminal and run this script again
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js found: 
node --version

echo.
echo Installing dependencies (this may take 2-3 minutes)...
call npm install

if errorlevel 1 (
    echo.
    echo ❌ Failed to install dependencies
    echo Check your internet connection and try again
    echo.
    pause
    exit /b 1
)

echo.
echo ✓ Dependencies installed successfully!
echo.
echo ====================================
echo Setup Complete! 🎉
echo ====================================
echo.
echo Next steps:
echo 1. Update .env.local with your MongoDB connection string
echo 2. Run: npm run dev
echo 3. Open: http://localhost:3000
echo.
echo Admin Panel: http://localhost:3000/admin
echo Default Email: admin@jaymataji.com
echo Default Password: Admin@123
echo.
pause
