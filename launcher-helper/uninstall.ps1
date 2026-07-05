$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repoRoot "src\launcher-config.js"
$secretPath = Join-Path $PSScriptRoot "secret.txt"
$protocolKey = "HKCU:\Software\Classes\aura-launch"
$utf8 = [System.Text.UTF8Encoding]::new($false)

Remove-Item -Path $protocolKey -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $secretPath -Force -ErrorAction SilentlyContinue
[System.IO.File]::WriteAllText($configPath, "window.Aura = window.Aura || {};`nAura.launcherToken = `"`";`n", $utf8)

Write-Host "Aura launcher uninstalled for the current user."
