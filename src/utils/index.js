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
        body: JSON.stringify({ lobbyName, playerName, cardCount })
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
        body: JSON.stringify({ lobbyId, playerName, cardCount })
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

// Socket bağlantısını sağla
export const initializeSocket = (params = {}) => {
  if (socket) {
    console.log('Socket bağlantısı zaten kurulmuş');
    return socket;
  }
  
  const { lobbyId, playerId, playerName } = params;
  
  // Socket bağlantı URL'sini hazırla - varsayılan port 5000
  let socketUrl = SOCKET_URL || 'http://localhost:5000';
  console.log(`Socket bağlantısı başlatılıyor: ${socketUrl}`);
  
  try {
    // Demo modu iptal et - öncelikle zorla devre dışı bırak
    if (localStorage.getItem('tombala_demo_mode')) {
      localStorage.removeItem('tombala_demo_mode');
      console.log('Demo mod devre dışı bırakılıyor (socket bağlantısı öncesi)');
    }
    
    // Demo mod sabitlerini kontrol et ve geçersiz kıl
    if (DEMO_MODE && DEMO_MODE.ENABLED) {
      console.log('DEMO_MODE.ENABLED değeri geçersiz kılınıyor (socket bağlantısı için)');
      // Burada DEMO_MODE referansı değiştirilemiyor ancak bağlantı öncesi log ekliyoruz
    }
    
    // Socket.io bağlantı seçenekleri - daha güvenilir bağlantı için
    const socketOptions = {
      forceNew: true,  // Her zaman yeni bağlantı kur
      reconnection: true,
      reconnectionAttempts: 15,   
      reconnectionDelay: 1000,    
      reconnectionDelayMax: 5000, 
      timeout: 20000,             
      autoConnect: true,
      transports: ['websocket', 'polling'],
      query: {}
    };
    
    // Lobi ID varsa query parametresine ekle
    if (lobbyId) {
      socketOptions.query.lobbyId = lobbyId;
    }
    
    // Oyuncu ID varsa query parametresine ekle
    if (playerId) {
      socketOptions.query.playerId = playerId;
    }
    
    // Oyuncu adı varsa query parametresine ekle
    if (playerName) {
      socketOptions.query.playerName = playerName;
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
      if (lobbyId && playerId) {
        const joinData = {
          lobbyId,
          playerId,
          playerName: playerName || 'Misafir Oyuncu',
          timestamp: new Date().toISOString()
        };
        
        socket.emit(SOCKET_EVENTS.JOIN_LOBBY, joinData);
        console.log('Lobi katılım olayı gönderildi', joinData);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Socket bağlantısı kesildi');
      connected = false;
      
      // Bağlantı durumunu event emitter ile bildir
      eventEmitter.emit('socket_disconnected', { connected: false });
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket bağlantı hatası:', error);
      
      // Demo mod devreye alınmasını engelle - özel koşullu olarak
      console.log('Socket bağlantı hatası gerçekleşti, ancak Demo modu etkinleştirilmeyecek');
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