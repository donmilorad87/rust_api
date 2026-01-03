#!/bin/bash
# Build script that avoids sandbox issues
# Usage: ./build.sh [dev|prod]

MODE="${1:-prod}"

if [ "$MODE" = "dev" ]; then
  npm run build:dev
else
  npm run build:prod
fi
