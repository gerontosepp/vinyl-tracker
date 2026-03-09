/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Vinyl Tracker',
        short_name: 'VinylTracker',
        description: 'Track your vinyl collection and listening habits',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/setupTests.ts',
        'src/vite-env.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
  server: {
    host: true,
    https:
      fs.existsSync('./certs/key.pem') && fs.existsSync('./certs/cert.pem')
        ? {
          key: fs.readFileSync('./certs/key.pem'),
          cert: fs.readFileSync('./certs/cert.pem'),
        }
        : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.error(`[API Error] ${req.method} ${req.url} - Error: ${err.message}`);
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            (req as any).startTime = Date.now();
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            const start = (req as any).startTime;
            const duration = start ? Date.now() - start : 0;
            const status = proxyRes.statusCode;
            if (status && status >= 400) {
              console.error(
                `[API Error] ${req.method} ${req.url} - Status: ${status} - Time: ${duration}ms - Error: HTTP Error ${status}`
              );
            } else {
              console.info(
                `[API Info] ${req.method} ${req.url} - Status: ${status} - Time: ${duration}ms`
              );
            }
          });
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
