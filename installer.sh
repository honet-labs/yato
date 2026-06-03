#!/bin/bash

# YATO Advanced Installer Script
# Supports modular installation and standalone/docker modes.

GREEN='\033[0-32m'
YELLOW='\033[1-33m'
RED='\033[0-31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting YATO Modular Installation...${NC}"

# Helper: Check if a port is in use on the host or already reserved in .env
is_port_in_use() {
    local port=$1
    # Check if the port is already allocated in the current .env file
    if [ -f ".env" ] && grep -qE "=\"?${port}\"?$" .env; then
        return 0
    fi
    # Check if the port is in use on the host
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
INFRA_MODE="docker" # docker | standalone
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
        echo -e "${RED}Error: $1 is not installed. Please install $1 before proceeding.${NC}" >&2
        return 1
    fi
    return 0
}

echo -e "${YELLOW}🔍 Checking system dependencies...${NC}"
check_dependency "git" || exit 1
check_dependency "openssl" || exit 1

if [ "$INFRA_MODE" = "docker" ]; then
    check_dependency "docker" || exit 1
    
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        echo -e "${RED}Error: docker compose is not installed.${NC}" >&2
        exit 1
    fi
fi

# Configuration
echo -e "${YELLOW}⚙️  Setting up configuration...${NC}"
if [ ! -f ".env" ]; then
    cp backend/.env.example .env 2>/dev/null || touch .env
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    ENC_KEY=$(openssl rand -hex 16)
    DB_PASS=$(openssl rand -hex 16)
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=\"$JWT_REFRESH_SECRET\"|" .env
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$ENC_KEY\"|" .env
    
    # Generate dynamic secure DB parameters
    echo "DB_USER=\"yato\"" >> .env
    echo "DB_PASSWORD=\"$DB_PASS\"" >> .env
    echo "DB_DATABASE=\"yato\"" >> .env
fi

# Detect Host Timezone and sync .env
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl | grep "Time zone" | awk '{print $3}' 2>/dev/null || echo "UTC")
echo -e "   • System Timezone detected as: ${GREEN}$HOST_TZ${NC}"

if grep -q "^TZ=" .env; then
    sed -i "s|^TZ=.*|TZ=\"$HOST_TZ\"|" .env
else
    echo "TZ=\"$HOST_TZ\"" >> .env
fi


# Ensure dynamic free ports are assigned if they are not already set in .env
write_port_if_missing() {
    local var_name=$1
    local default_port=$2
    if ! grep -q "^${var_name}=" .env; then
        local free_port=$(find_free_port $default_port)
        echo "${var_name}=\"${free_port}\"" >> .env
        echo -e "   • Port variable ${YELLOW}${var_name}${NC} initialized to free port: ${GREEN}${free_port}${NC}"
    fi
}

write_port_if_missing "HOST_POSTGRES_PORT" 5440
write_port_if_missing "HOST_REDIS_PORT" 6380
write_port_if_missing "HOST_BACKEND_PORT" 4000
write_port_if_missing "HOST_FRONTEND_PORT" 4001
write_port_if_missing "HOST_NGINX_HTTP_PORT" 9090
write_port_if_missing "HOST_NGINX_HTTPS_PORT" 9443
write_port_if_missing "HOST_DOCKER_PROXY_PORT" 2375

