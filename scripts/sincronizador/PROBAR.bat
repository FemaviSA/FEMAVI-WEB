@echo off
title Prueba sincronizador FEMAVI
cd /d "%~dp0"
echo Leyendo los archivos del sistema, puede tardar un par de minutos...
echo.
"%~dp0node.exe" "%~dp0prueba.js" %1
echo.
pause
