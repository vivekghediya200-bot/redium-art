@echo off
REM Jay Mataji Redium Art - Development Server Startup

title Jay Mataji - Dev Server

cd /d C:\Users\DELL\web

echo.
echo ========================================
echo   Jay Mataji Redium Art
echo   Development Server
echo ========================================
echo.
echo Starting Next.js development server...
echo.
echo Node version:
.\node\node.exe --version

echo.
echo npm version:
.\node\npm.cmd --version

echo.
echo ========================================
echo   SERVER STARTING...
echo ========================================
echo.

.\node\npm.cmd run dev

echo.
echo Server stopped.
pause
