$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageManager = if (Get-Command npm -ErrorAction SilentlyContinue) {
    "npm"
} elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
    "pnpm"
} else {
    throw "Install npm or pnpm before starting the Node services."
}

$localDbDir = Join-Path $root ".local\postgres"
if (Test-Path (Join-Path $localDbDir "PG_VERSION")) {
    $pgCtlPath = (Get-Command pg_ctl -ErrorAction SilentlyContinue).Source
    if (-not $pgCtlPath) {
        $pgCtlPath = "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
    }
    if (-not (Test-Path $pgCtlPath)) { throw "PostgreSQL 18 pg_ctl is required for the local database." }
    & $pgCtlPath -D $localDbDir status *> $null
    if ($LASTEXITCODE -ne 0) {
        & $pgCtlPath -D $localDbDir -o "-h 127.0.0.1 -p 5433" -l (Join-Path $root ".local\postgres.log") start
        if ($LASTEXITCODE -ne 0) { throw "Could not start the local database." }
    }
}

function Start-DevWindow($title, $directory, $command) {
    $escapedDirectory = $directory.Replace("'", "''")
    $escapedCommand = $command.Replace("'", "''")
    $windowCommand = "Set-Location '$escapedDirectory'; `$Host.UI.RawUI.WindowTitle = '$title'; $escapedCommand"

    Start-Process powershell.exe -WindowStyle Normal -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        $windowCommand
    )
}

$clientDir = Join-Path $root "client"
$serverDir = Join-Path $root "server"
$aiDir = Join-Path $root "ai-service"
$aiCommand = "if (Test-Path .\venv\Scripts\Activate.ps1) { . .\venv\Scripts\Activate.ps1 }; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

Start-DevWindow "MediRehab Client" $clientDir "$packageManager run dev"
Start-DevWindow "MediRehab Server" $serverDir "$packageManager run dev"
Start-DevWindow "MediRehab AI Service" $aiDir $aiCommand

Write-Host "Started client, server, and AI service dev windows." -ForegroundColor Green
