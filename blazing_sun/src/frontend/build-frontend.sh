#!/bin/bash
# Frontend build helper script
# Runs npm builds inside Docker container to avoid sandbox issues
# Usage: ./build-frontend.sh [page-name] [mode]
#   page-name: GALLERIES, PROFILE, GLOBAL, etc. (or "all" for all pages)
#   mode: dev or prod (default: prod)

PAGE="${1:-all}"
MODE="${2:-prod}"

# Base path inside container
CONTAINER_BASE="/home/rust/blazing_sun/src/frontend/pages"

# Function to build a single page
build_page() {
  local page_name=$1
  local build_mode=$2

  echo "Building $page_name in $build_mode mode..."

  if [ "$build_mode" = "dev" ]; then
    docker compose exec rust bash -c "cd $CONTAINER_BASE/$page_name && npm run build:dev"
  else
    docker compose exec rust bash -c "cd $CONTAINER_BASE/$page_name && npm run build:prod"
  fi

  if [ $? -eq 0 ]; then
    echo "✓ $page_name built successfully"
  else
    echo "✗ Failed to build $page_name"
    return 1
  fi
}

# Build all pages or specific page
if [ "$PAGE" = "all" ]; then
  echo "Building all frontend pages..."

  # Get list of all page directories
  PAGES=$(docker compose exec rust bash -c "ls $CONTAINER_BASE" | tr -d '\r')

  for page in $PAGES; do
    # Check if package.json exists (it's a buildable page)
    HAS_PACKAGE=$(docker compose exec rust bash -c "test -f $CONTAINER_BASE/$page/package.json && echo 'yes' || echo 'no'" | tr -d '\r')

    if [ "$HAS_PACKAGE" = "yes" ]; then
      build_page "$page" "$MODE"
    fi
  done

  echo ""
  echo "All pages built successfully!"
else
  build_page "$PAGE" "$MODE"
fi
