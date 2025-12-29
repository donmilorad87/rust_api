import { defineConfig } from 'vite';
import { resolve } from 'path';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    build: {
      outDir: resolve(__dirname, '../../../resources'),
      emptyOutDir: false,
      sourcemap: isDev,
      minify: !isDev,
      rollupOptions: {
        input: {
          app: resolve(__dirname, 'src/main.js'),
        },
        output: {
          entryFileNames: 'js/SIGN_UP/app.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'css/SIGN_UP/style.css';
            }
            return 'assets/[name].[ext]';
          },
        },
      },
    },
    css: {
      devSourcemap: isDev,
    },
  };
});
