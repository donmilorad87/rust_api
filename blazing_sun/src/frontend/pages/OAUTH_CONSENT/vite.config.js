import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
    build: {
        outDir: resolve(__dirname, '../../../resources'),
        emptyOutDir: false,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/main.js'),
            },
            output: {
                entryFileNames: 'js/OAUTH_CONSENT/app.js',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name && assetInfo.name.endsWith('.css')) {
                        return 'css/OAUTH_CONSENT/style.css';
                    }
                    return 'assets/[name].[ext]';
                },
            },
        },
        minify: mode === 'production' ? 'esbuild' : false,
        sourcemap: mode === 'development',
    },
}));
