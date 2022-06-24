FROM node:18.12-bullseye-slim AS build
RUN corepack enable && corepack prepare pnpm@7.18.2 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @surgiplan/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @surgiplan/web build

FROM nginx:1.23-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
