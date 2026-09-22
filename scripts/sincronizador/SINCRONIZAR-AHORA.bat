@echo off
title Sincronizar FEMAVI ahora
cd /d "%~dp0"
echo Sincronizando. La primera vez sube todo el historial y puede tardar 10-20 minutos.
echo No cierres esta ventana hasta que diga OK o ERROR.
echo.
"%~dp0node.exe" --max-old-space-size=1024 "%~dp0sincronizar.js"
echo.
pause
