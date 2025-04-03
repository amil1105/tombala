import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Özel rotalar için middleware
    {
      name: 'tombala-routes-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // URL sorgusunu al
          const urlPath = req.url.split('?')[0];
          
          // /direct-tombala/ rotasını yakala
          if (urlPath.startsWith('/direct-tombala/')) {
            console.log('Direct-tombala rotası yakalandı:', req.url);
            
            // URL'den lobbyId'yi çıkar
            const urlParts = urlPath.split('/');
            let lobbyId = '';
            
            if (urlParts.length > 2) {
              lobbyId = urlParts[2];
              
              // Parametreleri al
              const searchParams = req.url.includes('?') 
                ? req.url.substring(req.url.indexOf('?')) 
                : '';
              
              // lobbyId'yi query param olarak gönder
              res.writeHead(302, {
                Location: `/tombala/game/${lobbyId}${searchParams}`
              });
              res.end();
              return;
            }
          } 
          // Tombala alt rotalarını yönlendir
          else if (
            urlPath.match(/^\/tombala\/game\/[^/]+$/) || 
            urlPath.match(/^\/tombala\/[A-Z0-9]{5,8}$/) ||
            urlPath === '/tombala/game'
          ) {
            // HTML sayfasına yönlendir
            req.url = '/tombala/index.html';
          }
          
          next();
        });
      }
    }
  ],
  base: '/tombala/', // Tombala alt dizini temel yol
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tombala/common': resolve(__dirname, 'src/utils')
    },
  },
  // Tarayıcı ortamında değişkenleri tanımla
  define: {
    // Global değişkenler
    global: {},
    // Tarayıcıda ortam değişkenlerini window.__VITE_ENV__ üzerinden eriş
    'window.__VITE_ENV__': {
      VITE_API_URL: JSON.stringify(process.env.API_URL || 'http://localhost:5000'),
      VITE_SOCKET_URL: JSON.stringify(process.env.SOCKET_URL || 'http://localhost:5000'),
      VITE_NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
      VITE_BASE_URL: JSON.stringify('/tombala/')
    }
  },
  // CORS sorunlarını önlemek için proxy ayarları
  server: {
    port: 5174,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true
      },
      '/direct-tombala': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/direct-tombala/, '/tombala')
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@mui/material', '@emotion/react', '@emotion/styled'],
          utils: ['socket.io-client']
        }
      }
    },
    // Çıktı dosyalarının yapılandırması
    terserOptions: {
      compress: {
        drop_console: false // Konsol loglarını koru (geliştirme için)
      }
    }
  },
  // HTML'e eklenen meta etiketleri
  experimental: {
    renderBuiltUrl(filename) {
      return `/tombala/${filename}`;
    }
  }
}); 