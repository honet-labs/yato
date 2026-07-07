#!/bin/bash

# YATO Update Script
set -e

GREEN='\033[0-32m'
YELLOW='\033[1-33m'
NC='\033[0m'
RED='\033[0-31m'

SKIP_PULL=false
for arg in "$@"; do
  case $arg in
    --skip-pull|-s)
      SKIP_PULL=true
      ;;
  esac
done

# Check Prerequisites
check_dependency() {
    if ! command -v $1 >/dev/null 2>&1; then
        echo -e "${RED}Error: $1 is not installed.${NC}" >&2
        return 1
    fi
    return 0
}

echo -e "${YELLOW}🔍 Validating environment...${NC}"
check_dependency "git" || exit 1
check_dependency "docker" || exit 1

# Check for Docker Compose (V2 plugin or V1 standalone)
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo -e "${RED}Error: docker compose is not installed.${NC}" >&2
  exit 1
fi

echo -e "${GREEN}🔄 Updating YATO...${NC}"

# Step 1: Pull changes (if using Git)
if [ "$SKIP_PULL" = "true" ]; then
  echo -e "${GREEN}   • Skipped git pull via parameter.${NC}"
elif [ -d ".git" ]; then
  echo -e "${YELLOW}📥 Pulling latest changes from repository...${NC}"
  GIT_TERMINAL_PROMPT=0 git pull || echo -e "${RED}Warning: git pull failed, continuing...${NC}"
else
  echo "   • Not a git repository, skipping pull."
fi

# Step 1.2: Automation Check (CI/CD & Build Validation)
echo -e "${YELLOW}⚙️  Running automation checking (CI/CD & build validation)...${NC}"

echo -e "   • ${YELLOW}Validating Backend (Compiling & Type Checking)...${NC}"
if ! docker build --target builder -t yato-backend-check ./backend; then
  echo -e "${RED}❌ Automation Check FAILED: Backend compilation or type checking failed.${NC}" >&2
  exit 1
fi

echo -e "   • ${YELLOW}Validating Frontend (Compiling & Type Checking)...${NC}"
if ! docker build --target builder -t yato-frontend-check ./frontend; then
  echo -e "${RED}❌ Automation Check FAILED: Frontend compilation or type checking failed.${NC}" >&2
  exit 1
fi

echo -e "   • ${YELLOW}Running Backend Linter...${NC}"
if ! docker run --rm yato-backend-check npm run lint; then
  echo -e "${RED}❌ Automation Check FAILED: Backend linting check failed.${NC}" >&2
  exit 1
fi

echo -e "   • ${YELLOW}Running Frontend Linter...${NC}"
if ! docker run --rm yato-frontend-check npm run lint; then
  echo -e "${RED}❌ Automation Check FAILED: Frontend linting check failed.${NC}" >&2
  exit 1
fi

echo -e "${GREEN}✅ Automation Check PASSED: 100% passed (Build & Lint verification clean).${NC}"

# Step 1.5: Inject Copyright Headers
if command -v node &> /dev/null; then
  echo -e "${YELLOW}⚖️  Injecting Apache 2.0 Copyright Headers...${NC}"
  node add-copyright-header.js || echo -e "${RED}Warning: copyright injection script failed, continuing...${NC}"
else
  echo "   • Node.js not available on host, skipping automated copyright injection."
fi

# Step 1.7: Detect Host Timezone and sync .env
echo -e "${YELLOW}⚙️  Synchronizing system timezone...${NC}"
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl | grep "Time zone" | awk '{print $3}' 2>/dev/null || echo "UTC")
echo -e "   • System Timezone detected as: ${GREEN}$HOST_TZ${NC}"

if [ -f ".env" ]; then
  if grep -q "^TZ=" .env; then
      sed -i "s|^TZ=.*|TZ=$HOST_TZ|" .env
  else
      echo "TZ=$HOST_TZ" >> .env
  fi
fi



# Get Server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
  SERVER_IP=$(ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n1)
fi
if [ -z "$SERVER_IP" ]; then
  SERVER_IP="localhost"
fi
export API_URL="http://$SERVER_IP:4000"

# Step 1.9: Synchronize host dependencies if npm is available
if command -v npm &> /dev/null; then
  echo -e "${YELLOW}📦 Synchronizing host development dependencies...${NC}"
  echo -e "   • Installing backend dependencies on host..."
  (cd backend && npm install && npm audit fix) || echo -e "${RED}Warning: backend npm install or audit fix on host failed, continuing...${NC}"
  echo -e "   • Installing frontend dependencies on host..."
  (cd frontend && npm install && npm audit fix) || echo -e "${RED}Warning: frontend npm install or audit fix on host failed, continuing...${NC}"
else
  echo "   • npm not available on host, skipping host-level node_modules sync."
fi

# Step 2: Rebuild and Restart
echo -e "${YELLOW}📦 Rebuilding and restarting containers...${NC}"
$DOCKER_COMPOSE up -d --build --remove-orphans

# Proactively restart Nginx to flush DNS resolver cache for internal container IPs
echo -e "${YELLOW}⚡ Flushing Nginx DNS resolver cache...${NC}"
$DOCKER_COMPOSE restart nginx || echo -e "${RED}Warning: Failed to restart Nginx, continuing...${NC}"

# Step 3: Run migrations and sync schema
echo -e "${YELLOW}🗄️  Synchronizing database schema...${NC}"
if [ -d "backend/prisma/migrations" ]; then
    echo -e "   • ${GREEN}Safe migrations directory detected.${NC} Deploying migrations..."
    $DOCKER_COMPOSE exec -T yato-backend npx prisma migrate deploy
else
    echo -e "   • ${RED}⚠️  Warning: Migrations directory not found in backend/prisma/migrations.${NC}"
    echo -e "     Using 'db push' as fallback to synchronize schema changes safely."
    $DOCKER_COMPOSE exec -T yato-backend npx prisma db push
fi
$DOCKER_COMPOSE exec -T yato-backend npx prisma db seed
echo -e "${GREEN}✅ Database synchronized and seeded successfully.${NC}"

# Detailed Update Success Information Display
show_update_success() {
    echo -e ""
    echo -e "${GREEN}================================================================${NC}"
    echo -e "   🚀  ${GREEN}YATO Platform Successfully Updated!${NC}"
    echo -e "${GREEN}================================================================${NC}"
    echo -e ""
    
    if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
        echo -e "📄 ${YELLOW}RECENT CHANGES:${NC}"
        git log -n 3 --pretty=format:"   • %h - %s (%cr)" | cat
        echo -e "\n"
    fi

    echo -e "🔐 ${YELLOW}DEFAULT ACCESS CREDENTIALS:${NC}"
    echo -e "   • ${GREEN}Email:${NC}           admin@yato.local"
    echo -e "   • ${GREEN}Password:${NC}        admin123"
    echo -e "   • ${RED}IMPORTANT:${NC}       Please change this default password immediately in your profile settings!"
    echo -e ""

    echo -e "💡 ${YELLOW}USEFUL COMMANDS:${NC}"
    echo -e "   • ${GREEN}View Logs:${NC}           $DOCKER_COMPOSE logs -f"
    echo -e "   • ${GREEN}Restart Services:${NC}    $DOCKER_COMPOSE restart"
    echo -e "${GREEN}================================================================${NC}"
    echo -e ""
}

show_update_success
