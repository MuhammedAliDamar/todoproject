#!/usr/bin/env bash
# marktasks — sadece DB + nginx + SSL + pm2
# Sunucuda node/pm2/nginx/postgres/certbot zaten kurulu varsayılır.
#
# Çalıştır:
#   sudo bash setup.sh
#
# Bayraklar:
#   SKIP_SSL=1       — Let's Encrypt atla (Cloudflare Full mod)
#   IMPORT_OLD_DB=1  — Eski sunucudan (72.61.182.238) DB'yi aktar
set -uo pipefail

APP_NAME="marktasks"
APP_PORT=4444
APP_DOMAIN="marktasks.com"
PG_DB="marktasks"
PG_USER="marktasks"
ADMIN_EMAIL="globayazilim@gmail.com"
OLD_DB_URL="postgresql://marktasks:52db36b2ca3189dfaa78635bd40dc39d9f3179323441b52a@72.61.182.238:5432/marktasks"

SLACK_CLIENT_ID="9874048584085.10615149670229"
SLACK_CLIENT_SECRET="a29a82832b436d7dc86ae5a5065f50ff"
SLACK_SIGNING_SECRET="432d74f379f9595a43b6ce48ab5a37f7"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="commarktasks@gmail.com"
SMTP_PASS="ittimnsquaxivzmf"
SMTP_FROM="marktasks <commarktasks@gmail.com>"

G="\033[32m"; Y="\033[33m"; N="\033[0m"
log()  { echo -e "${G}[+]${N} $*"; }
warn() { echo -e "${Y}[!]${N} $*"; }

[[ $EUID -eq 0 ]] || { echo "sudo gerekli"; exit 1; }
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

gen_secret() {
  local f="$1" len="${2:-32}"
  [[ -s "$f" ]] && { cat "$f"; return; }
  local s; s=$(openssl rand -hex "$len")
  umask 077; printf '%s' "$s" > "$f"; chmod 600 "$f"; printf '%s' "$s"
}

# ── 1) PostgreSQL ────────────────────────────────────────────────────
log "1/5  PostgreSQL kullanıcı + DB"
PG_PASS="$(gen_secret "/root/.${APP_NAME}_db_pass" 24)"

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1; then
  sudo -u postgres psql -c "ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';" >/dev/null
else
  sudo -u postgres psql -c "CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASS}';" >/dev/null
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" >/dev/null
fi
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};" >/dev/null
sudo -u postgres psql -d "${PG_DB}" -c "GRANT ALL ON SCHEMA public TO ${PG_USER};" >/dev/null
log "     postgresql://localhost:5432/${PG_DB} hazır"

# ── 1b) Eski DB'yi içeri al (IMPORT_OLD_DB=1) ───────────────────────
if [[ "${IMPORT_OLD_DB:-0}" == "1" ]]; then
  log "     Eski sunucudan dump alınıyor (72.61.182.238)..."
  pg_dump "${OLD_DB_URL}" -Fc -f "/tmp/${APP_NAME}.dump" \
    && pg_restore -d "postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}" \
         --no-owner --no-privileges -Fc "/tmp/${APP_NAME}.dump" \
    && log "     Import tamam" \
    || warn "     Import sorunlu — kontrol et"
  rm -f "/tmp/${APP_NAME}.dump"
fi

# ── 2) .env ─────────────────────────────────────────────────────────
log "2/5  .env yazılıyor"
JWT_SECRET="$(gen_secret "/root/.${APP_NAME}_jwt" 48)"

cat > "${APP_DIR}/.env" <<EOF
DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}"
JWT_SECRET="${JWT_SECRET}"
NEXT_PUBLIC_APP_URL="https://${APP_DOMAIN}"
NODE_ENV="production"
SLACK_CLIENT_ID="${SLACK_CLIENT_ID}"
SLACK_CLIENT_SECRET="${SLACK_CLIENT_SECRET}"
SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET}"
SMTP_HOST="${SMTP_HOST}"
SMTP_PORT="${SMTP_PORT}"
SMTP_USER="${SMTP_USER}"
SMTP_PASS="${SMTP_PASS}"
SMTP_FROM="${SMTP_FROM}"
EOF
chmod 600 "${APP_DIR}/.env"

