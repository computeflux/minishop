# share-server · minishop 的 SEO / 社交分享 SSR 服务

为 minishop 每个店铺生成**可被搜索引擎收录**、**可被微信 / Telegram / X 预览**的独立页面与分享卡。

- **运行时**：Bun（轻、内存低）+ 手写路由（无 Hono 依赖，避免传递依赖坑）
- **数据**：读 TEE 后端 `contractDryRun`（GraphQL `/gql`），复用 `@polkadot` SCALE 解码
- **输出**：`/share/{id}.html`（SEO 内容页 + 社交 meta）、`/share/{id}.svg`（分享卡）、`/sitemap.xml`、`/robots.txt`

## 为什么是 SSR（按需生成）而非预渲染

店铺 ID 在链上、动态产生，构建期预渲染覆盖不到。本服务**首次被抓取时才生成**每个店铺的 HTML/SVG，内存缓存 + CDN 缓存，之后重复抓取从边缘发、不打本服务。数据永远最新（改名/新建下次抓取即生效）。

## 架构

```
微信 / TG / X / 百度 / Google
        ↓
   阿里云 CDN  ← SSL + 加速 + 缓存（/share/* 从这里发）
        ↓ 回源（缓存未命中）
  本服务（ECS，Bun）  → 读 TEE /gql → 生成 HTML/SVG
        ↓
  TEE 后端（contractDryRun）
```

CDN 把流量扛走，本服务只在缓存未命中时轻量生成——这就是「高性能、低占用」的来源。

## 端点

| 路径 | 说明 |
|------|------|
| `/share/{id}.html` | 店铺内容页（含 og/twitter meta + JSON-LD + 实质内容）｜SEO 与分享共用一页 |
| `/shop/{id}` | 同上，干净 URL 别名 |
| `/share/{id}.svg` | 1200×630 分享卡（logo base64 内联，微信服务器也能渲染） |
| `/sitemap.xml` | 所有在售店铺 URL |
| `/robots.txt` | 指向 sitemap |
| `/health` | 健康检查 |

不存在 / 读取失败的店铺：返回兜底页（404 / 500 仍带品牌 meta），社交分享不显示空白。

## 本地开发

```bash
cd services/share-server
cp .env.example .env        # 填 TEE_API_BASE / SITE_URL
bun install                 # 首次：装 @polkadot（服务自有 node_modules，不用 minishop 的）
bun run dev                 # 热重载，默认 :3000
```

或跑端到端测试（直调 `fetchHandler`，不绑端口）：

```bash
bun run test:chain   # 验证链上读取 + 解码
bun run test:list    # 验证列表/模型解码
bun run test:http    # 验证全部路由
```

### 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `TEE_API_BASE` | TEE 后端地址（读链走 `/gql`） | 必填 |
| `SITE_URL` | 公网域名（生成 canonical / og:image 绝对 URL） | 从请求头推导 |
| `GATEWAY_ABI_PATH` | gateway ABI 文件 | `/app/data/gateway.json`（Docker） |
| `PORT` | 服务端口 | `3000` |
| `TEE_TIMEOUT_MS` | 读链超时 | `15000` |
| `SPA_INDEX` | 若配置，其它 GET 返回该 HTML（可同一服务托管 app） | 空 |

## Docker 部署

```bash
# 构建上下文 = services/share-server（已自带 data/gateway.json）
docker build -t minishop-share-server .
docker run -d --name share-server -p 3000:3000 \
  -e TEE_API_BASE=https://your-tee:30118 \
  -e SITE_URL=https://minishop.computeflux.ai \
  minishop-share-server
```

镜像：构建期 `bun build` 打包成单文件 + 拷贝 ABI；运行期仅 `bun run dist/server.js`，极轻。

> ⚠️ **ABI 会随合约重建更新**。改合约后需重新 `cp` `minishop/public/contract/gateway.json` 到 `data/` 再重建镜像。

## 阿里云 CDN 配置（关键）

1. **域名回源**：把分享域名（如 `minishop.computeflux.ai`）的回源指向 ECS（IP:端口 或 ECS 自定义域名）。
2. **URL 分发**：让 CDN 把 `/share/*`、`/sitemap.xml`、`/robots.txt` 回源到本服务；其余静态资源（app）回源到 OSS / 另一源站。可在 CDN 按 URL 前缀配置不同回源。
3. **缓存**：本服务已返回 `Cache-Control: public, max-age=3600`，CDN 默认缓存。店铺改名要即时生效时，调 CDN 刷新接口清对应 URL（或缩短 TTL）。
4. **HTTPS**：CDN 终止 HTTPS；ECS 内部 HTTP 即可。
5. **og:image 跨域**：本服务已返回 `Access-Control-Allow-Origin: *`，确保各平台能取到 `/share/{id}.svg`。

## SEO 要点（本页已内置）

- 每个店铺独立干净 URL（`/share/{id}.html`），搜索引擎可区分收录。
- 完整 `og:*` / `twitter:*` meta + `canonical`。
- `application/ld+json` 结构化数据（`Organization` + 模型 `ItemList`）。
- 实质内容（店名、简介、模型名/价格/上下文、统计数据）——搜索引擎靠文字收录。
- `sitemap.xml` + `robots.txt` 提交给搜索引擎。

> 注意：交互 app 仍是 HashRouter（`/#/{id}`）。本页的「打开店铺」按钮跳 app。若想让**收录 URL = 用户访问 URL**（更完美），再把 app 改 `BrowserRouter` + nginx `try_files`；非前提。

## 目录

```
services/share-server/
├── src/
│   ├── abi.ts        gateway ABI 加载（路径可配置）
│   ├── chain.ts      链上读取（dry-run + SCALE 解码）+ TTL/单飞缓存
│   ├── render.ts     SEO 内容页 HTML（meta + JSON-LD + 内容）
│   ├── shareCard.ts  SVG 分享卡（logo base64 内联）
│   ├── sitemap.ts    sitemap.xml + robots.txt
│   └── server.ts     路由 + Bun.serve 启动
├── src/lib/          解码器（从 minishop 复制的 @polkadot codec/decoder）
├── data/gateway.json ABI 副本（合约变更后重新复制）
├── Dockerfile        多阶段构建
├── .env.example
├── test-*.ts         链上读取 / 路由端到端测试
└── README.md
```

## 已知取舍

- **logo 内联**：每次缓存未命中时 fetch logo 转 base64（已确认可公开访问）。logo 变更需等缓存过期或清 CDN。
- **SuccessRate**：链上为 1/10000 单位，页面按百分比展示（>100% 视为未设，原样展示）。
- **区域 Region**：暂无枚举映射，原样展示编码。
