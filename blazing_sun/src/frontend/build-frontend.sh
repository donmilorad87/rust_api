#!/bin/bash
# Frontend build helper script
# Runs npm builds inside Docker container to avoid sandbox issues
#
# Usage: ./build-frontend.sh [target] [mode]
#
#   target:
#     - "all"           : Build all pages AND games
#     - "pages"         : Build all pages only
#     - "games"         : Build all games only
#     - PAGE_NAME       : Build specific page (e.g., PROFILE, GALLERIES, GLOBAL)
#     - game:GAME_NAME  : Build specific game (e.g., game:BIGGER_DICE)
#
#   mode: dev or prod (default: prod)
#
# Examples:
#   ./build-frontend.sh all prod          # Build everything for production
#   ./build-frontend.sh pages dev         # Build all pages in dev mode
#   ./build-frontend.sh games prod        # Build all games for production
#   ./build-frontend.sh PROFILE prod      # Build only PROFILE page
#   ./build-frontend.sh game:BIGGER_DICE  # Build only BIGGER_DICE game
#
# Available pages: BALANCE, COMPETITIONS, FORGOT_PASSWORD, GALLERIES, GEO_GALLERIES,
#                  GLOBAL, OAUTH_APPLICATIONS, OAUTH_CONSENT, PROFILE,
#                  REGISTERED_USERS, SIGN_IN, SIGN_UP, THEME, UPLOADS, GAMES
#
# Available games: BIGGER_DICE

TARGET="${1:-all}"
MODE="${2:-prod}"

# Base paths inside container
CONTAINER_PAGES_BASE="/home/rust/blazing_sun/src/frontend/pages"
CONTAINER_GAMES_BASE="/home/rust/blazing_sun/src/frontend/games"

# .env file location (for ASSETS_VERSION)
ENV_FILE="/home/milner/Desktop/rust/blazing_sun/.env"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to increment ASSETS_VERSION in .env file
increment_assets_version() {
  echo -e "${BLUE}[VERSION]${NC} Incrementing ASSETS_VERSION..."

  if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ .env file not found at $ENV_FILE${NC}"
    return 1
  fi

  # Read current version
  CURRENT_VERSION=$(grep -E "^ASSETS_VERSION=" "$ENV_FILE" | cut -d'=' -f2)

  if [ -z "$CURRENT_VERSION" ]; then
    echo -e "${RED}✗ ASSETS_VERSION not found in .env${NC}"
    return 1
  fi

  # Parse version components (MAJOR.MINOR.PATCH)
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

  # Increment patch version
  NEW_PATCH=$((PATCH + 1))
  NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

  # Update .env file
  sed -i "s/^ASSETS_VERSION=.*/ASSETS_VERSION=$NEW_VERSION/" "$ENV_FILE"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ASSETS_VERSION updated: $CURRENT_VERSION → $NEW_VERSION${NC}"
    return 0
  else
    echo -e "${RED}✗ Failed to update ASSETS_VERSION${NC}"
    return 1
  fi
}

# Function to update dependencies for a project
update_project() {
  local project_path=$1
  local project_name=$2
  local project_type=$3  # "page" or "game"

  echo -e "${BLUE}[$project_type]${NC} Updating dependencies for $project_name..."

  docker compose exec rust bash -c "cd $project_path && ncu -u" 2>/dev/null
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠ ncu not available or failed for $project_name (continuing)${NC}"
  fi

  docker compose exec rust bash -c "cd $project_path && npm install"
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $project_name dependencies installed${NC}"
  else
    echo -e "${RED}✗ Failed to install dependencies for $project_name${NC}"
    return 1
  fi
}

# Function to build a single project
build_project() {
  local project_path=$1
  local project_name=$2
  local build_mode=$3
  local project_type=$4  # "page" or "game"

  echo -e "${BLUE}[$project_type]${NC} Building $project_name in $build_mode mode..."

  if [ "$build_mode" = "dev" ]; then
    docker compose exec rust bash -c "cd $project_path && npm run build:dev"
  else
    docker compose exec rust bash -c "cd $project_path && npm run build:prod"
  fi

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $project_name built successfully${NC}"
    return 0
  else
    echo -e "${RED}✗ Failed to build $project_name${NC}"
    return 1
  fi
}

