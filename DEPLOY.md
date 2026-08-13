# ZIMZ Deploy Guide (Linux VPS + Tailscale)

## 1) Prerequisites

- Ubuntu 24.04 (or similar)
- Node.js 24 LTS + npm (matches CI; the Gateway client needs Node's Web Crypto available globally)
- OpenClaw Gateway running on the VPS
- Tailscale installed and connected

## 2) Clone and install

```bash
git clone https://github.com/burnshall-ui/ZimZ.git
cd ZimZ
npm ci
```

## 3) Environment

First generate the session secret — this must run as a shell command, not sit
inside `.env`, which is read as plain `KEY=VALUE` pairs and does not expand
`$(...)`:

```bash
openssl rand -base64 48
```

Then create `.env` in the project root and paste the generated value in:

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=

# Required — see the warning below
ZIMZ_AUTH_PASSWORD=your-password-here
ZIMZ_SESSION_SECRET=paste-the-generated-value-here
```

Use `127.0.0.1` when ZIMZ and OpenClaw Gateway run on the same machine.

> **ZIMZ connects to the Gateway with `operator.admin` scope.** Anyone who
> reaches it can create, modify and delete agents, write `SOUL.md` / `MEMORY.md`
> and run cron jobs. `ZIMZ_AUTH_PASSWORD` and `ZIMZ_SESSION_SECRET` are therefore
> mandatory: without them every request is answered with HTTP 503. Keep the
> Gateway bound to `127.0.0.1`, and prefer a tailnet or an authenticating reverse
> proxy over a public listener.

Optional: `ZIMZ_ALLOWED_ORIGINS` (comma separated) adds origins permitted to send
`POST`/`PATCH`/`DELETE`. The request's own `Host` is always allowed, so this is
only needed when the browser reaches ZIMZ under a different hostname than the one
Next.js sees.

## 4) Build and run

```bash
npm run build
npm run start
```

Default app port is `3000`.

## 5) Run with systemd (recommended)

Create `/etc/systemd/system/zimz.service`:

```ini
[Unit]
Description=ZIMZ Next.js Dashboard
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/ZimZ
Environment=NODE_ENV=production
EnvironmentFile=/home/YOUR_USER/ZimZ/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable zimz
sudo systemctl start zimz
sudo systemctl status zimz
```

## 6) Reverse proxy (optional, Tailnet-internal)

Use Nginx/Caddy to expose ZIMZ on a friendly hostname in your tailnet.
Keep OpenClaw Gateway internal (`127.0.0.1:18789`).

## 7) Update flow

```bash
cd ~/ZimZ
git pull
npm ci
npm run build
sudo systemctl restart zimz
```
