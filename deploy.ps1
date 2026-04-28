# Script de Deploy - Sistema RH ETUS
# Execute este script no PowerShell (como Administrador)

# Verificar se o Node.js está instalado
Write-Host "Verificando Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "Node.js versão: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js não encontrado. Por favor, instale o Node.js em: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Verificar se o npm está instalado
Write-Host "Verificando npm..." -ForegroundColor Cyan
try {
    $npmVersion = npm --version
    Write-Host "npm versão: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "npm não encontrado." -ForegroundColor Red
    exit 1
}

# Verificar se o Firebase CLI está instalado
Write-Host "Verificando Firebase CLI..." -ForegroundColor Cyan
try {
    $firebaseVersion = firebase --version
    Write-Host "Firebase CLI versão: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "Firebase CLI não encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g firebase-tools
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Falha ao instalar Firebase CLI. Tente executar como Administrador." -ForegroundColor Red
        exit 1
    }
}

# Instalação de dependências
Write-Host "`nInstalando dependências..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao instalar dependências." -ForegroundColor Red
    exit 1
}

# Build do projeto
Write-Host "`nConstruindo projeto..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao construir projeto." -ForegroundColor Red
    exit 1
}

# Deploy para Firebase Hosting
Write-Host "`nFazendo deploy para Firebase Hosting..." -ForegroundColor Cyan
firebase deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeploy concluído com sucesso!" -ForegroundColor Green
    Write-Host "Acesse o URL fornecido pelo Firebase Hosting." -ForegroundColor Cyan
} else {
    Write-Host "Falha ao fazer deploy." -ForegroundColor Red
    exit 1
}

# Pausa para visualização
Write-Host "`nPressione Enter para sair..." -ForegroundColor Yellow
Read-Host