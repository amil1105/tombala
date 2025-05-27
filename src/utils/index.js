/**
 * Tombala uygulaması utils/common modülü
 * Bu modül, uygulama genelinde kullanılan ortak yardımcı fonksiyonları dışa aktarır
 */

// Socket.io bağlantısı ve işlemleri
import io from 'socket.io-client';
import EventEmitter from 'events';
import { SOCKET_URL, SOCKET_EVENTS, DEMO_MODE } from './config';
import { 
  generateTombalaCard,
  generateTombalaCards,
  checkWinningCondition,
  isValidWin,
  compareCards,
  isCardComplete,
  checkCardMarkedNumbers
} from './tombalaUtils';

// tombalaUtils'taki tüm fonksiyonları yeniden dışa aktar (re-export)
export { 
  generateTombalaCard,
  generateTombalaCards,
  checkWinningCondition,
  isValidWin,
  compareCards,
  isCardComplete,
  checkCardMarkedNumbers
};

// Event emitter - uygulama içi iletişim için
export const eventEmitter = new EventEmitter();

// API ile iletişim servisi
export const tombalaService = {
  // API üzerinden lobi oluştur
  createLobby: async ({ lobbyName, playerName, cardCount = 1 }) => {
    try {
      const response = await fetch(`${window.__API_URL__ || 'http://localhost:5000'}/api/lobbies/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lobbyName, playerName, cardCount }),
        credentials: 'include'
      });
      
      return await response.json();
    } catch (error) {
      console.error('Lobi oluşturma hatası:', error);
      return { success: false, error: error.message };
    }
  },
  
  // API üzerinden lobiye katıl
  joinLobby: async ({ lobbyId, playerName, cardCount = 1 }) => {
    try {
      const response = await fetch(`${window.__API_URL__ || 'http://localhost:5000'}/api/lobbies/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lobbyId, playerName, cardCount }),
        credentials: 'include'
      });
      
      return await response.json();
    } catch (error) {
      console.error('Lobiye katılma hatası:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Oyun durumunu localStorage'a kaydet
  saveGameStatus: (gameId, gameState) => {
    return new Promise((resolve, reject) => {
      try {
        const key = `tombala_gameState_${gameId}`;
        localStorage.setItem(key, JSON.stringify(gameState));
        resolve(true);
      } catch (error) {
        console.error('Oyun durumu kaydedilemedi:', error);
        reject(error);
      }
    });
  },
  
  // Oyun sonucunu kaydet
  saveGameResult: (gameId, resultData) => {
    return new Promise((resolve, reject) => {
      try {
        const key = `tombala_gameResult_${gameId}`;
        localStorage.setItem(key, JSON.stringify(resultData));
        resolve(true);
      } catch (error) {
        console.error('Oyun sonucu kaydedilemedi:', error);
        reject(error);
      }
    });
  }
};

// Socket.io bağlantısı için global değişken
let socket;

// Socket.io bağlantı durumu
let connected = false;

// Soket bağlantısını yenileme fonksiyonu - dış uygulamalardan çağrılabilir
export const refreshSocketConnection = (params = {}) => {
  console.log('refreshSocketConnection çağrıldı, parametreler:', params);
  
  // Mevcut soket bağlantısını kapat
  if (socket) {
    console.log('Mevcut soket bağlantısı kapatılıyor...');
    socket.close();
    socket = null;
  }
  
  // Yeni bağlantı başlat
  return initializeSocket(params);
};

// Window nesnesine refreshSocketConnection referansını ata (dış iframe'den çağrılabilmesi için)
if (typeof window !== 'undefined') {
  window.refreshSocketConnection = refreshSocketConnection;
  console.log('refreshSocketConnection fonksiyonu window nesnesine atandı');
}

// Socket bağlantısını sağla
export const initializeSocket = (params = {}) => {
  if (socket && socket.connected) {
    console.log('Socket bağlantısı zaten kurulmuş ve aktif');
    return socket;
  }
  
  // URL'den parametreleri çıkar
  let urlParams = {};
  try {
    // URL parametrelerini al
    const searchParams = new URLSearchParams(window.location.search);
    
    // Parametreleri kontrol et
    if (searchParams.has('lobbyId')) urlParams.lobbyId = searchParams.get('lobbyId');
    if (searchParams.has('playerId')) urlParams.playerId = searchParams.get('playerId');
    if (searchParams.has('playerName')) urlParams.playerName = searchParams.get('playerName');
    if (searchParams.has('lobbyName')) urlParams.lobbyName = searchParams.get('lobbyName');
    
    // URL path'inden lobi ID'yi çıkarmayı dene (ör: /tombala/game/ABCDEF)
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 2) {
      // Son parça muhtemelen lobi ID'si olabilir
      const lastPathPart = pathParts[pathParts.length - 1];
      if (lastPathPart && lastPathPart.length >= 5 && lastPathPart.length <= 10) {
        urlParams.lobbyId = urlParams.lobbyId || lastPathPart;
        console.log(`URL path'inden lobi ID alındı: ${lastPathPart}`);
      }
    }
  } catch (e) {
    console.error('URL parametreleri işlenirken hata:', e);
  }
  
  const { lobbyId, playerId, playerName, lobbyName } = {
    ...urlParams,  // Önce URL parametrelerini dene
    ...params      // Ardından fonksiyona gönderilen parametreleri kullan (override)
  };
  
  // tombalaParams üzerinden değerler yoksa localStorage'dan al
  const finalLobbyId = lobbyId || localStorage.getItem('tombala_lobbyId') || window.tombalaParams?.lobbyId;
  const finalPlayerId = playerId || localStorage.getItem('tombala_playerId') || window.tombalaParams?.playerId || window.playerId;
  const finalPlayerName = playerName || localStorage.getItem('tombala_playerName') || window.tombalaParams?.playerName || 'Misafir Oyuncu';
  const finalLobbyName = lobbyName || localStorage.getItem('tombala_lobbyName') || window.tombalaParams?.lobbyName || 'Tombala Lobisi';
  
  // Parametreleri localStorage'a kaydet (sonraki kullanımlar için)
  if (finalLobbyId) localStorage.setItem('tombala_lobbyId', finalLobbyId);
  if (finalPlayerId) localStorage.setItem('tombala_playerId', finalPlayerId);
  if (finalPlayerName) localStorage.setItem('tombala_playerName', finalPlayerName);
  if (finalLobbyName) localStorage.setItem('tombala_lobbyName', finalLobbyName);
  
  // Tüm değerleri loglama
  console.log('Socket parametreleri hazırlandı:', {
    lobbyId: finalLobbyId, 
    playerId: finalPlayerId,
    playerName: finalPlayerName,
    lobbyName: finalLobbyName
  });
  
  // Socket bağlantı URL'sini hazırla - vite.config.js proxy ayarları için
  // Farklı kaynaklardan döngüsel olarak kontrol et
  let socketUrl = window.__SOCKET_URL__ || 
                  window.__VITE_ENV__?.VITE_SOCKET_URL ||
                  window.__API_URL__ ||
                  'http://localhost:5000';
  
  console.log(`Socket bağlantısı başlatılıyor: ${socketUrl}`);
  
  try {
    // Demo modu iptal et - öncelikle zorla devre dışı bırak
    if (localStorage.getItem('tombala_demo_mode')) {
      localStorage.removeItem('tombala_demo_mode');
      console.log('Demo mod devre dışı bırakılıyor (socket bağlantısı öncesi)');
    }
    
    // Socket.io bağlantı seçenekleri - daha güvenilir bağlantı için
    const socketOptions = {
      forceNew: true,        // Her zaman yeni bağlantı kur
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      transports: ['websocket', 'polling'],
      withCredentials: true,  // CORS için credentials desteği
      path: '/socket.io/',
      extraHeaders: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      query: {}
    };
    
    // Lobi ID varsa query parametresine ekle
    if (finalLobbyId) {
      socketOptions.query.lobbyId = finalLobbyId;
    }
    
    // Oyuncu ID varsa query parametresine ekle
    if (finalPlayerId) {
      socketOptions.query.playerId = finalPlayerId;
    }
    
    // Oyuncu adı varsa query parametresine ekle
    if (finalPlayerName) {
      socketOptions.query.playerName = finalPlayerName;
    }
    
    // İlk olarak socket bağlantısını kurmayı dene
    socket = io(socketUrl, socketOptions);
    
    // Bağlantı olaylarını dinle
    socket.on('connect', () => {
      console.log('Socket bağlantısı başarıyla kuruldu');
      connected = true;
      
      // Demo modu tamamen kapat
      localStorage.removeItem('tombala_demo_mode');
      
      // Bağlantı durumunu event emitter ile bildir
      eventEmitter.emit('socket_connected', { connected: true });
      
      // Lobi ve oyuncu ID'leri varsa lobi katılım olayı gönder
      if (finalLobbyId && finalPlayerId) {
        const joinData = {
          lobbyId: finalLobbyId,
          playerId: finalPlayerId,
          playerName: finalPlayerName || 'Misafir Oyuncu',
          lobbyName: finalLobbyName || 'Tombala Lobisi',
          timestamp: new Date().toISOString()
        };
        
        socket.emit(SOCKET_EVENTS.JOIN_LOBBY, joinData);
        console.log('Lobi katılım olayı gönderildi', joinData);
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`Socket bağlantısı kesildi: ${reason}`);
      connected = false;
      
      // Bağlantı durumunu event emitter ile bildir
      eventEmitter.emit('socket_disconnected', { connected: false, reason });
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket bağlantı hatası:', error);
      
      // Socket URL'ini değiştirerek tekrar deneme yap
      if (socketUrl.includes('localhost:3000')) {
        console.log('Socket bağlantısı localhost:3000 üzerinden başarısız oldu, localhost:3100 üzerinden tekrar deneniyor...');
        socketUrl = 'http://localhost:3100';
        // Yeni bağlantı dene
        try {
          socket.io.uri = socketUrl;
          socket.io.opts.hostname = 'localhost';
          socket.io.opts.port = '3100';
          socket.connect();
        } catch (e) {
          console.error('Socket bağlantısı URL değişikliği başarısız oldu:', e);
        }
      } else if (socketUrl.includes('localhost:5000')) {
        console.log('Socket bağlantısı localhost:5000 üzerinden başarısız oldu, localhost:3100 üzerinden tekrar deneniyor...');
        socketUrl = 'http://localhost:3100';
        // Yeni bağlantı dene
        try {
          socket.io.uri = socketUrl;
          socket.io.opts.hostname = 'localhost';
          socket.io.opts.port = '3100';
          socket.connect();
        } catch (e) {
          console.error('Socket bağlantısı URL değişikliği başarısız oldu:', e);
        }
      } else {
        // Bağlantı hatasından sonra demo modu etkinleştir
        console.log('Socket bağlantı hatası gerçekleşti, daha fazla hata mesajını engellemek için demo moda geçiliyor');
        enableDemoMode();
      }
    });
    
    socket.on('error', (error) => {
      console.error('Socket hatası:', error);
      eventEmitter.emit('socket_error', { error });
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket yeniden bağlandı (deneme: ${attemptNumber})`);
      connected = true;
      
      // Bağlantı durumunu event emitter ile bildir
      eventEmitter.emit('socket_reconnected', { connected: true, attemptNumber });
      
      // Yeniden bağlandığında lobi katılım olayı gönder
      if (finalLobbyId && finalPlayerId) {
        const joinData = {
          lobbyId: finalLobbyId,
          playerId: finalPlayerId,
          playerName: finalPlayerName || 'Misafir Oyuncu',
          lobbyName: finalLobbyName || 'Tombala Lobisi',
          timestamp: new Date().toISOString(),
          isReconnect: true
        };
        
        socket.emit(SOCKET_EVENTS.JOIN_LOBBY, joinData);
        console.log('Yeniden bağlantıda lobi katılım olayı gönderildi', joinData);
      }
    });
    
    socket.on('reconnect_error', (error) => {
      console.error('Socket yeniden bağlanma hatası:', error);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('Socket yeniden bağlanma başarısız oldu');
      
      // Demo mod devreye alınmasını engelle
      console.log('Yeniden bağlanma başarısız oldu, ancak Demo modu etkinleştirilmeyecek');
    });
    
    return socket;
  } catch (error) {
    console.error('Socket bağlantısı başlatılırken hata:', error);
    
    // Hata durumunda demo modu etkinleştirmeyi engelle
    console.log('Socket hatası oluştu, ancak Demo modu etkinleştirilmeyecek');
    
    return null;
  }
};

// Demo modu etkinleştir - kontrollü bir şekilde ve sadece gerektiğinde kullanılmalı
export const enableDemoMode = () => {
  console.log('Demo mod etkinleştiriliyor...');
  
  // Önceki demo modu durumunu kontrol et
  const wasDemoEnabled = localStorage.getItem('tombala_demo_mode') === 'true';
  
  if (wasDemoEnabled) {
    console.log('Demo mod zaten etkin, tekrar etkinleştirme atlanıyor');
    return;
  }
  
  // Demo mod durumunu aktar
  localStorage.setItem('tombala_demo_mode', 'true');
  
  // Gerçek socket bağlantısı yoksa demo mod için bağlantı var gibi davran
  connected = true;
  
  // Demo mod için eventEmitter'ı kullan
  eventEmitter.emit('demo_mode_enabled', { enabled: true });
  eventEmitter.emit('socket_connected', { connected: true, isDemo: true });
};

// Socket bağlantı durumunu kontrol et
export const isConnected = () => {
  if (DEMO_MODE.ENABLED) {
    return true; // Demo modda bağlantı var gibi davran
  }
  
  return connected && socket && socket.connected;
};

// Mevcut socket nesnesini döndür
export const getSocket = () => {
  return socket;
};

// Sayı çekme fonksiyonu
export const drawNumber = (min = 1, max = 90, excluded = []) => {
  const available = [];
  
  // Kullanılabilir sayıları bul
  for (let i = min; i <= max; i++) {
    if (!excluded.includes(i)) {
      available.push(i);
    }
  }
  
  if (available.length === 0) {
    return null; // Çekilecek sayı kalmadı
  }
  
  // Rastgele bir sayı seç
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
};

// Rastgele gecikme oluştur (demo mod için)
export const createRandomDelay = (min = 300, max = 1000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Socket nesnesini dışa aktar
export { socket };

// Varsayılan dışa aktarım
export default {
  generateTombalaCard,
  generateTombalaCards,
  checkWinningCondition,
  isValidWin,
  compareCards,
  isCardComplete,
  eventEmitter,
  initializeSocket,
  isConnected,
  getSocket,
  tombalaService,
  drawNumber
}; 