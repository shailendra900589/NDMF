# Web dev: open http://localhost:7357 after "lib\main.dart is being served"
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$flutter = if ($env:FLUTTER_ROOT) { Join-Path $env:FLUTTER_ROOT "bin\flutter.bat" } else { "C:\Users\uuu\flutter\bin\flutter.bat" }
if (-not (Test-Path $flutter)) { $flutter = "flutter" }

$p = Get-NetTCPConnection -LocalPort 7357 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p) { Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue }

$chromeProfile = Join-Path $env:TEMP "ndfa_flutter_web_dev"
Write-Host "API: production (deploy backend for face policy API). URL: http://localhost:7357"
Set-Location $root
Start-Process "http://localhost:7357"
& $flutter run -d web-server --web-port=7357 --web-hostname=localhost
