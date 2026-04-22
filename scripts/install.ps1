# ============================================================
# Juragan — Installation Script (Windows Server)
# ============================================================
# Usage: .\install.ps1
#
# Windows Server 2022+, PowerShell 5.1+
# ============================================================

$ErrorActionPreference = 'Stop'

function info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Green }
function warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

info "Memeriksa dependencies..."

# Docker
try {
    docker version | Out-Null
} catch {
    error "Docker tidak ditemukan. Install Docker Desktop dulu: https://docs.docker.com/desktop/install/windows-install/"
}
info "Docker: OK"

# Node
try {
    node --version | Out-Null
} catch {
    error "Node.js tidak ditemukan. Install Node.js 20+ dulu: https://nodejs.org/"
}
info "Node.js: $(node --version)"

# pnpm
try {
    pnpm --version | Out-Null
} catch {
    info "Menginstall pnpm..."
    npm install -g pnpm
}
info "pnpm: $(pnpm --version)"

# ─── App directory ─────────────────────────────────────────────
$APP_DIR = Join-Path $PSScriptRoot ".."
if (!(Test-Path "$APP_DIR\.env")) {
    if (Test-Path "$APP_DIR\docker\.env.production.example") {
        info "Menyalin template env..."
        Copy-Item "$APP_DIR\docker\.env.production.example" "$APP_DIR\.env"
        warn "Edit $APP_DIR\.env dan isi semua variabel yang diperlukan!"
    }
} else {
    info "File .env sudah ada, tidak ditimpa."
}

# ─── Install deps ───────────────────────────────────────────────
info "Menginstall dependencies..."
Set-Location $APP_DIR
pnpm install --frozen-lockfile

info "Membangun aplikasi..."
pnpm build

info "Menjalankan docker compose..."
docker compose -f docker-compose.prod.yml up -d --build

# ─── Done ────────────────────────────────────────────────────────
$PUBLIC_IP = (Invoke-WebRequest -Uri "https://ifconfig.me" -UseBasicParsing -TimeoutSec 5).Content.Trim()
if (!$PUBLIC_IP) { $PUBLIC_IP = "<IP-server>" }

info ""
info "========================================"
info "Juragan berhasil diinstall! "
info ""
info "Dashboard: http://$PUBLIC_IP`:5173"
info "API:      http://$PUBLIC_IP`:4111"
info ""
info "File .env ada di: $APP_DIR\.env"
info "Log:      docker compose -f docker-compose.prod.yml logs -f"
info "Stop:     docker compose -f docker-compose.prod.yml down"
info "========================================"
