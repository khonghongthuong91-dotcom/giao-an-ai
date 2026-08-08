#!/usr/bin/env bash
# Triển khai APP Tạo Giáo Án lên VPS.
#
#   ./deploy-vps.sh                          # chỉ đồng bộ mã + dựng lại container
#   ./deploy-vps.sh giaoan.workzone.ai.vn    # làm thêm nginx + HTTPS + basic auth
#
# Đọc thông tin máy chủ từ hoc-ai-contabo-vps.env (file này KHÔNG commit).
# Chạy lại bao nhiêu lần cũng được — mỗi bước đều tự kiểm tra trước khi làm.
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=hoc-ai-contabo-vps.env
[ -f "$ENV_FILE" ] || { echo "Thiếu $ENV_FILE"; exit 1; }
set -a; . "./$ENV_FILE"; set +a

DOMAIN="${1:-}"
HOST_PORT="${HOST_PORT:-3060}"
REMOTE_DIR='~/giaoan-ai'

SSH="sshpass -p $VPS_PASSWORD ssh -o StrictHostKeyChecking=accept-new -o NumberOfPasswordPrompts=1"
TARGET="$VPS_USERNAME@$VPS_IP"

# sudo trên máy này cần mật khẩu; đưa qua stdin để không lộ trong danh sách tiến trình.
remote_sudo() { $SSH "$TARGET" "printf '%s\n' '$VPS_PASSWORD' | sudo -S -p '' $1"; }

# ── Tăng số phiên bản ────────────────────────────────────────────────────
#
# Tự tăng số cuối mỗi lần deploy. Nếu để sửa tay thì sẽ có lúc quên, hai môi
# trường cùng hiện một số, và nhãn phiên bản mất hết tác dụng đối chiếu — đúng
# lúc cần tin nó nhất.
#
# Muốn tăng số giữa hoặc số đầu (thêm tính năng lớn, đổi lớn) thì sửa tay
# version.json rồi chạy deploy như bình thường.
echo "==> 0/5 Tăng số phiên bản"
OLD_VER=$(node -p "require('./version.json').version")
NEW_VER=$(node -e "
  var v = require('./version.json').version.split('.');
  v[2] = Number(v[2]) + 1;
  console.log(v.join('.'));
")
node -e "
  var fs = require('fs');
  fs.writeFileSync('version.json', JSON.stringify({ version: '$NEW_VER' }, null, 2) + '\n');
"
export BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
export BUILT_AT="$(date -u '+%Y-%m-%d %H:%M UTC')"
echo "    $OLD_VER -> $NEW_VER  (commit $BUILD_ID)"

echo "==> 1/5 Đồng bộ mã nguồn"
rsync -az --delete \
  --exclude '.git' --exclude '*.env' --exclude '.ai-cwd' \
  --exclude '__test.docx' --exclude 'tasks' \
  -e "$SSH" ./ "$TARGET:$REMOTE_DIR/"

echo "==> 2/5 Dựng và khởi động container"
# Gộp build + kiểm tra vào một phiên ssh: mở nhiều phiên liên tiếp bị sshd chặn.
$SSH "$TARGET" "
  cd $REMOTE_DIR
  HOST_PORT=$HOST_PORT BUILD_ID='$BUILD_ID' BUILT_AT='$BUILT_AT' docker compose up -d --build 2>&1 | tail -3
  sleep 5
  curl -fsS http://127.0.0.1:$HOST_PORT/api/health >/dev/null || {
    echo 'health FAIL'; docker logs giaoan-ai | tail -20; exit 1; }
  echo '==> 3/5 health OK, phiên bản đang chạy:'
  curl -fsS http://127.0.0.1:$HOST_PORT/api/version
  echo
"

if [ -z "$DOMAIN" ]; then
  echo
  echo "Xong phần container. App chạy ở 127.0.0.1:$HOST_PORT trên VPS."
  echo "Muốn mở ra Internet, chạy lại kèm tên miền:  ./deploy-vps.sh ten-mien-cua-ban"
  exit 0
fi

echo "==> 4/5 Cấu hình nginx cho $DOMAIN"

# Người dùng basic auth. Đặt BASIC_USER / BASIC_PASS trước khi chạy để tự chọn;
# không đặt thì sinh mật khẩu ngẫu nhiên và in ra cuối.
BASIC_USER="${BASIC_USER:-giaoan}"
GENERATED=0
if [ -z "${BASIC_PASS:-}" ]; then
  BASIC_PASS="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 20)"
  GENERATED=1