# ── 3) Build + PM2 ──────────────────────────────────────────────────
log "3/5  npm ci + prisma + build"
mkdir -p "${APP_DIR}/public/uploads/chat"
touch "${APP_DIR}/public/uploads/.gitkeep" "${APP_DIR}/public/uploads/chat/.gitkeep" 2>/dev/null || true

npm ci --no-audit --no-fund \
  && npx prisma generate \
  && npx prisma db push \
  && npm run build \
  || warn "Build sorunlu — pm2 logs ${APP_NAME} --lines 50"

sed -i "s|cwd: \".*\"|cwd: \"${APP_DIR}\"|" "${APP_DIR}/ecosystem.config.js" 2>/dev/null || true

pm2 delete "${APP_NAME}" >/dev/null 2>&1 || true
pm2 start "${APP_DIR}/ecosystem.config.js"
pm2 save
eval "$(pm2 startup systemd -u root --hp /root 2>/dev/null | grep 'sudo env PATH' | head -1)" >/dev/null 2>&1 || true

sleep 4
HTTP_CODE="$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:${APP_PORT}" 2>/dev/null || echo 000)"
echo "${HTTP_CODE}" | grep -qE "^(200|30)" \
  && log "     Port ${APP_PORT}: HTTP ${HTTP_CODE} OK" \
  || warn "     Port ${APP_PORT}: HTTP ${HTTP_CODE} — pm2 logs ${APP_NAME} --lines 30"

# ── 4) Nginx ────────────────────────────────────────────────────────
log "4/5  Nginx"
SSL_DIR="/etc/nginx/ssl"; mkdir -p "${SSL_DIR}"

# Self-signed hazır (certbot sonra üstüne yazar)
[[ -f "${SSL_DIR}/${APP_DOMAIN}.crt" ]] || openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "${SSL_DIR}/${APP_DOMAIN}.key" \
  -out    "${SSL_DIR}/${APP_DOMAIN}.crt" \
  -subj   "/CN=${APP_DOMAIN}" >/dev/null 2>&1

cat > "/etc/nginx/sites-available/${APP_DOMAIN}" <<NGINX
server {
    listen 80;
    server_name ${APP_DOMAIN} www.${APP_DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://${APP_DOMAIN}\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name www.${APP_DOMAIN};
    ssl_certificate     ${SSL_DIR}/${APP_DOMAIN}.crt;
    ssl_certificate_key ${SSL_DIR}/${APP_DOMAIN}.key;
    return 301 https://${APP_DOMAIN}\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${APP_DOMAIN};

    ssl_certificate     ${SSL_DIR}/${APP_DOMAIN}.crt;
    ssl_certificate_key ${SSL_DIR}/${APP_DOMAIN}.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    client_max_body_size 25m;

    # SSE (canlı chat) — buffering kapalı, timeout çok uzun
    location ~ ^/api/(chat|widget)/stream {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Connection "";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding on;
    }

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
NGINX

ln -sf "/etc/nginx/sites-available/${APP_DOMAIN}" "/etc/nginx/sites-enabled/${APP_DOMAIN}"
nginx -t && systemctl reload nginx \
  && log "     Nginx reload OK" \
  || warn "     nginx -t HATALI"

# ── 5) SSL ──────────────────────────────────────────────────────────
if [[ "${SKIP_SSL:-0}" != "1" ]]; then
  log "5/5  Let's Encrypt"
  certbot --nginx -d "${APP_DOMAIN}" -d "www.${APP_DOMAIN}" \
    --non-interactive --agree-tos -m "${ADMIN_EMAIL}" \
    && log "     SSL tamam" \
    || warn "     Certbot başarısız — Cloudflare proxy kapalı mı? Port 80 açık mı?"
else
  log "5/5  SSL atlandı — Cloudflare SSL/TLS modunu 'Full' yap"
fi

# ── ÖZET ────────────────────────────────────────────────────────────
echo
log "TAMAM → https://${APP_DOMAIN}"
echo "  pm2 status | pm2 logs ${APP_NAME}"
echo
echo "  Eski DB'yi almak için: IMPORT_OLD_DB=1 sudo bash setup.sh"
