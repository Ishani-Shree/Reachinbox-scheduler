import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The dev server proxies /api to Express so the session cookie is same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
});
