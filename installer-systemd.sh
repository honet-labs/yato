#!/bin/bash

# YATO Systemd Installer
# Dedicated installer for standalone systemd deployment (without Docker)

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
echo "  YATO Systemd Installer"
echo "============================================"
echo ""

# --- Root Check ---
if [ "$(id -u)" -ne 0 ]; then
    log_error "This script must be run as root or with sudo."
    exit 1
fi

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

if ! command -v systemctl >/dev/null 2>&1; then
    log_error "systemctl is not available. Systemd mode requires systemd support."
    exit 1
fi

# --- Detect Distribution ---
PKG_MANAGER=""
if [ -f /etc/debian_version ]; then
    PKG_MANAGER="apt-get"
elif [ -f /etc/redhat-release ]; then
    PKG_MANAGER="yum"
else
    log_warn "Unsupported OS distribution. Continuing with manual dependency checks..."
fi

# --- Install System Dependencies ---
install_system_deps() {
    log_info "Installing system dependencies..."

    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get update -y >/dev/null 2>&1

        # PostgreSQL
        if ! command -v psql >/dev/null 2>&1; then
            log_info "Installing PostgreSQL..."
            apt-get install -y postgresql postgresql-contrib >/dev/null 2>&1
            systemctl enable --now postgresql
        fi

        # Redis
        if ! command -v redis-server >/dev/null 2>&1; then
            log_info "Installing Redis..."
            apt-get install -y redis-server >/dev/null 2>&1
            systemctl enable --now redis-server
        fi

        # Node.js (v20 LTS)
        if ! command -v node >/dev/null 2>&1; then
            log_info "Installing Node.js 20 LTS..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            apt-get install -y nodejs >/dev/null 2>&1
        fi

        # Nginx (optional, for reverse proxy)
        if ! command -v nginx >/dev/null 2>&1; then
            log_info "Installing Nginx..."
            apt-get install -y nginx >/dev/null 2>&1
            systemctl enable --now nginx
        fi

    elif [ "$PKG_MANAGER" = "yum" ]; then
        # PostgreSQL
        if ! command -v psql >/dev/null 2>&1; then
            log_info "Installing PostgreSQL..."
            yum install -y postgresql-server postgresql-contrib >/dev/null 2>&1
            postgresql-setup --initdb 2>/dev/null || true
            systemctl enable --now postgresql
        fi

        # Redis
        if ! command -v redis-server >/dev/null 2>&1; then
            log_info "Installing Redis..."
            yum install -y redis >/dev/null 2>&1
            systemctl enable --now redis
        fi

        # Node.js
        if ! command -v node >/dev/null 2>&1; then
            log_info "Installing Node.js 20 LTS..."
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            yum install -y nodejs >/dev/null 2>&1
        fi

        # Nginx
        if ! command -v nginx >/dev/null 2>&1; then
            log_info "Installing Nginx..."
            yum install -y nginx >/dev/null 2>&1
            systemctl enable --now nginx
        fi
    fi
}

install_system_deps

# --- Database Setup ---
setup_database() {
    log_info "Setting up PostgreSQL database..."

    # Create database and user
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='yato'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER yato WITH PASSWORD 'yato_secure_password';"
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='yato'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE yato OWNER yato;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE yato TO yato;" 2>/dev/null || true

    log_info "Database 'yato' and user 'yato' created."
}

setup_database

# --- Configuration ---
PROJECT_DIR=$(pwd)
ENV_FILE="$PROJECT_DIR/.env"

log_info "Setting up configuration..."

if [ ! -f "$ENV_FILE" ]; then
    cp backend/.env.example "$ENV_FILE" 2>/dev/null || touch "$ENV_FILE"

    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    ENC_KEY=$(openssl rand -hex 16)

    sed -i "s|JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" "$ENV_FILE"
    sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=\"$JWT_REFRESH_SECRET\"|" "$ENV_FILE"
    sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"$ENC_KEY\"|" "$ENV_FILE"
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://yato:yato_secure_password@localhost:5432/yato?schema=public\"|" "$ENV_FILE"

    if ! grep -q "^REDIS_HOST=" "$ENV_FILE"; then
        echo "REDIS_HOST=localhost" >> "$ENV_FILE"
    fi
    if ! grep -q "^REDIS_PORT=" "$ENV_FILE"; then
        echo "REDIS_PORT=6379" >> "$ENV_FILE"
    fi

    log_info "Generated JWT secrets and encryption key."
fi

# Timezone
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl 2>/dev/null | grep "Time zone" | awk '{print $3}' || echo "UTC")
if grep -q "^TZ=" "$ENV_FILE"; then
    sed -i "s|^TZ=.*|TZ=$HOST_TZ|" "$ENV_FILE"
else
    echo "TZ=$HOST_TZ" >> "$ENV_FILE"
fi

# --- Build Backend ---
log_info "Building backend service..."
cd "$PROJECT_DIR/backend"
npm install --no-audit --no-fund
npx prisma generate
npx prisma migrate deploy || npx prisma db push --accept-data-loss
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts || true
npm run build
cd "$PROJECT_DIR"

# --- Build Frontend ---
log_info "Building frontend service..."
cd "$PROJECT_DIR/frontend"
npm install --no-audit --no-fund
npm run build
cd "$PROJECT_DIR"

# --- Create Systemd Services ---
log_info "Creating systemd service files..."

# Backend Service
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

[Install]
WantedBy=multi-user.target
EOF

# Frontend Service
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

[Install]
WantedBy=multi-user.target
EOF

# Reload and enable
systemctl daemon-reload
systemctl enable yato-backend yato-frontend
systemctl start yato-backend
log_info "Backend service started."
systemctl start yato-frontend
log_info "Frontend service started."

# --- Nginx Reverse Proxy ---
NGINX_CONF="/etc/nginx/sites-available/yato"
cat > "$NGINX_CONF" <<'NGINX_EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

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
        limit_req zone=api_limit burst=20 nodelay;
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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 600s;
    }
}
NGINX_EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/yato
rm -f /etc/nginx/sites-enabled/default 2>/dev/null
nginx -t && systemctl reload nginx

# --- Success ---
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"

echo ""
echo "============================================"
echo "  YATO Systemd Installation Complete"
echo "============================================"
echo ""
echo "  ACCESS URLS:"
echo "    Frontend:  http://${SERVER_IP}"
echo "    Backend:   http://${SERVER_IP}:3000"
echo "    Swagger:   http://${SERVER_IP}:3000/docs"
echo ""
echo "  DEFAULT CREDENTIALS:"
echo "    Email:     admin@yato.local"
echo "    Password:  admin123"
echo ""
echo "  SERVICE MANAGEMENT:"
echo "    Status:    systemctl status yato-backend yato-frontend"
echo "    Restart:   systemctl restart yato-backend yato-frontend"
echo "    Stop:      systemctl stop yato-backend yato-frontend"
echo "    Logs:      journalctl -u yato-backend -f"
echo ""
echo "============================================"
