#!/bin/bash

# ============================================================================
# YATO Docker Installer
# Usage: ./installer-docker.sh [OPTIONS]
#
# Options:
#   --branch <name>    Branch to install (main|staging, default: main)
#   --port <port>      Nginx port (default: 9090)
#   --help             Show this help
# ============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${CYAN}[STEP]${NC} $1"; }

# ============================================================================
# Parse Arguments
# ============================================================================
BRANCH="main"
NGINX_PORT=9090

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --branch)   BRANCH="$2"; shift ;;
        --port)     NGINX_PORT="$2"; shift ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --branch <name>   Branch to install (main|staging, default: main)"
            echo "  --port <port>     Nginx HTTP port (default: 9090)"
            echo "  --help, -h        Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                          # Install from main branch"
            echo "  $0 --branch staging         # Install from staging branch"
            echo "  $0 --branch main --port 80  # Install on port 80"
            exit 0
            ;;
        *) log_error "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Validate branch
if [[ "$BRANCH" != "main" && "$BRANCH" != "staging" ]]; then
    log_error "Invalid branch: $BRANCH. Must be 'main' or 'staging'."
    exit 1
fi

# ============================================================================
# Display Header
# ============================================================================
echo ""
echo "============================================================"
echo "  YATO Docker Installer"
echo "============================================================"
echo ""
echo "  Branch:       $BRANCH"
echo "  Nginx Port:   $NGINX_PORT"
echo ""
echo "============================================================"
echo ""

# ============================================================================
# STEP 1: Check System Dependencies
# ============================================================================
log_step "1/8 - Checking system dependencies..."

check_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_error "$1 is not installed."
        echo ""
        echo "  Install $1 first:"
        if [[ "$1" == "docker" ]]; then
            echo "  Ubuntu/Debian:  curl -fsSL https://get.docker.com | sh"
            echo "  RHEL/CentOS:    yum install -y docker-ce docker-ce-cli containerd.io"
            echo "  macOS:          brew install --cask docker"
        elif [[ "$1" == "git" ]]; then
            echo "  Ubuntu/Debian:  apt-get install -y git"
            echo "  RHEL/CentOS:    yum install -y git"
            echo "  macOS:          brew install git"
        fi
        echo ""
        exit 1
    fi
    log_info "$1 found: $(command -v $1)"
}

check_cmd "git"
check_cmd "openssl"

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker is not installed."
    echo ""
    echo "  Install Docker:"
    echo "    curl -fsSL https://get.docker.com | sh"
    echo "    sudo usermod -aG docker \$USER"
    echo "    # Then logout and login again"
    echo ""
    exit 1
fi
log_info "Docker found: $(docker --version)"

# Check Docker Compose
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
    log_info "Docker Compose V2 found"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
    log_info "Docker Compose V1 found"
else
    log_error "Docker Compose is not installed."
    echo ""
    echo "  Install Docker Compose:"
    echo "    # Docker Compose V2 (included with Docker Desktop)"
    echo "    # Or install plugin manually:"
    echo "    mkdir -p ~/.docker/cli-plugins/"
    echo "    curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose"
    echo "    chmod +x ~/.docker/cli-plugins/docker-compose"
    echo ""
    exit 1
fi

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running."
    echo ""
    echo "  Start Docker:"
    echo "    sudo systemctl start docker"
    echo "    sudo systemctl enable docker"
    echo ""
    exit 1
fi
log_info "Docker daemon is running"

echo ""

# ============================================================================
# STEP 2: Clone or Update Repository
# ============================================================================
log_step "2/8 - Getting YATO source code..."

REPO_URL="https://github.com/honet-labs/yato.git"
INSTALL_DIR="yato"

if [ -d "$INSTALL_DIR/.git" ]; then
    log_info "YATO directory exists, updating..."
    cd "$INSTALL_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    log_info "Updated to latest $BRANCH branch"
else
    log_info "Cloning YATO from $BRANCH branch..."
    git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    log_info "Cloned successfully"
fi

echo ""

# ============================================================================
# STEP 3: Generate Configuration (.env)
# ============================================================================
log_step "3/8 - Generating configuration..."

if [ ! -f ".env" ]; then
    log_info "Creating .env file with auto-generated secrets..."

    cp backend/.env.example .env 2>/dev/null || touch .env

    # Generate secure secrets
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    ENC_KEY=$(openssl rand -hex 16)
    DB_PASS=$(openssl rand -hex 16)

    # Write to .env
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" .env
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=\"$JWT_REFRESH_SECRET\"|" .env
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$ENC_KEY\"|" .env

    echo "" >> .env
    echo "# Database" >> .env
    echo "DB_USER=\"yato\"" >> .env
    echo "DB_PASSWORD=\"$DB_PASS\"" >> .env
    echo "DB_DATABASE=\"yato\"" >> .env

    log_info "JWT secrets generated"
    log_info "Encryption key generated"
    log_info "Database password generated"
else
    log_info ".env file already exists, keeping existing config"
fi

# Timezone
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl 2>/dev/null | grep "Time zone" | awk '{print $3}' || echo "UTC")
if grep -q "^TZ=" .env; then
    sed -i "s|^TZ=.*|TZ=$HOST_TZ|" .env
else
    echo "TZ=$HOST_TZ" >> .env
fi
log_info "Timezone: $HOST_TZ"

# Ports
write_port() {
    local var=$1
    local default=$2
    if ! grep -q "^${var}=" .env; then
        echo "${var}=\"${default}\"" >> .env
    fi
}

