# ZIMZ Deploy Guide (Linux VPS + Tailscale)

## 1) Prerequisites

- Ubuntu 24.04 (or similar)
- Node.js 20 LTS + npm
- OpenClaw Gateway running on the VPS
- Tailscale installed and connected

## 2) Clone and install

```bash
git clone https://github.com/burnshall-ui/ZimZ.git
cd ZimZ
npm ci
```

## 3) Environment

Create `.env` in the project root:

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=
```

Use `127.0.0.1` when ZIMZ and OpenClaw Gateway run on the same machine.

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
