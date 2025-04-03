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

// Global API ve socket URL'lerini ayarla (doğru portları kullan: backend 5000)
window.__API_URL__ = window.location.hostname === 'localhost' 
  ? `http://${window.location.hostname}:5000` 
  : `https://${window.location.hostname}/api`;

window.__SOCKET_URL__ = window.location.hostname === 'localhost' 
  ? `http://${window.location.hostname}:5000` 
  : `https://${window.location.hostname}/socket.io`;

// URL parametrelerini al ve window.tombalaParams nesnesine ata
try {
  console.log('index.jsx - URL parametreleri işleniyor...');
  
  // URL parametrelerini analiz et
  const urlParams = new URLSearchParams(window.location.search);
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  
  // lobbyId için kontroller
  let lobbyId = urlParams.get('lobbyId') || urlParams.get('lobby') || urlParams.get('code');
  
  // URL yolu üzerinden kontrol et (/game/LOBBYCODE gibi)
  if (!lobbyId && pathSegments.length > 0) {
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment && lastSegment !== 'game' && lastSegment !== 'tombala') {
      lobbyId = lastSegment;
      console.log('index.jsx - LobbyId URL path\'inden alındı:', lobbyId);
    }
  }
  
  // Diğer parametreleri al
  const playerId = urlParams.get('playerId') || localStorage.getItem('tombala_playerId');
  const lobbyName = urlParams.get('lobbyName') || localStorage.getItem('tombala_lobbyName');
  
  // Varsayılan değerler kontrolü
  if (!lobbyId) {
    lobbyId = 'AGT187'; // Sabit bir varsayılan değer
    console.log('index.jsx - Varsayılan LobbyId kullanıldı:', lobbyId);
  }
  
  // tombalaParams nesnesini oluştur
  window.tombalaParams = {
    lobbyId,
    playerId,
    lobbyName
  };
  
  console.log('index.jsx - Tombala Parametreleri:', window.tombalaParams);
  
  // LocalStorage'a kaydet (null değilse)
  if (lobbyId) localStorage.setItem('tombala_lobbyId', lobbyId);
  if (playerId) localStorage.setItem('tombala_playerId', playerId);
  if (lobbyName) localStorage.setItem('tombala_lobbyName', lobbyName);
  
  // Değerler varsa konsola logla
  if (lobbyId) console.log(`index.jsx - Lobi ID: ${lobbyId}`);
  if (playerId) console.log(`index.jsx - Oyuncu ID: ${playerId}`);
  if (lobbyName) console.log(`index.jsx - Lobi Adı: ${lobbyName}`);
  
  // LocalStorage değerlerini kontrol et ve logla
  const storedLobbyId = localStorage.getItem('tombala_lobbyId');
  const storedPlayerId = localStorage.getItem('tombala_playerId');
  const storedLobbyName = localStorage.getItem('tombala_lobbyName');
  
  if (storedLobbyId || storedPlayerId || storedLobbyName) {
    console.log('index.jsx - LocalStorage değerleri eklendi. Güncel parametreler:', {
      lobbyId: storedLobbyId,
      playerId: storedPlayerId,
      lobbyName: storedLobbyName
    });
  }
  
} catch (error) {
  console.error('index.jsx - URL parametreleri alınırken hata:', error);
}

// Yakalanmamış Promise redlerine global hata işleyicisi ekle
window.addEventListener('unhandledrejection', event => {
  console.error('Yakalanmamış Promise hatası:', event.reason);
});

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