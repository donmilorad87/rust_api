# Frontend Build Guide

## The Sandbox Issue

When running `npm run build` commands directly from the host system, you may encounter this error:
```
bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
```

This is a sandbox restriction that prevents npm/vite from setting up network interfaces.

## Solution: Build Inside Docker

All frontend builds should be run inside the Docker container where there are no sandbox restrictions.

### Option 1: Use the Helper Script (Recommended)

```bash
# Build all frontend pages (production mode)
./build-frontend.sh all

# Build all frontend pages (development mode)
./build-frontend.sh all dev

# Build specific page (production mode)
./build-frontend.sh GALLERIES
./build-frontend.sh PROFILE
./build-frontend.sh GLOBAL

# Build specific page (development mode)
./build-frontend.sh GALLERIES dev
```

### Option 2: Manual Docker Command

```bash
# Build GALLERIES page (production)
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/GALLERIES && npm run build"

# Build GALLERIES page (development)
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/GALLERIES && npm run build:dev"

# Build PROFILE page
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/PROFILE && npm run build"

# Build GLOBAL styles
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/GLOBAL && npm run build"
```

## Frontend Page Structure

Each frontend page is located at:
```
blazing_sun/src/frontend/pages/{PAGE_NAME}/
```

Available pages:
- **GALLERIES** - Gallery management interface
- **PROFILE** - User profile page
- **UPLOADS** - File upload management
- **REGISTERED_USERS** - User list (admin)
- **THEME** - Theme configuration (admin)
- **SIGN_IN** - Sign in page
- **SIGN_UP** - Sign up page
- **FORGOT_PASSWORD** - Password reset page
- **GLOBAL** - Global styles and navigation

## Build Output

Built files are placed in:
```
blazing_sun/src/resources/css/{PAGE_NAME}/style.css
blazing_sun/src/resources/js/{PAGE_NAME}/app.js
```

## Development Workflow

1. Make changes to source files in `src/frontend/pages/{PAGE_NAME}/src/`
2. Run build command using helper script or Docker exec
3. Refresh browser to see changes (or use dev mode with watch)

## Watch Mode (Development)

For continuous building during development:

```bash
# Inside Docker container
docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/GALLERIES && npm run dev"
```

This will watch for file changes and rebuild automatically.

## Adding New Pages

1. Create directory structure:
   ```
   src/frontend/pages/NEW_PAGE/
   ├── package.json
   ├── vite.config.js
   └── src/
       ├── main.js
       └── styles/
           └── main.scss
   ```

2. Copy package.json and vite.config.js from existing page
3. Update paths in vite.config.js
4. Run `docker compose exec rust bash -c "cd /home/rust/blazing_sun/src/frontend/pages/NEW_PAGE && npm install"`
5. Build using helper script: `./build-frontend.sh NEW_PAGE`

## Troubleshooting

**Error: "bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted"**
- Solution: Always run builds inside Docker container using the helper script or docker compose exec

**Error: "No such file or directory"**
- Check that you're using the correct container path: `/home/rust/blazing_sun/src/frontend/pages/{PAGE_NAME}`

**Build succeeds but changes don't appear**
- Clear browser cache (Ctrl+Shift+R)
- Check that you rebuilt the correct page
- Verify the output files were updated in `src/resources/`

**npm command not found**
- Ensure Node.js is installed in the rust container
- Run `docker compose exec rust node --version` to verify
