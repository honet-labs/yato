# Troubleshooting Guide: Nginx 502 Bad Gateway / Login Failure After Updates

This document describes how to diagnose and fix the **502 Bad Gateway** / **"Authentication failed. Check your identity keys."** issue that can occur after running updates on the YATO Platform.

---

## 1. Symptoms
* Attempting to sign in on the web console displays the red banner:
  > **Authentication failed. Check your identity keys.**
* Checking the backend logs with `docker compose logs yato-backend --tail 50` shows **no new requests or error logs** logged during your sign-in attempts.
* Running a direct local check to the Nginx entrypoint returns `502 Bad Gateway`:
  ```bash
  curl -i -X POST http://localhost:9090/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@yato.local","password":"admin123"}'
  ```
  *Response:*
  ```http
  HTTP/1.1 502 Bad Gateway
  Server: nginx/...
  ```
* Running `docker ps -a` shows the `yato-backend` container has been created or restarted recently (e.g., `Up 4 hours`), while the `yato-nginx` container has been running statically for days/weeks (e.g., `Up 5 days`).

---

## 2. Root Cause
When Docker containers are rebuilt and restarted (such as when pulling backend updates), Docker Compose assigns them a **new internal IP address** on the virtual bridge network.

Nginx queries the Docker DNS resolver for the domain name `backend` only once **during its startup** and caches this internal IP address indefinitely. Because the `yato-nginx` container image was not changed during the update, Docker Compose did not recreate or restart Nginx. As a result, Nginx continues to forward all incoming `/api/` traffic to the **old, non-existent internal IP** of the backend, causing a `502 Bad Gateway`.

---

## 3. Resolution Steps

### Step 1: Force Restart the Nginx Container
Restart the Nginx container to clear its DNS cache and resolve the new internal IP address of the backend and frontend:
```bash
docker compose restart nginx
```
*Or via standalone Docker:*
```bash
docker restart yato-nginx
```

### Step 2: Verify Connection (Bypass Cloudflare / Proxy)
Test if Nginx is now successfully routing traffic to the backend by running a POST request to port `9090` from the host terminal:
```bash
curl -i -X POST http://localhost:9090/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yato.local","password":"admin123"}'
```
*Expected response:*
```http
HTTP/1.1 201 Created
{"access_token":"...","refresh_token":"..."}
```

### Step 3: Verify Public Endpoint
Verify that the public domain routing (including any external Cloudflare CDN) is functioning correctly:
```bash
curl -i -X POST https://ops.honet.web.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yato.local","password":"admin123"}'
```

---

## 4. Prevention
The platform's `./update.sh` script has been updated to **automatically restart the Nginx service** whenever an update is executed. This ensures that the Nginx routing cache is flushed seamlessly on every deployment.
