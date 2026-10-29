@echo off
title LAN Chat Server
cd /d "%~dp0"

if exist "%~dp0node.exe" (
  "%~dp0node.exe" server.js
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo node.exe not found.
    echo Put node.exe from the Node.js "Windows Binary (.zip)" download in this folder.
    pause
    exit /b 1
  )
  node server.js
)
pause