write_port "HOST_POSTGRES_PORT" "5440"
write_port "HOST_REDIS_PORT" "6380"
write_port "HOST_BACKEND_PORT" "4000"
write_port "HOST_FRONTEND_PORT" "4001"
write_port "HOST_NGINX_HTTP_PORT" "$NGINX_PORT"
write_port "HOST_NGINX_HTTPS_PORT" "9443"
write_port "HOST_DOCKER_PROXY_PORT" "2375"

# Compose project name
if ! grep -q "^COMPOSE_PROJECT_NAME=" .env; then
    DIR_HASH=$(echo -n "$(pwd)" | md5sum 2>/dev/null | cut -c1-5 || echo "$$")
    echo "COMPOSE_PROJECT_NAME=\"yato-${DIR_HASH}\"" >> .env
fi

log_info "Configuration saved to .env"

echo ""

# ============================================================================
# STEP 4: Build Docker Images
# ============================================================================
log_step "4/8 - Building Docker images (this may take a few minutes)..."

log_info "Building backend image..."
$DOCKER_COMPOSE build yato-backend

log_info "Building frontend image..."
$DOCKER_COMPOSE build yato-frontend

log_info "All images built successfully"

echo ""

# ============================================================================
# STEP 5: Start Infrastructure Services
# ============================================================================
log_step "5/8 - Starting infrastructure services (PostgreSQL, Redis)..."

$DOCKER_COMPOSE up -d postgres redis docker-proxy

# Wait for PostgreSQL to be ready
log_info "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    if $DOCKER_COMPOSE exec -T postgres pg_isready -U yato >/dev/null 2>&1; then
        log_info "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "PostgreSQL failed to start"
        $DOCKER_COMPOSE logs postgres
        exit 1
    fi
    sleep 2
done

# Wait for Redis to be ready
log_info "Waiting for Redis to be ready..."
for i in $(seq 1 15); do
    if $DOCKER_COMPOSE exec -T redis redis-cli ping >/dev/null 2>&1; then
        log_info "Redis is ready"
        break
    fi
    if [ $i -eq 15 ]; then
        log_error "Redis failed to start"
        $DOCKER_COMPOSE logs redis
        exit 1
    fi
    sleep 2
done

echo ""

# ============================================================================
# STEP 6: Run Database Migrations
# ============================================================================
log_step "6/8 - Running database migrations and seed..."

# Start backend temporarily for migrations
$DOCKER_COMPOSE up -d yato-backend
sleep 5

log_info "Generating Prisma client..."
$DOCKER_COMPOSE exec -T yato-backend npx prisma generate

log_info "Running database migrations..."
$DOCKER_COMPOSE exec -T yato-backend npx prisma migrate deploy || {
    log_warn "Migration deploy failed, trying db push..."
    $DOCKER_COMPOSE exec -T yato-backend npx prisma db push --accept-data-loss
}

log_info "Seeding database..."
$DOCKER_COMPOSE exec -T yato-backend npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts || {
    log_warn "Seed script had warnings (this is usually fine)"
}

log_info "Database setup complete"

echo ""

# ============================================================================
# STEP 7: Start All Services
# ============================================================================
log_step "7/8 - Starting all services..."

$DOCKER_COMPOSE up -d

# Wait for backend to be healthy
log_info "Waiting for backend to be healthy..."
for i in $(seq 1 30); do
    if $DOCKER_COMPOSE exec -T yato-backend node -e "fetch('http://127.0.0.1:3000/system/config/branding').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
        log_info "Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        log_warn "Backend health check timed out (may still be starting)"
    fi
    sleep 3
done

# Wait for frontend to be healthy
log_info "Waiting for frontend to be healthy..."
for i in $(seq 1 20); do
    if $DOCKER_COMPOSE exec -T yato-frontend node -e "fetch('http://127.0.0.1:3000/login').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
        log_info "Frontend is healthy"
        break
    fi
    if [ $i -eq 20 ]; then
        log_warn "Frontend health check timed out (may still be starting)"
    fi
    sleep 3
done

log_info "All services started"

echo ""

# ============================================================================
# STEP 8: Display Results
# ============================================================================
log_step "8/8 - Installation complete!"

# Get server IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP=$(ip addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n1)
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"

# Read actual ports from .env
ACTUAL_NGINX_PORT=$(grep "^HOST_NGINX_HTTP_PORT=" .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "$NGINX_PORT")
ACTUAL_BACKEND_PORT=$(grep "^HOST_BACKEND_PORT=" .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "4000")

echo ""
echo "============================================================"
echo "  YATO is ready!"
echo "============================================================"
echo ""
echo "  ACCESS URLS:"
echo "    Frontend:     http://${SERVER_IP}:${ACTUAL_NGINX_PORT}"
echo "    Backend API:  http://${SERVER_IP}:${ACTUAL_BACKEND_PORT}"
echo "    Swagger Docs: http://${SERVER_IP}:${ACTUAL_BACKEND_PORT}/docs"
echo ""
echo "  DEFAULT LOGIN:"
echo "    Email:    admin@yato.local"
echo "    Password: admin123"
echo ""
echo "  INSTALLED BRANCH: $BRANCH"
echo ""
echo "  USEFUL COMMANDS:"
echo "    View logs:     $DOCKER_COMPOSE logs -f"
echo "    Restart:       $DOCKER_COMPOSE restart"
echo "    Stop:          $DOCKER_COMPOSE down"
echo "    Status:        $DOCKER_COMPOSE ps"
echo "    Update:        ./update-versi.sh"
echo ""
echo "  CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!"
echo ""
echo "============================================================"
