@echo off
title Programar sincronizador FEMAVI
cd /d "%~dp0"
schtasks /Create /TN "FEMAVI Sincronizador" /TR "wscript.exe \"%~dp0oculto.vbs\"" /SC MINUTE /MO 15 /F
echo.
if errorlevel 1 (echo NO SE PUDO PROGRAMAR. Mandale una foto a Claude.) else (echo LISTO: se va a sincronizar solo cada 15 minutos mientras esta sesion de Windows este abierta.)
echo.
pause
