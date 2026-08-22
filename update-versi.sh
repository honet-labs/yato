#!/bin/bash

# ============================================================================
# YATO Version Update Script
# Usage: ./update-versi.sh [OPTIONS]
#
# Options:
#   --branch <name>      Branch to update to (main|staging, default: current)
#   --docker             Force Docker mode
#   --systemd            Force Systemd mode
#   --skip-pull          Skip git pull
#   --skip-validation    Skip build validation
#   --help               Show this help
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
SKIP_PULL=false
SKIP_VALIDATION=false
MODE="auto"
TARGET_BRANCH=""

for arg in "$@"; do
    case $arg in
        --skip-pull|-s)        SKIP_PULL=true ;;
        --skip-validation|-sv) SKIP_VALIDATION=true ;;
        --docker)              MODE="docker" ;;
        --systemd)             MODE="systemd" ;;
        --branch)              TARGET_BRANCH="$2"; shift ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --branch <name>      Branch to update to (main|staging)"
            echo "  --docker             Force Docker mode"
            echo "  --systemd            Force Systemd mode"
            echo "  --skip-pull, -s      Skip git pull"
            echo "  --skip-validation    Skip build validation"
            echo "  --help, -h           Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                          # Update current branch, auto-detect mode"
            echo "  $0 --branch staging         # Switch to staging branch"
            echo "  $0 --branch main --docker   # Switch to main, force Docker mode"
            exit 0
            ;;
    esac
done

# ============================================================================
# Display Header
# ============================================================================
echo ""
echo "============================================================"
echo "  YATO Update"
echo "============================================================"
echo ""

# ============================================================================
# STEP 1: Detect Deployment Mode
# ============================================================================
log_step "1/6 - Detecting deployment mode..."

detect_mode() {
    if [ "$MODE" != "auto" ]; then
        return
    fi

    if docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; then
        if docker compose ps 2>/dev/null | grep -q "yato" || docker-compose ps 2>/dev/null | grep -q "yato"; then
            MODE="docker"
            log_info "Detected: Docker"
            return
        fi
    fi

    if systemctl is-active yato-backend >/dev/null 2>&1; then
        MODE="systemd"
        log_info "Detected: Systemd"
        return
    fi

    if docker compose version >/dev/null 2>&1; then
        MODE="docker"
        log_info "Defaulting to: Docker"
    else
        log_error "Could not detect deployment mode."
        echo ""
        echo "  Use --docker or --systemd flag to specify."
        echo ""
        exit 1
    fi
}

detect_mode

# Get current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
log_info "Current branch: $CURRENT_BRANCH"

# Set target branch
if [ -z "$TARGET_BRANCH" ]; then
    TARGET_BRANCH="$CURRENT_BRANCH"
fi

echo ""

# ============================================================================
# STEP 2: Pull Changes
# ============================================================================
log_step "2/6 - Updating source code..."

if [ "$SKIP_PULL" = "true" ]; then
    log_info "Skipping git pull"
elif [ -d ".git" ]; then
    # Switch branch if needed
    if [ "$TARGET_BRANCH" != "$CURRENT_BRANCH" ]; then
        log_info "Switching from '$CURRENT_BRANCH' to '$TARGET_BRANCH'..."
        git fetch origin
        git checkout "$TARGET_BRANCH"
        log_info "Switched to $TARGET_BRANCH"
    fi

    log_info "Pulling latest changes from $TARGET_BRANCH..."
    GIT_TERMINAL_PROMPT=0 git pull origin "$TARGET_BRANCH" || log_warn "Git pull failed, continuing..."

    NEW_VERSION=$(git log -1 --pretty=format:"%h - %s" 2>/dev/null || echo "unknown")
    log_info "Latest: $NEW_VERSION"
else
    log_warn "Not a git repository, skipping pull"
fi

echo ""

# ============================================================================
# STEP 3: Inject Copyright Headers
# ============================================================================
log_step "3/6 - Injecting copyright headers..."

