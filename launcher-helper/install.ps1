$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repoRoot "src\launcher-config.js"
$launcherPath = Join-Path $PSScriptRoot "launcher.py"
$secretPath = Join-Path $PSScriptRoot "secret.txt"
$pythonw = (Get-Command pythonw.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source

if (-not $pythonw) {
  throw "pythonw.exe was not found on PATH. Install Python 3 and try again."
}

$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$token = ([System.BitConverter]::ToString($bytes) -replace "-", "").ToLowerInvariant()
$utf8 = [System.Text.UTF8Encoding]::new($false)

[System.IO.File]::WriteAllText($secretPath, $token, $utf8)
[System.IO.File]::WriteAllText($configPath, "window.Aura = window.Aura || {};`nAura.launcherToken = '$token';`n", $utf8)

$protocolKey = "HKCU:\Software\Classes\aura-launch"
$commandKey = Join-Path $protocolKey "shell\open\command"
New-Item -Path $commandKey -Force | Out-Null
Set-Item -Path $protocolKey -Value "URL:Aura Launch Protocol"
New-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
Set-Item -Path $commandKey -Value "`"$pythonw`" `"$launcherPath`" `"%1`""

Write-Host "Aura launcher installed for the current user."