# Ensure compose project namespace matches current directory basename or path hash
if ! grep -q "^COMPOSE_PROJECT_NAME=" .env; then
    PARENT_DIR_NAME=$(basename "$(pwd)")
    CLEAN_PROJECT_NAME=$(echo "$PARENT_DIR_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')
    [ -z "$CLEAN_PROJECT_NAME" ] && CLEAN_PROJECT_NAME="yato"
    
    # If the project name is generic 'yato' or 'project', append a unique hash of the directory path
    if [ "$CLEAN_PROJECT_NAME" = "yato" ] || [ "$CLEAN_PROJECT_NAME" = "project" ]; then
        DIR_HASH=$(echo -n "$(pwd)" | md5sum 2>/dev/null | cut -c1-5 || echo -n "$(pwd)" | shasum 2>/dev/null | cut -c1-5 || echo -n "$$")
        CLEAN_PROJECT_NAME="yato-${DIR_HASH}"
    fi
    
    echo "COMPOSE_PROJECT_NAME=\"$CLEAN_PROJECT_NAME\"" >> .env
    echo -e "   • Compose project namespace initialized to: ${GREEN}$CLEAN_PROJECT_NAME${NC}"
fi

# IP Detection
SERVER_IP=$(hostname -I | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP=$(ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n1)
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"
export API_URL="http://$SERVER_IP:4000"

# Installation Logic
if [ "$INFRA_MODE" = "docker" ]; then
    echo -e "${YELLOW}📦 Deploying via Docker Compose...${NC}"
    
    # Selective service start
    SERVICES=""
    [ "$COMP_DB" = true ] && SERVICES="$SERVICES postgres"
    [ "$COMP_REDIS" = true ] && SERVICES="$SERVICES redis"
    [ "$COMP_APP" = true ] && SERVICES="$SERVICES yato-backend"
    [ "$COMP_WEB" = true ] && SERVICES="$SERVICES yato-frontend nginx"
    
    # Synchronize host development dependencies if npm is available
    if command -v npm &> /dev/null; then
      echo -e "${YELLOW}📦 Synchronizing host development dependencies...${NC}"
      echo -e "   • Installing backend dependencies on host..."
      (cd backend && npm install && npm audit fix) || echo -e "${RED}Warning: backend npm install or audit fix failed, continuing...${NC}"
      echo -e "   • Installing frontend dependencies on host..."
      (cd frontend && npm install && npm audit fix) || echo -e "${RED}Warning: frontend npm install or audit fix failed, continuing...${NC}"
    else
      echo "   • npm not available on host, skipping host-level node_modules sync."
    fi

    $DOCKER_COMPOSE up -d --build $SERVICES
    
    if [ "$COMP_APP" = true ]; then
        echo -e "${YELLOW}🗄️  Running database setup...${NC}"
        sleep 10
        $DOCKER_COMPOSE exec -T yato-backend npx prisma migrate deploy || true
        $DOCKER_COMPOSE exec -T yato-backend npx prisma db push --accept-data-loss
        $DOCKER_COMPOSE exec -T yato-backend npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
    fi
else
    echo -e "${YELLOW}🏗️  Standalone Systemd installation mode active...${NC}"
    echo -e "${YELLOW}🔍 Checking systemd availability...${NC}"
    if ! command -v systemctl >/dev/null 2>&1; then
        echo -e "${RED}Error: systemctl is not available. Systemd mode requires systemd support.${NC}"
        exit 1
    fi

    # Detect distribution
    PKG_MANAGER=""
    if [ -f /etc/debian_version ]; then
        PKG_MANAGER="apt-get"
    elif [ -f /etc/redhat-release ]; then
        PKG_MANAGER="yum"
    else
        echo -e "${RED}Warning: Unsupported OS distribution. Continuing manual dependency checks...${NC}"
    fi

    # 1. Install prerequisites if needed
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        echo -e "   • Updating apt package indexes..."
        sudo apt-get update -y &>/dev/null
        
        if [ "$COMP_DB" = true ] && ! command -v psql >/dev/null 2>&1; then
            echo -e "   • Installing PostgreSQL..."
            sudo apt-get install -y postgresql postgresql-contrib &>/dev/null
            sudo systemctl enable --now postgresql
        fi
        
        if [ "$COMP_REDIS" = true ] && ! command -v redis-server >/dev/null 2>&1; then
            echo -e "   • Installing Redis server..."
            sudo apt-get install -y redis-server &>/dev/null
            sudo systemctl enable --now redis-server
        fi

        if ! command -v node >/dev/null 2>&1; then
            echo -e "   • Installing Node.js & npm..."
            sudo apt-get install -y nodejs npm &>/dev/null
        fi
    fi

    # 2. Build backend
    if [ "$COMP_APP" = true ]; then
        echo -e "${YELLOW}📦 Building Backend Service...${NC}"
        cd backend
        npm install
        npx prisma generate
        npx prisma migrate deploy || true
        npx prisma db push --accept-data-loss
        npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts || true
        npm run build
        cd ..

        # Generate Backend Systemd Service file
        echo -e "   • Generating yato-backend.service..."
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

    # 3. Build frontend
    if [ "$COMP_WEB" = true ]; then
        echo -e "${YELLOW}📦 Building Frontend Service...${NC}"
        cd frontend
        npm install
        npm run build
        cd ..

        # Generate Frontend Systemd Service file
        echo -e "   • Generating yato-frontend.service..."
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

# Detailed Success & Access Information Display
show_access_info() {
    # Load configuration if available
    [ -f ".env" ] && source .env
    
    # Use config values with fallbacks
    local pg_port=${HOST_POSTGRES_PORT:-5440}
    local redis_port=${HOST_REDIS_PORT:-6380}
    local backend_port=${HOST_BACKEND_PORT:-4000}
    local frontend_port=${HOST_FRONTEND_PORT:-4001}
    local nginx_port=${HOST_NGINX_HTTP_PORT:-9090}

    echo -e ""
    echo -e "${GREEN}================================================================${NC}"
    echo -e "   🚀  ${GREEN}YATO (Unified Infrastructure Platform) is READY!${NC}"
    echo -e "${GREEN}================================================================${NC}"
    echo -e ""
    echo -e "🌐 ${YELLOW}ACCESS URLS:${NC}"
    echo -e "   • ${GREEN}Frontend Web Portal:${NC}  http://${SERVER_IP}:${frontend_port}  or  http://${SERVER_IP}:${nginx_port} (Nginx Gateway)"
    echo -e "   • ${GREEN}Backend API Gateway:${NC}  http://${SERVER_IP}:${backend_port}"
    echo -e "   • ${GREEN}API Swagger Explorer:${NC} http://${SERVER_IP}:${backend_port}/docs"
    echo -e ""
    echo -e "🔐 ${YELLOW}ADMINISTRATOR ACCESS:${NC}"
    echo -e "   • ${GREEN}Default Email:${NC}    admin@yato.local"
    echo -e "   • ${GREEN}Default Password:${NC} admin123"
    echo -e "   • ${RED}Note:${NC}             Please change the default password immediately after login."
    echo -e ""
    echo -e "🗄️  ${YELLOW}DATABASE & SYSTEM INFO:${NC}"
    echo -e "   • ${GREEN}Database Engine:${NC}      PostgreSQL 15 (on port ${pg_port})"
    echo -e "   • ${GREEN}PostgreSQL User:${NC}      yato"
    echo -e "   • ${GREEN}PostgreSQL DB Name:${NC}   yato"
    echo -e "   • ${GREEN}Redis Cache Port:${NC}    ${redis_port}"
    echo -e ""
    echo -e "💡 ${YELLOW}USEFUL COMMANDS:${NC}"
    echo -e "   • ${GREEN}View Logs:${NC}           $DOCKER_COMPOSE logs -f"
    echo -e "   • ${GREEN}Restart Services:${NC}    $DOCKER_COMPOSE restart"
    echo -e "   • ${GREEN}Stop Platform:${NC}       $DOCKER_COMPOSE down"
    echo -e "${GREEN}================================================================${NC}"
    echo -e ""
}

show_access_info
