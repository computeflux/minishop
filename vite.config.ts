import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// 开发环境 /share/{id}.svg 用的最小分享卡生成器（避免把 app 代码引入 node 工程）。
function devShareSvg(storeId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0b0b0d" />
  <rect x="40" y="40" width="72" height="72" rx="16" fill="#ffffff" />
  <text x="76" y="92" text-anchor="middle" font-size="44" font-weight="700" fill="#000">M</text>
  <text x="136" y="180" font-size="56" font-weight="700" fill="#ffffff">Shop #${storeId}</text>
  <text x="136" y="240" font-size="28" fill="#ffffff" opacity="0.5">算力小铺 · 分享预览卡（开发占位，生产端点将读取链上店铺数据）</text>
  <text x="136" y="560" font-size="30" font-weight="600" fill="#ffffff" letter-spacing="6" font-family="monospace">ComputeFlux Shop</text>
</svg>`;
}

export default defineConfig(({ mode }) => {
  // 部署路径前缀：如 test 环境部署在 https://xxx/shops/，则 VITE_BASE=/shops/
  const env = loadEnv(mode, process.cwd());
  // ssr / ssr-test（test 环境 SSR 包，读 .env.ssr-test：test TEE + VITE_BASE 前缀）
  const isSSR = mode.startsWith("ssr");

  const common = {
    base: env.VITE_BASE ?? "/",
    plugins: [
      react(),
      // 开发环境：/share/{id}.svg 返回一张 Open Graph 分享卡，
      // 让 og:image 在本地可解析。生产环境需由能读取链上店铺数据的端点接管（见部署说明）。
      {
        name: "minishop-share-image",
        apply: "serve",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const m = /^\/share\/(\w+)\.svg$/.exec(req.url ?? "");
            if (!m) return next();
            const storeId = m[1];
            // 开发期无链数据来源：用 id 占位，展示分享卡生成管线是否正确。
            const svg = devShareSvg(storeId);
            res.writeHead(200, {
              "Content-Type": "image/svg+xml",
              "Cache-Control": "public, max-age=3600",
              AccessControlAllowOrigin: "*",
            });
            res.end(svg);
          });
        },
      } as Plugin,
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@wetee/web3auth": path.resolve(__dirname, "../web3auth/src"),
        "@wetee/web3auth/react": path.resolve(__dirname, "../web3auth/src/react.ts"),
        // @computeflux/c2c-sdk 根导出（index.ts）无 UI 依赖（react/react-query 仅在 ./react 子路径），
        // 指向 src 目录（目录索引解析到 index.ts，且 /react 子路径可正常解析），与 @wetee/web3auth 一致。
        "@computeflux/c2c-sdk": path.resolve(__dirname, "../c2c/sdk/src"),
        viem: path.resolve(__dirname, "node_modules/viem"),
        "viem/accounts": path.resolve(__dirname, "node_modules/viem/accounts"),
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      },
      dedupe: [
        "react",
        "react-dom",
        "@polkadot/api-contract",
        "@polkadot/types",
        "@polkadot/types-codec",
        "@polkadot/util",
      ],
    },
    // 客户端构建生成 manifest，供 SSR 服务读取以精确注入入口 JS / async chunk / CSS。
    build: { manifest: true },
    define: {
      global: "globalThis",
    },
  };

  // SSR 构建：把 src/ssr/server.tsx 打成 ESM lib（dist-ssr/index.js），供 runner 导入。
  if (isSSR) {
    return {
      ...common,
      // web3auth /react 服务端不兼容（useSyncExternalStore 无 getServerSnapshot）：指向 SSR 存根。
      // 注意 alias 顺序：/react 必须在根 @wetee/web3auth 之前（避免前缀匹配落到真版）。
      resolve: {
        ...common.resolve,
        alias: {
          "@wetee/web3auth/react": path.resolve(__dirname, "./src/ssr/stubs/web3auth-react.tsx"),
          "@": path.resolve(__dirname, "./src"),
          "@wetee/web3auth": path.resolve(__dirname, "../web3auth/src"),
          // 与客户端一致：c2c-sdk 指向源码目录（SSR 分支用全新 alias 对象覆盖，需单独补齐）
          "@computeflux/c2c-sdk": path.resolve(__dirname, "../c2c/sdk/src"),
          viem: path.resolve(__dirname, "node_modules/viem"),
          "viem/accounts": path.resolve(__dirname, "node_modules/viem/accounts"),
          react: path.resolve(__dirname, "node_modules/react"),
          "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        },
      },
      // noExternal: true：Vite SSR 构建默认 external 所有 dependencies（react/react-router 等），
      // 强制全量内联，运行时镜像无需 node_modules。
      ssr: { noExternal: true },
      build: {
        outDir: "dist-ssr",
        ssr: "src/ssr/server.tsx",
        lib: {
          entry: "src/ssr/server.tsx",
          formats: ["es"],
          fileName: () => "index.js",
        },
        rollupOptions: {
          // 全量打包（含 react/react-dom 等）：运行时镜像无需 node_modules。
          // node 内建（node:fs 等）由 Vite SSR 构建自动保持 external，Bun 原生支持。
          // @polkadot 的 wasm 为惰性加载，SSR 链路（TEE dry-run + SCALE 解码）不会触发，可安全内联。
          external: [],
        },
      },
    };
  }

  return {
    ...common,
    server: {
      host: "0.0.0.0",
      port: 5175,
      hmr: true,
      fs: {
        // @computeflux/c2c-sdk 是 file: 本地链接依赖，symlink 解析到真实路径 apps/c2c/sdk，
        // 不在默认 allow 列表内，dev server 会 403（outside of Vite serving allow list）。
        // 与 @wetee/web3auth 同理，显式加白名单。
        allow: [
          path.resolve(__dirname),
          path.resolve(__dirname, "../web3auth"),
          path.resolve(__dirname, "../c2c/sdk"),
        ],
      },
    },
  };
});
