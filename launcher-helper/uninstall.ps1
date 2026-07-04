$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repoRoot "src\launcher-config.local.js"
$secretPath = Join-Path $PSScriptRoot "secret.txt"
$protocolKey = "HKCU:\Software\Classes\aura-launch"

Remove-Item -Path $protocolKey -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $secretPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue

Write-Host "Aura launcher uninstalled for the current user."
