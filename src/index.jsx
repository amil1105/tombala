import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App.jsx';
import './index.css';
import apiInterceptor from './utils/apiInterceptor';

// Material UI tema yapılandırması
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7c4dff',
    },
    secondary: {
      main: '#4caf50',
    },
    background: {
      default: '#121212',
      paper: 'rgba(25, 25, 45, 0.7)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        },
      },
    },
  },
});

// API Interceptor modülü
console.log('API Interceptor modülü yüklendi, GameBoard içinde kullanılacak');

// Global API ve socket URL'lerini ayarla (proxy ayarlarıyla uyumlu)
// Farklı kaynaklardan sırayla kontrol ederek en güvenilir yapılandırmayı kullan
const setupGlobalConfig = () => {
  // Geliştirme ortamında proxy ayarlarını kullan
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // API URL ayarı
  if (!window.__API_URL__) {
    if (isLocalhost) {
      // Geliştirme ortamında (vite.config.js proxy ayarlarını kullanmak için)
      window.__API_URL__ = '/api';
    } else {
      // Prodüksiyon ortamında
      window.__API_URL__ = `https://${window.location.hostname}/api`;
    }
  }
  
  // Socket URL ayarı
  if (!window.__SOCKET_URL__) {
    if (isLocalhost) {
      // Geliştirme ortamında
      window.__SOCKET_URL__ = 'http://localhost:5000';
    } else {
      // Prodüksiyon ortamında
      window.__SOCKET_URL__ = `https://${window.location.hostname}`;
    }
  }
  
  // Environment değişkenlerini de güncelle (vite define ile enjekte edilmiş)
  if (window.__VITE_ENV__) {
    window.__VITE_ENV__.VITE_API_URL = window.__API_URL__;
    window.__VITE_ENV__.VITE_SOCKET_URL = window.__SOCKET_URL__;
  }
  
  console.log('Global API URL:', window.__API_URL__);
  console.log('Global Socket URL:', window.__SOCKET_URL__);
};

// Konfigürasyon ayarlarını uygula
setupGlobalConfig();

// URL ve postMessage parametrelerini alarak birleştir
const processParams = () => {
  try {
    console.log('index.jsx - URL ve postMessage parametreleri işleniyor...');
    
    // Önceden atanmış tombalaParams varsa kullan
    let params = window.tombalaParams || {};
    
    // URL parametrelerini analiz et
    const urlParams = new URLSearchParams(window.location.search);
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    
    // lobbyId için kontroller - URL'den
    let lobbyId = urlParams.get('lobbyId') || urlParams.get('lobby') || urlParams.get('code');
    
    // URL yolu üzerinden kontrol et (/game/LOBBYCODE gibi)
    if (!lobbyId && pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment && lastSegment !== 'game' && lastSegment !== 'tombala') {
        lobbyId = lastSegment;
        console.log('index.jsx - LobbyId URL path\'inden alındı:', lobbyId);
      }
    }
    
    // Global değişkenden kontrol et (direct-tombala middleware tarafından atanmış olabilir)
    if (!lobbyId && window.tombalaLobbyId) {
      lobbyId = window.tombalaLobbyId;
      console.log('index.jsx - LobbyId global değişkenden alındı:', lobbyId);
    }
    
    // Diğer parametreleri al - URL'den
    const playerId = urlParams.get('playerId') || params.playerId;
    const playerName = urlParams.get('playerName') || params.playerName;
    const lobbyName = urlParams.get('lobbyName') || params.lobbyName;
    
    // LocalStorage'dan tamamla
    const storedLobbyId = localStorage.getItem('tombala_lobbyId');
    const storedPlayerId = localStorage.getItem('tombala_playerId');
    const storedPlayerName = localStorage.getItem('tombala_playerName');
    const storedLobbyName = localStorage.getItem('tombala_lobbyName');
    
    // Final parametreleri birleştir
    params = {
      lobbyId: lobbyId || storedLobbyId || 'TEST123',
      playerId: playerId || storedPlayerId || '',
      playerName: playerName || storedPlayerName || 'Misafir Oyuncu',
      lobbyName: lobbyName || storedLobbyName || 'Tombala Lobisi'
    };
    
    // window.tombalaParams olarak kaydet
    window.tombalaParams = params;
    
    // localStorage'a da kaydet
    if (params.lobbyId) localStorage.setItem('tombala_lobbyId', params.lobbyId);
    if (params.playerId) localStorage.setItem('tombala_playerId', params.playerId);
    if (params.playerName) localStorage.setItem('tombala_playerName', params.playerName);
    if (params.lobbyName) localStorage.setItem('tombala_lobbyName', params.lobbyName);
    
    console.log('index.jsx - İşlenmiş Tombala Parametreleri:', params);
    
    // Yükleme tamamlandı - ebeveyn pencereye bildir
    if (window !== window.parent) {
      console.log('İframe modunda çalışıyor, ebeveyn pencereye yükleme mesajı gönderiliyor');
      window.parent.postMessage({ 
        type: 'TOMBALA_LOADED', 
        lobbyId: params.lobbyId,
        timestamp: Date.now() 
      }, '*');
    }
    
    return params;
  } catch (error) {
    console.error('index.jsx - URL parametreleri alınırken hata:', error);
    return {
      lobbyId: localStorage.getItem('tombala_lobbyId') || 'TEST123',
      playerId: localStorage.getItem('tombala_playerId') || '',
      playerName: localStorage.getItem('tombala_playerName') || 'Misafir Oyuncu',
      lobbyName: localStorage.getItem('tombala_lobbyName') || 'Tombala Lobisi'
    };
  }
};

