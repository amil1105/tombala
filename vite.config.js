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
            const lobbyId = urlParts[2] || '';
            
            if (lobbyId) {
              // index.html içeriğini oku
              const indexHtml = fs.readFileSync(
                resolve(__dirname, 'index.html'),
                'utf-8'
              );
              
              // lobbyId bilgisini sayfaya ekle
              const htmlWithLobby = indexHtml.replace(
                '</head>',
                `  <script>window.tombalaLobbyId = "${lobbyId}";</script>\n</head>`
              );
              
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html');
              res.end(htmlWithLobby);
              return;
            }
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
      VITE_BASE_URL: JSON.stringify('/tombala/'),
      VITE_IFRAME_MODE: JSON.stringify(true)  // iframe modu aktif
    },
    // Global değişkenleri tanımla
    __API_URL__: JSON.stringify('/api'),
    __SOCKET_URL__: JSON.stringify('http://localhost:5000')
  },
  // CORS sorunlarını önlemek için proxy ayarları
  server: {
    port: 3100,
    open: false,
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    proxy: {
      // API isteklerini backend'e yönlendir
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      // WebSocket isteklerini de yönlendir
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true
      },
      // Doğrudan endpoint isteklerini yönlendir (eski API destek için)
      '/lobbies/status': {
        target: 'http://localhost:5000/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lobbies\/status/, '/lobbies/status'),
        secure: false,
      }
    },
    // Hata ayıklama bilgilerini görüntüle
    hmr: {
      overlay: true
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