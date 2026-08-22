# YATO Platform
### Unified Infrastructure Operations & Asset Management Platform

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18%20%7C%20v20-green?style=for-the-badge&logo=node.js&logoColor=white" alt="Node Version" />
  <img src="https://img.shields.io/badge/NestJS-v10-red?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS Version" />
  <img src="https://img.shields.io/badge/Next.js-v14-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js Version" />
  <img src="https://img.shields.io/badge/PostgreSQL-v15-blue?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL Version" />
  <img src="https://img.shields.io/badge/Redis-v7-red?style=for-the-badge&logo=redis&logoColor=white" alt="Redis Version" />
  <img src="https://img.shields.io/badge/Docker-Supported-blue?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Supported" />
  <img src="https://img.shields.io/badge/License-Apache%202.0-yellowgreen?style=for-the-badge" alt="Apache 2.0 License" />
</p>

---

## Overview

**YATO** is a unified IT Operations, Task Management, and Asset Registry platform built to streamline communications between development teams, helpdesk support, and system administrators.

---

## Installation

### Prerequisites

| Requirement | Docker Mode | Systemd Mode |
|-------------|-------------|--------------|
| OS | Linux, macOS, Windows WSL2 | Ubuntu 20.04+, Debian 11+, RHEL 8+ |
| Docker | v24.0+ with Compose v2.20+ | Not required |
| RAM | 4 GB minimum (8 GB recommended) | 4 GB minimum |
| Disk | 20 GB free | 20 GB free |
| Root/Sudo | No (add user to docker group) | Yes |

### Quick Install (One Command)

**Docker mode (recommended):**
```bash
curl -fsSL https://raw.githubusercontent.com/honet-labs/yato/staging/installer-docker.sh | bash -s -- --branch staging
```

**Systemd mode:**
```bash
curl -fsSL https://raw.githubusercontent.com/honet-labs/yato/staging/installer-systemd.sh | sudo bash -s -- --branch staging
```

---

### Step-by-Step Install

#### Step 1: Download Installer

```bash
# Download Docker installer
curl -fsSL -o installer-docker.sh https://raw.githubusercontent.com/honet-labs/yato/staging/installer-docker.sh
chmod +x installer-docker.sh

# OR download Systemd installer
curl -fsSL -o installer-systemd.sh https://raw.githubusercontent.com/honet-labs/yato/staging/installer-systemd.sh
chmod +x installer-systemd.sh
```

#### Step 2: Run Installer

**Docker:**
```bash
# Install from main branch (stable)
./installer-docker.sh --branch main

# Install from staging branch (latest features)
./installer-docker.sh --branch staging

# Custom Nginx port
./installer-docker.sh --branch main --port 80
```

**Systemd:**
```bash
# Install from main branch (stable)
sudo ./installer-systemd.sh --branch main

# Install from staging branch (latest features)
sudo ./installer-systemd.sh --branch staging

# Custom database password
sudo ./installer-systemd.sh --branch main --db-pass mySecurePassword
```

#### Step 3: Access YATO

After installation completes, open your browser:

```
http://<your-server-ip>
```

Default login:
- **Email:** `admin@yato.local`
- **Password:** `admin123`

**Change the password immediately after first login.**

---

### Installer Options

#### installer-docker.sh

| Option | Default | Description |
|--------|---------|-------------|
| `--branch <name>` | `main` | Branch to install (`main` or `staging`) |
| `--port <port>` | `9090` | Nginx HTTP port |
| `--help` | - | Show help |

#### installer-systemd.sh

| Option | Default | Description |
|--------|---------|-------------|
| `--branch <name>` | `main` | Branch to install (`main` or `staging`) |
| `--db-pass <pass>` | auto-generated | PostgreSQL password |
| `--help` | - | Show help |

---

### What the Installer Does

The installer performs these steps automatically:

1. **Check dependencies** - Verifies git, docker/node, openssl
2. **Clone repository** - Downloads YATO from selected branch
3. **Generate config** - Creates `.env` with auto-generated secrets
4. **Build images** - Compiles backend and frontend
5. **Start infrastructure** - Launches PostgreSQL, Redis
6. **Run migrations** - Sets up database schema and seed data
7. **Start services** - Launches all YATO services
8. **Display access info** - Shows URLs and credentials

---

## Update

```bash
# Update current branch
./update-versi.sh

# Switch to staging branch
./update-versi.sh --branch staging

# Switch back to main branch
./update-versi.sh --branch main

# Force Docker mode
./update-versi.sh --docker

# Force Systemd mode
./update-versi.sh --systemd
```

### Update Options

| Option | Default | Description |
|--------|---------|-------------|
| `--branch <name>` | current | Branch to update to |
| `--docker` | auto | Force Docker mode |
| `--systemd` | auto | Force Systemd mode |
| `--skip-pull` | false | Skip git pull |
| `--skip-validation` | false | Skip build validation |

---

## Branches

| Branch | Description | Stability |
|--------|-------------|-----------|
| `main` | Stable release | High |
| `staging` | Latest features, may have bugs | Medium |

---

## Service Management

### Docker Mode

```bash
# View status
docker compose ps

# View logs
docker compose logs -f
docker compose logs -f yato-backend

# Restart services
docker compose restart

# Stop services
docker compose down

# Start services
docker compose up -d
```

### Systemd Mode

```bash
# View status
sudo systemctl status yato-backend yato-frontend

# View logs
sudo journalctl -u yato-backend -f
sudo journalctl -u yato-frontend -f

# Restart services
sudo systemctl restart yato-backend yato-frontend

# Stop services
sudo systemctl stop yato-backend yato-frontend

# Start services
sudo systemctl start yato-backend yato-frontend
```

---

## Uninstall

```bash
./uninstall.sh
```

The uninstaller will ask for confirmation before removing:
- Containers and networks
- Database volumes (optional)
- Docker images (optional)
- Configuration files (optional)

---

## Access URLs

After installation:

| Service | Docker URL | Systemd URL |
|---------|------------|-------------|
| Frontend | `http://<ip>:9090` | `http://<ip>` |
| Backend API | `http://<ip>:4000` | `http://<ip>:3000` |
| Swagger Docs | `http://<ip>:4000/docs` | `http://<ip>:3000/docs` |

---

## Features

- **Helpdesk Ticketing** - Support tickets with threaded comments
- **Task Management** - Kanban boards with templates
- **Credential Vault** - AES-256 encrypted password storage
- **Asset Registry** - CMDB with QR codes and rack mapping
- **HRM** - Attendance, shifts, leaves, timesheets
- **VM Provisioning** - Automated VM deployment via Proxmox
- **Multi-channel Notifications** - Email, WhatsApp, Telegram
- **RBAC** - Role-based access control with granular permissions
- **MFA** - Two-factor authentication with TOTP
- **Audit Trail** - Immutable logging of all actions

---

## API Integration

See [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md) for:
- Authentication (JWT + Personal Access Tokens)
- Full endpoint reference
- Code examples (cURL, Python, Node.js)

---

## Troubleshooting

### Docker not starting
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### Port already in use
```bash
# Check what's using the port
sudo lsof -i :9090

# Or change port in installer
./installer-docker.sh --port 8080
```

### Database connection failed
```bash
# Check if PostgreSQL is running
docker compose ps postgres
# or
sudo systemctl status postgresql

# Check logs
docker compose logs postgres
```

### MFA codes not working
```bash
# Sync system time
sudo systemctl restart systemd-timesyncd

# Check container time
docker compose exec yato-backend date
```

---

## License

Apache License 2.0. See [LICENSE](LICENSE).
