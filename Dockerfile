# APP Tạo Giáo Án — máy chủ tĩnh + cầu nối AI (claude -p) trong container.
#
# Dùng node:22-slim (Debian) chứ không phải alpine: Claude Code CLI kèm theo
# vài binary dựng sẵn (ripgrep…) liên kết glibc, chạy trên musl hay gãy.
FROM node:22-slim

# ca-certificates để gọi HTTPS tới api.anthropic.com; tini để tiến trình con
# claude được thu dọn tử tế khi container dừng.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code@2.1.197 \
 && npm cache clean --force

WORKDIR /app

# Chỉ chép phần app thật sự cần phục vụ. .dockerignore đã loại file thừa,
# nhưng liệt kê rõ ở đây để image không vô tình ôm thêm thứ khác.
COPY ai-server.mjs ./
COPY auth.mjs ./
COPY index.html ./
COPY favicon.svg ./
COPY og-image.png ./
COPY version.json ./
COPY css/ ./css/
COPY js/ ./js/

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Chạy bằng user "node" có sẵn trong image — không cần root.
RUN mkdir -p /app/.ai-cwd /home/node/.claude \
 && chown -R node:node /app /home/node/.claude
USER node

# Mã commit và giờ build, để /api/version nói đúng image nào đang chạy.
# Thư mục .git không được chép vào image nên phải truyền vào lúc build.
ARG BUILD_ID=dev
ARG BUILT_AT=

ENV APP_ROOT=/app \
    PORT=8787 \
    BIND_ADDR=0.0.0.0 \
    CLAUDE_CONFIG_DIR=/home/node/.claude \
    BUILD_ID=$BUILD_ID \
    BUILT_AT=$BUILT_AT

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "/app/ai-server.mjs"]