# Function to build all projects in a directory
build_all_in_dir() {
  local base_path=$1
  local project_type=$2  # "page" or "game"
  local build_mode=$3

  echo -e "${BLUE}[BUILD]${NC} Building all ${project_type}s..."

  # Get list of all directories
  PROJECTS=$(docker compose exec rust bash -c "ls $base_path 2>/dev/null" | tr -d '\r')

  if [ -z "$PROJECTS" ]; then
    echo -e "${YELLOW}⚠ No ${project_type}s found in $base_path${NC}"
    return 0
  fi

  local built_count=0

  for project in $PROJECTS; do
    # Check if package.json exists (it's a buildable project)
    HAS_PACKAGE=$(docker compose exec rust bash -c "test -f $base_path/$project/package.json && echo 'yes' || echo 'no'" | tr -d '\r')

    if [ "$HAS_PACKAGE" = "yes" ]; then
      update_project "$base_path/$project" "$project" "$project_type" || exit 1
      build_project "$base_path/$project" "$project" "$build_mode" "$project_type" || exit 1
      built_count=$((built_count + 1))
    fi
  done

  echo -e "${GREEN}✓ Built $built_count ${project_type}(s)${NC}"
}

# Install npm-check-updates globally (for dependency updates)
install_ncu() {
  echo -e "${BLUE}[SETUP]${NC} Installing npm-check-updates..."
  docker compose exec rust bash -c "npm install -g npm-check-updates" 2>/dev/null
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠ npm-check-updates installation failed (optional)${NC}"
  fi
}

# Track if any builds happened (for version increment)
BUILDS_HAPPENED=0

# Main logic based on target
case "$TARGET" in
  "all")
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Building ALL frontend projects${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    install_ncu
    build_all_in_dir "$CONTAINER_PAGES_BASE" "page" "$MODE"
    build_all_in_dir "$CONTAINER_GAMES_BASE" "game" "$MODE"
    BUILDS_HAPPENED=1
    echo ""
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}  All frontend projects built!${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    ;;

  "pages")
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Building all PAGES${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    install_ncu
    build_all_in_dir "$CONTAINER_PAGES_BASE" "page" "$MODE"
    BUILDS_HAPPENED=1
    echo ""
    echo -e "${GREEN}✓ All pages built successfully!${NC}"
    ;;

  "games")
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Building all GAMES${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    install_ncu
    build_all_in_dir "$CONTAINER_GAMES_BASE" "game" "$MODE"
    BUILDS_HAPPENED=1
    echo ""
    echo -e "${GREEN}✓ All games built successfully!${NC}"
    ;;

  game:*)
    # Build specific game (e.g., game:BIGGER_DICE)
    GAME_NAME="${TARGET#game:}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Building game: $GAME_NAME${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"

    # Check if game exists
    GAME_EXISTS=$(docker compose exec rust bash -c "test -f $CONTAINER_GAMES_BASE/$GAME_NAME/package.json && echo 'yes' || echo 'no'" | tr -d '\r')

    if [ "$GAME_EXISTS" = "yes" ]; then
      install_ncu
      update_project "$CONTAINER_GAMES_BASE/$GAME_NAME" "$GAME_NAME" "game"
      build_project "$CONTAINER_GAMES_BASE/$GAME_NAME" "$GAME_NAME" "$MODE" "game"
      BUILDS_HAPPENED=1
    else
      echo -e "${RED}✗ Game '$GAME_NAME' not found at $CONTAINER_GAMES_BASE/$GAME_NAME${NC}"
      echo -e "${YELLOW}Available games:${NC}"
      docker compose exec rust bash -c "ls $CONTAINER_GAMES_BASE 2>/dev/null" | tr -d '\r'
      exit 1
    fi
    ;;

  *)
    # Assume it's a page name (e.g., PROFILE, GALLERIES)
    PAGE_NAME="$TARGET"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Building page: $PAGE_NAME${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"

    # Check if page exists
    PAGE_EXISTS=$(docker compose exec rust bash -c "test -f $CONTAINER_PAGES_BASE/$PAGE_NAME/package.json && echo 'yes' || echo 'no'" | tr -d '\r')

    if [ "$PAGE_EXISTS" = "yes" ]; then
      install_ncu
      update_project "$CONTAINER_PAGES_BASE/$PAGE_NAME" "$PAGE_NAME" "page"
      build_project "$CONTAINER_PAGES_BASE/$PAGE_NAME" "$PAGE_NAME" "$MODE" "page"
      BUILDS_HAPPENED=1
    else
      echo -e "${RED}✗ Page '$PAGE_NAME' not found at $CONTAINER_PAGES_BASE/$PAGE_NAME${NC}"
      echo -e "${YELLOW}Available pages:${NC}"
      docker compose exec rust bash -c "ls $CONTAINER_PAGES_BASE 2>/dev/null" | tr -d '\r'
      echo ""
      echo -e "${YELLOW}To build a game, use: game:GAME_NAME (e.g., game:BIGGER_DICE)${NC}"
      exit 1
    fi
    ;;
esac

# Increment ASSETS_VERSION after successful builds
if [ "$BUILDS_HAPPENED" -eq 1 ]; then
  echo ""
  increment_assets_version
  echo ""
  echo -e "${YELLOW}⚠ Remember to restart Docker to apply new ASSETS_VERSION:${NC}"
  echo -e "  ${BLUE}docker compose restart rust${NC}"
fi
