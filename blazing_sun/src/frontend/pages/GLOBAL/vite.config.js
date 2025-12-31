import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, '../../../resources'),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        global: resolve(__dirname, 'src/main.js'),
      },
      output: {
        format: 'iife',
        entryFileNames: 'js/GLOBAL/app.js',
        chunkFileNames: 'js/GLOBAL/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'css/GLOBAL/style.css';
          }
          return 'assets/GLOBAL/[name][extname]';
        },
      },
    },
    cssCodeSplit: false,
    minify: 'esbuild',
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',  // Use modern Sass API (avoids deprecation warning)
        charset: false,
      },
    },
  },
});
