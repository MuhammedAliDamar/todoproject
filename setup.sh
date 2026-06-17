#!/usr/bin/env bash
# ============================================================================
# marktasks TEK KURULUM — WordPress (marktasks.com) + Next panel (dashboard.marktasks.com)
#   Panel : https://dashboard.marktasks.com  (Next, pm2, port 4444)
#   Front : https://marktasks.com            (WordPress, PHP-FPM)
#
# DAYANIKLI: bir adım patlasa bile script DURMAZ; nginx + SSL mutlaka çalışır.
# VERİ KAYBI YOK: DB'ler/secret'lar/WP içeriği korunur (hepsi "varsa dokunma").
#
# Çalıştır (panel repo'sundan):
#   cd /var/www/dashboard.marktasks.com && git pull && sudo bash setup.sh
# Panel hâlâ /var/www/marktasks.com'daysa otomatik dashboard dizinine taşınır.
# ============================================================================
set -uo pipefail   # DİKKAT: -e YOK; script hatada durmaz, devam eder.

# ===================== KONFIG =====================
APP_NAME="marktasks"
APP_PORT=4444
PANEL_DOMAIN="dashboard.marktasks.com"
PANEL_DIR="/var/www/dashboard.marktasks.com"
PG_DB="marktasks"; PG_USER="marktasks"

WP_DOMAIN="marktasks.com"
WP_DIR="/var/www/marktasks.com"
WP_DB="marktasks_wp"; WP_DB_USER="marktasks_wp"

NODE_MAJOR="20"
ADMIN_EMAIL="globayazilim@gmail.com"

SLACK_CLIENT_ID="${SLACK_CLIENT_ID:-}"
SLACK_CLIENT_SECRET="${SLACK_CLIENT_SECRET:-}"
SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}"
SMTP_HOST="${SMTP_HOST:-}"; SMTP_PORT="${SMTP_PORT:-}"
SMTP_USER="${SMTP_USER:-}"; SMTP_PASS="${SMTP_PASS:-}"; SMTP_FROM="${SMTP_FROM:-}"
# ==================================================

G="\033[32m"; Y="\033[33m"; R="\033[31m"; N="\033[0m"
log()  { echo -e "${G}[+]${N} $*"; }
warn() { echo -e "${Y}[!]${N} $*"; }
err()  { echo -e "${R}[x]${N} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Root: sudo bash setup.sh"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -d "$SELF_DIR/.git" ]] || err "$SELF_DIR git repo değil. Paneli buraya clone'la."

gen_secret() { local f="$1"; if [[ -s "$f" ]]; then cat "$f"; else local s; s=$(openssl rand -hex "${2:-24}"); umask 077; printf '%s' "$s" >"$f"; chmod 600 "$f"; printf '%s' "$s"; fi; }
env_val()    { [[ -f "${APP_DIR:-/nonexistent}/.env" ]] && grep -E "^$1=" "${APP_DIR}/.env" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }

# ===================== 0) Panel'i doğru dizine yerleştir =====================
if [[ "$SELF_DIR" == "$WP_DIR" ]]; then
  [[ -e "$PANEL_DIR" && -n "$(ls -A "$PANEL_DIR" 2>/dev/null)" ]] && err "$PANEL_DIR dolu, çakışmayı elle çöz."
  log "Panel $WP_DIR -> $PANEL_DIR taşınıyor (marktasks.com WordPress'e bırakılıyor)"
  mkdir -p "$(dirname "$PANEL_DIR")"; mv "$WP_DIR" "$PANEL_DIR"; APP_DIR="$PANEL_DIR"
elif [[ "$SELF_DIR" == "$PANEL_DIR" ]]; then APP_DIR="$PANEL_DIR"
else APP_DIR="$SELF_DIR"; [[ "$APP_DIR" == "$WP_DIR" ]] && err "Panel WP_DIR ile çakışıyor."; fi
cd "$APP_DIR"; log "Panel dizini: $APP_DIR"

# ===================== 1) Sistem paketleri =====================
log "Sistem paketleri"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || warn "apt update sorunlu"
if ! command -v node >/dev/null; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - && apt-get install -y nodejs
fi
command -v pm2     >/dev/null || npm install -g pm2 || warn "pm2 kurulamadı"
command -v nginx   >/dev/null || apt-get install -y nginx
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
command -v psql    >/dev/null || apt-get install -y postgresql
command -v unzip   >/dev/null || apt-get install -y unzip
command -v mysql   >/dev/null || apt-get install -y mariadb-server
ls /run/php/php*-fpm.sock >/dev/null 2>&1 || apt-get install -y php-fpm php-mysql php-curl php-gd php-mbstring php-xml php-zip php-imagick
systemctl enable --now mariadb >/dev/null 2>&1 || true
command -v wp >/dev/null || { curl -fsSL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp && chmod +x /usr/local/bin/wp; }
PHP_FPM_SOCK="$(ls /run/php/php*-fpm.sock 2>/dev/null | head -1)"

