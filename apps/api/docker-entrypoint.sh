#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  npx --no-install prisma migrate deploy
fi

if [ "$SEED_DEMO_DATA" = "true" ]; then
  node dist-seed/seed.js
fi

exec node dist/main.js
