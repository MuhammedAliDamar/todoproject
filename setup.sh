#!/usr/bin/env bash
# ============================================================================
# marktasks TEK KURULUM SCRIPTI — WordPress (front) + Next panel (dashboard)
# ----------------------------------------------------------------------------
#   Front  (WordPress) : https://marktasks.com
#   Panel  (bu proje)  : https://dashboard.marktasks.com   (port 4444, pm2)
#
# Idempotent ve VERİ KAYBI KORUMALI:
#   - Var olan DB'leri/şifreleri/oturumları silmez (secret'lar /root altında saklı).
#   - WordPress dosyalarını/wp-config'i/wp-content'i mevcutsa ASLA üzerine yazmaz.
#   - prisma db push yalnızca eklemeli şema (veri kaybı gerekirse durur).
#   - .env yeniden yazılırken mevcut Slack/SMTP değerleri korunur.
#
# İlk kurulum:
#   git clone https://github.com/MuhammedAliDamar/todoproject.git /var/www/dashboard.marktasks.com
#   cd /var/www/dashboard.marktasks.com && sudo bash setup.sh
#
# Sonraki deploy'lar:
#   cd /var/www/dashboard.marktasks.com && git pull && sudo bash setup.sh
# ============================================================================
set -euo pipefail

# ===================== KONFIG =====================
APP_NAME="marktasks"
# Panel dizini = bu script'in bulunduğu dizin (nereye clone'larsan oradan çalışır)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PORT=4444
PANEL_DOMAIN="dashboard.marktasks.com"

# Panel Postgres
PG_DB="marktasks"
PG_USER="marktasks"

# WordPress
WP_DOMAIN="marktasks.com"
WP_DIR="/var/www/marktasks.com"
WP_DB="marktasks_wp"
WP_DB_USER="marktasks_wp"

NODE_MAJOR="20"
ADMIN_EMAIL="globayazilim@gmail.com"

# Slack + SMTP — env'den geçir; boşsa mevcut .env'deki değer korunur
SLACK_CLIENT_ID="${SLACK_CLIENT_ID:-}"
SLACK_CLIENT_SECRET="${SLACK_CLIENT_SECRET:-}"
SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
SMTP_FROM="${SMTP_FROM:-}"
# ==================================================