if command -v node >/dev/null 2>&1 && [ -f "add-copyright-header.js" ]; then
    node add-copyright-header.js || log_warn "Copyright injection failed"
    log_info "Copyright headers injected"
else
    log_info "Skipped (node or script not available)"
fi

# Sync timezone
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl 2>/dev/null | grep "Time zone" | awk '{print $3}' || echo "UTC")
if [ -f ".env" ]; then
    if grep -q "^TZ=" .env; then
        sed -i "s|^TZ=.*|TZ=$HOST_TZ|" .env
    else
        echo "TZ=$HOST_TZ" >> .env
    fi
fi

echo ""

# ============================================================================
# STEP 4: Build Validation
# ============================================================================
if [ "$SKIP_VALIDATION" = "true" ]; then
    log_step "4/6 - Skipping build validation"
else
    log_step "4/6 - Running build validation..."

    if [ "$MODE" = "docker" ]; then
        log_info "Validating backend build..."
        if ! docker build --target builder -t yato-backend-check ./backend; then
            log_error "Backend build validation FAILED"
            exit 1
        fi

        log_info "Validating frontend build..."
        if ! docker build --target builder -t yato-frontend-check ./frontend; then
            log_error "Frontend build validation FAILED"
            exit 1
        fi

        log_info "Build validation passed"
    else
        log_info "Skipping Docker build validation for systemd mode"
    fi
fi

echo ""

# ============================================================================
# STEP 5: Sync Host Dependencies
# ============================================================================
log_step "5/6 - Syncing host dependencies..."

if command -v npm >/dev/null 2>&1; then
    log_info "Installing backend dependencies..."
    (cd backend && npm install --no-audit --no-fund) || log_warn "Backend npm install failed"

    log_info "Installing frontend dependencies..."
    (cd frontend && npm install --no-audit --no-fund) || log_warn "Frontend npm install failed"

    log_info "Dependencies synced"
else
    log_info "npm not available, skipping"
fi

echo ""

# ============================================================================
# STEP 6: Rebuild and Restart
# ============================================================================
log_step "6/6 - Rebuilding and restarting services..."

if [ "$MODE" = "docker" ]; then
    # Determine compose command
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi

    log_info "Rebuilding containers..."
    $DOCKER_COMPOSE up -d --build --remove-orphans

    log_info "Restarting Nginx..."
    $DOCKER_COMPOSE restart nginx || log_warn "Nginx restart failed"

    log_info "Running database migrations..."
    if [ -d "backend/prisma/migrations" ]; then
        $DOCKER_COMPOSE exec -T yato-backend npx prisma migrate deploy || log_warn "Migration had warnings"
    else
        $DOCKER_COMPOSE exec -T yato-backend npx prisma db push || log_warn "DB push had warnings"
    fi
    $DOCKER_COMPOSE exec -T yato-backend npx prisma db seed || log_warn "Seed had warnings"

elif [ "$MODE" = "systemd" ]; then
    # Build backend
    log_info "Building backend..."
    cd backend
    npm install --no-audit --no-fund
    npx prisma generate
    npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
    npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts 2>/dev/null || true
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
    log_info "Backend restarted"
    systemctl restart yato-frontend
    log_info "Frontend restarted"

    # Reload nginx
    nginx -t && systemctl reload nginx
    log_info "Nginx reloaded"
fi

echo ""

# ============================================================================
# Display Results
# ============================================================================
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="localhost"

echo ""
echo "============================================================"
echo "  YATO Update Complete"
echo "============================================================"
echo ""
echo "  Branch:  $TARGET_BRANCH"
echo "  Mode:    $MODE"
echo ""
echo "  RECENT CHANGES:"
git log -n 5 --pretty=format:"    %h - %s (%cr)" 2>/dev/null || echo "    (not available)"
echo ""
echo ""
echo "  DEFAULT LOGIN:"
echo "    Email:    admin@yato.local"
echo "    Password: admin123"
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
echo "============================================================"
