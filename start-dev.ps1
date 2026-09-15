#!/usr/bin/env powershell

# Set up Node.js portable path
$nodeDir = "C:\Users\DELL\web\node"
$env:Path = "$nodeDir;$env:Path"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Jay Mataji Redium Art" -ForegroundColor Yellow
Write-Host "   Development Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting Next.js development server..." -ForegroundColor Green
Write-Host ""

Write-Host "Node version:" -ForegroundColor Yellow
& "$nodeDir\node.exe" --version

Write-Host "npm version:" -ForegroundColor Yellow
& "$nodeDir\npm.cmd" --version

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   SERVER STARTING..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Web:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "👨‍💼 Admin:  http://localhost:3000/admin" -ForegroundColor Cyan
Write-Host "📧 Email: admin@jaymataji.com" -ForegroundColor Cyan
Write-Host "🔑 Pass:  Admin@123" -ForegroundColor Cyan
Write-Host ""

# Run next dev
Push-Location "C:\Users\DELL\web"
& "$nodeDir\npm.cmd" run dev
Pop-Location
