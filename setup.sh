#!/usr/bin/env bash
# =====================================================================
# marktasks — Tek Komut Sunucu Kurulumu
#   Panel : https://marktasks.com  (Next.js 16, pm2, port 4444)
#
# Kullanım:
#   sudo bash setup.sh
#
# Opsiyonel bayraklar:
#   SKIP_SSL=1        — Let's Encrypt atla (Cloudflare Full mod self-signed yeterli)
#   IMPORT_OLD_DB=1   — Eski 72.61.182.238 sunucusundan DB'yi içeri aktar
# =====================================================================
set -uo pipefail

# ======================== KONFIG ========================
APP_NAME="marktasks"
APP_PORT=4444
APP_DOMAIN="marktasks.com"
PG_DB="marktasks"
PG_USER="marktasks"
NODE_MAJOR="20"
ADMIN_EMAIL="globayazilim@gmail.com"

# Eski production DB (import için)
OLD_DB_URL="postgresql://marktasks:52db36b2ca3189dfaa78635bd40dc39d9f3179323441b52a@72.61.182.238:5432/marktasks"

# .env değerleri
SLACK_CLIENT_ID="9874048584085.10615149670229"
SLACK_CLIENT_SECRET="a29a82832b436d7dc86ae5a5065f50ff"
SLACK_SIGNING_SECRET="432d74f379f9595a43b6ce48ab5a37f7"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="commarktasks@gmail.com"
SMTP_PASS="ittimnsquaxivzmf"
SMTP_FROM="marktasks <commarktasks@gmail.com>"
# ========================================================

G="\033[32m"; Y="\033[33m"; R="\033[31m"; N="\033[0m"
log()  { echo -e "${G}[+]${N} $*"; }
warn() { echo -e "${Y}[!]${N} $*"; }
err()  { echo -e "${R}[x]${N} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Root gerekli: sudo bash setup.sh"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "${APP_DIR}/package.json" ]] || err "package.json bulunamadı — repo kökünden çalıştır"
cd "$APP_DIR"
log "Uygulama dizini: ${APP_DIR}"

# Tekrar çalıştırmalarda secret'ları yeniden üretmemek için dosyadan oku
gen_secret() {
  local f="$1" len="${2:-32}"
  [[ -s "$f" ]] && { cat "$f"; return; }
  local s; s=$(openssl rand -hex "$len")
  umask 077; printf '%s' "$s" > "$f"; chmod 600 "$f"; printf '%s' "$s"
}

# ── 1) Sistem paketleri ─────────────────────────────────────────────
log "1/6  Sistem paketleri"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -q 2>/dev/null || warn "apt-get update sorunlu"

if ! command -v node >/dev/null 2>&1; then
  log "     Node.js ${NODE_MAJOR} kuruluyor..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
  apt-get install -y nodejs -q
fi
command -v pm2     >/dev/null 2>&1 || npm install -g pm2 --silent
command -v nginx   >/dev/null 2>&1 || apt-get install -y nginx -q
command -v certbot >/dev/null 2>&1 || apt-get install -y certbot python3-certbot-nginx -q
if ! command -v psql >/dev/null 2>&1; then
  apt-get install -y postgresql postgresql-contrib -q
  systemctl enable postgresql >/dev/null 2>&1
fi
systemctl is-active --quiet postgresql || systemctl start postgresql

node  --version && npm --version && pm2 --version | head -1 || true

# ── 2) PostgreSQL: yeni kullanıcı + veritabanı ──────────────────────
log "2/6  PostgreSQL"
PG_PASS="$(gen_secret "/root/.${APP_NAME}_db_pass" 24)"

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" 2>/dev/null | grep -q 1; then
  sudo -u postgres psql -c "ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';" >/dev/null
else
  sudo -u postgres psql -c "CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASS}';" >/dev/null
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" 2>/dev/null | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" >/dev/null
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};" >/dev/null
sudo -u postgres psql -d "${PG_DB}" -c "GRANT ALL ON SCHEMA public TO ${PG_USER};" >/dev/null
log "     DB hazır: postgresql://localhost:5432/${PG_DB}"

