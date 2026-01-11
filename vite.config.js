import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/cetus': {
        target: 'https://api-sui.cetus.zone',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cetus/, ''),
        secure: true,
      },
      '/api/momentum': {
        target: 'https://api.mmt.finance',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/momentum/, ''),
        secure: true,
      },
      '/api/bluefin': {
        target: 'https://swap.api.sui-prod.bluefin.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bluefin/, ''),
        secure: true,
      },
    },
  },
});
