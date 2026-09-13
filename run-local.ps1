$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

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

Start-DevWindow "MediRehab Client" $clientDir "npm run dev"
Start-DevWindow "MediRehab Server" $serverDir "npm run dev"
Start-DevWindow "MediRehab AI Service" $aiDir $aiCommand

Write-Host "Started client, server, and AI service dev windows." -ForegroundColor Green
