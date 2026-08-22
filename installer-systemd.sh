#!/bin/bash

# ============================================================================
# YATO Systemd Installer
# Usage: sudo ./installer-systemd.sh [OPTIONS]
#
# Options:
#   --branch <name>    Branch to install (main|staging, default: main)
#   --db-pass <pass>   PostgreSQL password (default: auto-generated)
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
DB_PASS=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --branch)   BRANCH="$2"; shift ;;
        --db-pass)  DB_PASS="$2"; shift ;;
        --help|-h)
            echo "Usage: sudo $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --branch <name>   Branch to install (main|staging, default: main)"
            echo "  --db-pass <pass>  PostgreSQL password (default: auto-generated)"
            echo "  --help, -h        Show this help"
            echo ""
            echo "Examples:"
            echo "  sudo $0                          # Install from main branch"
            echo "  sudo $0 --branch staging         # Install from staging branch"
            echo "  sudo $0 --db-pass mySecurePass   # Custom DB password"
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
# Root Check
# ============================================================================
if [ "$(id -u)" -ne 0 ]; then
    log_error "This script must be run as root."
    echo ""
    echo "  Run: sudo $0 $@"
    echo ""
    exit 1
fi

# ============================================================================
# Display Header
# ============================================================================
echo ""
echo "============================================================"
echo "  YATO Systemd Installer"
echo "============================================================"
echo ""
echo "  Branch:  $BRANCH"
echo ""
echo "============================================================"
echo ""

# ============================================================================
# STEP 1: Check System Dependencies
# ============================================================================
log_step "1/10 - Checking system dependencies..."

check_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        return 1
    fi
    log_info "$1 found: $(command -v $1)"
    return 0
}

# Git
if ! check_cmd git; then
    log_info "Installing git..."
    if [ -f /etc/debian_version ]; then
        apt-get update -y >/dev/null 2>&1
        apt-get install -y git >/dev/null 2>&1
    elif [ -f /etc/redhat-release ]; then
        yum install -y git >/dev/null 2>&1
    fi
    check_cmd git || { log_error "Failed to install git"; exit 1; }
fi

# OpenSSL
if ! check_cmd openssl; then
    log_info "Installing openssl..."
    if [ -f /etc/debian_version ]; then
        apt-get install -y openssl >/dev/null 2>&1
    elif [ -f /etc/redhat-release ]; then
        yum install -y openssl >/dev/null 2>&1
    fi
fi

# systemctl
if ! command -v systemctl >/dev/null 2>&1; then
    log_error "systemctl is not available. This installer requires systemd."
    exit 1
fi
log_info "systemctl found"

echo ""

# ============================================================================
# STEP 2: Install System Packages
# ============================================================================
log_step "2/10 - Installing system packages..."

if [ -f /etc/debian_version ]; then
    PKG_MANAGER="apt-get"
    log_info "Detected Debian/Ubuntu system"

    log_info "Updating package index..."
    apt-get update -y >/dev/null 2>&1

    # PostgreSQL
    if ! check_cmd psql; then
        log_info "Installing PostgreSQL 15..."
        apt-get install -y postgresql postgresql-contrib >/dev/null 2>&1
        systemctl enable postgresql
        systemctl start postgresql
        log_info "PostgreSQL installed and started"
    fi

    # Redis
    if ! command -v redis-server >/dev/null 2>&1; then
        log_info "Installing Redis..."
        apt-get install -y redis-server >/dev/null 2>&1
        systemctl enable redis-server
        systemctl start redis-server
        log_info "Redis installed and started"
    fi

    # Node.js 20 LTS
    if ! check_cmd node; then
        log_info "Installing Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
        apt-get install -y nodejs >/dev/null 2>&1
        log_info "Node.js $(node --version) installed"
    fi

    # Nginx
    if ! check_cmd nginx; then
        log_info "Installing Nginx..."
        apt-get install -y nginx >/dev/null 2>&1
        systemctl enable nginx
        systemctl start nginx
        log_info "Nginx installed and started"
    fi

