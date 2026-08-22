#!/bin/bash

# YATO Advanced Installer Script
# Supports modular installation and standalone/docker modes.

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "============================================"
echo "  YATO Modular Installer"
echo "============================================"
echo ""

# Helper: Check if a port is in use on the host or already reserved in .env
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
        lsof -i :$port -sTCP:LISTEN -t >/dev/null 2>&1 && return 0
    elif command -v nc >/dev/null 2>&1; then
        nc -z 127.0.0.1 $port >/dev/null 2>&1 && return 0
    fi
    return 1
}

# Helper: Find the next available TCP port
find_free_port() {
    local port=$1
    while is_port_in_use $port; do
        port=$((port + 1))
    done
    echo $port
}

# Default Options
INFRA_MODE="docker"
COMPONENT_ALL=true
COMP_DB=false
COMP_REDIS=false
COMP_APP=false
COMP_WEB=false

# Parse Arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --infra-mode) INFRA_MODE="$2"; shift ;;
        --database|--only-db) COMP_DB=true; COMPONENT_ALL=false ;;
        --redis|--only-redis) COMP_REDIS=true; COMPONENT_ALL=false ;;
        --app|--only-app) COMP_APP=true; COMPONENT_ALL=false ;;
        --web|--only-web) COMP_WEB=true; COMPONENT_ALL=false ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

if [ "$COMPONENT_ALL" = true ]; then
    COMP_DB=true
    COMP_REDIS=true
    COMP_APP=true
    COMP_WEB=true
fi

# Check Prerequisites
check_dependency() {
    if ! command -v $1 >/dev/null 2>&1; then
        log_error "$1 is not installed. Please install $1 before proceeding."
        return 1
    fi
    return 0
}

log_info "Checking system dependencies..."
check_dependency "git" || exit 1
check_dependency "openssl" || exit 1

if [ "$INFRA_MODE" = "docker" ]; then
    check_dependency "docker" || exit 1
    
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        log_error "docker compose is not installed."
        exit 1
    fi
fi

# Configuration
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
fi

# Detect Host Timezone and sync .env
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl | grep "Time zone" | awk '{print $3}' 2>/dev/null || echo "UTC")
log_info "System timezone: $HOST_TZ"

if grep -q "^TZ=" .env; then
    sed -i "s|^TZ=.*|TZ=$HOST_TZ|" .env
else
    echo "TZ=$HOST_TZ" >> .env
fi


