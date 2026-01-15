import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    build: {
      outDir: resolve(__dirname, '../../../resources'),
      emptyOutDir: false,
      sourcemap: isDev,
      minify: !isDev,
      cssCodeSplit: false,
      rollupOptions: {
        input: {
          app: resolve(__dirname, 'src/main.js'),
        },
        output: {
          format: 'iife',
          entryFileNames: 'js/games/BIGGER_DICE/app.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'css/games/BIGGER_DICE/style.css';
            }
            return 'assets/games/BIGGER_DICE/[name].[ext]';
          },
        },
      },
    },
    css: {
      devSourcemap: isDev,
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          charset: false,
        },
      },
    },
  };
});