# ── 2b) Eski DB'yi içeri aktar (IMPORT_OLD_DB=1) ────────────────────
if [[ "${IMPORT_OLD_DB:-0}" == "1" ]]; then
  log "     Eski sunucudan DB dump alınıyor (72.61.182.238)..."
  DUMP_FILE="/tmp/${APP_NAME}_import.dump"
  pg_dump "${OLD_DB_URL}" -Fc -f "${DUMP_FILE}" \
    && log "     Dump alındı: ${DUMP_FILE}" \
    || warn "     pg_dump başarısız — eski sunucu erişilebilir mi?"

  if [[ -f "${DUMP_FILE}" ]]; then
    log "     Yeni DB'ye yükleniyor..."
    pg_restore \
      -d "postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}" \
      --no-owner --no-privileges --no-comments \
      -Fc "${DUMP_FILE}" \
      && log "     DB import başarılı" \
      || warn "     pg_restore sorunlu (bazı hatalar normal olabilir — veriyi kontrol et)"
    rm -f "${DUMP_FILE}"
  fi
fi

# ── 3) .env ─────────────────────────────────────────────────────────
log "3/6  .env yazılıyor"
JWT_SECRET="$(gen_secret "/root/.${APP_NAME}_jwt" 48)"

cat > "${APP_DIR}/.env" <<ENVEOF
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
ENVEOF
chmod 600 "${APP_DIR}/.env"

# ── 4) Build + PM2 ──────────────────────────────────────────────────
log "4/6  npm ci + prisma + next build (birkaç dakika sürebilir)"

mkdir -p "${APP_DIR}/public/uploads/chat"
touch "${APP_DIR}/public/uploads/.gitkeep" "${APP_DIR}/public/uploads/chat/.gitkeep" 2>/dev/null || true

BUILD_OK=0
npm ci --no-audit --no-fund \
  && npx prisma generate \
  && npx prisma db push \
  && npm run build \
  && BUILD_OK=1 \
  || warn "Build sorunlu — pm2 logs ${APP_NAME} --lines 50 ile kontrol et"

# ecosystem.config.js içindeki cwd'yi bu dizine güncelle
sed -i "s|cwd: \".*\"|cwd: \"${APP_DIR}\"|" "${APP_DIR}/ecosystem.config.js" 2>/dev/null || true

pm2 delete "${APP_NAME}" >/dev/null 2>&1 || true
pm2 start "${APP_DIR}/ecosystem.config.js"
pm2 save >/dev/null

# Sistem yeniden başlayınca otomatik çalış
STARTUP_CMD="$(pm2 startup systemd -u root --hp /root 2>/dev/null | grep 'sudo env PATH' | head -1)"
[[ -n "${STARTUP_CMD}" ]] && eval "${STARTUP_CMD}" >/dev/null 2>&1 || true

log "     PM2 başlatıldı — bekleniyor (5 sn)..."
sleep 5
HTTP_CODE="$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:${APP_PORT}" 2>/dev/null || echo "000")"
if echo "${HTTP_CODE}" | grep -qE "^(200|30[0-9])$"; then
  log "     Panel port ${APP_PORT}'de çalışıyor (HTTP ${HTTP_CODE})"
else
  warn "     Panel port ${APP_PORT}'de cevap vermiyor (HTTP ${HTTP_CODE})"
  [[ "${BUILD_OK}" -eq 0 ]] && pm2 logs "${APP_NAME}" --lines 30 --nostream 2>/dev/null || true
fi

# ── 5) Nginx ────────────────────────────────────────────────────────
log "5/6  Nginx yapılandırması"
SSL_DIR="/etc/nginx/ssl"; mkdir -p "${SSL_DIR}"

# Self-signed (Cloudflare Full modu için yeterli; Let's Encrypt sonradan üstüne yazar)
if [[ ! -f "${SSL_DIR}/${APP_DOMAIN}.crt" ]]; then
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "${SSL_DIR}/${APP_DOMAIN}.key" \
    -out    "${SSL_DIR}/${APP_DOMAIN}.crt" \
    -subj   "/CN=${APP_DOMAIN}" >/dev/null 2>&1
fi

cat > "/etc/nginx/sites-available/${APP_DOMAIN}" <<NGINX
# marktasks — https://${APP_DOMAIN}
# Otomatik üretildi: $(date '+%Y-%m-%d %H:%M')

