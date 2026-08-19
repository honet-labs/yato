#!/bin/bash

# YATO Docker Installer
# Dedicated installer for Docker Compose deployment

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "============================================"
echo "  YATO Docker Installer"
echo "============================================"
echo ""

# --- Dependency Checks ---
check_dependency() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_error "$1 is not installed. Please install $1 before proceeding."
        exit 1
    fi
}

log_info "Checking system dependencies..."
check_dependency "git"
check_dependency "openssl"
check_dependency "docker"

if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    log_error "docker compose is not installed."
    exit 1
fi

log_info "Using: $DOCKER_COMPOSE"

# --- Port Utilities ---
is_port_in_use() {
    local port=$1
    if [ -f ".env" ] && grep -qE "=\"?${port}\"?$" .env; then
        return 0
    fi
    if command -v ss >/dev/null 2>&1; then
        ss -tln | grep -q ":$port " && return 0
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tln | grep -q ":$port " && return 0
    elif command -v lsof >/dev/null 2>&1; then
        lsof -i :"$port" -sTCP:LISTEN -t >/dev/null 2>&1 && return 0
    fi
    return 1
}

find_free_port() {
    local port=$1
    while is_port_in_use "$port"; do
        port=$((port + 1))
    done
    echo "$port"
}

# --- Configuration ---
log_info "Setting up configuration..."

if [ ! -f ".env" ]; then
    cp backend/.env.example .env 2>/dev/null || touch .env

    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    ENC_KEY=$(openssl rand -hex 16)
    DB_PASS=$(openssl rand -hex 16)

    sed -i "s|JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=\"$JWT_REFRESH_SECRET\"|" .env
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$ENC_KEY\"|" .env

    echo "DB_USER=\"yato\"" >> .env
    echo "DB_PASSWORD=\"$DB_PASS\"" >> .env
    echo "DB_DATABASE=\"yato\"" >> .env

    log_info "Generated JWT secrets, encryption key, and database password."
fi

# Timezone
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl 2>/dev/null | grep "Time zone" | awk '{print $3}' || echo "UTC")
log_info "System timezone: $HOST_TZ"

if grep -q "^TZ=" .env; then
    sed -i "s|^TZ=.*|TZ=$HOST_TZ|" .env
else
    echo "TZ=$HOST_TZ" >> .env
fi

# Ports
write_port_if_missing() {
    local var_name=$1
    local default_port=$2
    if ! grep -q "^${var_name}=" .env; then
        local free_port
        free_port=$(find_free_port "$default_port")
        echo "${var_name}=\"${free_port}\"" >> .env
        log_info "Port $var_name set to $free_port"
    fi
}

write_port_if_missing "HOST_POSTGRES_PORT" 5440
write_port_if_missing "HOST_REDIS_PORT" 6380
write_port_if_missing "HOST_BACKEND_PORT" 4000
write_port_if_missing "HOST_FRONTEND_PORT" 4001
write_port_if_missing "HOST_NGINX_HTTP_PORT" 9090
write_port_if_missing "HOST_NGINX_HTTPS_PORT" 9443
write_port_if_missing "HOST_DOCKER_PROXY_PORT" 2375

# Compose project name
if ! grep -q "^COMPOSE_PROJECT_NAME=" .env; then
    PARENT_DIR_NAME=$(basename "$(pwd)")
    CLEAN_PROJECT_NAME=$(echo "$PARENT_DIR_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')
    [ -z "$CLEAN_PROJECT_NAME" ] && CLEAN_PROJECT_NAME="yato"
    if [ "$CLEAN_PROJECT_NAME" = "yato" ] || [ "$CLEAN_PROJECT_NAME" = "project" ]; then
        DIR_HASH=$(echo -n "$(pwd)" | md5sum 2>/dev/null | cut -c1-5 || echo "$$")
        CLEAN_PROJECT_NAME="yato-${DIR_HASH}"
    fi
    echo "COMPOSE_PROJECT_NAME=\"$CLEAN_PROJECT_NAME\"" >> .env
    log_info "Compose project name: $CLEAN_PROJECT_NAME"
fi

# Server IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP=$(ip addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n1)
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"

# --- Install Host Dependencies (optional for dev) ---
if command -v npm >/dev/null 2>&1; then
    log_info "Syncing host development dependencies..."
    (cd backend && npm install --no-audit --no-fund) || log_warn "Backend npm install failed, continuing..."
    (cd frontend && npm install --no-audit --no-fund) || log_warn "Frontend npm install failed, continuing..."
fi

# --- Build and Deploy ---
log_info "Building and deploying containers..."
$DOCKER_COMPOSE up -d --build

# --- Database Setup ---
log_info "Waiting for database to be ready..."
sleep 10

log_info "Running database migrations..."
$DOCKER_COMPOSE exec -T yato-backend npx prisma migrate deploy || true
$DOCKER_COMPOSE exec -T yato-backend npx prisma db push --accept-data-loss

log_info "Seeding database..."
$DOCKER_COMPOSE exec -T yato-backend npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts || true

# --- Success ---
# Read ports from .env for display
HOST_NGINX_HTTP_PORT=$(grep "^HOST_NGINX_HTTP_PORT=" .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "9090")
HOST_BACKEND_PORT=$(grep "^HOST_BACKEND_PORT=" .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "4000")

echo ""
echo "============================================"
echo "  YATO Docker Installation Complete"
echo "============================================"
echo ""
echo "  ACCESS URLS:"
echo "    Frontend:  http://${SERVER_IP}:${HOST_NGINX_HTTP_PORT}"
echo "    Backend:   http://${SERVER_IP}:${HOST_BACKEND_PORT}"
echo "    Swagger:   http://${SERVER_IP}:${HOST_BACKEND_PORT}/docs"
echo ""
echo "  DEFAULT CREDENTIALS:"
echo "    Email:     admin@yato.local"
echo "    Password:  admin123"
echo ""
echo "  USEFUL COMMANDS:"
echo "    View logs:      $DOCKER_COMPOSE logs -f"
echo "    Restart:        $DOCKER_COMPOSE restart"
echo "    Stop:           $DOCKER_COMPOSE down"
echo "    Status:         $DOCKER_COMPOSE ps"
echo ""
echo "============================================"
