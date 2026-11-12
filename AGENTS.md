# minishop（算力店铺 dApp）

任何人开设算力小铺，把闲置算力挂上链；任何人充值积分，按需调用。单店私域、按需消费、结算上链。

技术栈：**React + Vite + TypeScript**（前端 dApp）+ **Bun** 服务（SEO / 社交分享 SSR）。

> 本文件是 `apps/minishop` 子项目约定，被根 `AGENTS.md` 自动继承。进入 `services/share-server` 视为另一个独立项目（见其 `README.md` / `DEPLOYMENT.md`）。

## 结构

```
apps/minishop/
├── src/                 # dApp 前端（React + Vite + TS）
│   ├── pages/           # Home / ShopDetail / ModelDetail / OpenShop / RechargeModal
│   ├── contracts/tee/   # TEE 合约读取（contractDryRun + SCALE 解码）+ ABI
│   ├── lib/share.ts     # 分享卡 SVG（前端用）
│   ├── hooks/           # useMeta（动态 meta）等
│   ├── ssr/             # ★ 应用级 SSR（Vite --ssr）：Home/ShopDetail 服务端渲染 + hydrate
│   │   ├── server.tsx   #   renderPage（renderToReadableStream + StaticRouter + query dehydrate）
│   │   ├── SsrApp.tsx   #   SSR 专用组件树（静态导入页面，避免 lazy suspense 在 Bun 的关闭 bug）
│   │   ├── runner.ts    #   Bun HTTP runner（导入 dist-ssr/server.js）
│   │   ├── manifest.ts  #   Vite manifest 类型
│   │   └── stubs/       #   web3auth SSR 存根（@wetee/web3auth/react → no-op provider + 断开默认值 hooks）
│   └── vite.config.ts   # dev :5175（--mode ssr 打 SSR 包）
├── public/              # 静态资源（logo、contract/*.json ABI、og-brand.svg）
├── index.html           # 基础 SEO meta + 品牌级 og:image 兜底（含 hydration 入口 JS）
├── services/
│   └── share-server/    # Bun SEO/分享 SSR 服务（独立项目，见下；/share/{id}.svg 供 og:image）
└── package.json         # Vite 构建
```

## 两个运行时

| 部分 | 运行时 | 端口 | 说明 |
|------|--------|------|------|
| dApp 前端 | Vite（Node） | :5175（dev） | SPA，BrowserRouter（clean URL，见下） |
| 应用 SSR | **Bun** | 自定义（test 用 3001） | `src/ssr/` 渲染全部收录页 + SEO 端点（sitemap/robots/分享卡），CDN 回源 |

⚠️ **share-server 已被 app SSR 取代（2026-09）**：sitemap / robots / 店铺分享卡（`/share/{id}.svg`）已并入 `src/ssr/server.tsx`（`seoSitemap` / `seoRobots` / `seoShareCard`），不再需要独立 SEO 内容页。`services/share-server/` 保留作参考，不再部署维护。

## 数据读取（两部分共用）

店铺/模型数据都走 TEE 后端的 **`contractDryRun`**（GraphQL `/gql`），返回 SCALE 字节，用 `@polkadot` 解码。

- **前端 / 应用 SSR**：`src/contracts/tee/`（`BaseContract` + `decoder.ts` + `codec.ts` + `public/contract/gateway.json` ABI），SSR 与客户端共用同一套代码。

## 应用级 SSR（Home / ShopDetail）

目标：让「收录页 = 访问页」——店铺链上动态产生，首抓时服务端渲染真实内容 + og/twitter meta，客户端 hydrate 接管。

