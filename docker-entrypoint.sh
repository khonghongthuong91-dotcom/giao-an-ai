#!/bin/sh
# Dựng thông tin đăng nhập cho claude CLI bên trong container.
#
# Hai đường, ưu tiên theo thứ tự:
#   1. ANTHROPIC_API_KEY — claude tự dùng, không cần chép gì.
#   2. Thư mục ~/.claude của máy chủ, mount chỉ-đọc vào /host-claude. Ta CHÉP
#      ra chỗ ghi được thay vì dùng thẳng, vì claude cần ghi (khoá, cache) và
#      mount chỉ-đọc sẽ làm nó gãy.
#
# LƯU Ý: bản chép là một chiều. Khi claude tự gia hạn token OAuth, bản mới nằm
# trong container và mất khi container dựng lại — lúc đó phải khởi động lại để
# chép bản mới từ máy chủ. Dùng ANTHROPIC_API_KEY thì không có vấn đề này.
#
# Không dùng `set -e`: chép hụt thông tin đăng nhập KHÔNG được phép giết
# container. App vẫn chạy đầy đủ wizard, xuất Word/PowerPoint và kiểm tra
# chuyên môn khi không có AI — chỉ hai tính năng gọi model là rơi về bản dựng
# cục bộ. Chết ở đây là đổi một tính năng hỏng thành cả site sập.

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/home/node/.claude}"

if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "[entrypoint] Dùng ANTHROPIC_API_KEY."
elif [ -d /host-claude ]; then
  mkdir -p "$CONFIG_DIR"
  for f in .credentials.json settings.json; do
    if [ ! -f "/host-claude/$f" ]; then
      continue
    fi
    if cp "/host-claude/$f" "$CONFIG_DIR/$f" 2>/dev/null; then
      chmod 600 "$CONFIG_DIR/$f"
      echo "[entrypoint] Đã chép $f từ máy chủ."
    else
      # Hay gặp nhất: file thuộc root mode 600, còn container chạy bằng uid
      # 1000. Sửa trên máy chủ bằng:
      #   sudo chown agent:agent ~/.claude/.credentials.json
      echo "[entrypoint] Không đọc được /host-claude/$f (sai quyền?)." >&2
    fi
  done
  if [ -f /host-claude.json ]; then
    if cp /host-claude.json "$HOME/.claude.json" 2>/dev/null; then
      chmod 600 "$HOME/.claude.json"
      echo "[entrypoint] Đã chép .claude.json từ máy chủ."
    else
      echo "[entrypoint] Không đọc được /host-claude.json (sai quyền?)." >&2
    fi
  fi
  if [ ! -f "$CONFIG_DIR/.credentials.json" ]; then
    echo "[entrypoint] CẢNH BÁO: không thấy .credentials.json — AI sẽ không chạy," >&2
    echo "[entrypoint] app vẫn mở được nhưng rơi về bản giáo án dựng cục bộ." >&2
  fi
else
  echo "[entrypoint] CẢNH BÁO: không có ANTHROPIC_API_KEY và không mount /host-claude." >&2
  echo "[entrypoint] AI sẽ không chạy; app vẫn dùng được với bản dựng cục bộ." >&2
fi

exec "$@"