elif [ -f /etc/redhat-release ]; then
    PKG_MANAGER="yum"
    log_info "Detected RHEL/CentOS system"

    # PostgreSQL
    if ! check_cmd psql; then
        log_info "Installing PostgreSQL..."
        yum install -y postgresql-server postgresql-contrib >/dev/null 2>&1
        postgresql-setup --initdb 2>/dev/null || true
        systemctl enable postgresql
        systemctl start postgresql
        log_info "PostgreSQL installed and started"
    fi

    # Redis
    if ! command -v redis-server >/dev/null 2>&1; then
        log_info "Installing Redis..."
        yum install -y redis >/dev/null 2>&1
        systemctl enable redis
        systemctl start redis
        log_info "Redis installed and started"
    fi

    # Node.js
    if ! check_cmd node; then
        log_info "Installing Node.js 20 LTS..."
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
        yum install -y nodejs >/dev/null 2>&1
        log_info "Node.js $(node --version) installed"
    fi

    # Nginx
    if ! check_cmd nginx; then
        log_info "Installing Nginx..."
        yum install -y nginx >/dev/null 2>&1
        systemctl enable nginx
        systemctl start nginx
        log_info "Nginx installed and started"
    fi
else
    log_error "Unsupported OS. Only Debian/Ubuntu and RHEL/CentOS are supported."
    exit 1
fi

echo ""

# ============================================================================
# STEP 3: Clone or Update Repository
# ============================================================================
log_step "3/10 - Getting YATO source code..."

REPO_URL="https://github.com/honet-labs/yato.git"
PROJECT_DIR=$(pwd)/yato

if [ -d "$PROJECT_DIR/.git" ]; then
    log_info "YATO directory exists, updating..."
    cd "$PROJECT_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    log_info "Updated to latest $BRANCH branch"
else
    log_info "Cloning YATO from $BRANCH branch..."
    git clone -b "$BRANCH" "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    log_info "Cloned successfully"
fi

echo ""

# ============================================================================
# STEP 4: Setup PostgreSQL Database
# ============================================================================
log_step "4/10 - Setting up PostgreSQL database..."

# Generate password if not provided
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -hex 16)
    log_info "Generated database password"
fi

# Create user and database
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='yato'" 2>/dev/null | grep -q 1 || {
    sudo -u postgres psql -c "CREATE USER yato WITH PASSWORD '$DB_PASS';" 2>/dev/null
    log_info "Created database user 'yato'"
}

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='yato'" 2>/dev/null | grep -q 1 || {
    sudo -u postgres psql -c "CREATE DATABASE yato OWNER yato;" 2>/dev/null
    log_info "Created database 'yato'"
}

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE yato TO yato;" 2>/dev/null || true
log_info "Database setup complete"

echo ""

# ============================================================================
# STEP 5: Generate Configuration (.env)
# ============================================================================
log_step "5/10 - Generating configuration..."

ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    cp "$PROJECT_DIR/backend/.env.example" "$ENV_FILE" 2>/dev/null || touch "$ENV_FILE"

    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    ENC_KEY=$(openssl rand -hex 16)

    sed -i "s|JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" "$ENV_FILE"
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=\"$JWT_REFRESH_SECRET\"|" "$ENV_FILE"
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$ENC_KEY\"|" "$ENV_FILE"
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://yato:${DB_PASS}@localhost:5432/yato?schema=public\"|" "$ENV_FILE"

    # Redis
    if ! grep -q "^REDIS_HOST=" "$ENV_FILE"; then
        echo "REDIS_HOST=localhost" >> "$ENV_FILE"
    fi
    if ! grep -q "^REDIS_PORT=" "$ENV_FILE"; then
        echo "REDIS_PORT=6379" >> "$ENV_FILE"
    fi

    log_info "Configuration file created"
    log_info "JWT secrets generated"
    log_info "Encryption key generated"
else
    log_info "Configuration file already exists"
fi

# Timezone
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl 2>/dev/null | grep "Time zone" | awk '{print $3}' || echo "UTC")
if grep -q "^TZ=" "$ENV_FILE"; then
    sed -i "s|^TZ=.*|TZ=$HOST_TZ|" "$ENV_FILE"
else
    echo "TZ=$HOST_TZ" >> "$ENV_FILE"
fi
log_info "Timezone: $HOST_TZ"

echo ""