- **构建**：`npx vite build --mode ssr` → `dist-ssr/index.js`（ESM，**全量打包**：react/react-dom 等全部内联，仅 node 内建 external；运行时镜像无需 node_modules，见 `Dockerfile.ssr`）。TEE 后端地址由 `minishop/.env.ssr` 在构建期注入 `import.meta.env`（buildkit 的 `ARG/--build-arg` 替换在本环境失效，故改用 Vite 原生 `.env.ssr`）。客户端 `npm run build` → `dist/` + `dist/.vite/manifest.json`。`tsconfig.app.json` 已 `exclude` `src/ssr/**`（SSR 入口由 esbuild 编译，不纳入客户端 tsc，避免 `Web3AuthProvider` 缺 `config` 报错）。
- **运行**：`bun run src/ssr/runner.ts`（Bun）。运行时 env：`SITE_URL`（meta 绝对 URL / ABI 源）、`TEE_API_BASE_URL` 等（构建时 baked）、`TEE_TIMEOUT_MS`、`DEFAULT_LOCALE`、`ABI_DIR`（SSR 读 ABI 的目录，默认 `public/`）、`CLIENT_MANIFEST_PATH`（客户端 manifest，默认 `../dist/.vite/manifest.json`）。
- **渲染**：`renderPage(pathname)` → `renderToReadableStream`（StaticRouter + 每请求 QueryClient + `dehydrate`）→ 完整 HTML。`/1` 等店铺页先 `prefetchQuery` 再渲染，避免 flash。
- **为什么用 renderToReadableStream + SsrApp**：Bun 的 `react-dom/server` 对 `lazy()` 异步 suspense 边界在关闭时有 bug（"abortable task at the root… bug in React"）。`SsrApp` 静态导入页面（不 lazy）绕过；`renderToReadableStream` 在 Bun 可用（`renderToPipeableStream` 无）。
- **SSR 存根**：`@wetee/web3auth/react` 的 `Web3AuthProvider` 用无 `getServerSnapshot` 的 `useSyncExternalStore`，SSR 会崩。vite `--mode ssr` 的 alias 把 `/react` 指向 `src/ssr/stubs/web3auth-react.tsx`（no-op provider + 断开默认值 hooks）。根 `@wetee/web3auth` 保留真版（仅构建 chain config，服务端无害）。
- **浏览器全局 guard**：`useMeta` 的 `window.location`（Home/ShopDetail）、`GraphqlClient.getAuthHeader` 的 `localStorage`、`AbiLoader.fetchAbi` 的 SSR 读 fs —— 均加 `typeof window/localStorage === 'undefined'` guard，SSR 期走默认/本地路径。
- **资产链接**：`loadClientAssets()` 读 client manifest，把入口 JS / preload / CSS 精确注入 `<head>`（Rolldown manifest 的 imports 带前导 `_`，需还原为 `assets/<name>`）。
- **hydration**：`main.tsx` 检测 `window.__SSR__` 用 `hydrateRoot`，读 `window.__QUERY_STATE__` 回填 QueryClient（无 flash）。

与 share-server 互补：app SSR 给「会跑 JS + 服务器端抓取访问页」；share-server 给「微信/TG/X 服务器端抓取」的 `/share/{id}` 内容页与分享卡（og:image 指向 `/share/{id}.svg`）。

## SEO 端点（app SSR 内置，原 share-server 职责）

`src/ssr/server.tsx` 导出、`runner.ts` 路由（剥 `BASE_PREFIX` 后匹配）：

- `/sitemap.xml`：首页 + 全部在售店铺（`listActiveProviders` 分页读取，内存缓存 5 分钟，`SITEMAP_CACHE_MS`）；链读失败时仅含首页，不报错。
- `/robots.txt`：`Allow: /` + 绝对 Sitemap URL。
- `/share/{id}.svg`：店铺分享卡（`buildShareSvg`：店名 + logo + 简介 + 品牌水印），og:image 指向它；1h 缓存（`CARD_CACHE_MS`）；店铺不存在回退品牌图 `og-brand.svg`。带 `Access-Control-Allow-Origin: *`。

> 旧 `services/share-server/`（独立 Bun 项目）已不再部署：其 `/share/{id}.html` 独立 SEO 内容页被弃用（收录页 = 访问页，SSR 直接出内容），其余端点如上并入 runner。

