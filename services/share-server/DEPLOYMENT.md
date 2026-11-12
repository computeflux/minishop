# share-server 部署文档

minishop 的 SEO / 社交分享 SSR 服务。为每个店铺生成可被搜索引擎收录、可被微信 / Telegram / X 预览的独立页面与分享卡。

- **运行时**：Bun（无 Hono 依赖，手写路由 `Bun.serve({ fetch })`）
- **数据**：读 TEE 后端 `contractDryRun`（GraphQL `/gql`）
- **产出**：`/share/{id}.html`（SEO + 社交 meta + JSON-LD）、`/share/{id}.svg`（分享卡）、`/sitemap.xml`、`/robots.txt`
- **架构**：阿里云 CDN → 回源 share-server（ECS）→ TEE

> 配套总览见同目录 `README.md`；子项目约定见 `../../AGENTS.md`（minishop）与根 `../../../AGENTS.md`。

---

## 1. 前置条件

| 项 | 要求 | 验证 |
|----|------|------|
| TEE 后端可达 | ECS 能访问 `TEE_API_BASE`（`/gql`） | `curl -XPOST $TEE_API_BASE/gql -d '{"query":"{contractDryRun...}"}'` |
| logo 公开可取 | 店铺 logo URL 无鉴权、跨域可取 | `curl -I <logo-url>` 返回 200 + 图片 |
| 公网域名 | 用于 canonical / og:image（如 `minishop.computeflux.ai`） | DNS 已解析到 CDN |
| ECS | 1 vCPU / 1GB 起（峰值内存 ~250MB） | — |
| 阿里云 CDN | 已创建域名、可配置回源 | — |

---

## 2. 环境变量

| 变量 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `TEE_API_BASE` | 是 | TEE 后端地址（读链走 `/gql`） | `https://xxx:30118` |
| `SITE_URL` | 建议 | 公网域名（生成绝对 URL） | `https://minishop.computeflux.ai` |
| `GATEWAY_ABI_PATH` | 默认已有 | ABI 文件路径 | `/app/data/gateway.json` |
| `PORT` | 默认 3000 | 服务端口 | `3000` |
| `TEE_TIMEOUT_MS` | 默认 15000 | 读链超时 | `15000` |
| `SPA_INDEX` | 否 | 配置后其它 GET 返回该 HTML（可同一服务托管 app） | `/app/index.html` |

复制 `.env.example` 为 `.env` 填写。

---

## 3. Docker 部署（推荐）

构建上下文 = `services/share-server`（自带 `data/gateway.json`）。

```bash
cd apps/minishop/services/share-server

# 构建
docker build -t minishop-share-server:latest .

# 运行
docker run -d --name share-server \
  --restart unless-stopped \
  -p 3000:3000 \
  -e TEE_API_BASE=https://your-tee:30118 \
  -e SITE_URL=https://minishop.computeflux.ai \
  minishop-share-server:latest

# 验证
docker logs -f share-server
curl http://localhost:3000/health
curl http://localhost:3000/share/1.html   # 应返回含 og/meta 的 HTML
```

镜像说明：构建期 `bun build --target bun` 打包成单文件 + 拷贝 ABI；运行期仅 `bun run dist/server.js`，极轻（~0.72MB bundle）。

### ABI 更新（重要）

ABI 随合约重建更新。改合约后：

```bash
cp ../../public/contract/gateway.json data/gateway.json   # 从 minishop/public 复制最新（工作目录 = services/share-server）
docker build -t minishop-share-server:latest .
docker rm -f share-server && docker run ...   # 同上重启
```

---

## 4. 阿里云 CDN 配置（核心）

目标：让 CDN 把 SEO/分享流量缓存分发，未命中时回源到 share-server。

### 4.1 回源配置

在 CDN 控制台为该域名配置回源：

| URL 前缀 | 回源到 | 说明 |
|----------|--------|------|
| `/share/*` | share-server（ECS IP:端口 或 ECS 自定义域名） | SEO 页 + 分享卡 |
| `/sitemap.xml`、`/robots.txt` | share-server | 搜索引擎 |
| 其余（`/*.js` `/*.css` 图片等） | OSS / 另一源站（app） | 前端静态资源 |

- **回源 Host**：设为 share-server 域名或 ECS IP。
- **回源端口**：3000（HTTP 即可，HTTPS 由 CDN 终止）。
- 若同一域名混送 app + share 流量，按上表**按 URL 前缀配多条回源规则**。

### 4.2 HTTPS

- CDN 端开启 HTTPS 并绑定证书。
- 回源协议选 HTTP（CDN→ECS 内网/局域网，无需 HTTPS）。

### 4.3 缓存策略

- 本服务已返回 `Cache-Control: public, max-age=3600`，CDN 默认缓存。
- SVG/HTML 建议缓存 1h；如需店铺改名即时生效，缩短 TTL 或配置**缓存刷新**。
- `robots.txt` / `sitemap.xml` 可缓存更久（变更少）。

