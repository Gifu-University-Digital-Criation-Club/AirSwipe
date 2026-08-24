@echo off
setlocal

PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0起動.ps1"
if errorlevel 1 pause