G="\033[32m"; Y="\033[33m"; R="\033[31m"; N="\033[0m"
log()  { echo -e "${G}[+]${N} $*"; }
warn() { echo -e "${Y}[!]${N} $*"; }
err()  { echo -e "${R}[x]${N} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Root olarak çalıştır: sudo bash setup.sh"
[[ -d "$APP_DIR/.git" ]] || err "$APP_DIR git repo değil. Önce panel'i buraya clone'la."

# Secret üret/oku — /root altında kalıcı (deploy'lar arası değişmez)
gen_secret() { # $1=dosya $2=uzunluk(hex byte)
  local f="$1"
  if [[ -s "$f" ]]; then cat "$f"; else
    local s; s=$(openssl rand -hex "${2:-24}"); umask 077; printf '%s' "$s" > "$f"; chmod 600 "$f"; printf '%s' "$s"
  fi
}
env_val() { [[ -f "${APP_DIR}/.env" ]] && grep -E "^$1=" "${APP_DIR}/.env" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }

# ============================== 1) SİSTEM PAKETLERİ ==============================
log "Sistem paketleri"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null

if ! command -v node >/dev/null; then
  log "Node.js ${NODE_MAJOR} kuruluyor"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
command -v pm2     >/dev/null || { log "pm2 kuruluyor"; npm install -g pm2; }
command -v nginx   >/dev/null || apt-get install -y nginx
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
command -v psql    >/dev/null || apt-get install -y postgresql
command -v openssl >/dev/null || err "openssl yok"
command -v unzip   >/dev/null || apt-get install -y unzip

# PHP-FPM + MariaDB (WordPress)
command -v mariadb >/dev/null || command -v mysql >/dev/null || apt-get install -y mariadb-server
if ! ls /run/php/php*-fpm.sock >/dev/null 2>&1; then
  log "PHP-FPM + eklentileri kuruluyor"
  apt-get install -y php-fpm php-mysql php-curl php-gd php-mbstring php-xml php-zip php-imagick
fi
systemctl enable --now mariadb >/dev/null 2>&1 || true
PHP_FPM_SOCK="$(ls /run/php/php*-fpm.sock 2>/dev/null | head -1)"
[[ -n "$PHP_FPM_SOCK" ]] || err "php-fpm socket bulunamadı"

# ============================== 2) PANEL: POSTGRES ==============================
log "Postgres (panel) hazırlanıyor"
PG_PASS="$(gen_secret "/root/.${APP_NAME}_db_pass" 24)"
ROLE_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'")
if [[ "$ROLE_EXISTS" != "1" ]]; then
  sudo -u postgres psql -c "CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASS}';" >/dev/null
else
  sudo -u postgres psql -c "ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';" >/dev/null
fi
if [[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'")" != "1" ]]; then
  sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" >/dev/null
fi
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};" >/dev/null
sudo -u postgres psql -d "${PG_DB}" -c "GRANT ALL ON SCHEMA public TO ${PG_USER};" >/dev/null

# ============================== 3) PANEL: .ENV ==============================
log ".env (panel) yazılıyor — mevcut secret'lar korunuyor"
JWT_SECRET="$(gen_secret "/root/.${APP_NAME}_jwt" 48)"
# Slack/SMTP: env > mevcut .env > boş
SLACK_CLIENT_ID="${SLACK_CLIENT_ID:-$(env_val SLACK_CLIENT_ID)}"
SLACK_CLIENT_SECRET="${SLACK_CLIENT_SECRET:-$(env_val SLACK_CLIENT_SECRET)}"
SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-$(env_val SLACK_SIGNING_SECRET)}"
SMTP_HOST="${SMTP_HOST:-$(env_val SMTP_HOST)}"
SMTP_PORT="${SMTP_PORT:-$(env_val SMTP_PORT)}"
SMTP_USER="${SMTP_USER:-$(env_val SMTP_USER)}"
SMTP_PASS="${SMTP_PASS:-$(env_val SMTP_PASS)}"
SMTP_FROM="${SMTP_FROM:-$(env_val SMTP_FROM)}"

cat > "${APP_DIR}/.env" <<EOF
DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}"
JWT_SECRET="${JWT_SECRET}"
NEXT_PUBLIC_APP_URL="https://${PANEL_DOMAIN}"
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

# ============================== 4) PANEL: BUILD + PM2 ==============================
log "npm ci + prisma + build"
cd "${APP_DIR}"
npm ci --no-audit --no-fund
npx prisma generate
# Repo migration kullanmıyor → şemayı db push ile senkronla (eklemeli; veri kaybı gerekirse durur)
npx prisma db push

# ecosystem.config.js cwd'sini bu dizine sabitle (taşınmış olabilir)
sed -i "s|cwd: \".*\"|cwd: \"${APP_DIR}\"|" ecosystem.config.js 2>/dev/null || true

