import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Polyfill Node.js core modules for browser compatibility
      // Required for Full Sail SDK which uses https.Agent
      include: ['buffer', 'https', 'http', 'stream', 'util', 'url'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // Fix Full Sail SDK entry resolution issue
      '@fullsailfinance/sdk': path.resolve(
        './node_modules/@fullsailfinance/sdk/dist/index.js'
      ),
    },
  },
  server: {
    proxy: {
      // Proxy Bluefin Spot API requests to bypass CORS
      '/api/bluefin': {
        target: 'https://swap.api.sui-prod.bluefin.io',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/bluefin/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});

