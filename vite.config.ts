import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            target: 'node22',
            outDir: 'dist-electron',
            minify: false,
            ssr: true,
            rollupOptions: {
              external: ['better-sqlite3', 'electron-log', 'electron-updater', 'electron', 'futu-api'],
              output: {
                format: 'cjs',
                entryFileNames: 'main.cjs',
              },
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            target: 'node22',
            outDir: 'dist-electron',
            ssr: true,
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // React ecosystem → vendor-react
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
            return 'vendor-react';
          }
          // Charts (echarts, echarts-for-react) → vendor-charts
          if (id.includes('/echarts/') || id.includes('/zrender/')) {
            return 'vendor-charts';
          }
          // TradingView lightweight-charts → vendor-charts
          if (id.includes('/lightweight-charts/')) {
            return 'vendor-charts';
          }
          // i18n → vendor-i18n
          if (id.includes('/i18next/') || id.includes('/react-i18next/')) {
            return 'vendor-i18n';
          }
          // Zustand + other small state/utils → vendor-utils
          if (id.includes('/zustand/') || id.includes('/immer/') || id.includes('/lodash') || id.includes('/date-fns/')) {
            return 'vendor-utils';
          }
          // All other node_modules → vendor-misc
          return 'vendor-misc';
        },
      },
    },
  },
});
