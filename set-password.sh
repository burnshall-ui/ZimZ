#!/usr/bin/env bash
# Set the ZimZ dashboard password.
#
# Prompts without echo, rewrites ZIMZ_AUTH_PASSWORD in .env and restarts
# whichever process manager is actually running zimz (systemd or pm2). The
# password is never passed as an argument, so it stays out of the shell
# history and the process list.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "No .env in $(pwd) — copy .env.example first." >&2
  exit 1
fi

read -rsp "New ZimZ password: " pw && echo
read -rsp "Repeat: " pw2 && echo

if [ "$pw" != "$pw2" ]; then
  echo "Passwords do not match." >&2
  exit 1
fi
if [ ${#pw} -lt 8 ]; then
  echo "Use at least 8 characters." >&2
  exit 1
fi

backup=".env.bak.$(date +%s)"
cp .env "$backup"
chmod 600 "$backup"

# Rewrite via the environment rather than a sed pattern, so characters that are
# special to sed (/, &, \) survive intact.
PW="$pw" python3 - <<'PY'
import os, re
pw = os.environ["PW"]
with open(".env") as fh:
    lines = fh.read().splitlines()

out, seen = [], False
for line in lines:
    if re.match(r"^ZIMZ_AUTH_PASSWORD=", line):
        out.append(f"ZIMZ_AUTH_PASSWORD={pw}")
        seen = True
    else:
        out.append(line)
if not seen:
    out.append(f"ZIMZ_AUTH_PASSWORD={pw}")

with open(".env", "w") as fh:
    fh.write("\n".join(out) + "\n")
PY

chmod 600 .env

# DEPLOY.md recommends systemd; pm2 is the alternative some setups use
# instead. Try both rather than hard-coding one, so the helper works either
# way — restarting the wrong (inactive) manager is a no-op, not a failure.
restarted=""
if command -v systemctl >/dev/null && systemctl is-active --quiet zimz 2>/dev/null; then
  sudo systemctl restart zimz
  restarted="systemd"
elif command -v pm2 >/dev/null && pm2 describe zimz >/dev/null 2>&1; then
  pm2 restart zimz >/dev/null
  restarted="pm2"
fi

if [ -z "$restarted" ]; then
  echo "Password updated, but no running zimz service found under systemd or pm2." >&2
  echo "Restart it manually (see DEPLOY.md) for the new password to take effect." >&2
  exit 0
fi

echo "Password updated and zimz restarted ($restarted)."
echo "Existing sessions stay valid — they are signed with ZIMZ_SESSION_SECRET,"
echo "which is unchanged. Rotate that too if you need to sign everyone out."
