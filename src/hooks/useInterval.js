import { useEffect, useRef } from 'react';

/**
 * Belirli bir aralıkta callback fonksiyonunu çalıştıran hook
 * @param {Function} callback - Çalıştırılacak fonksiyon
 * @param {number|null} delay - Milisaniye cinsinden gecikme süresi, null ise interval durdurulur
 */
export const useInterval = (callback, delay) => {
  const savedCallback = useRef();

  // Son callback'i ref'te sakla
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Interval'i kur
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}; 