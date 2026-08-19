#!/bin/bash

# YATO Version Update Script
# Handles version checking, pulling updates, rebuilding, and database migrations

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- Parse Arguments ---
SKIP_PULL=false
SKIP_VALIDATION=false
MODE="auto"  # auto | docker | systemd

for arg in "$@"; do
    case $arg in
        --skip-pull|-s)       SKIP_PULL=true ;;
        --skip-validation|-sv) SKIP_VALIDATION=true ;;
        --docker)             MODE="docker" ;;
        --systemd)            MODE="systemd" ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-pull, -s       Skip git pull"
            echo "  --skip-validation,-sv Skip build validation"
            echo "  --docker              Force Docker mode"
            echo "  --systemd             Force Systemd mode"
            echo "  --help, -h            Show this help"
            exit 0
            ;;
    esac
done

echo ""
echo "============================================"
echo "  YATO Version Update"
echo "============================================"
echo ""

# --- Detect Deployment Mode ---
detect_mode() {
    if [ "$MODE" != "auto" ]; then
        return
    fi

    if docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; then
        if docker compose ps 2>/dev/null | grep -q "yato" || docker-compose ps 2>/dev/null | grep -q "yato"; then
            MODE="docker"
            log_info "Detected Docker deployment."
            return
        fi
    fi

    if systemctl is-active yato-backend >/dev/null 2>&1; then
        MODE="systemd"
        log_info "Detected Systemd deployment."
        return
    fi

    # Default to docker if available
    if docker compose version >/dev/null 2>&1; then
        MODE="docker"
    else
        log_error "Could not detect deployment mode. Use --docker or --systemd flag."
        exit 1
    fi
}

detect_mode

# --- Get Current Version ---
get_current_version() {
    if [ -f "package.json" ]; then
        node -e "console.log(require('./package.json').version || 'unknown')" 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

CURRENT_VERSION=$(get_current_version)
log_info "Current version: $CURRENT_VERSION"

# --- Pull Changes ---
if [ "$SKIP_PULL" = "false" ]; then
    if [ -d ".git" ]; then
        log_info "Pulling latest changes..."
        GIT_TERMINAL_PROMPT=0 git pull || log_warn "Git pull failed, continuing..."
        NEW_VERSION=$(get_current_version)
        log_info "Updated to version: $NEW_VERSION"
    else
        log_warn "Not a git repository, skipping pull."
    fi
else
    log_info "Skipping git pull."
fi

# --- Inject Copyright Headers ---
if command -v node >/dev/null 2>&1 && [ -f "add-copyright-header.js" ]; then
    log_info "Injecting copyright headers..."
    node add-copyright-header.js || log_warn "Copyright injection failed, continuing..."
fi

# --- Sync Timezone ---
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl 2>/dev/null | grep "Time zone" | awk '{print $3}' || echo "UTC")
if [ -f ".env" ]; then
    if grep -q "^TZ=" .env; then
        sed -i "s|^TZ=.*|TZ=$HOST_TZ|" .env
    else
        echo "TZ=$HOST_TZ" >> .env
    fi
fi

# --- Update Based on Mode ---
if [ "$MODE" = "docker" ]; then
    # Determine compose command
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi

    # Validation
    if [ "$SKIP_VALIDATION" = "false" ]; then
        log_info "Running build validation..."

        log_info "Validating backend build..."
        if ! docker build --target builder -t yato-backend-check ./backend; then
            log_error "Backend build validation failed."
            exit 1
        fi

        log_info "Validating frontend build..."
        if ! docker build --target builder -t yato-frontend-check ./frontend; then
            log_error "Frontend build validation failed."
            exit 1
        fi

        log_info "Build validation passed."
    fi

    # Sync host deps
    if command -v npm >/dev/null 2>&1; then
        log_info "Syncing host dependencies..."
        (cd backend && npm install --no-audit --no-fund) || log_warn "Backend npm install failed."
        (cd frontend && npm install --no-audit --no-fund) || log_warn "Frontend npm install failed."
    fi

    # Rebuild
    log_info "Rebuilding containers..."
    $DOCKER_COMPOSE up -d --build --remove-orphans

    # Restart nginx
    log_info "Restarting Nginx..."
    $DOCKER_COMPOSE restart nginx || log_warn "Nginx restart failed."

    # Database migration
    log_info "Running database migrations..."
    if [ -d "backend/prisma/migrations" ]; then
        $DOCKER_COMPOSE exec -T yato-backend npx prisma migrate deploy
    else
        $DOCKER_COMPOSE exec -T yato-backend npx prisma db push
    fi
    $DOCKER_COMPOSE exec -T yato-backend npx prisma db seed

elif [ "$MODE" = "systemd" ]; then
    # Build backend
    log_info "Building backend..."
    cd backend
    npm install --no-audit --no-fund
    npx prisma generate
    npx prisma migrate deploy || npx prisma db push --accept-data-loss
    npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts || true
    npm run build
    cd ..

    # Build frontend
    log_info "Building frontend..."
    cd frontend
    npm install --no-audit --no-fund
    npm run build
    cd ..

    # Restart services
    log_info "Restarting services..."
    systemctl restart yato-backend
    systemctl restart yato-frontend

    # Reload nginx
    nginx -t && systemctl reload nginx
fi

# --- Display Recent Changes ---
if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
    echo ""
    log_info "Recent changes:"
    git log -n 5 --pretty=format:"  %h - %s (%cr)" 2>/dev/null || true
    echo ""
fi

# --- Success ---
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"

echo ""
echo "============================================"
echo "  YATO Update Complete"
echo "============================================"
echo ""
echo "  Version: $CURRENT_VERSION -> $(get_current_version)"
echo "  Mode:    $MODE"
echo ""
echo "  DEFAULT CREDENTIALS:"
echo "    Email:     admin@yato.local"
echo "    Password:  admin123"
echo ""

if [ "$MODE" = "docker" ]; then
    echo "  COMMANDS:"
    echo "    Logs:    $DOCKER_COMPOSE logs -f"
    echo "    Restart: $DOCKER_COMPOSE restart"
    echo "    Status:  $DOCKER_COMPOSE ps"
else
    echo "  COMMANDS:"
    echo "    Logs:    journalctl -u yato-backend -f"
    echo "    Restart: systemctl restart yato-backend yato-frontend"
    echo "    Status:  systemctl status yato-backend yato-frontend"
fi

echo ""
echo "============================================"