npm run build
log "pm2 start/restart"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}" --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ============================== 5) WORDPRESS: MariaDB ==============================
log "MariaDB (WordPress) hazırlanıyor"
WP_DB_PASS="$(gen_secret "/root/.${APP_NAME}_wpdb_pass" 24)"
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${WP_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${WP_DB_USER}'@'localhost' IDENTIFIED BY '${WP_DB_PASS}';
ALTER USER '${WP_DB_USER}'@'localhost' IDENTIFIED BY '${WP_DB_PASS}';
GRANT ALL PRIVILEGES ON \`${WP_DB}\`.* TO '${WP_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# ============================== 6) WORDPRESS: DOSYALAR ==============================
mkdir -p "${WP_DIR}"
# Güvenlik: WP_DIR başka bir app (örn. panel) içeriyorsa DOKUNMA
if [[ -f "${WP_DIR}/package.json" || -d "${WP_DIR}/.git" ]]; then
  warn "${WP_DIR} içinde başka bir uygulama var (package.json/.git). WordPress kurulumu ATLANDI."
  warn "  Panel'i dashboard dizinine taşıdıysan, ${WP_DIR}'i boşalt ve scripti tekrar çalıştır."
elif [[ -f "${WP_DIR}/wp-load.php" ]]; then
  log "WordPress zaten kurulu (${WP_DIR}) — dosyalara dokunulmadı (veri korundu)"
else
  log "WordPress indiriliyor"
  TMP="$(mktemp -d)"
  curl -fsSL https://wordpress.org/latest.tar.gz -o "${TMP}/wp.tar.gz"
  tar -xzf "${TMP}/wp.tar.gz" -C "${TMP}"
  cp -a "${TMP}/wordpress/." "${WP_DIR}/"
  rm -rf "${TMP}"
fi

# wp-config.php yoksa üret (varsa dokunma — DB/secret korunur)
if [[ -f "${WP_DIR}/wp-load.php" && ! -f "${WP_DIR}/wp-config.php" ]]; then
  log "wp-config.php oluşturuluyor"
  SALTS="$(curl -fsSL https://api.wordpress.org/secret-key/1.1/salt/ || true)"
  [[ -n "$SALTS" ]] || SALTS="define('AUTH_KEY','$(openssl rand -hex 32)');"
  cat > "${WP_DIR}/wp-config.php" <<PHP
<?php
define( 'DB_NAME', '${WP_DB}' );
define( 'DB_USER', '${WP_DB_USER}' );
define( 'DB_PASSWORD', '${WP_DB_PASS}' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

${SALTS}

\$table_prefix = 'wp_';

/* HTTPS — nginx reverse proxy arkasında */
if ( isset( \$_SERVER['HTTP_X_FORWARDED_PROTO'] ) && \$_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https' ) {
  \$_SERVER['HTTPS'] = 'on';
}

define( 'WP_DEBUG', false );
if ( ! defined( 'ABSPATH' ) ) define( 'ABSPATH', __DIR__ . '/' );
require_once ABSPATH . 'wp-settings.php';
PHP
  chmod 640 "${WP_DIR}/wp-config.php"
fi

# Sahiplik (içeriği silmez, sadece chown)
[[ -f "${WP_DIR}/wp-load.php" ]] && chown -R www-data:www-data "${WP_DIR}"

# ===================== 6b) WORDPRESS: WP-CLI ile kurulum + tema + eklentiler =====================
if [[ -f "${WP_DIR}/wp-config.php" ]]; then
  wpcli() { sudo -u www-data wp --path="${WP_DIR}" "$@"; }

  if ! command -v wp >/dev/null; then
    log "WP-CLI kuruluyor"
    curl -fsSL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp
    chmod +x /usr/local/bin/wp
  fi

  # WordPress'i kur (zaten kuruluysa dokunma — veri korunur)
  WP_ADMIN_PASS="$(gen_secret "/root/.${APP_NAME}_wp_admin" 16)"
  if ! wpcli core is-installed >/dev/null 2>&1; then
    log "WordPress kuruluyor (admin: admin)"
    wpcli core install --url="https://${WP_DOMAIN}" --title="marktasks" \
      --admin_user="admin" --admin_password="${WP_ADMIN_PASS}" \
      --admin_email="${ADMIN_EMAIL}" --skip-email
  else
    log "WordPress zaten kurulu — içerik korundu"
  fi

  # Base tema (Elementor için boş tema)
  wpcli theme install hello-elementor --activate || warn "hello-elementor kurulamadı"

  # Kit'in gerektirdiği eklentiler (manifest.json'dan) — hepsi wordpress.org'da
  for slug in elementor jeg-elementor-kit gum-elementor-addon metform header-footer-elementor elementskit-lite; do
    wpcli plugin install "$slug" --activate || warn "plugin kurulamadı: $slug"
  done

  # Saastify kit'i uploads'a hazırla (import için)
  KIT_SRC="${APP_DIR}/wordpress/saastify-kit.zip"
  if [[ -f "$KIT_SRC" ]]; then
    KIT_DST="${WP_DIR}/wp-content/uploads/saastify-kit.zip"
    mkdir -p "${WP_DIR}/wp-content/uploads"
    cp "$KIT_SRC" "$KIT_DST"
    chown www-data:www-data "$KIT_DST"
    # CLI import dene (sürüm destekliyorsa); desteklemiyorsa UI'dan import edilecek
    if wpcli elementor kit import "$KIT_DST" >/dev/null 2>&1; then
      log "Saastify kit CLI ile import edildi"
    else
      warn "Kit'i Elementor > Tools > Import Kit'ten yükle: ${KIT_DST}"
    fi
  fi
fi

# ============================== 7) NGINX VHOST'LARI ==============================
log "nginx vhost'ları"

# 7a) Panel — reverse proxy → Next (pm2)
cat > "/etc/nginx/sites-available/${PANEL_DOMAIN}" <<EOF
server {
  listen 80;
  server_name ${PANEL_DOMAIN};
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
ln -sf "/etc/nginx/sites-available/${PANEL_DOMAIN}" "/etc/nginx/sites-enabled/${PANEL_DOMAIN}"

# 7b) WordPress — PHP-FPM
cat > "/etc/nginx/sites-available/${WP_DOMAIN}" <<EOF
server {
  listen 80;
  server_name ${WP_DOMAIN} www.${WP_DOMAIN};
  root ${WP_DIR};
  index index.php index.html;
  client_max_body_size 64m;

  location / { try_files \$uri \$uri/ /index.php?\$args; }

  location ~ \.php\$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:${PHP_FPM_SOCK};
  }

  location ~ /\.ht { deny all; }
  location = /favicon.ico { log_not_found off; access_log off; }
  location = /robots.txt  { log_not_found off; access_log off; }
}
EOF
ln -sf "/etc/nginx/sites-available/${WP_DOMAIN}" "/etc/nginx/sites-enabled/${WP_DOMAIN}"

# Eski default vhost'u kaldır (çakışmasın)
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

# ============================== 8) SSL (idempotent) ==============================
log "Let's Encrypt sertifikaları"
[[ -d "/etc/letsencrypt/live/${PANEL_DOMAIN}" ]] || \
  certbot --nginx -d "${PANEL_DOMAIN}" --non-interactive --agree-tos -m "${ADMIN_EMAIL}" --redirect \
  || warn "Certbot (panel) başarısız — DNS A kaydı + 80/443 kontrol et"

[[ -d "/etc/letsencrypt/live/${WP_DOMAIN}" ]] || \
  certbot --nginx -d "${WP_DOMAIN}" -d "www.${WP_DOMAIN}" --non-interactive --agree-tos -m "${ADMIN_EMAIL}" --redirect \
  || warn "Certbot (WordPress) başarısız — DNS A kaydı + 80/443 kontrol et"

# ============================== ÖZET ==============================
echo
log "Kurulum tamam"
echo "  Panel:      https://${PANEL_DOMAIN}   (pm2: ${APP_NAME}, port ${APP_PORT})"
echo "  WordPress:  https://${WP_DOMAIN}"
echo "  PG DB:      ${PG_DB} (user ${PG_USER}, pw: /root/.${APP_NAME}_db_pass)"
echo "  WP DB:      ${WP_DB} (user ${WP_DB_USER}, pw: /root/.${APP_NAME}_wpdb_pass)"
echo "  WP admin:   admin / (pw: /root/.${APP_NAME}_wp_admin)  -> https://${WP_DOMAIN}/wp-admin"
echo "  JWT:        /root/.${APP_NAME}_jwt"
echo
warn "DNS: ${PANEL_DOMAIN} ve ${WP_DOMAIN} A kayıtları bu sunucuya bakmalı."
warn "Slack OAuth redirect: https://${PANEL_DOMAIN}/api/slack/callback"
warn "Saastify kit CLI ile import olmadıysa: WP Admin > Elementor > Tools > Import Kit > wp-content/uploads/saastify-kit.zip"