- **端点**：`/share/{id}.html`（SEO 内容页 + og/twitter meta + JSON-LD + 实质内容）、`/share/{id}.svg`（1200×630 分享卡，logo base64 内联）、`/sitemap.xml`、`/robots.txt`、`/health`。
- **为什么 SSR 而非预渲染**：店铺 ID 链上动态产生，构建期预渲染覆盖不到。首次被抓取时才生成，内存缓存 + CDN 缓存，数据永远最新。
- **架构**：阿里云 CDN（SSL/加速/缓存）→ 回源到 share-server（ECS）→ TEE `/gql`。CDN 扛流量，服务只在缓存未命中时生成——高性能低占用的来源。
- **无 Hono 依赖**：手写路由（`Bun.serve({ fetch })`）。minishop 的传递依赖 `hono` 是残缺包，已避免。
- **兜底**：店铺不存在/读取失败 → 带品牌 meta 的兜底页，社交分享不显示空白。

## CDN 路由（关键）

- app 的 HTML 收录页（`/`、`/:id`、`/models/:id`、`/open`，即 clean URL 路径）+ SEO 端点（`/sitemap.xml`、`/robots.txt`、`/share/{id}.svg`）→ 回源到 **app SSR**（`src/ssr/runner.ts`），由它 SSR + 注入 hydration 入口 / 出 SEO 资源。
- 其余静态资源（app 的 JS/CSS/图片）→ 回源到 OSS / 另一源站。
- 按 URL 前缀在 CDN 配置不同回源；HTTPS 由 CDN 终止。
- ⚠️ nginx/CDN 需 `try_files $uri $uri/ /<ssr-entry>` 兜底，否则 SPA 深度链接刷新会 404（app SSR 与 clean URL 的前提）。

## 本地开发

```bash
# dApp
cd apps/minishop
cp .env.development .env          # 或 .env.test
bun install || npm install        # 前端依赖
npm run dev                       # :5175

# share-server（独立）
cd apps/minishop/services/share-server
cp .env.example .env              # 填 TEE_API_BASE / SITE_URL
bun install
bun run dev                       # :3000
bun run test:http                 # 端到端验证全部路由

# 应用 SSR runner（先两个构建）
npm run build                     # 客户端 → dist/ + manifest
npx vite build --mode ssr   # SSR 包 → dist-ssr/（TEE 地址读 .env.ssr）
SITE_URL=https://yourdomain.com DEFAULT_LOCALE=en bun run src/ssr/runner.ts   # :3000（或自定义 PORT）
```

## 部署

- **share-server**：Docker 多阶段构建（`bun build --target bun` → 0.72MB 单文件）。部署步骤见 `services/share-server/DEPLOYMENT.md`。
- **dApp**：`npm run build` → 静态资源托管（nginx/OSS）。
- **app SSR（Bun）**：`dist-ssr/server.js` 用 Bun 运行（`bun run src/ssr/runner.ts`）。
- **app SSR（Docker）**：`docker build -f minishop/Dockerfile.ssr -t minishop-ssr:latest apps/`（**context = `apps/`**，因 `@wetee/web3auth` 是 `file:../web3auth` 本地依赖；`.env.ssr` 随 `minishop/` 拷入镜像注入 TEE 地址；运行时 `node:20` + `bun`，约 1.8GB）。运行：`docker run -p 3000:3000 -e SITE_URL=... -e DEFAULT_LOCALE=en -e TEE_TIMEOUT_MS=15000 minishop-ssr:latest`。与 share-server、OSS 静态资源一起放在 ECS/CDN 后，按 URL 前缀回源（见上）。

## 脚本

### Shell 脚本（`hack/`）

