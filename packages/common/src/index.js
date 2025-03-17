// API URL'si - sabit değer kullan
const API_URL = typeof window !== 'undefined' && window.APP_CONFIG 
  ? window.APP_CONFIG.API_URL 
  : 'http://localhost:5000';

export { API_URL };

// Socket.io fonksiyonlarını dışa aktar
export { 
  initializeSocket,
  getSocket,
  closeSocket,
  joinLobby,
  startGame,
  emitDrawNumber,
  announceWin,
  onPlayersUpdate,
  onNumberDrawn,
  onGameStatusUpdate,
  onWinnerAnnounced
} from './server.js';

/**
 * Tombala kartı oluştur
 * @returns {Array} - 3 satır ve satır başına 5 sayıdan oluşan tombala kartı
 */
export const generateTombalaCard = () => {
  // Tombala kartı için 3 satır, her satırda 9 hücre oluşturma (her satırda 5 sayı olacak)
  const card = [
    Array(9).fill(null),
    Array(9).fill(null),
    Array(9).fill(null),
  ];

  // Her sütun için kullanılabilir sayıları tanımla (1-90 arası)
  const columns = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9],           // 1. sütun: 1-9
    [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], // 2. sütun: 10-19
    [20, 21, 22, 23, 24, 25, 26, 27, 28, 29], // 3. sütun: 20-29
    [30, 31, 32, 33, 34, 35, 36, 37, 38, 39], // 4. sütun: 30-39
    [40, 41, 42, 43, 44, 45, 46, 47, 48, 49], // 5. sütun: 40-49
    [50, 51, 52, 53, 54, 55, 56, 57, 58, 59], // 6. sütun: 50-59
    [60, 61, 62, 63, 64, 65, 66, 67, 68, 69], // 7. sütun: 60-69
    [70, 71, 72, 73, 74, 75, 76, 77, 78, 79], // 8. sütun: 70-79
    [80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90] // 9. sütun: 80-90
  ];

  // Her sütun için 1, 2 veya 3 sayı seç (toplam 15 sayı)
  for (let colIndex = 0; colIndex < 9; colIndex++) {
    const colNumbers = columns[colIndex];
    
    // Bu sütun için kaç sayı seçileceğini belirle (1, 2 veya 3 satırda değer olacak)
    let numbersInColumn;
    
    if (colIndex === 0 || colIndex === 8) {
      // İlk ve son sütunda genellikle daha az sayı olur
      numbersInColumn = Math.floor(Math.random() * 2) + 1; // 1 veya 2
    } else {
      numbersInColumn = Math.floor(Math.random() * 2) + 1; // 1 veya 2 (3 de olabilir ama kartta toplam 15 sayı olmalı)
    }
    
    // Bu sütun için rastgele satırlar seç
    const selectedRows = [];
    while (selectedRows.length < numbersInColumn) {
      const row = Math.floor(Math.random() * 3);
      if (!selectedRows.includes(row)) {
        selectedRows.push(row);
      }
    }
    
    // Seçilen satırlara sayı yerleştir
    selectedRows.forEach(rowIndex => {
      const randomIndex = Math.floor(Math.random() * colNumbers.length);
      card[rowIndex][colIndex] = colNumbers[randomIndex];
      // Seçilen sayıyı listeden çıkar (tekrar kullanılmasın)
      colNumbers.splice(randomIndex, 1);
    });
  }

  // Her satırda tam olarak 5 sayı olmasını sağla (bazı sütunlar boş olacak)
  // Önce her satırdaki sayı adedini kontrol et
  const rowCounts = card.map(row => row.filter(cell => cell !== null).length);
  
  // Her satırı 5 sayıya tamamla veya fazla sayıları kaldır
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    const numbersInRow = rowCounts[rowIndex];
    
    if (numbersInRow > 5) {
      // Fazla sayıları kaldır
      let toRemove = numbersInRow - 5;
      for (let colIndex = 0; colIndex < 9 && toRemove > 0; colIndex++) {
        if (card[rowIndex][colIndex] !== null) {
          card[rowIndex][colIndex] = null;
          toRemove--;
        }
      }
    } else if (numbersInRow < 5) {
      // Eksik sayıları tamamla
      let toAdd = 5 - numbersInRow;
      for (let colIndex = 0; colIndex < 9 && toAdd > 0; colIndex++) {
        if (card[rowIndex][colIndex] === null && columns[colIndex].length > 0) {
          const randomIndex = Math.floor(Math.random() * columns[colIndex].length);
          card[rowIndex][colIndex] = columns[colIndex][randomIndex];
          columns[colIndex].splice(randomIndex, 1);
          toAdd--;
        }
      }
    }
  }

  return card;
};

/**
 * Tombala için sayı çekme
 * @param {Array} drawnNumbers - Daha önce çekilmiş sayıların listesi
 * @returns {number|null} - Çekilen sayı veya tüm sayılar çekilmişse null
 */
export const drawNumber = (drawnNumbers) => {
  const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  const availableNumbers = allNumbers.filter(num => !drawnNumbers.includes(num));
  
  if (availableNumbers.length === 0) {
    return null; // Tüm sayılar çekilmiş
  }
  
  const randomIndex = Math.floor(Math.random() * availableNumbers.length);
  return availableNumbers[randomIndex];
};

/**
 * Kazanma durumunu kontrol et
 * @param {Array} card - Tombala kartı
 * @param {Array} drawnNumbers - Çekilmiş sayılar
 * @returns {Object} - Kazanma durumları (cinko1, cinko2, tombala)
 */
export const checkWinningCondition = (card, drawnNumbers) => {
  // Karttan sadece sayılar olan hücreleri al (null olmayanlar)
  const flattenedCard = card.map(row => row.filter(cell => cell !== null));
  
  // Her satır için eşleşme sayısını hesapla
  const rowMatches = flattenedCard.map(row => {
    return row.filter(num => drawnNumbers.includes(num)).length;
  });
  
  // Kazanma durumlarını kontrol et
  const cinko1 = rowMatches.some(matches => matches === 5); // Bir satırda tüm sayılar çekildi
  const cinko2 = rowMatches.filter(matches => matches === 5).length >= 2; // İki satırda tüm sayılar çekildi
  const tombala = rowMatches.every(matches => matches === 5); // Tüm satırlarda tüm sayılar çekildi
  
  return {
    cinko1,
    cinko2,
    tombala
  };
}; 