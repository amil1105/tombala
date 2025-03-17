import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Tarayıcı ortamında değişkenleri tanımla
  define: {
    // Node.js process objesine erişimi sağla
    global: {},
    // Tarayıcıda ortam değişkenlerini window.__VITE_ENV__ üzerinden eriş
    'window.__VITE_ENV__': {
      VITE_API_URL: JSON.stringify(process.env.API_URL || 'http://localhost:5000'),
      VITE_SOCKET_URL: JSON.stringify(process.env.SOCKET_URL || 'http://localhost:5000'),
      VITE_NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
      VITE_REACT_API: JSON.stringify(process.env.REACT_API || 'false')
    }
  },
  // CORS sorunlarını önlemek için proxy ayarları
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
}); 