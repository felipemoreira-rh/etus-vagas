@echo off
REM Deploy Script para Sistema RH ETUS
REM Execute este arquivo no Prompt de Comando ou PowerShell

echo ========================================
echo    DEPLOY - Sistema RH ETUS
echo ========================================
echo.

REM Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado. Instale em https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Instalando dependências...
call npm install
if %errorlevel% neq 0 (
    echo ERRO ao instalar dependências.
    pause
    exit /b 1
)

echo.
echo [2/4] Verificando Firebase CLI...
call npx firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Firebase CLI nao encontrado.
    pause
    exit /b 1
)

echo.
echo [3/4] Construindo projeto...
call npm run build
if %errorlevel% neq 0 (
    echo ERRO ao construir projeto.
    pause
    exit /b 1
)

echo.
echo [4/4] Fazendo deploy...
call npx firebase deploy

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo    DEPLOY CONCLUIDO COM SUCESSO!
    echo ========================================
) else (
    echo.
    echo ERRO ao fazer deploy.
)

echo.
pause