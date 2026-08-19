#!/bin/bash

# YATO Uninstaller Script
# Cleanly removes all YATO services, volumes, networks, and configuration files.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "============================================"
echo "  YATO Uninstaller"
echo "============================================"
echo ""

# Check for Docker Compose
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  log_warn "docker compose is not installed. Manual cleanup may be required."
  DOCKER_COMPOSE=""
fi

# Confirmation
read -p "Are you sure you want to completely uninstall YATO? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Uninstall cancelled."
    exit 0
fi

# Stop and remove containers
if [ -n "$DOCKER_COMPOSE" ]; then
    log_info "Stopping and removing YATO containers and networks..."
    $DOCKER_COMPOSE down --remove-orphans
    log_info "Services stopped."

    # Volume removal
    echo ""
    read -p "Delete database and cache volumes? (ALL DATA WILL BE LOST!) (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_warn "Purging persistent volumes..."
        $DOCKER_COMPOSE down -v --remove-orphans
        docker volume prune -f --filter "label=com.docker.compose.project=yato" >/dev/null 2>&1 || true
        log_info "Volumes purged."
    else
        log_info "Keeping volumes."
    fi

    # Image removal
    echo ""
    read -p "Remove all YATO Docker images? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_warn "Removing images..."
        $DOCKER_COMPOSE down --rmi all --remove-orphans
        log_info "Images removed."
    else
        log_info "Keeping images."
    fi
else
    log_warn "Docker Compose not found, skipping container removal."
fi

# Config removal
echo ""
read -p "Delete '.env' file and temporary logs? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Deleting configuration files..."
    rm -f .env
    rm -f backend/.env
    rm -f backend_logs.txt
    rm -f docker_status.txt
    log_info "Configuration files removed."
else
    log_info "Keeping configuration files."
fi

# Docker system prune
echo ""
read -p "Run Docker system prune to reclaim unused cache? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Pruning unused build cache and networks..."
    docker system prune -f --volumes
    log_info "Docker system pruned."
fi

echo ""
log_info "YATO has been completely uninstalled."
echo "Thank you for using YATO."
echo ""
