#!/bin/bash

# YATO Update Script
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SKIP_PULL=false
SKIP_VALIDATION=false
for arg in "$@"; do
  case $arg in
    --skip-pull|-s)
      SKIP_PULL=true
      ;;
    --skip-validation|--skip-check|-sv|-sc)
      SKIP_VALIDATION=true
      ;;
  esac
done

check_dependency() {
    if ! command -v $1 >/dev/null 2>&1; then
        log_error "$1 is not installed."
        return 1
    fi
    return 0
}

echo ""
echo "============================================"
echo "  YATO Update"
echo "============================================"
echo ""

log_info "Validating environment..."
check_dependency "git" || exit 1
check_dependency "docker" || exit 1

if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  log_error "docker compose is not installed."
  exit 1
fi

# Step 1: Pull changes
if [ "$SKIP_PULL" = "true" ]; then
  log_info "Skipping git pull."
elif [ -d ".git" ]; then
  log_info "Pulling latest changes..."
  GIT_TERMINAL_PROMPT=0 git pull || log_warn "git pull failed, continuing..."
else
  log_info "Not a git repository, skipping pull."
fi

# Step 2: Build validation
if [ "$SKIP_VALIDATION" = "true" ]; then
  log_info "Skipping build validation."
else
  log_info "Running build validation..."

  log_info "Validating backend build..."
  if ! docker build --target builder -t yato-backend-check ./backend; then
    log_error "Backend build validation FAILED."
    exit 1
  fi

  log_info "Validating frontend build..."
  if ! docker build --target builder -t yato-frontend-check ./frontend; then
    log_error "Frontend build validation FAILED."
    exit 1
  fi

  log_info "Running backend linter..."
  if ! docker run --rm yato-backend-check npm run lint; then
    log_error "Backend lint check FAILED."
    exit 1
  fi

  log_info "Running frontend linter..."
  if ! docker run --rm yato-frontend-check npm run lint; then
    log_error "Frontend lint check FAILED."
    exit 1
  fi

  log_info "Build validation passed."
fi

# Step 3: Inject Copyright Headers
if command -v node &> /dev/null; then
  log_info "Injecting copyright headers..."
  node add-copyright-header.js || log_warn "Copyright injection failed."
fi

# Step 4: Sync timezone
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl | grep "Time zone" | awk '{print $3}' 2>/dev/null || echo "UTC")
log_info "System timezone: $HOST_TZ"

if [ -f ".env" ]; then
  if grep -q "^TZ=" .env; then
      sed -i "s|^TZ=.*|TZ=$HOST_TZ|" .env
  else
      echo "TZ=$HOST_TZ" >> .env
  fi
fi

# Step 5: Get Server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
  SERVER_IP=$(ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n1)
fi
if [ -z "$SERVER_IP" ]; then
  SERVER_IP="localhost"
fi
export API_URL="http://$SERVER_IP:4000"

# Step 6: Sync host dependencies
if command -v npm &> /dev/null; then
  log_info "Syncing host dependencies..."
  (cd backend && npm install --no-audit --no-fund) || log_warn "Backend npm install failed."
  (cd frontend && npm install --no-audit --no-fund) || log_warn "Frontend npm install failed."
fi

# Step 7: Rebuild and restart
log_info "Rebuilding and restarting containers..."
$DOCKER_COMPOSE up -d --build --remove-orphans

# Step 8: Restart Nginx
log_info "Restarting Nginx..."
$DOCKER_COMPOSE restart nginx || log_warn "Nginx restart failed."

# Step 9: Database migration
log_info "Running database migrations..."
if [ -d "backend/prisma/migrations" ]; then
    $DOCKER_COMPOSE exec -T yato-backend npx prisma migrate deploy
else
    $DOCKER_COMPOSE exec -T yato-backend npx prisma db push
fi
$DOCKER_COMPOSE exec -T yato-backend npx prisma db seed
log_info "Database synchronized."

# Display success
show_update_success() {
    echo ""
    echo "============================================"
    echo "  YATO Update Complete"
    echo "============================================"
    echo ""
    
    if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
        echo "  RECENT CHANGES:"
        git log -n 3 --pretty=format:"    %h - %s (%cr)" | cat
        echo ""
        echo ""
    fi

    echo "  DEFAULT CREDENTIALS:"
    echo "    Email:     admin@yato.local"
    echo "    Password:  admin123"
    echo ""
    echo "  COMMANDS:"
    echo "    Logs:      $DOCKER_COMPOSE logs -f"
    echo "    Restart:   $DOCKER_COMPOSE restart"
    echo ""
    echo "============================================"
    echo ""
}

show_update_success
