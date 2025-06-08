// API base URL'ini belirle - global yapılandırmayı kullan
const API_BASE_URL = (() => {
  // Önce global API URL değişkenini kontrol et
  if (typeof window !== 'undefined' && window.__API_URL__) {
    return window.__API_URL__;
  }
  
  // Vite ortam değişkenlerini kontrol et
  if (typeof window !== 'undefined' && window.__VITE_ENV__?.VITE_API_URL) {
    return window.__VITE_ENV__.VITE_API_URL;
  }
  
  // Geliştirme ortamında proxy yapılandırmasını kullan
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '/api'; // Proxy kullan - vite.config.js'deki yapılandırmaya göre
  }
  
  // Varsayılan yol
  return '/api';
})();

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
    
    // API'ye kaydet - eğer bağlantı varsa
    if (navigator.onLine) {
      try {
        // Doğru endpoint kullan - gameState içinde gameStatus olup olmadığını kontrol et
        const endpoint = `/api/lobbies/status/${lobbyId}`;
        
        // Durumu doğru formatta hazırla - "status" parametresi bekleniyor
        const statusToSend = gameState.gameStatus || gameState.status || 'playing';
        
        console.log(`Oyun durumu API'ye kaydediliyor: ${endpoint}, durum: ${statusToSend}`);
        
        // Özel olarak kontrol et - Eğer gameStatus "finished" ise lobi durumunu da finished olarak güncelle
        if (statusToSend === 'finished' || gameState.gameStatus === 'finished') {
          console.log('Oyun bitti, lobi durumu "finished" olarak güncelleniyor');
          
          // Doğrudan lobby status API'sini çağır
          const lobbyUpdateResponse = await fetch(`/api/lobbies/${lobbyId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'finished' })
          });

          if (!lobbyUpdateResponse.ok) {
            console.error(`Lobi durumu güncellenirken hata: ${lobbyUpdateResponse.status}`);
            
            // Alternatif endpoint'i dene (ID değil kod ile)
            if (lobbyId.length <= 10) {
              const altLobbyUpdateResponse = await fetch(`/api/lobbies/code/${lobbyId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'finished' })
              });
              
              if (altLobbyUpdateResponse.ok) {
                console.log('Lobi durumu alternatif endpoint ile güncellendi');
              }
            }
          } else {
            console.log('Lobi durumu başarıyla güncellendi: finished');
          }
        }
        
        // Oyun durumu için bir istek daha yap
        const gameStatusResponse = await fetch(endpoint, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            status: statusToSend,
            gameData: {
              ...gameState,
              lastUpdated: new Date().toISOString()
            }
          })
        });
        
        if (gameStatusResponse.ok) {
          console.log('Oyun durumu API\'ye kaydedildi.');
          return { success: true };
        } else {
          console.warn(`Oyun durumu API'ye kaydedilemedi. HTTP Durumu: ${gameStatusResponse.status}`);
          return { success: false, error: `HTTP Durumu: ${gameStatusResponse.status}` };
        }
      } catch (error) {
        console.error('API isteği sırasında hata:', error);
        return { success: false, error: error.message, localSaved: true };
      }
    } else {
      console.log('Çevrimdışı olduğunuz için oyun durumu sadece yerel olarak kaydedildi.');
      return { success: true, onlyLocal: true };
    }
  } catch (error) {
    console.error('Oyun durumu kaydedilemedi:', error);
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
        signal: controller.signal,
        credentials: 'include'
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