# Ensure dynamic free ports are assigned
write_port_if_missing() {
    local var_name=$1
    local default_port=$2
    if ! grep -q "^${var_name}=" .env; then
        local free_port=$(find_free_port $default_port)
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

# Compose project namespace
if ! grep -q "^COMPOSE_PROJECT_NAME=" .env; then
    PARENT_DIR_NAME=$(basename "$(pwd)")
    CLEAN_PROJECT_NAME=$(echo "$PARENT_DIR_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')
    [ -z "$CLEAN_PROJECT_NAME" ] && CLEAN_PROJECT_NAME="yato"
    
    if [ "$CLEAN_PROJECT_NAME" = "yato" ] || [ "$CLEAN_PROJECT_NAME" = "project" ]; then
        DIR_HASH=$(echo -n "$(pwd)" | md5sum 2>/dev/null | cut -c1-5 || echo -n "$(pwd)" | shasum 2>/dev/null | cut -c1-5 || echo -n "$$")
        CLEAN_PROJECT_NAME="yato-${DIR_HASH}"
    fi
    
    echo "COMPOSE_PROJECT_NAME=\"$CLEAN_PROJECT_NAME\"" >> .env
    log_info "Compose project: $CLEAN_PROJECT_NAME"
fi

# IP Detection
SERVER_IP=$(hostname -I | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP=$(ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n1)
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"
export API_URL="http://$SERVER_IP:4000"

# Installation Logic
if [ "$INFRA_MODE" = "docker" ]; then
    log_info "Deploying via Docker Compose..."
    
    SERVICES=""
    [ "$COMP_DB" = true ] && SERVICES="$SERVICES postgres"
    [ "$COMP_REDIS" = true ] && SERVICES="$SERVICES redis"
    [ "$COMP_APP" = true ] && SERVICES="$SERVICES yato-backend"
    [ "$COMP_WEB" = true ] && SERVICES="$SERVICES yato-frontend nginx"
    
    if command -v npm &> /dev/null; then
      log_info "Syncing host development dependencies..."
      (cd backend && npm install && npm audit fix) || log_warn "Backend npm install failed."
      (cd frontend && npm install && npm audit fix) || log_warn "Frontend npm install failed."
    fi

    $DOCKER_COMPOSE up -d --build $SERVICES
    
    if [ "$COMP_APP" = true ]; then
        log_info "Running database setup..."
        sleep 10
        $DOCKER_COMPOSE exec -T yato-backend npx prisma migrate deploy || true
        $DOCKER_COMPOSE exec -T yato-backend npx prisma db push --accept-data-loss
        $DOCKER_COMPOSE exec -T yato-backend npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
    fi
else
    log_info "Standalone Systemd installation mode..."
    
    if ! command -v systemctl >/dev/null 2>&1; then
        log_error "systemctl is not available. Systemd mode requires systemd."
        exit 1
    fi

    PKG_MANAGER=""
    if [ -f /etc/debian_version ]; then
        PKG_MANAGER="apt-get"
    elif [ -f /etc/redhat-release ]; then
        PKG_MANAGER="yum"
    else
        log_warn "Unsupported OS. Continuing with manual dependency checks..."
    fi

    if [ "$PKG_MANAGER" = "apt-get" ]; then
        log_info "Updating apt package indexes..."
        sudo apt-get update -y &>/dev/null
        
        if [ "$COMP_DB" = true ] && ! command -v psql >/dev/null 2>&1; then
            log_info "Installing PostgreSQL..."
            sudo apt-get install -y postgresql postgresql-contrib &>/dev/null
            sudo systemctl enable --now postgresql
        fi
        
        if [ "$COMP_REDIS" = true ] && ! command -v redis-server >/dev/null 2>&1; then
            log_info "Installing Redis..."
            sudo apt-get install -y redis-server &>/dev/null
            sudo systemctl enable --now redis-server
        fi

        if ! command -v node >/dev/null 2>&1; then
            log_info "Installing Node.js..."
            sudo apt-get install -y nodejs npm &>/dev/null
        fi
    fi

    if [ "$COMP_APP" = true ]; then
        log_info "Building Backend Service..."
        cd backend
        npm install
        npx prisma generate
        npx prisma migrate deploy || true
        npx prisma db push --accept-data-loss
        npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts || true
        npm run build
        cd ..

        log_info "Generating yato-backend.service..."
        CURRENT_DIR=$(pwd)
        cat <<EOF | sudo tee /etc/systemd/system/yato-backend.service >/dev/null
[Unit]
Description=YATO Backend Service
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=$CURRENT_DIR/backend
ExecStart=/usr/bin/npm run start:prod
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=$CURRENT_DIR/.env

[Install]
WantedBy=multi-user.target
EOF
        sudo systemctl daemon-reload
        sudo systemctl enable --now yato-backend
    fi

    if [ "$COMP_WEB" = true ]; then
        log_info "Building Frontend Service..."
        cd frontend
        npm install
        npm run build
        cd ..

        log_info "Generating yato-frontend.service..."
        CURRENT_DIR=$(pwd)
        cat <<EOF | sudo tee /etc/systemd/system/yato-frontend.service >/dev/null
[Unit]
Description=YATO Frontend Service
After=network.target yato-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$CURRENT_DIR/frontend
ExecStart=/usr/bin/npm run start
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=$CURRENT_DIR/.env

[Install]
WantedBy=multi-user.target
EOF
        sudo systemctl daemon-reload
        sudo systemctl enable --now yato-frontend
    fi
fi

# Display access information
show_access_info() {
    [ -f ".env" ] && source .env
    
    local pg_port=${HOST_POSTGRES_PORT:-5440}
    local redis_port=${HOST_REDIS_PORT:-6380}
    local backend_port=${HOST_BACKEND_PORT:-4000}
    local frontend_port=${HOST_FRONTEND_PORT:-4001}
    local nginx_port=${HOST_NGINX_HTTP_PORT:-9090}

    echo ""
    echo "============================================"
    echo "  YATO Installation Complete"
    echo "============================================"
    echo ""
    echo "  ACCESS URLS:"
    echo "    Frontend:  http://${SERVER_IP}:${nginx_port} (Nginx)"
    echo "               http://${SERVER_IP}:${frontend_port} (Direct)"
    echo "    Backend:   http://${SERVER_IP}:${backend_port}"
    echo "    Swagger:   http://${SERVER_IP}:${backend_port}/docs"
    echo ""
    echo "  DEFAULT CREDENTIALS:"
    echo "    Email:     admin@yato.local"
    echo "    Password:  admin123"
    echo ""
    echo "  DATABASE:"
    echo "    Engine:    PostgreSQL 15 (port ${pg_port})"
    echo "    User:      yato"
    echo "    Database:  yato"
    echo "    Redis:     port ${redis_port}"
    echo ""
    echo "  COMMANDS:"
    echo "    Logs:      $DOCKER_COMPOSE logs -f"
    echo "    Restart:   $DOCKER_COMPOSE restart"
    echo "    Stop:      $DOCKER_COMPOSE down"
    echo ""
    echo "============================================"
}

show_access_info
