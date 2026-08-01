# Launcher di sviluppo: avvia backend (porta 3000) e frontend (porta 5173) in due finestre.
# Uso:  powershell -ExecutionPolicy Bypass -File .\start.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

if (-not (Test-Path (Join-Path $root "node_modules"))) {
  Write-Host "Dipendenze assenti. Eseguo npm install..." -ForegroundColor Yellow
  Push-Location $root; npm install; Pop-Location
}

if (-not (Test-Path (Join-Path $root ".env"))) {
  Write-Host "Attenzione: manca il file .env (copia .env.example e riempilo)." -ForegroundColor Yellow
  Write-Host "In Fase 0 non serve; dalla Fase 1 servono le stringhe di Neon." -ForegroundColor DarkGray
}

Write-Host "Avvio BACKEND su http://localhost:3000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root'; npm run dev:server"
)

Write-Host "Avvio FRONTEND su http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root'; npm run dev:client"
)

Write-Host ""
Write-Host "Pronto! Apri il browser su http://localhost:5173" -ForegroundColor Green