server {
    listen 80;
    server_name ${APP_DOMAIN} www.${APP_DOMAIN};

    # Let's Encrypt / ACME http-01 doğrulama
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://${APP_DOMAIN}\$request_uri;
    }
}

# www → non-www yönlendirme
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
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    client_max_body_size 25m;

    # SSE endpoint'leri: /api/chat/stream  /api/widget/stream
    # Buffering kapalı, çok uzun timeout (canlı chat bağlantısı)
    location ~ ^/api/(chat|widget)/stream {
        proxy_pass          http://127.0.0.1:${APP_PORT};
        proxy_http_version  1.1;
        proxy_set_header    Connection "";
        proxy_set_header    Host               \$host;
        proxy_set_header    X-Real-IP          \$remote_addr;
        proxy_set_header    X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto  \$scheme;
        proxy_buffering     off;
        proxy_cache         off;
        proxy_read_timeout  86400s;
        proxy_send_timeout  86400s;
        chunked_transfer_encoding on;
    }

    # Genel proxy
    location / {
        proxy_pass          http://127.0.0.1:${APP_PORT};
        proxy_http_version  1.1;
        proxy_set_header    Upgrade            \$http_upgrade;
        proxy_set_header    Connection         "upgrade";
        proxy_set_header    Host               \$host;
        proxy_set_header    X-Real-IP          \$remote_addr;
        proxy_set_header    X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto  \$scheme;
        proxy_cache_bypass  \$http_upgrade;
        proxy_read_timeout  300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout  300s;
    }
}
NGINX

ln -sf "/etc/nginx/sites-available/${APP_DOMAIN}" "/etc/nginx/sites-enabled/${APP_DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx && log "     Nginx reload OK" \
  || warn "     nginx -t HATALI — \`nginx -t\` çalıştırıp hatayı gör"

# ── 6) SSL: Let's Encrypt ───────────────────────────────────────────
if [[ "${SKIP_SSL:-0}" != "1" ]]; then
  log "6/6  Let's Encrypt SSL alınıyor"
  certbot --nginx \
    -d "${APP_DOMAIN}" \
    -d "www.${APP_DOMAIN}" \
    --non-interactive \
    --agree-tos \
    -m "${ADMIN_EMAIL}" \
    && log "     SSL sertifikası başarıyla alındı!" \
    || warn "     Certbot başarısız. Olası sebepler:
     1. Cloudflare 'turuncu bulut' (Proxied) açık — DNS-only yap, certbot sonrası tekrar aç.
     2. Domain henüz bu sunucuya yönlendirilmemiş.
     3. Port 80 dışarıya kapalı (ufw allow 80 && ufw allow 443).
     Düzelince: sudo certbot --nginx -d ${APP_DOMAIN} -d www.${APP_DOMAIN} --agree-tos -m ${ADMIN_EMAIL}"
else
  log "6/6  SSL atlandı (SKIP_SSL=1)."
  warn "     Cloudflare SSL/TLS modu 'Full' olmalı (Full Strict değil)."
fi

# ── ÖZET ────────────────────────────────────────────────────────────
echo
echo -e "${G}╔══════════════════════════════════════════╗${N}"
echo -e "${G}║         KURULUM TAMAMLANDI               ║${N}"
echo -e "${G}╚══════════════════════════════════════════╝${N}"
echo "  Panel URL  : https://${APP_DOMAIN}"
echo "  Uygulama   : ${APP_DIR}"
echo "  PM2        : pm2 status | pm2 logs ${APP_NAME}"
echo "  DB         : postgresql://localhost:5432/${PG_DB}"
echo "  .env       : ${APP_DIR}/.env  (izinler: 600)"
echo
echo -e "${Y}  Eski DB'yi içeri almak için:${N}"
echo "    IMPORT_OLD_DB=1 sudo bash setup.sh"
echo
echo -e "${Y}  Slack slash-command Request URL'leri:${N}"
echo "    /task command : https://${APP_DOMAIN}/api/slack/command"
echo "    Interactivity : https://${APP_DOMAIN}/api/slack/interactions"
echo
