import { io } from 'socket.io-client';

// Varsayılan socket sunucusu - tarayıcı ortamına uyumlu
const SOCKET_URL = typeof window !== 'undefined' && window.APP_CONFIG 
  ? window.APP_CONFIG.SOCKET_URL 
  : 'http://localhost:5000';

let socket = null;

/**
 * Socket bağlantısını başlatır
 * @param {string} token - Kullanıcı kimlik doğrulama token'ı
 * @returns {Object} - Socket nesnesi
 */
export const initializeSocket = (token) => {
  if (socket) {
    // Eğer zaten bir bağlantı varsa ve bağlı değilse, yeniden bağlanmayı dene
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  if (!token) {
    throw new Error('Token gereklidir');
  }

  console.log(`Socket.io sunucusuna bağlanılıyor: ${SOCKET_URL}`);

  // Socket.io client oluştur
  socket = io(SOCKET_URL, {
    auth: {
      token
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    transports: ['websocket'], // Sadece WebSocket kullan, polling devre dışı
    extraHeaders: {
      Authorization: `Bearer ${token}`
    },
    withCredentials: true // CORS için credential'ları gönder
  });

  // Bağlantı olaylarını dinle
  socket.on('connect', () => {
    console.log('Socket.io sunucusuna bağlandı');
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket.io bağlantısı kesildi: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.io bağlantı hatası:', error);
    // WebSocket'e geçiş yapamadıysa polling'i dene
    if (socket.io.opts.transports.indexOf('polling') < 0) {
      console.log('WebSocket bağlantısı başarısız, polling deneniyor...');
      socket.io.opts.transports = ['polling', 'websocket'];
    }
  });

  socket.on('error', (error) => {
    console.error('Socket.io hatası:', error);
  });

  return socket;
};

/**
 * Mevcut socket bağlantısını döndürür
 * @returns {Object|null} - Socket nesnesi veya null
 */
export const getSocket = () => socket;

/**
 * Socket bağlantısını kapatır
 */
export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Lobiye katılma
 * @param {string} lobbyId - Lobi kimliği
 */
export const joinLobby = (lobbyId) => {
  if (!socket) {
    console.error('Socket bağlantısı mevcut değil');
    return;
  }

  // Oyunu direk başlatmak için status parametresi ekliyorum
  socket.emit('joinLobby', { lobbyId, defaultStatus: 'playing' });
};

/**
 * Oyunu başlatma
 * @param {string} lobbyId - Lobi kimliği
 */
export const startGame = (lobbyId) => {
  if (!socket) {
    console.error('Socket bağlantısı mevcut değil');
    return;
  }

  socket.emit('startGame', { lobbyId });
};

/**
 * Sayı çekme
 * @param {string} lobbyId - Lobi kimliği
 */
export const emitDrawNumber = (lobbyId) => {
  if (!socket) {
    console.error('Socket bağlantısı mevcut değil');
    return;
  }

  socket.emit('drawNumber', { lobbyId });
};

/**
 * Kazandığını bildirme
 * @param {string} lobbyId - Lobi kimliği
 * @param {string} winType - Kazanma türü (cinko1, cinko2, tombala)
 */
export const announceWin = (lobbyId, winType) => {
  if (!socket) {
    console.error('Socket bağlantısı mevcut değil');
    return;
  }

  socket.emit('announceWin', { lobbyId, winType });
};

/**
 * Oyuncular güncellenince tetiklenen olay
 * @param {Function} callback - Güncellenmiş oyuncu verilerini işleyen fonksiyon
 * @returns {Function} - Dinleyiciyi kaldıran fonksiyon
 */
export const onPlayersUpdate = (callback) => {
  if (!socket) {
    console.error('Socket bağlantısı mevcut değil');
    return () => {};
  }

  socket.on('playersUpdate', callback);
  return () => {
    if (socket) {
      socket.off('playersUpdate', callback);
    }
  };
};

/**
 * Sayı çekilince tetiklenen olay
 * @param {Function} callback - Çekilen sayı verisini işleyen fonksiyon
 * @returns {Function} - Dinleyiciyi kaldıran fonksiyon
 */
export const onNumberDrawn = (callback) => {
  if (!socket) {
    console.error('Socket bağlantısı mevcut değil');
    return () => {};
  }

  socket.on('numberDrawn', callback);
  return () => {
    if (socket) {
      socket.off('numberDrawn', callback);
    }
  };
};

/**
 * Oyun durumu değiştiğinde tetiklenen olay
 * @param {Function} callback - Güncellenmiş oyun durumunu işleyen fonksiyon
 * @returns {Function} - Dinleyiciyi kaldıran fonksiyon
 */
export const onGameStatusUpdate = (callback) => {
  if (!socket) {
    console.error('Socket bağlantısı mevcut değil');
    return () => {};
  }

  socket.on('gameStatusUpdate', callback);
  return () => {
    if (socket) {
      socket.off('gameStatusUpdate', callback);
    }
  };
};

/**
 * Kazanan duyurulduğunda tetiklenen olay
 * @param {Function} callback - Kazanan verisini işleyen fonksiyon
 * @returns {Function} - Dinleyiciyi kaldıran fonksiyon
 */
export const onWinnerAnnounced = (callback) => {
  if (!socket) {
    console.error('Socket bağlantısı mevcut değil');
    return () => {};
  }

  socket.on('winnerAnnounced', callback);
  return () => {
    if (socket) {
      socket.off('winnerAnnounced', callback);
    }
  };
}; 