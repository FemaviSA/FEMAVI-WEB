@echo off
title Explorar archivos del sistema FEMAVI
cd /d "%~dp0"
echo Buscando los archivos del sistema en G:. Puede tardar varios minutos.
echo.
"%~dp0node.exe" --max-old-space-size=1024 "%~dp0explorar.js"
echo.
pause