### 4.4 跨域（og:image）

- 本服务已返回 `Access-Control-Allow-Origin: *`，确保各平台能取到 `/share/{id}.svg`。

### 4.5 提交 sitemap 给搜索引擎

- 百度站长 / Google Search Console 提交 `https://<域名>/sitemap.xml`。

---

## 5. 非 Docker 部署（ECS 直接跑）

```bash
cd apps/minishop/services/share-server
cp .env.example .env        # 填 TEE_API_BASE / SITE_URL
bun install
# 生产：打包 + 后台常驻
bun build src/server.ts --target bun --outdir dist --minify
GATEWAY_ABI_PATH=/app/data/gateway.json PORT=3000 nohup bun run dist/server.js > /var/log/share-server.log 2>&1 &
# 建议用 systemd / pm2 托管（自动重启），见下方 snippet
```

systemd snippet（`/etc/systemd/system/share-server.service`）：

```ini
[Unit]
Description=minishop share-server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/srv/share-server
Environment=TEE_API_BASE=https://your-tee:30118
Environment=SITE_URL=https://minishop.computeflux.ai
Environment=PORT=3000
ExecStart=/usr/local/bin/bun run dist/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now share-server
```

---

## 6. 验证清单

部署后逐项确认：

| 检查 | 命令 | 期望 |
|------|------|------|
| 健康检查 | `curl -s :3000/health` | `{"ok":true,...}` |
| 店铺页 | `curl -s :3000/share/1.html` | 200，含 `<title>`、`og:title`、`og:image`、`twitter:card`、`application/ld+json`、`canonical` |
| 分享卡 | `curl -s :3000/share/1.svg` | 200，`image/svg+xml`，~1800 字节 |
| 不存在店铺 | `curl -s -o /dev/null -w '%{http_code}' :3000/share/999999.html` | 404（兜底页，仍带 meta） |
| sitemap | `curl -s :3000/sitemap.xml` | 含所有在售店铺 `/share/{id}.html` |
| robots | `curl -s :3000/robots.txt` | `Sitemap: https://<域名>/sitemap.xml` |
| CDN 链路 | `curl -I https://<域名>/share/1.html` | 200，`via`/`x-cache` 显示 CDN 命中 |
| og:image 可取 | `curl -I https://<域名>/share/1.svg` | 200 + `access-control-allow-origin: *` |

### 抓爬虫视角（可选）

用 Twitter Card Validator / 微信开发者工具「抓包」或 `curl -A <crawler-UA>` 确认爬虫拿到的 meta 正确。

---

## 7. 运维 / 排错

| 现象 | 原因 | 处理 |
|------|------|------|
| 店铺页返回 404 兜底 | `getProvider` 抛错（链读取失败 / ABI 不匹配） | 查 log；确认 TEE 可达；ABI 是否最新 |
| SVG 无 logo | logo URL 不可公开取 / 超时 | logo 需无鉴权、跨域可取；或等缓存 |
| 改名后预览未更新 | CDN 缓存 | 清对应 URL 缓存（CDN 刷新接口）或缩短 TTL |
| 读链超时 | TEE 慢 / `TEE_TIMEOUT_MS` 太小 | 调大 `TEE_TIMEOUT_MS`；查 TEE 负载 |
| 启动报 `awaitPromise` 错误 | 用了旧版顶层 `await import("bun")` 打包 | 用当前 `--target bun`（已改为静态 import） |
| 端口占用 | 旧进程未释放 | `fuser -k 3000/tcp` 或重启容器 |

### 缓存刷新（店铺改名/新建急需生效）

CDN 控制台「缓存刷新」输入 `https://<域名>/share/{id}.html` 与 `.svg`；或 API：

```bash
aliyun cdn RefreshCdnObjectObject --CdnDomain <域名> --ObjectPath '["https://<域名>/share/{id}.html"]'
```

---

## 8. 监控建议

- ECS：CPU / 内存 / 网络（峰值内存 ~250MB，1v1C 足够）。
- 日志：`bun run` / systemd 输出到日志文件；关键错误已 `console.error`。
- 健康检查：CDN 回源健康检查指向 `/health`。
- 可选：对 `/share/{id}.html` 做拨测，确认 200 + meta 存在。

---

## 9. 与前端 dApp 的关系

| | dApp 前端 | share-server |
|--|--|--|
| 运行时 | Vite（Node） | Bun |
| 路由 | HashRouter `/#/{id}` | 干净 URL `/share/{id}.html` |
| 职责 | 交互（充值/调用/钱包） | SEO 收录 + 社交分享预览 |
| 托管 | OSS/nginx | CDN 回源 ECS |
| meta | `useMeta` 动态（给跑 JS 的爬虫） | 服务端静态（给微信/TG/X 服务器端抓取） |

两者互补：前端动态 meta 覆盖会跑 JS 的爬虫；share-server 服务端 meta 覆盖微信/TG/X 的服务器端抓取（不跑 JS）。
