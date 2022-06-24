# 1. TypeScript monorepo with a shared domain package

## Context

The scheduling rules (roles, permissions, surgery status transitions, checklist items) are needed by both the API and the UI. When they live in two places they drift: the UI offers a button the API then rejects, or a new status shows up as a raw code in a table.

## Decision

One pnpm workspace with three packages:

- `apps/api` — NestJS + Prisma
- `apps/web` — React + Vite
- `packages/shared` — plain TypeScript: roles, permission map, status machine, checklist template, time-zone constants

The UI asks the API which transitions are allowed for the current user (`allowedTransitions` on the surgery detail) but renders labels and colours from the shared package, so both sides read the same table.

## Consequences

- A rule change is one edit and both apps fail to compile if they disagree.
- The shared package must stay free of runtime dependencies so it works in Node and the browser.
- The API consumes the compiled CommonJS build; Vite aliases the TypeScript source directly, which keeps hot reload fast.
