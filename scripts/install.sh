#!/bin/bash
# ============================================================
# Juragan — Installation Script (Ubuntu/Debian)
# ============================================================
# Usage: bash install.sh
#
# Minimal checks, fresh VPS Ubuntu 22.04+.
# ============================================================

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ─── Check root ────────────────────────────────────────────────
if [[ $EUID -eq 0 ]]; then
  error "Jangan jalankan sebagai root. Gunakan user biasa."
fi

# ─── Check deps ──────────────────────────────────────────────
check() {
  command -v "$1" >/dev/null 2>&1 || error "$1 tidak ditemukan. Install dulu: $2"
}

info "Memeriksa dependencies..."
check "docker"     "curl -fsSL https://get.docker.com | sh"
check "docker compose" "curl -fsSL https://get.docker.com | sh"
check "git"       "apt install git"
check "node"      "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install nodejs"
check "pnpm"      "npm install -g pnpm"

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "0")
check_version() {
  local major minor have=$1; IFS='.' read -r major minor <<<"$have"
  [[ $major -gt $2 ]] || [[ $major -eq $2 && $minor -ge $3 ]]
}
if ! check_version "$DOCKER_VERSION" 20 10; then
  warn "Docker version 20.10+ direkomendasikan. Yang terinstall: $DOCKER_VERSION"
fi

# ─── Clone / pull ─────────────────────────────────────────────
APP_DIR="$HOME/juragan"
if [[ -d "$APP_DIR/.git" ]]; then
  info "Updating existing installation at $APP_DIR..."
  cd "$APP_DIR" && git pull
else
  info "Cloning Juragan..."
  git clone https://github.com/your-org/juragan.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ─── Env file ─────────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$APP_DIR/docker/.env.production.example" ]]; then
    info "Menyalin template env..."
    cp "$APP_DIR/docker/.env.production.example" "$ENV_FILE"
    warn "Edit $ENV_FILE dan isi semua variabel yang diperlukan!"
  fi
else
  info "File .env sudah ada, tidak ditimpa."
fi

# ─── Build + start ────────────────────────────────────────────
info "Menginstall dependencies..."
pnpm install --frozen-lockfile

info "Membangun aplikasi..."
pnpm build

info "Menjalankan docker compose..."
docker compose -f docker-compose.prod.yml up -d --build

# ─── Done ─────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "<IP-server>")
info ""
info "========================================"
info "Juragan berhasil diinstall! 🚀"
info ""
info "Dashboard: http://$PUBLIC_IP:5173"
info "API:      http://$PUBLIC_IP:4111"
info "Redis:    redis://$PUBLIC_IP:6379"
info ""
info "File .env ada di: $ENV_FILE"
info "Log:      docker compose -f docker-compose.prod.yml logs -f"
info "Stop:     docker compose -f docker-compose.prod.yml down"
info "========================================"
