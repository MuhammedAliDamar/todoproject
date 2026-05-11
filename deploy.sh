#!/usr/bin/env bash
# Marktasks (trello-clone) deploy scripti — idempotent
#
# İlk kurulum:
#   git clone https://github.com/MuhammedAliDamar/todoproject.git /var/www/marktasks.com
#   cd /var/www/marktasks.com
#   sudo bash deploy.sh
#
# Sonraki deploy'lar:
#   cd /var/www/marktasks.com && git pull && sudo bash deploy.sh

set -euo pipefail

# ===================== KONFIG =====================
APP_NAME="marktasks"
APP_DIR="/var/www/marktasks.com"
APP_PORT=4444
DOMAIN="marktasks.com"
DB_NAME="marktasks"
DB_USER="marktasks"
NODE_MAJOR="20"
ADMIN_EMAIL="globayazilim@gmail.com"

# Slack credentials — env'den geçir veya burayı düzenle
SLACK_CLIENT_ID="${SLACK_CLIENT_ID:-}"
SLACK_CLIENT_SECRET="${SLACK_CLIENT_SECRET:-}"
SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}"
# ==================================================

G="\033[32m"; Y="\033[33m"; R="\033[31m"; N="\033[0m"
log()  { echo -e "${G}[+]${N} $*"; }
warn() { echo -e "${Y}[!]${N} $*"; }
err()  { echo -e "${R}[x]${N} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Root olarak çalıştır: sudo bash deploy.sh"
[[ -d "$APP_DIR/.git" ]] || err "$APP_DIR git repo değil. Önce clone'la."

# 1. Sistem paketleri
log "Sistem paketleri kontrol ediliyor"
if ! command -v node >/dev/null; then
  log "Node.js ${NODE_MAJOR} kuruluyor"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
command -v pm2     >/dev/null || { log "pm2 kuruluyor";     npm install -g pm2; }
command -v psql    >/dev/null || err "PostgreSQL bulunamadı (apt install postgresql)"
command -v nginx   >/dev/null || { log "nginx kuruluyor";   apt-get install -y nginx; }
command -v certbot >/dev/null || { log "certbot kuruluyor"; apt-get install -y certbot python3-certbot-nginx; }
command -v openssl >/dev/null || err "openssl bulunamadı"

# 2. Postgres rol + db (idempotent, secret /root altında saklanır)
log "Postgres rol + db hazırlanıyor"
DB_PASS_FILE="/root/.${APP_NAME}_db_pass"
if [[ -s "$DB_PASS_FILE" ]]; then
  DB_PASS=$(cat "$DB_PASS_FILE")
  log "Mevcut db şifresi kullanılıyor ($DB_PASS_FILE)"
else
  DB_PASS=$(openssl rand -hex 24)
  umask 077; echo -n "$DB_PASS" > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
fi

ROLE_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")
if [[ "$ROLE_EXISTS" != "1" ]]; then
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';" >/dev/null
else
  sudo -u postgres psql -c "ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null
fi

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")
if [[ "$DB_EXISTS" != "1" ]]; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null

# 3. JWT secret + .env
log ".env yazılıyor"
JWT_SECRET_FILE="/root/.${APP_NAME}_jwt"
if [[ -s "$JWT_SECRET_FILE" ]]; then
  JWT_SECRET=$(cat "$JWT_SECRET_FILE")
else
  JWT_SECRET=$(openssl rand -hex 48)
  umask 077; echo -n "$JWT_SECRET" > "$JWT_SECRET_FILE"
  chmod 600 "$JWT_SECRET_FILE"
fi

cat > "${APP_DIR}/.env" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
JWT_SECRET="${JWT_SECRET}"
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"
NODE_ENV="production"

SLACK_CLIENT_ID="${SLACK_CLIENT_ID}"
SLACK_CLIENT_SECRET="${SLACK_CLIENT_SECRET}"
SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET}"
EOF
chmod 600 "${APP_DIR}/.env"

# 4. Bağımlılıklar + prisma
log "npm ci"
cd "${APP_DIR}"
npm ci --no-audit --no-fund

log "prisma generate + migrate deploy"
npx prisma generate
npx prisma migrate deploy

# 5. Build
log "next build"
npm run build

# 6. pm2
log "pm2 start/restart"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}" --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# 7. nginx
log "nginx config"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
if [[ ! -f "$NGINX_CONF" ]]; then
  cat > "$NGINX_CONF" <<EOF
server {
  listen 80;
  server_name ${DOMAIN} www.${DOMAIN};

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:${APP_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
  }
}
EOF
  ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"
fi
nginx -t && systemctl reload nginx

# 8. SSL (idempotent)
if [[ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
  log "Let's Encrypt sertifikası alınıyor"
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "${ADMIN_EMAIL}" --redirect \
    || warn "Certbot başarısız — DNS A kaydını ve 80/443 portunu kontrol et"
else
  log "SSL sertifikası zaten var, atlanıyor"
fi

echo
log "Deploy tamam"
echo "  URL:     https://${DOMAIN}"
echo "  DB:      postgresql://${DB_USER}@localhost:5432/${DB_NAME}"
echo "  DB pw:   $DB_PASS_FILE"
echo "  JWT:    $JWT_SECRET_FILE"
echo "  pm2:     pm2 logs ${APP_NAME}"