# ===================== 2) Panel: Postgres =====================
log "Postgres (panel)"
PG_PASS="$(gen_secret "/root/.${APP_NAME}_db_pass" 24)"
if [[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'")" != "1" ]]; then
  sudo -u postgres psql -c "CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASS}';" >/dev/null
else
  sudo -u postgres psql -c "ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';" >/dev/null
fi
[[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'")" == "1" ]] || \
  sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" >/dev/null
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};" >/dev/null
sudo -u postgres psql -d "${PG_DB}" -c "GRANT ALL ON SCHEMA public TO ${PG_USER};" >/dev/null

# ===================== 3) Panel: .env =====================
log ".env (panel)"
JWT_SECRET="$(gen_secret "/root/.${APP_NAME}_jwt" 48)"
SLACK_CLIENT_ID="${SLACK_CLIENT_ID:-$(env_val SLACK_CLIENT_ID)}"
SLACK_CLIENT_SECRET="${SLACK_CLIENT_SECRET:-$(env_val SLACK_CLIENT_SECRET)}"
SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-$(env_val SLACK_SIGNING_SECRET)}"
SMTP_HOST="${SMTP_HOST:-$(env_val SMTP_HOST)}"; SMTP_PORT="${SMTP_PORT:-$(env_val SMTP_PORT)}"
SMTP_USER="${SMTP_USER:-$(env_val SMTP_USER)}"; SMTP_PASS="${SMTP_PASS:-$(env_val SMTP_PASS)}"; SMTP_FROM="${SMTP_FROM:-$(env_val SMTP_FROM)}"
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

# ===================== 4) Panel: build + pm2 =====================
log "Panel build (npm ci + prisma + build)"
( cd "$APP_DIR" && npm ci --no-audit --no-fund && npx prisma generate && npx prisma db push && npm run build ) \
  || warn "Panel build sorunlu — eski build ile devam (logları kontrol et)"
sed -i "s|cwd: \".*\"|cwd: \"${APP_DIR}\"|" "${APP_DIR}/ecosystem.config.js" 2>/dev/null || true
# Taze başlat (eski/çökmüş process'i temizle)
pm2 delete "${APP_NAME}" >/dev/null 2>&1 || true
( cd "$APP_DIR" && pm2 start ecosystem.config.js )
pm2 save >/dev/null 2>&1 || true
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
# 4444 cevap veriyor mu? (502 sebebi buradan anlaşılır)
sleep 3
if curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:${APP_PORT} | grep -qE "200|307"; then
  log "Panel 4444'te çalışıyor"
else
  warn "Panel 4444'te cevap vermiyor — pm2 logs ${APP_NAME} ile bak (build hatası olabilir)"
  pm2 logs "${APP_NAME}" --lines 15 --nostream 2>/dev/null || true
fi

# ===================== 5) WordPress (WP-CLI) =====================
log "WordPress (MariaDB + WP-CLI)"
WP_DB_PASS="$(gen_secret "/root/.${APP_NAME}_wpdb_pass" 24)"
WP_ADMIN_PASS="$(gen_secret "/root/.${APP_NAME}_wp_admin" 12)"
mysql <<SQL || warn "MariaDB komutları sorunlu"
CREATE DATABASE IF NOT EXISTS \`${WP_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${WP_DB_USER}'@'localhost' IDENTIFIED BY '${WP_DB_PASS}';
ALTER USER '${WP_DB_USER}'@'localhost' IDENTIFIED BY '${WP_DB_PASS}';
GRANT ALL PRIVILEGES ON \`${WP_DB}\`.* TO '${WP_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

mkdir -p "$WP_DIR"; chown -R www-data:www-data "$WP_DIR"
WP="sudo -u www-data wp --path=${WP_DIR}"
[[ -f "${WP_DIR}/wp-load.php" ]] || $WP core download || warn "WP core indirilemedi"
if [[ -f "${WP_DIR}/wp-load.php" && ! -f "${WP_DIR}/wp-config.php" ]]; then
  $WP config create --dbname="${WP_DB}" --dbuser="${WP_DB_USER}" --dbpass="${WP_DB_PASS}" --dbhost=localhost --force --extra-php <<'PHP'
if ( isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https' ) { $_SERVER['HTTPS'] = 'on'; }
PHP
fi
if [[ -f "${WP_DIR}/wp-config.php" ]] && ! $WP core is-installed >/dev/null 2>&1; then
  $WP core install --url="https://${WP_DOMAIN}" --title="marktasks" --admin_user="admin" \
    --admin_password="${WP_ADMIN_PASS}" --admin_email="${ADMIN_EMAIL}" --skip-email || warn "WP core install sorunlu"
fi
if [[ -f "${WP_DIR}/wp-config.php" ]]; then
  $WP theme install hello-elementor --activate || warn "hello-elementor kurulamadı"
  for s in elementor jeg-elementor-kit gum-elementor-addon metform header-footer-elementor elementskit-lite; do
    $WP plugin install "$s" --activate || warn "plugin kurulamadı: $s"
  done
  KIT_SRC="${APP_DIR}/wordpress/saastify-kit.zip"
  if [[ -f "$KIT_SRC" ]]; then
    KIT_DST="${WP_DIR}/wp-content/uploads/saastify-kit.zip"
    mkdir -p "${WP_DIR}/wp-content/uploads"; cp "$KIT_SRC" "$KIT_DST"; chown www-data:www-data "$KIT_DST"
    $WP elementor kit import "$KIT_DST" >/dev/null 2>&1 && log "Kit import edildi" \
      || warn "Kit'i Elementor > Tools > Import Kit'ten yükle: ${KIT_DST}"
  fi
  chown -R www-data:www-data "$WP_DIR"
fi

# ===================== 6) NGINX + SSL (self-signed, Cloudflare 'Full' uyumlu) =====================
log "nginx vhost'ları (80 + 443 self-signed)"
# Origin için self-signed cert üret (Cloudflare edge zaten public TLS sağlar; CF->origin için bu yeter)
SSL_DIR="/etc/nginx/ssl"; mkdir -p "$SSL_DIR"
selfcert() { # $1=domain
  [[ -f "${SSL_DIR}/$1.crt" ]] || openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "${SSL_DIR}/$1.key" -out "${SSL_DIR}/$1.crt" -subj "/CN=$1" >/dev/null 2>&1
}
selfcert "${PANEL_DOMAIN}"
selfcert "${WP_DOMAIN}"

# Panel vhost (80 + 443 -> Next)
cat > "/etc/nginx/sites-available/${PANEL_DOMAIN}" <<EOF
server {
  listen 80;
  listen 443 ssl;
  server_name ${PANEL_DOMAIN};
  ssl_certificate     ${SSL_DIR}/${PANEL_DOMAIN}.crt;
  ssl_certificate_key ${SSL_DIR}/${PANEL_DOMAIN}.key;
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

# WordPress vhost (80 + 443 -> php-fpm) — WP kuruluysa
if [[ -n "$PHP_FPM_SOCK" && -f "${WP_DIR}/wp-load.php" ]]; then
  cat > "/etc/nginx/sites-available/${WP_DOMAIN}" <<EOF
server {
  listen 80;
  listen 443 ssl;
  server_name ${WP_DOMAIN} www.${WP_DOMAIN};
  ssl_certificate     ${SSL_DIR}/${WP_DOMAIN}.crt;
  ssl_certificate_key ${SSL_DIR}/${WP_DOMAIN}.key;
  root ${WP_DIR};
  index index.php index.html;
  client_max_body_size 64m;
  location / { try_files \$uri \$uri/ /index.php?\$args; }
  location ~ \.php\$ { include snippets/fastcgi-php.conf; fastcgi_pass unix:${PHP_FPM_SOCK}; }
  location ~ /\.ht { deny all; }
}
EOF
  ln -sf "/etc/nginx/sites-available/${WP_DOMAIN}" "/etc/nginx/sites-enabled/${WP_DOMAIN}"
else
  warn "WordPress hazır değil — ${WP_DOMAIN} vhost'u atlandı."
fi
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx && log "nginx reload OK" || warn "nginx -t HATALI — yukarıyı oku"

# ===================== 7) Gerçek SSL (opsiyonel, Let's Encrypt) =====================
# Self-signed taban zaten var. CERTBOT=1 ile çalıştırılırsa gerçek cert almayı dener.
# DİKKAT: Domain Cloudflare proxy (turuncu bulut) arkasındaysa HTTP-01 BAŞARISIZ olur;
# önce o kaydı geçici "DNS only" (gri bulut) yap, certbot'tan sonra tekrar proxy'e al.
if [[ "${CERTBOT:-0}" == "1" ]]; then
  log "Gerçek SSL deneniyor (certbot)"
  certbot --nginx -d "${PANEL_DOMAIN}" --non-interactive --agree-tos -m "${ADMIN_EMAIL}" --redirect \
    || warn "Certbot (panel) başarısız — Cloudflare kaydını DNS-only yapıp tekrar dene."
  if [[ -f "${WP_DIR}/wp-load.php" ]]; then
    certbot --nginx -d "${WP_DOMAIN}" -d "www.${WP_DOMAIN}" --non-interactive --agree-tos -m "${ADMIN_EMAIL}" --redirect \
      || warn "Certbot (WordPress) başarısız — Cloudflare kaydını DNS-only yapıp tekrar dene."
  fi
fi

# ===================== ÖZET =====================
echo
log "BİTTİ"
echo "  Panel:     https://${PANEL_DOMAIN}   (pm2: ${APP_NAME}:${APP_PORT})"
echo "  WordPress: https://${WP_DOMAIN}      (admin: admin / $(cat /root/.${APP_NAME}_wp_admin 2>/dev/null))"
echo "  WP $([[ -f ${WP_DIR}/wp-load.php ]] && echo 'KURULU' || echo 'KURULMADI — yukarıdaki [!] satırlarına bak')"
warn "Origin self-signed cert kullanıyor. Cloudflare SSL/TLS modu 'Full' olmalı (Full STRICT değil)."
warn "Tarayıcı 526 verirse: Cloudflare > SSL/TLS > Overview > 'Full' seç."