# ============================================================================
# STEP 6: Install Dependencies and Build Backend
# ============================================================================
log_step "6/10 - Building backend service..."

cd "$PROJECT_DIR/backend"

log_info "Installing backend dependencies..."
npm install --no-audit --no-fund 2>&1 | tail -1

log_info "Generating Prisma client..."
npx prisma generate

log_info "Running database migrations..."
npx prisma migrate deploy 2>/dev/null || {
    log_warn "Migration deploy failed, trying db push..."
    npx prisma db push --accept-data-loss
}

log_info "Seeding database..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts 2>/dev/null || {
    log_warn "Seed had warnings (usually fine)"
}

log_info "Building backend..."
npm run build

log_info "Backend build complete"

echo ""

# ============================================================================
# STEP 7: Install Dependencies and Build Frontend
# ============================================================================
log_step "7/10 - Building frontend service..."

cd "$PROJECT_DIR/frontend"

log_info "Installing frontend dependencies..."
npm install --no-audit --no-fund 2>&1 | tail -1

log_info "Building frontend..."
npm run build

log_info "Frontend build complete"

echo ""

# ============================================================================
# STEP 8: Create Systemd Services
# ============================================================================
log_step "8/10 - Creating systemd services..."

# Backend service
cat > /etc/systemd/system/yato-backend.service <<EOF
[Unit]
Description=YATO Backend API Service
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=$(which node) dist/main.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=$ENV_FILE
StandardOutput=journal
StandardError=journal
SyslogIdentifier=yato-backend

[Install]
WantedBy=multi-user.target
EOF

# Frontend service
cat > /etc/systemd/system/yato-frontend.service <<EOF
[Unit]
Description=YATO Frontend Portal Service
After=network.target yato-backend.service
Wants=yato-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/frontend
ExecStart=$(which node) .next/standalone/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
EnvironmentFile=$ENV_FILE
StandardOutput=journal
StandardError=journal
SyslogIdentifier=yato-frontend

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable yato-backend yato-frontend

log_info "Systemd services created and enabled"

echo ""

# ============================================================================
# STEP 9: Configure Nginx
# ============================================================================
log_step "9/10 - Configuring Nginx reverse proxy..."

NGINX_CONF="/etc/nginx/sites-available/yato"

cat > "$NGINX_CONF" <<'NGINX_EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (terminal)
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_read_timeout 600s;
    }
}
NGINX_EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/yato
rm -f /etc/nginx/sites-enabled/default 2>/dev/null

nginx -t && systemctl reload nginx
log_info "Nginx configured and reloaded"

echo ""

# ============================================================================
# STEP 10: Start Services and Display Results
# ============================================================================
log_step "10/10 - Starting YATO services..."

systemctl start yato-backend
log_info "Backend service started"

# Wait for backend
log_info "Waiting for backend to be ready..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:3000/system/config/branding >/dev/null 2>&1; then
        log_info "Backend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        log_warn "Backend health check timed out"
    fi
    sleep 2
done

systemctl start yato-frontend
log_info "Frontend service started"

# Get server IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"

echo ""
echo "============================================================"
echo "  YATO is ready!"
echo "============================================================"
echo ""
echo "  ACCESS URLS:"
echo "    Frontend:     http://${SERVER_IP}"
echo "    Backend API:  http://${SERVER_IP}:3000"
echo "    Swagger Docs: http://${SERVER_IP}:3000/docs"
echo ""
echo "  DEFAULT LOGIN:"
echo "    Email:    admin@yato.local"
echo "    Password: admin123"
echo ""
echo "  INSTALLED BRANCH: $BRANCH"
echo ""
echo "  DATABASE:"
echo "    User:     yato"
echo "    Password: $DB_PASS"
echo "    Database: yato"
echo ""
echo "  SERVICE MANAGEMENT:"
echo "    Status:   systemctl status yato-backend yato-frontend"
echo "    Restart:  systemctl restart yato-backend yato-frontend"
echo "    Stop:     systemctl stop yato-backend yato-frontend"
echo "    Logs:     journalctl -u yato-backend -f"
echo ""
echo "  UPDATE:"
echo "    cd $PROJECT_DIR"
echo "    ./update-versi.sh"
echo ""
echo "  CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!"
echo ""
echo "============================================================"
