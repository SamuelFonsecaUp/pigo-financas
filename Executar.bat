@echo off
title Pigo - Financas Pessoais
chcp 65001 > nul

rem 1. Versao instalada pelo "Pigo Setup" (atualiza sozinha)
for %%P in ("%LOCALAPPDATA%\Programs\Pigo\Pigo.exe" "%LOCALAPPDATA%\Programs\financeiro\Pigo.exe" "%ProgramFiles%\Pigo\Pigo.exe") do (
    if exist %%P (
        start "" %%P
        exit /b 0
    )
)

rem 2. Copia gerada localmente (npm run pack)
set "EXE_PATH=%~dp0release\win-unpacked\Pigo.exe"
if exist "%EXE_PATH%" (
    start "" "%EXE_PATH%"
    exit /b 0
)

echo Executavel nao encontrado. Compilando o aplicativo...
cd /d "%~dp0"
call npm run build
call npm run pack
if exist "%EXE_PATH%" (
    start "" "%EXE_PATH%"
    exit /b 0
)
echo.
echo Ocorreu um erro ao gerar o executavel.
pause
exit /b 1
