import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Use IPv4 explicitly so multipart uploads do not depend on how
      // `localhost` is resolved by the Node/Vite process.
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000
      }
    }
  }
});
