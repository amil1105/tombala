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
  // Eğer hâlihazırda bir socket bağlantısı varsa ve bu bağlantı açıksa, tekrar aynı bağlantıyı kullan
  if (socket && socket.connected) {
    console.log('Mevcut socket bağlantısı kullanılıyor, ID:', socket.id);
    return socket;
  }
  
  // Eğer socket varsa ama bağlı değilse ve hala yeniden bağlanma durumundaysa, bekle
  if (socket && socket.disconnected && socket.io.reconnection() && socket.io._reconnecting) {
    console.log('Socket yeniden bağlanmaya çalışıyor, mevcut socket döndürülüyor');
    return socket;
  }

  try {
    // URL'den parametreleri çıkar
    let urlParams = {};
    
    // URL parametrelerini al
    const searchParams = new URLSearchParams(window.location.search);
    
    // Parametreleri kontrol et
    if (searchParams.has('lobbyId')) urlParams.lobbyId = searchParams.get('lobbyId');
    if (searchParams.has('playerId')) urlParams.playerId = searchParams.get('playerId');
    if (searchParams.has('playerName')) urlParams.playerName = searchParams.get('playerName');
    
    // İstemci tarafından belirtilen parametreleri URL parametrelerinin üzerine yaz
    const finalParams = {
      ...urlParams,
      ...params
    };
    
    // lobbyId kontrolü
    if (!finalParams.lobbyId) {
      // URL path'inden lobi ID'sini çıkarmaya çalış
      const path = window.location.pathname;
      console.log('URL path\'inden lobi ID alındı:', path);
      
      // URL path'i "/tombala/game/:lobbyId" veya "/game/:lobbyId" formatında
      const pathSegments = path.split('/').filter(segment => segment.length > 0);
      if (pathSegments.length > 1) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment.length >= 6) {
          finalParams.lobbyId = lastSegment;
        }
      }
    }
    
    // lobbyId hala yoksa, bu durumda socket bağlantısı oluşturulamaz
    if (!finalParams.lobbyId) {
      console.error('Lobi ID bulunamadı, socket bağlantısı oluşturulamıyor');
      return null;
    }
    
    // Geliştirme ortamında localhost kontrolü
    const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    // Socket bağlantı URL'ini belirleme
    const SOCKET_URL = isLocalhost
      ? 'http://localhost:5000'
      : window.location.origin;
      
    console.log('Geliştirme ortamında socket URL ayarlandı:', SOCKET_URL);
    
    // Mevcut socket bağlantısını kapatmayı önle
    if (socket) {
      // Mevcut bağlantıyı kapat
      if (socket.connected) {
        console.log('Mevcut socket bağlantısı zaten açık, yeniden bağlanmaya gerek yok');
        return socket;
      }
      
      // Reconnecting durumundayken yeni bağlantı oluşturmayı önle
      if (socket.io && socket.io._reconnecting) {
        console.log('Socket zaten yeniden bağlanmaya çalışıyor, bekleyip mevcut socket\'i döndür');
        return socket;
      }
    }
    
    console.log('Socket bağlantısı başlatılıyor:', SOCKET_URL);
    
    // Socket.io bağlantı seçenekleri
    const socketOptions = {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      query: finalParams
    };

    // Socket.io bağlantısını oluştur
    const socketConn = io(SOCKET_URL, socketOptions);
    
    // Global socket değişkenini güncelle
    socket = socketConn;
    
    // Socket dinleyicileri ekle
    socketConn.on('connect', () => {
      console.log('Socket bağlantısı başarıyla kuruldu, socket ID:', socketConn.id);
      
      // Lobi katılım olayını gönder
      socketConn.emit('join_lobby', {
        lobbyId: finalParams.lobbyId,
        playerId: finalParams.playerId,
        playerName: finalParams.playerName,
        lobbyName: finalParams.lobbyName,
        timestamp: new Date().toISOString()
      });
      
      console.log('Lobi katılım olayı gönderildi', {
        lobbyId: finalParams.lobbyId,
        playerId: finalParams.playerId,
        playerName: finalParams.playerName,
        lobbyName: finalParams.lobbyName,
        timestamp: new Date().toISOString()
      });
      
      // Bağlantı durumunu güncelle
      eventEmitter.emit('connectionChange', true);
    });
    
    socketConn.on('disconnect', (reason) => {
      console.log('Socket bağlantısı kesildi:', reason);
      eventEmitter.emit('connectionChange', false);
    });
    
    socketConn.on('connect_error', (error) => {
      console.error('Socket bağlantı hatası:', error.message);
      
      // Websocket bağlantısı başarısız olduysa polling'e geç
      if (socketConn.io.opts.transports[0] === 'websocket') {
        console.log('WebSocket bağlantısı başarısız, polling deneniyor...');
        socketConn.io.opts.transports = ['polling', 'websocket'];
      }
    });
    
    return socketConn;
  } catch (error) {
    console.error('Socket bağlantısı oluşturulurken hata:', error);
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