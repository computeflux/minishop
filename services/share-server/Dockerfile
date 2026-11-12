# share-server：Bun + Hono 的 SEO / 社交分享 SSR 服务
# 构建：docker build -t minishop-share-server .  （构建上下文 = services/share-server）
FROM bun:latest AS base
WORKDIR /app
COPY package.json ./
RUN bun install

FROM bun:latest AS build
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY . .
RUN bun build src/server.ts --target node --outdir dist --minify

FROM bun:latest
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
ENV GATEWAY_ABI_PATH=/app/data/gateway.json \
    PORT=3000
EXPOSE 3000
CMD ["bun", "run", "dist/server.js"]