fi

# Vùng giới hạn nhịp phải khai báo ở scope http, không đặt trong server block được.
remote_sudo "tee /etc/nginx/conf.d/giaoan-ratelimit.conf >/dev/null <<'EOF'
# Mỗi lần /api/generate là một lần gọi model có tính tiền. 10 lần/phút mỗi IP,
# cho phép dồn 3 lần liên tiếp — đủ rộng cho một cô soạn bài, đủ chặt để một
# script lạ không đốt sạch hạn mức.
limit_req_zone \\\$binary_remote_addr zone=giaoan_ai:10m rate=10r/m;
EOF"

remote_sudo "mkdir -p /var/www/certbot"

# htpasswd: dùng openssl để khỏi phải cài apache2-utils.
HASH="$($SSH "$TARGET" "openssl passwd -apr1 '$BASIC_PASS'")"
remote_sudo "tee /etc/nginx/.htpasswd-giaoan >/dev/null <<EOF
$BASIC_USER:$HASH
EOF"
remote_sudo "chmod 640 /etc/nginx/.htpasswd-giaoan && chown root:www-data /etc/nginx/.htpasswd-giaoan"

# Lần đầu chưa có cert -> nginx không load nổi block 443 có ssl_certificate.
# Dựng bản chỉ-HTTP trước, xin cert, rồi mới đặt bản đầy đủ.
HAS_CERT=$($SSH "$TARGET" "printf '%s\n' '$VPS_PASSWORD' | sudo -S -p '' test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem && echo yes || echo no")

if [ "$HAS_CERT" = "no" ]; then
  echo "    Chưa có cert — dựng vhost tạm chỉ HTTP để xin cert"
  remote_sudo "tee /etc/nginx/sites-available/$DOMAIN >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
EOF"
  remote_sudo "ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN"
  remote_sudo "nginx -t && systemctl reload nginx"

  echo "    Xin cert Let's Encrypt (DNS phải đã trỏ về $VPS_IP)"
  remote_sudo "certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --non-interactive --agree-tos --keep-until-expiring" \
    || { echo "certbot THẤT BẠI — kiểm tra DNS đã trỏ về $VPS_IP chưa."; exit 1; }
fi

# Máy này không có deploy-hook chung: cert gia hạn xong nginx vẫn phục vụ bản
# cũ cho tới khi được nạp lại, nên ~60 ngày nữa site sẽ báo lỗi chứng chỉ.
# Gắn hook riêng cho domain này để tự nạp lại sau mỗi lần gia hạn.
remote_sudo "grep -q '^renew_hook' /etc/letsencrypt/renewal/$DOMAIN.conf \
  || sed -i 's|^\\[renewalparams\\]|[renewalparams]\\nrenew_hook = systemctl reload nginx|' /etc/letsencrypt/renewal/$DOMAIN.conf"

echo "    Đặt vhost đầy đủ (HTTPS + basic auth + rate limit)"
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$HOST_PORT/g" nginx-giaoan.conf.template \
  | $SSH "$TARGET" "cat > /tmp/giaoan-vhost.conf"
remote_sudo "mv /tmp/giaoan-vhost.conf /etc/nginx/sites-available/$DOMAIN"
remote_sudo "ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN"
remote_sudo "nginx -t && systemctl reload nginx"

echo "==> 5/5 Kiểm tra qua HTTPS"
$SSH "$TARGET" "
  code=\$(curl -s -o /dev/null -w '%{http_code}' https://$DOMAIN/ --resolve $DOMAIN:443:127.0.0.1 -k)
  echo \"không kèm mật khẩu -> HTTP \$code (mong đợi 401)\"
  code=\$(curl -s -o /dev/null -w '%{http_code}' -u '$BASIC_USER:$BASIC_PASS' https://$DOMAIN/ --resolve $DOMAIN:443:127.0.0.1 -k)
  echo \"có kèm mật khẩu   -> HTTP \$code (mong đợi 200)\"
"

echo
echo "Xong. App ở https://$DOMAIN/"
echo "Tài khoản: $BASIC_USER"
if [ "$GENERATED" = "1" ]; then
  echo "Mật khẩu:  $BASIC_PASS   <-- sinh tự động, lưu lại ngay"
fi
