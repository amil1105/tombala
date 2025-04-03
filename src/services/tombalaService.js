// API base URL'ini belirle
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : 'http://localhost:5000/api';

/**
 * Oyun durumunu kaydet
 * @param {string} lobbyId Lobi kimliği
 * @param {object} gameState Oyun durumu
 * @returns {Promise<object>} Kayıt sonucu
 */
export const saveGameStatus = async (lobbyId, gameState) => {
  if (!lobbyId) {
    console.error('saveGameStatus: Lobi ID gereklidir');
    return { success: false, error: 'Lobi ID gereklidir' };
  }
  
  // Yerel depolamada önbelleğe al
  try {
    const localStorageKey = `tombalaState_${lobbyId}`;
    const localState = {
      ...gameState,
      savedAt: new Date().toISOString(),
      localSave: true
    };
    
    localStorage.setItem(localStorageKey, JSON.stringify(localState));
    console.log(`Oyun durumu yerel depolamaya kaydedildi: ${localStorageKey}`);
    
    // Çevrimiçi modu kontrol et
    if (!navigator.onLine) {
      console.log('Cihaz çevrimdışı, sunucuya kaydetme atlandı.');
      return { 
        success: true, 
        local: true, 
        message: 'Oyun durumu yerel olarak kaydedildi (çevrimdışı mod)' 
      };
    }
    
    // Sunucuya kaydet
    try {
      // Signal kullanarak timeout ekle
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort('Zaman aşımı');
      }, 10000);
      
      const response = await fetch(`${API_BASE_URL}/lobbies/status/${lobbyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: gameState.gameStatus || 'playing',
          gameData: gameState
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Oyun durumu sunucuya kaydedildi:', data);
        return { success: true, data, local: true };
      } else {
        console.warn(`Sunucu kayıt hatası: ${response.status}`);
        return { 
          success: true, 
          local: true, 
          serverError: true,
          message: 'Sunucu hatası, oyun durumu yalnızca yerel olarak kaydedildi'
        };
      }
    } catch (error) {
      console.error('Sunucuya kaydetme hatası:', error);
      // Yerel kaydedildiği için yine de başarılı döndür
      return { 
        success: true, 
        local: true, 
        error: error.message,
        message: 'Sunucu hatası, oyun durumu yalnızca yerel olarak kaydedildi'
      };
    }
  } catch (error) {
    console.error('Yerel depolama hatası:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Kaydedilmiş oyun durumunu yükle
 * @param {string} lobbyId Lobi kimliği 
 * @returns {object|null} Oyun durumu veya null
 */
export const loadSavedGameStatus = (lobbyId) => {
  if (!lobbyId) return null;
  
  try {
    const localStorageKey = `tombalaState_${lobbyId}`;
    const savedState = localStorage.getItem(localStorageKey);
    
    if (!savedState) return null;
    
    const parsedState = JSON.parse(savedState);
    console.log(`Kaydedilmiş oyun durumu yüklendi: ${localStorageKey}`, parsedState);
    
    // Kaydın 2 saatten eski olup olmadığını kontrol et
    if (parsedState.savedAt) {
      const savedTime = new Date(parsedState.savedAt).getTime();
      const now = new Date().getTime();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      
      if (now - savedTime > twoHoursMs) {
        console.log('Kaydedilmiş oyun durumu çok eski, temizleniyor');
        localStorage.removeItem(localStorageKey);
        return null;
      }
    }
    
    return parsedState;
  } catch (error) {
    console.error('Oyun durumu yükleme hatası:', error);
    return null;
  }
};

/**
 * Oyun sonuçlarını kaydet
 * @param {string} lobbyId Lobi kimliği
 * @param {object} results Oyun sonuçları
 * @returns {Promise<object>} Kayıt sonucu
 */
export const saveGameResults = async (lobbyId, results) => {
  if (!lobbyId || !results) {
    console.error('saveGameResults: Geçersiz parametreler');
    return { success: false, error: 'Geçersiz parametreler' };
  }
  
  try {
    // Yerel depolamaya kaydet
    const localStorageKey = `tombalaResults_${lobbyId}`;
    localStorage.setItem(localStorageKey, JSON.stringify({
      ...results,
      savedAt: new Date().toISOString()
    }));
    
    // Çevrimiçi kontrolü
    if (!navigator.onLine) {
      return { success: true, local: true };
    }
    
    try {
      // Signal kullanarak timeout ekle
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${API_BASE_URL}/lobbies/${lobbyId}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(results),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return { success: true, data: await response.json() };
      } else {
        return { 
          success: false, 
          local: true,
          statusCode: response.status,
          message: 'Sunucu hatası, sonuçlar yalnızca yerel olarak kaydedildi'
        };
      }
    } catch (error) {
      console.error('Sunucuya sonuç gönderme hatası:', error);
      return { 
        success: true, 
        local: true, 
        error: error.message 
      };
    }
  } catch (error) {
    console.error('Oyun sonuçları kaydetme hatası:', error);
    return { success: false, error: error.message };
  }
}; 