// Parametreleri işle
const tombalaParams = processParams();

// Yakalanmamış Promise redlerine global hata işleyicisi ekle
window.addEventListener('unhandledrejection', event => {
  console.error('Yakalanmamış Promise hatası:', event.reason);
});

// Ana uygulamadan gelen postMessage mesajlarını dinle
window.addEventListener('message', (event) => {
  try {
    console.log('Dış uygulamadan mesaj alındı:', event.data);
    
    // Eğer mesaj LOBBY_DATA türündeyse ve içinde lobbyId varsa
    if (event.data && event.data.type === 'LOBBY_DATA' && event.data.lobbyId) {
      console.log('Lobi ID alındı:', event.data.lobbyId);
      
      // Parametreleri hazırla
      const { lobbyId, playerId, playerName, lobbyName } = event.data;
      
      // localStorage'a kaydet
      if (lobbyId) localStorage.setItem('tombala_lobbyId', lobbyId);
      if (playerId) localStorage.setItem('tombala_playerId', playerId);
      if (playerName) localStorage.setItem('tombala_playerName', playerName);
      if (lobbyName) localStorage.setItem('tombala_lobbyName', lobbyName);
      
      // tombalaParams nesnesine ekle veya güncelle
      if (!window.tombalaParams) {
        window.tombalaParams = {};
      }
      
      // Tüm parametreleri window.tombalaParams'a aktarma
      window.tombalaParams = {
        ...window.tombalaParams,
        lobbyId,
        playerId,
        playerName,
        lobbyName
      };
      
      console.log('PostMessage ile alınan parametreler:', window.tombalaParams);
      
      // Soket bağlantısını yenile - Bu parametrelerle yeni bağlantı kurulmasını sağla
      if (window.refreshSocketConnection && typeof window.refreshSocketConnection === 'function') {
        console.log('Soket bağlantısı yenileniyor...');
        window.refreshSocketConnection(window.tombalaParams);
      } else {
        console.warn('refreshSocketConnection fonksiyonu bulunamadı. Socket bağlantısı güncellenemedi.');
        // 500ms sonra tekrar dene
        setTimeout(() => {
          if (window.refreshSocketConnection && typeof window.refreshSocketConnection === 'function') {
            console.log('Soket bağlantısı yenileniyor (gecikmiş)...');
            window.refreshSocketConnection(window.tombalaParams);
          }
        }, 500);
      }
      
      // Oyun sayfasına otomatik yönlendirme yapma seçeneği
      // Şu an otomatik yönlendirilmeyecek - SPA olarak kalıcak
    }
  } catch (error) {
    console.error('Message event işlenirken hata:', error);
  }
}, false);

// Ebeveyn pencereye yükleme mesajı gönder (iframe içinde çalışıyorsa)
if (window !== window.parent) {
  // Sayfa yüklendikten 200ms sonra mesaj göndermeyi dene (parent hazır olsun diye)
  setTimeout(() => {
    try {
      window.parent.postMessage({
        type: 'TOMBALA_LOADED',
        lobbyId: tombalaParams.lobbyId,
        timestamp: Date.now()
      }, '*');
      console.log('Ebeveyn pencereye TOMBALA_LOADED mesajı gönderildi');
    } catch (error) {
      console.error('Ebeveyn pencereye mesaj gönderme hatası:', error);
    }
  }, 200);
}

// App bileşenini render et (BrowserRouter ile wrap edilmiş)
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename="/tombala">
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
); 