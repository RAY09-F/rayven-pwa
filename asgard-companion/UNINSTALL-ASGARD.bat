@rem Remove only ASGARD voice startup integration; preserve recordings and secrets.
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
