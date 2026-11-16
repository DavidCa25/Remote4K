# Inicia el bridge de Remote4K (crea el entorno de Python la primera vez).
$ErrorActionPreference = 'Stop'
Set-Location -Path (Join-Path $PSScriptRoot 'bridge')

if (-not (Test-Path '.venv')) {
    Write-Host 'Creando entorno de Python...'
    py -3 -m venv .venv
    & .\.venv\Scripts\python.exe -m pip install -r requirements.txt
}

if (-not (Test-Path (Join-Path $PSScriptRoot 'dist\index.html'))) {
    Write-Host 'La app web no está compilada. Compilando (npm run build:web)...'
    Push-Location $PSScriptRoot
    npm run build:web
    Pop-Location
}

& .\.venv\Scripts\python.exe main.py