| 脚本 | 用途 | 用法 |
|------|------|------|
| `hack/deploy-test-oss.sh` | ⚠️ 构建 test 前端并**强制覆盖上传** `dist/` 到 `oss://compute-flux-test/shops`（`-f --recursive`，同前缀旧文件被覆盖，不删除远端多余文件） | `./hack/deploy-test-oss.sh`（参数 `[env]` 仅支持 `test`，其他值直接报错退出） |
| `hack/deploy-test.sh` | ⚠️ 构建客户端 + SSR 包，打包后 `scp` 到 test ECS，并**覆盖远端 `/etc/systemd/system/minishop-ssr.service`、重启 `minishop-ssr` 服务** | `./hack/deploy-test.sh`；改站点地址：`SITE_URL=https://xxx/shops/ ./hack/deploy-test.sh` |

要点：
- 两个脚本都会先 `cd` 到项目根（`hack/../`），在任意目录执行均可，但依赖项目根下的 `.env.test` / `.env.ssr-test`。
- `deploy-test-oss.sh` 流程：`npm run build:test` → `ossutil64 -c ./hack/.config -f --recursive cp dist/ oss://compute-flux-test/shops`。前置：本机有 `npm` 与 `ossutil64`；`hack/.config` 内含明文 OSS 凭证（`endpoint` + accessKey），**勿外传、勿再复制到别处**。
- `deploy-test.sh` 流程：`bun run build:test` → `bun run build:ssr:test` → 打包 `dist-ssr/` + `dist/` + `public/contract/gateway.json` + `src/ssr/runner.ts` 为 `/tmp/minishop-ssr.tar.gz` → `scp` → 远端解压到 `$REMOTE_DIR`、按需装 bun、写 systemd 单元、`systemctl restart`。前置：本机有 `bun`；`ssh`/`scp` 免密登录 `computefluxtest`；远端 root 可写 `/etc/systemd/system` 且可执行 `systemctl`。
- `deploy-test.sh` 可覆盖的环境变量：`ECS_HOST`（默认 `computefluxtest`）、`REMOTE_DIR`（默认 `/srv/minishop-ssr`）、`SSR_PORT`（默认 `3001`，3000 留给 share-server）、`SITE_URL`（默认 `http://shop.computeflux.ai`，必须以 `http://`/`https://` 开头，脚本据它拆出 origin 与 `BASE_PREFIX`）。
- 部署顺序：先 `deploy-test.sh`（SSR runner 已自带 client `dist/`），再按需 `deploy-test-oss.sh`（CDN 走 OSS 静态加速层时）。
- 服务已运行时 `systemctl enable --now` 不会重启进程，脚本用 `restart` 确保新 bundle 生效；脚本末尾用 `curl http://127.0.0.1:$SSR_PORT/health` + 首页 meta 做健康检查。

### npm scripts（定义见 `package.json`）

| 命令 | 用途 |
|------|------|
| `npm run dev` | `vite` 开发服务器 :5175 |
| `npm run build` | `tsc -b` + `vite build` → `dist/`（默认 mode，读 `.env`/`.env.production`） |
| `npm run build:test` | 同上但 `--mode test`（读 `.env.test`：test TEE + `VITE_BASE` 前缀） |
| `npm run build:ssr` | `vite build --mode ssr` → `dist-ssr/`（读 `.env.ssr`，TEE 地址构建期 baked） |
| `npm run build:ssr:test` | `vite build --mode ssr-test` → `dist-ssr/`（读 `.env.ssr-test`） |
| `npm run lint` | `eslint .` |
| `npm run preview` | `vite preview` 本地预览 `dist/` |

要点：
- 没有 `test` 脚本；验证靠 `npm run build` / `npm run build:ssr` + 手工跑 runner。
- `build:test` / `build:ssr:test` 依赖仓库内已有的 `.env.test` / `.env.ssr-test`，缺失时按 Vite 默认规则退化为无 test 配置（`VITE_BASE` 不再有前缀）。
- `deploy-test.sh` 里用的是 `bun run build:*`（Bun 也能执行 npm scripts），本地用 `npm run` 等价；注意只有 `build` / `build:test` 带 `tsc -b` 类型检查，两个 SSR 构建（`build:ssr` / `build:ssr:test`）是纯 `vite build`。

