# Milestone 1: Project Foundation

Scope of this milestone:

- npm workspaces monorepo (`apps/web`, `apps/api`, `packages/shared`)
- Minimal React + TypeScript web app (Vite), no UI framework
- Minimal Express + TypeScript API with a single `GET /health` endpoint
- Shared TypeScript package exporting `APP_NAME`
- Strict TypeScript configuration across all packages

Out of scope (future milestones): authentication, database/ORM, user profiles,
nutrition calculations, meal tracking, photo upload, AI integrations, shopping
lists, mobile app, Docker, CI/CD. See [AGENTS.md](../AGENTS.md) for the rules
that enforce this boundary.
