/**
 * Tombala oyunu konfigürasyon dosyası
 * API ve WebSocket bağlantı ayarları, URL'ler ve diğer global ayarlar
 */

// Geliştirme modu kontrolü
const isDevelopment = process.env.NODE_ENV !== 'production';

// Hostname ve port için safe check
const getHostname = () => {
  try {
    return window.location.hostname || 'localhost';
  } catch (e) {
    return 'localhost';
  }
};

// API ve socket için URL'ler (geliştirilmiş versiyon)
export const API_URL = (() => {
  const hostname = getHostname();
  // Geliştirme ortamında localhost:5000 kullan
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:5000`;
  }
  // Prodüksiyon ortamında kullanılan domain'in /api endpoint'ini kullan
  return `https://${hostname}/api`;
})();

export const SOCKET_URL = (() => {
  const hostname = getHostname();
  // Geliştirme ortamında localhost:5000 kullan
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:5000`;
  }
  // Prodüksiyon ortamında secure websocket kullan
  return `https://${hostname}`;
})();

// Base path ayarı
export const BASE_PATH = '/tombala';

// Depolama anahtarları
export const STORAGE_KEYS = {
  LOBBYID: 'tombala_lobbyId',
  PLAYERID: 'tombala_playerId',
  LOBBY_NAME: 'tombala_lobbyName',
  GAME_HISTORY: 'tombala_game_history',
  USER_SETTINGS: 'tombala_user_settings'
};

// Demo mod - Socket bağlantısı olmadan yerel oyun modu
export const DEMO_MODE = {
  ENABLED: false,       // Demo modu zorla devre dışı bırak
  AUTO_ENABLE: false,   // Bağlantı hatası olduğunda demo moda geçmeyi engelle
  DRAW_INTERVAL: 5000,  // Demo modda sayı çekme aralığı (ms)
  MAX_NUMBERS: 90,      // Maksimum çekilebilecek sayı
  SIMULATE_DELAY: true, // Gerçek bir bağlantı gibi gecikme simülasyonu
  MIN_DELAY: 500,       // Minimum gecikme (ms)
  MAX_DELAY: 2000,      // Maksimum gecikme (ms)
  STORAGE_KEY: 'tombala_demo_mode'
};

// Oyun ayarları
export const GAME_SETTINGS = {
  MIN_PLAYERS: 1, // Minimum oyuncu sayısı
  MAX_PLAYERS: 20, // Maksimum oyuncu sayısı
  CARD_PRICE: 10, // Kart başına ücret
  CINKO1_PRIZE_PERCENT: 20, // Birinci çinko için ödül yüzdesi
  CINKO2_PRIZE_PERCENT: 30, // İkinci çinko için ödül yüzdesi
  TOMBALA_PRIZE_PERCENT: 50, // Tombala için ödül yüzdesi
  NUMBER_DRAW_INTERVAL: 5000, // Sayı çekme aralığı (ms)
  ANIMATION_DURATION: 1500, // Animasyon süresi (ms)
  NOTIFICATION_DURATION: 4000 // Bildirim süresi (ms)
};

// Socket olayları - gerçek çok oyunculu iletişim için
export const SOCKET_EVENTS = {
  // Bağlantı olayları
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  ERROR: 'connect_error',
  
  // Lobi olayları
  JOIN_LOBBY: 'join_lobby',
  LEAVE_LOBBY: 'leave_lobby',
  LOBBY_JOINED: 'lobby_joined',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  LOBBY_INFO: 'lobby_info',
  LOBBY_UPDATED: 'lobby_updated',
  
  // Oyun olayları
  GAME_START: 'game_start',
  GAME_END: 'game_end',
  DRAW_NUMBER: 'draw_number',
  NUMBER_DRAWN: 'number_drawn',
  GAME_UPDATE: 'game_update',
  PLAYER_UPDATE: 'player_update',
  PLAYER_STATUS_UPDATE: 'player_status_update',
  
  // Çinko olayları
  CLAIM_CINKO: 'claim_cinko',
  CINKO_CLAIMED: 'cinko_claimed',
  CLAIM_TOMBALA: 'claim_tombala',
  TOMBALA_CLAIMED: 'tombala_claimed',
  
  // Sohbet olayları
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  SYSTEM_MESSAGE: 'system_message'
};

// URL parametreleri
export const URL_PARAMS = {
  LOBBY_ID: 'lobbyId',
  PLAYER_ID: 'playerId',
  LOBBY_NAME: 'lobbyName',
  GAME_CODE: 'code'
};

// Global konfigürasyonları dışa aktar
export default {
  API_URL,
  SOCKET_URL,
  DEMO_MODE,
  GAME_SETTINGS,
  STORAGE_KEYS,
  URL_PARAMS,
  SOCKET_EVENTS,
  isDevelopment
}; 