### share-server npm scripts（独立 Bun 子服务，目录 `services/share-server`）

定义见 `services/share-server/package.json`，**必须在 `services/share-server` 目录内执行**：

| 命令 | 用途 |
|------|------|
| `bun run dev` | `bun run --watch src/server.ts` 热重载，默认 :3000 |
| `bun run start` | `bun run src/server.ts` 前台启动（默认 :3000） |
| `bun run build` | `bun build src/server.ts --target node --outdir dist --minify` |
| `bun run test:chain` | `bun run test-chain.ts`：直连 TEE `contractDryRun` 验证链上读取 + SCALE 解码 |
| `bun run test:list` | `bun run test-list.ts`：验证店铺列表 / 模型解码 |

要点：
- 前置：`bun install`（服务自带 `node_modules`）、`cp .env.example .env` 并填 `TEE_API_BASE`（必填）。两个 `test:*` 脚本读 `TEE_API_BASE`，**未设置时回落到脚本内置的 `https://xiaobai.asyou.me:30118`**，且会读取 `../../public/contract/gateway.json` 与 `../../src/contracts/tee/decoder.ts`（依赖 minishop 主项目文件，不能单独拷走目录运行）。
- 目录里还有 `test-http.ts`（全路由端到端，不绑端口直调 `fetchHandler`），但 `package.json` **没有** `test:http` 脚本 —— 需要跑时用 `bun run test-http.ts`（minishop 本文件「本地开发」里的 `bun run test:http` 写法会找不到脚本）。
- 该服务已不部署维护（sitemap / robots / 分享卡已并入 app SSR），仅保留参考；其 `build` 用的是 `--target node`，与根 `AGENTS.md` 里写的 `--target bun` 不一致，以 `package.json` 为准。

## 约定 / 注意

- ⚠️ **独立登录红线：minishop 不接统一登录（SSO）**：minishop 是独立程序，完全不需要（也禁止）通过 core-ui 枢纽（board-ops :5181 `/login`）登录——根 `AGENTS.md` 的「统一登录 / 枢纽 SSO」设计**不适用于 minishop**。登录 / 钱包一律走自带 `@wetee/web3auth/react`（`Web3AuthProvider` 本地弹窗；`VITE_AUTH_BACKEND_URL` / `VITE_GOOGLE_CLIENT_ID` 由 .env 注入），登录链路完全自包含（不依赖任何枢纽）。**禁止**改用 `@wetee/web3auth/remote`（`RemoteWalletProvider` / `SsoGate` / `consumeSsoOnBoot` / `redirectToLogin`——会跳枢纽登录页，钱包会话也依赖枢纽 SSO 写入）。此误改曾由 evolve 链引入（commit `d81b844`，已还原）——自动进化 / 重构不得再引入。
- ⚠️ **前端已是 `BrowserRouter`（clean URL）：`App.tsx` 的 `App()` 为 router-agnostic（路由器由入口提供——客户端 `main.tsx` 用 `BrowserRouter`，SSR `server.tsx` 用 `StaticRouter`）。生产需 nginx/CDN `try_files` 兜底。
- ⚠️ **ABI 会随合约重建更新**：改合约后需重拷 `minishop/public/contract/gateway.json` 到 `services/share-server/data/` 再重建 share-server 镜像；app SSR 构建期 baked `VITE_API_BASE_URL`，TEE 地址变更需重建 SSR 包。
- 前端 `useMeta`（`src/hooks/`）做页面级动态 meta（给会跑 JS 的爬虫）；应用 SSR（`src/ssr/server.tsx` 的 `computeMeta` + `metaTags`）做服务端可抓取的 meta（给微信/TG/X 服务器端抓取）——收录页即访问页，一套 SSR 覆盖两者。
- 改任何部分后优先跑对应 lint/build/test：前端 `npm run build`，share-server `bun run test:*` + `bun build --target bun`。
