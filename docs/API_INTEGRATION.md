# YATO API Integration Guide

Dokumentasi ini menjelaskan cara mengakses YATO API untuk integrasi dengan aplikasi pihak ketiga.

---

## 1. Informasi Dasar API

| Property | Value |
|----------|-------|
| Base URL | `http://<server-ip>:3000` |
| Protocol | HTTP/HTTPS |
| Format | JSON |
| Auth | Bearer Token (JWT) |
| Swagger | `http://<server-ip>:3000/docs` |

---

## 2. Autentikasi

### 2.1 Login dan Mendapatkan Token

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "admin@yato.local",
  "password": "admin123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 2.2 Menggunakan Token

Semua request ke API yang memerlukan autentikasi harus menyertakan header:

```
Authorization: Bearer <access_token>
```

### 2.3 Personal Access Token (PAT)

Untuk integrasi jangka panjang, gunakan PAT yang tidak expire sesering JWT:

```bash
POST /auth/token
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "duration": 365
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-08-19T00:00:00.000Z"
}
```

---

## 3. Endpoint API Utama

### 3.1 Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List semua user |
| GET | `/users/:id` | Detail user |
| PATCH | `/users/:id` | Update user |
| DELETE | `/users/:id` | Hapus user |

### 3.2 Support Tickets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/support-tickets` | Buat tiket baru |
| GET | `/support-tickets` | List semua tiket |
| GET | `/support-tickets/:id` | Detail tiket |
| PUT | `/support-tickets/:id` | Update tiket |
| PUT | `/support-tickets/:id/status` | Update status tiket |
| DELETE | `/support-tickets/:id` | Hapus tiket (admin) |

### 3.3 VM Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/vm/request` | Buat request VM |
| GET | `/vm/request` | List semua request |
| GET | `/vm/request/:id` | Detail request |
| PUT | `/vm/request/:id/approve` | Approve request |
| PUT | `/vm/request/:id/reject` | Reject request |

### 3.4 VM Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/vm-inventory` | Tambah VM ke inventory |
| GET | `/vm-inventory` | List semua VM |
| PUT | `/vm-inventory/:id/config` | Update konfigurasi VM |
| POST | `/vm-inventory/:id/reveal` | Reveal SSH credentials |

### 3.5 Service Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/service/request` | Buat request service |
| GET | `/service/request` | List semua request |
| PUT | `/service/request/:id/approve` | Approve request |

### 3.6 Service Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/service-inventory` | Tambah service |
| GET | `/service-inventory` | List semua service |

### 3.7 Credentials

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/credentials` | Buat credential |
| GET | `/credentials` | List semua credential |
| GET | `/credentials/:id` | Detail credential (password masked) |
| POST | `/credentials/:id/reveal` | Reveal password (perlu re-auth) |

### 3.8 Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/assets` | Buat asset |
| GET | `/assets` | List semua asset |
| GET | `/assets/:id` | Detail asset |
| PUT | `/assets/:id` | Update asset |
| DELETE | `/assets/:id` | Hapus asset |
| GET | `/assets/:id/print` | Generate label cetak |

### 3.9 Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks` | Buat task |
| GET | `/tasks` | List semua task |
| GET | `/tasks/:id` | Detail task |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Hapus task |

### 3.10 HRM

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/hrm/timesheets/clock-in` | Clock in |
| POST | `/hrm/timesheets/clock-out` | Clock out |
| GET | `/hrm/timesheets/my` | Timesheet saya |
| POST | `/hrm/leaves` | Ajukan cuti |
| GET | `/hrm/leaves/balance` | Sisa cuti |

### 3.11 Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/integrations` | List integrasi |
| POST | `/integrations` | Tambah integrasi |
| GET | `/integrations/plugins` | List plugin |
| POST | `/integrations/plugins/upload` | Upload plugin |

### 3.12 System Config

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/system/config/branding` | Branding (public) |
| GET | `/system/config` | Semua config (admin) |
| PUT | `/system/config` | Update config |
| GET | `/system/config/status` | Status sistem |

### 3.13 Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/stats` | Statistik platform |

### 3.14 Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit` | List audit logs |

---

## 4. Contoh Integrasi

### 4.1 cURL - Buat Tiket Support

```bash
curl -X POST http://your-server:3000/support-tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subject": "Server down",
    "description": "Production server tidak bisa diakses",
    "priority": "URGENT",
    "category": "INFRASTRUCTURE"
  }'
```

### 4.2 Python - List VM Inventory

```python
import requests

API_URL = "http://your-server:3000"
TOKEN = "YOUR_TOKEN"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

response = requests.get(f"{API_URL}/vm-inventory", headers=headers)
vms = response.json()
for vm in vms:
    print(f"VM: {vm.get('hostname')} - {vm.get('ipAddress')}")
```

### 4.3 Node.js - Clock In

```javascript
const axios = require('axios');

const API_URL = 'http://your-server:3000';
const TOKEN = 'YOUR_TOKEN';

async function clockIn() {
  try {
    const response = await axios.post(`${API_URL}/hrm/timesheets/clock-in`, {
      latitude: -6.2088,
      longitude: 106.8456,
      deviceInfo: 'Integration Bot'
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Clock in success:', response.data);
  } catch (error) {
    console.error('Clock in failed:', error.response?.data);
  }
}

clockIn();
```

### 4.4 Webhook - Notifikasi Otomatis

Untuk menerima notifikasi dari YATO ke sistem lain, gunakan event listener pada notification module. Konfigurasi routing rules di System Settings:

```json
{
  "NOTIFICATION_ROUTING_RULES": [
    {
      "category": "INFRASTRUCTURE",
      "team": "infra-team",
      "channel": "telegram"
    },
    {
      "category": "DATABASE",
      "team": "dba-team",
      "channel": "email"
    }
  ]
}
```

---

## 5. Rate Limiting

| Layer | Limit | Burst |
|-------|-------|-------|
| Nginx | 10 req/s per IP | 20 |
| NestJS | 100 req/min per IP | - |

---

## 6. Error Codes

| HTTP Code | Meaning |
|-----------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validasi gagal) |
| 401 | Unauthorized (token invalid/expired) |
| 403 | Forbidden (permission tidak cukup) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |

---

## 7. Konfigurasi CORS

Untuk mengizinkan akses dari domain lain, tambahkan domain ke environment variable `CORS_ORIGINS`:

```env
CORS_ORIGINS="https://your-app.com,https://dashboard.your-app.com"
```

---

## 8. Keamanan

- Simpan token di tempat aman, jangan hardcode di source code
- Gunakan PAT untuk integrasi server-to-server
- Rotate token secara berkala
- Gunakan HTTPS di production
- Batasi permission token hanya untuk endpoint yang diperlukan
