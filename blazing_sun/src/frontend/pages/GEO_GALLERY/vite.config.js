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
          app: resolve(__dirname, 'src/main.js')
        },
        output: {
          format: 'iife',
          entryFileNames: 'js/GEO_GALLERY/app.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'css/GEO_GALLERY/style.css';
            }
            return 'assets/[name].[ext]';
          }
        }
      }
    },
    css: {
      devSourcemap: isDev,
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          charset: false
        }
      }
    }
  };
});
