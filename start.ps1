# ─── Cards — Production LAN Launcher ────────────────────────────────────────
# Builds the Angular frontend and Go backend, then starts the server.
# Anyone on your local network can connect via the printed URL.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DistDir   = Join-Path $ScriptDir "dist\Cards\browser"
$ServerDir = Join-Path $ScriptDir "server"
$Port      = 8080

# ─── Colors ──────────────────────────────────────────────────────────────────
function Info  ($msg) { Write-Host "▸ $msg" -ForegroundColor Cyan }
function Ok    ($msg) { Write-Host "✔ $msg" -ForegroundColor Green }
function Warn  ($msg) { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Fail  ($msg) { Write-Host "✖ $msg" -ForegroundColor Red; exit 1 }

# ─── Prerequisites ───────────────────────────────────────────────────────────
Info "Checking prerequisites..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js is not installed" }
if (-not (Get-Command npm  -ErrorAction SilentlyContinue)) { Fail "npm is not installed" }
if (-not (Get-Command go   -ErrorAction SilentlyContinue)) { Fail "Go is not installed" }

$nodeVer = node --version
$npmVer  = npm --version
$goVer   = (go version) -replace '^go version ',''
Ok "node $nodeVer, npm $npmVer, go $goVer"

# ─── Check npm dependencies ─────────────────────────────────────────────────
if (-not (Test-Path (Join-Path $ScriptDir "node_modules"))) {
    Fail "npm dependencies are missing. Run 'npm ci' in $ScriptDir first."
} else {
    Ok "node_modules present"
}

# ─── Build Angular ───────────────────────────────────────────────────────────
Info "Building Angular app (production)..."
Push-Location $ScriptDir
try {
    npx ng build --configuration production
    if ($LASTEXITCODE -ne 0) { Fail "Angular build failed" }
} finally {
    Pop-Location
}
Ok "Angular build complete → $DistDir"

# ─── Build Go server ────────────────────────────────────────────────────────
Info "Building Go server..."
Push-Location $ServerDir
try {
    go build -o server.exe .
    if ($LASTEXITCODE -ne 0) { Fail "Go build failed" }
} finally {
    Pop-Location
}
Ok "Go server built → $ServerDir\server.exe"

# ─── Detect LAN IP ──────────────────────────────────────────────────────────
$LanIP = "unknown"
try {
    $adapter = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
        Select-Object -First 1
    if ($adapter) { $LanIP = $adapter.IPAddress }
} catch {
    $LanIP = "unknown"
}

# ─── Print access info ──────────────────────────────────────────────────────
$pad = ' ' * [Math]::Max(0, 19 - $LanIP.Length)

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor White
Write-Host "║              🃏  Cards Game Server                ║" -ForegroundColor White
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor White
Write-Host "║                                                  ║" -ForegroundColor White
Write-Host -NoNewline "║  Local:   " -ForegroundColor White
Write-Host -NoNewline "http://localhost:$Port" -ForegroundColor Green
Write-Host "                  ║" -ForegroundColor White
Write-Host -NoNewline "║  Network: " -ForegroundColor White
Write-Host -NoNewline "http://${LanIP}:${Port}" -ForegroundColor Green
Write-Host "${pad}║" -ForegroundColor White
Write-Host "║                                                  ║" -ForegroundColor White
Write-Host "║  Share the Network URL with your partner!        ║" -ForegroundColor White
Write-Host "║  Press Ctrl+C to stop the server.                ║" -ForegroundColor White
Write-Host "║                                                  ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor White
Write-Host ""

# ─── Firewall reminder ──────────────────────────────────────────────────────
try {
    $rule = Get-NetFirewallRule -ErrorAction SilentlyContinue |
        Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' } |
        Get-NetFirewallPortFilter -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -eq $Port -and $_.Protocol -eq 'TCP' }

    if (-not $rule) {
        Warn "Windows Firewall may block incoming connections on port $Port."
        Write-Host "     You may need to allow it:" -ForegroundColor Yellow
        Write-Host "     New-NetFirewallRule -DisplayName 'Cards' -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow" -ForegroundColor Yellow
        Write-Host ""
    }
} catch {
    # Firewall check is best-effort
}

# ─── Start server ───────────────────────────────────────────────────────────
& (Join-Path $ServerDir "server.exe") -static $DistDir
