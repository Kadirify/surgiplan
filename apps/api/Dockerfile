FROM node:18.12-bullseye-slim AS build
RUN corepack enable && corepack prepare pnpm@7.18.2 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @surgiplan/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @surgiplan/shared build \
 && pnpm --filter @surgiplan/api exec prisma generate \
 && pnpm --filter @surgiplan/api build \
 && pnpm --filter @surgiplan/api exec tsc prisma/seed.ts --outDir dist-seed --module commonjs --target es2021 --esModuleInterop --skipLibCheck \
 && pnpm deploy --filter @surgiplan/api --prod /out \
 && cp -r apps/api/dist /out/dist \
 && cp -r apps/api/dist-seed /out/dist-seed \
 && cp -r apps/api/prisma /out/prisma \
 && cd /out && npx --no-install prisma generate

FROM node:18.12-bullseye-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --chown=node:node apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "./docker-entrypoint.sh"]
