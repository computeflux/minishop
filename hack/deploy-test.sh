#!/bin/sh

# minishop 部署（test 环境）— bun 构建 SSR + 部署 runner 到 computefluxtest：
#   1. bun run build:test       (vite --mode test，读 .env.test) -> dist/（SSR 需要其 manifest.json 注入 asset 链接）
#   2. bun run build:ssr:test   (vite --mode ssr-test，读 .env.ssr-test) -> dist-ssr/
#   3. 打包 SSR 运行时 -> scp 到 computefluxtest -> systemd 常驻（Bun）
#      SSR 提供 SEO 页面：/、/:id、/models/:id、/open（SSR HTML + og/twitter meta + hydration 入口）
#      及 SEO 端点：/sitemap.xml、/robots.txt、/share/{id}.svg（分享卡 og:image）
#
# 静态资源（dist/ -> oss://compute-flux-test/shops）由 ./hack/deploy-test-oss.sh 负责。
#
# 用法: ./hack/deploy-test.sh
#   SITE_URL  默认 https://test.computeflux.ai/shops/（test 站固定地址），
#             如需覆盖：SITE_URL=https://xxx/shops/ ./hack/deploy-test.sh

set -eu

# 获取脚本所在目录（兼容符号链接）
SOURCE="$0"
while [ -h "$SOURCE"  ]; do
    DIR="$( cd -P "$( dirname "$SOURCE"  )" && pwd  )"
    SOURCE="$(readlink "$SOURCE")"
    [ "$SOURCE" != /*  ] && SOURCE="$DIR/$SOURCE"
done
DIR="$( cd -P "$( dirname "$SOURCE"  )" && pwd  )"

cd "$DIR/../"

# test 环境构建脚本（当前仅 test）
BUILD="build:test"
SSR_BUILD="build:ssr:test"

# computefluxtest ECS（~/.ssh/config 别名：root@47.79.98.142, drcao.pem）
ECS_HOST="${ECS_HOST:-computefluxtest}"
REMOTE_DIR="${REMOTE_DIR:-/srv/minishop-ssr}"
SSR_PORT="${SSR_PORT:-3001}"          # share-server 占 3000，app SSR 用 3001
SITE_URL="${SITE_URL:-http://shop.computeflux.ai}"
case "$SITE_URL" in
  http://*|https://*) ;;
  *) echo "SITE_URL 必须是 http(s) URL: $SITE_URL" >&2; exit 1 ;;
esac
# 拆分：origin（meta 绝对 URL 的根）+ 路径前缀（如 /shops，runner 用 BASE_PREFIX 剥前缀路由）
ORIGIN=$(printf %s "$SITE_URL" | sed -E 's|(https?://[^/]+).*|\1|')
PREFIX=$(printf %s "$SITE_URL" | sed -E 's|https?://[^/]+||; s|/$||')

# ── 1. 客户端构建 ────────────────────────────────────────────────
echo "==> [build] bun run $BUILD"
bun run "$BUILD"

# ── 2. SSR 构建（test TEE + /shops/ 前缀 baked 进 dist-ssr）──────
echo "==> [build] bun run $SSR_BUILD"
bun run "$SSR_BUILD"

# ── 3. 打包 SSR 运行时（SSR 包全量打包，远端只需 bun，无需 node_modules）──
#   dist-ssr/                 SSR bundle（vite --mode ssr-test 产物）
#   dist/                     客户端构建全量（asset 由 runner 静态服务 + manifest 注入 <head>）
#                             CDN 把 /shops/* 全部回源 runner 时，assets 也必须在此，
#                             否则 /assets/*.js 查不到文件 → SPA 兜底返回 text/html → 浏览器 MIME 拦截
#   public/contract/gateway.json  ABI（SSR 读链，cwd/public 默认路径）
#   src/ssr/runner.ts         HTTP runner
TAR=/tmp/minishop-ssr.tar.gz
rm -f "$TAR"
tar -czf "$TAR" \
    dist-ssr \
    dist \
    public/contract/gateway.json \
    src/ssr/runner.ts

echo "==> [scp] $TAR -> $ECS_HOST:$REMOTE_DIR"
scp -q "$TAR" "$ECS_HOST:/tmp/minishop-ssr.tar.gz"

# ── 5. 远端：解压 + 装 bun（首次）+ systemd 常驻 + 健康检查 ───────
echo "==> [remote] $ECS_HOST: 解压 / systemd / 健康检查"
ssh "$ECS_HOST" "set -eu
    mkdir -p $REMOTE_DIR
    tar -xzf /tmp/minishop-ssr.tar.gz -C $REMOTE_DIR
    rm -f /tmp/minishop-ssr.tar.gz
    if [ ! -x \$HOME/.bun/bin/bun ] && ! command -v bun >/dev/null 2>&1; then
        echo '    首次部署：安装 bun...'
        curl -fsSL https://bun.sh/install | bash
    fi
    BUN=\$( [ -x \$HOME/.bun/bin/bun ] && echo \$HOME/.bun/bin/bun || command -v bun )
    cat > /etc/systemd/system/minishop-ssr.service <<UNIT
[Unit]
Description=minishop app SSR (Bun runner)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REMOTE_DIR
Environment=SITE_URL=$ORIGIN
Environment=BASE_PREFIX=$PREFIX
Environment=DEFAULT_LOCALE=en
Environment=TEE_TIMEOUT_MS=15000
Environment=PORT=$SSR_PORT
ExecStart=\$BUN run src/ssr/runner.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable minishop-ssr
    systemctl restart minishop-ssr   # ⚠️ 必须 restart：enable --now 在服务已运行时不会重启，旧进程会继续跑旧 bundle
    sleep 2
    echo '    [health]'
    curl -sf "http://127.0.0.1:$SSR_PORT/health" && echo
    echo '    [ssr 首页] title + og 关键 meta（带部署前缀访问）'
    curl -sf "http://127.0.0.1:$SSR_PORT$PREFIX/" | grep -oE '<title>[^<]*</title>|property=\"og:(title|locale)\" content=\"[^\"]*\"' | head -5
"

echo "==> [done]"
echo "    SSR runner: $ECS_HOST:$SSR_PORT（systemd: minishop-ssr，已含 client dist，asset 由 runner 直接服务）"
echo "    可选: ./hack/deploy-test-oss.sh 上传 dist/ 到 OSS（若 CDN 配了静态资源回源 OSS 则作为加速层）"
echo "    公网入口: $SITE_URL"
echo "    CDN 回源: 全部 $PREFIX/* → $SSR_PORT（SSR 已含 /sitemap.xml、/robots.txt、/share/{id}.svg）；静态资源 → OSS"
