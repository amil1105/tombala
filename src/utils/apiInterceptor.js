/**
 * API İstek Yöneticisi
 * API isteklerini yönetir ve hata durumlarını ele alır
 */

import { API_URL, DEMO_MODE } from './config';

// Demo moda geçiş callback'i (GameBoard bileşeninden gelecek)
let activateDemoModeCallback = null;

/**
 * Demo mod aktivasyonu için callback fonksiyonu kaydetme
 * @param {Function} callback - Demo modu aktifleştiren fonksiyon
 */
export const setDemoModeActivationCallback = (callback) => {
  activateDemoModeCallback = callback;
};

/**
 * API isteği gönderme ve yanıtı işleme
 * @param {string} endpoint - API endpoint'i (başında / olmamalı)
 * @param {Object} options - fetch seçenekleri (method, headers, body, vb.)
 * @returns {Promise} - API yanıtının promise'i
 */
export const apiRequest = async (endpoint, options = {}) => {
  try {
    // Tam API URL'ini oluştur
    const url = `${API_URL}/${endpoint}`;
    
    // Varsayılan seçenekleri ayarla
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };
    
    // Eğer body varsa ve string değilse JSON'a çevir
    if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
      fetchOptions.body = JSON.stringify(fetchOptions.body);
    }
    
    // API isteğini gönder
    console.log(`API isteği: ${fetchOptions.method} ${url}`);
    const response = await fetch(url, fetchOptions);
    
    // Başarılı yanıt kontrolü
    if (!response.ok) {
      throw new Error(`API hatası: ${response.status} ${response.statusText}`);
    }
    
    // JSON yanıtını döndür
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API isteği başarısız:', error);
    
    // Hata durumunda demo moda geçiş (eğer AUTO_ACTIVATE_ON_ERROR etkinse)
    if (DEMO_MODE.AUTO_ACTIVATE_ON_ERROR && activateDemoModeCallback) {
      console.log('API hatası nedeniyle demo mod etkinleştiriliyor...');
      activateDemoModeCallback();
    }
    
    // Hatayı yukarıya iletelim ki çağıran fonksiyon da işleyebilsin
    throw error;
  }
};

/**
 * GET isteği gönderme
 * @param {string} endpoint - API endpoint'i
 * @param {Object} options - fetch seçenekleri
 * @returns {Promise} - API yanıtının promise'i
 */
export const get = (endpoint, options = {}) => {
  return apiRequest(endpoint, { ...options, method: 'GET' });
};

/**
 * POST isteği gönderme
 * @param {string} endpoint - API endpoint'i
 * @param {Object} data - Gönderilecek veriler
 * @param {Object} options - fetch seçenekleri
 * @returns {Promise} - API yanıtının promise'i
 */
export const post = (endpoint, data, options = {}) => {
  return apiRequest(endpoint, { 
    ...options, 
    method: 'POST', 
    body: data 
  });
};

/**
 * PUT isteği gönderme
 * @param {string} endpoint - API endpoint'i
 * @param {Object} data - Gönderilecek veriler
 * @param {Object} options - fetch seçenekleri
 * @returns {Promise} - API yanıtının promise'i
 */
export const put = (endpoint, data, options = {}) => {
  return apiRequest(endpoint, { 
    ...options, 
    method: 'PUT', 
    body: data 
  });
};

/**
 * DELETE isteği gönderme
 * @param {string} endpoint - API endpoint'i
 * @param {Object} options - fetch seçenekleri
 * @returns {Promise} - API yanıtının promise'i
 */
export const del = (endpoint, options = {}) => {
  return apiRequest(endpoint, { ...options, method: 'DELETE' });
};

export default {
  get,
  post,
  put,
  delete: del,
  setDemoModeActivationCallback
}; 