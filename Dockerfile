# Production image for the API only (the Web app is a static build - see
# docs/deployment.md). PostgreSQL is external: pass DATABASE_URL at run time.
# No secrets are baked in; everything is configured via environment variables.

# ---- build: compile TypeScript (shared package first, then the API) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --workspace=apps/api --workspace=packages/shared
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace=packages/shared && npm run build --workspace=apps/api

# ---- runtime: production dependencies + compiled output only ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --omit=dev --workspace=apps/api --workspace=packages/shared && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
# Migrations ship with the image so the same image can run `npm run migrate:up`.
COPY apps/api/migrations apps/api/migrations

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--conditions=healthy-eating-runtime", "apps/api/dist/index.js"]
