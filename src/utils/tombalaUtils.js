/**
 * Tombala oyunu için yardımcı fonksiyonlar
 */

/**
 * Rastgele bir tombala kartı oluşturur
 * @returns {Array} 3x9 matris şeklinde tombala kartı
 */
export const generateTombalaCard = () => {
  // 9 sütun için sayı aralıkları
  const columnRanges = [
    { start: 1, end: 9 },    // 1. sütun: 1-9
    { start: 10, end: 19 },  // 2. sütun: 10-19
    { start: 20, end: 29 },  // 3. sütun: 20-29
    { start: 30, end: 39 },  // 4. sütun: 30-39
    { start: 40, end: 49 },  // 5. sütun: 40-49
    { start: 50, end: 59 },  // 6. sütun: 50-59
    { start: 60, end: 69 },  // 7. sütun: 60-69
    { start: 70, end: 79 },  // 8. sütun: 70-79
    { start: 80, end: 90 }   // 9. sütun: 80-90
  ];

  // Her sütun için sayıları seç
  const columnNumbers = columnRanges.map(range => {
    const available = [];
    for (let i = range.start; i <= range.end; i++) {
      available.push(i);
    }
    
    // Her sütunda 0-3 arası rastgele sayı olacak
    const count = Math.floor(Math.random() * 3) + 1; // 1, 2 veya 3 sayı
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);
      selected.push(available[randomIndex]);
      available.splice(randomIndex, 1);
    }
    
    return selected.sort((a, b) => a - b);
  });

  // Boş kart oluştur (3x9 null matris)
  const card = Array(3).fill().map(() => Array(9).fill(null));
  
  // Her sütun için, seçilen sayıları rastgele satırlara yerleştir
  columnNumbers.forEach((numbers, colIndex) => {
    // Her satırda kaç sayı olduğunu takip et
    const rowCounts = [0, 0, 0];
    
    // Her sayı için rastgele bir satır seç
    numbers.forEach(number => {
      // Geçerli satırları bul (her satırda en fazla 5 sayı olabilir)
      const validRows = rowCounts.map((count, index) => count < 5 ? index : -1)
        .filter(index => index !== -1);
      
      if (validRows.length === 0) {
        // Tüm satırlar doluysa bu sayıyı atla
        return;
      }
      
      // Rastgele bir satır seç
      const randomRowIndex = validRows[Math.floor(Math.random() * validRows.length)];
      
      // Sayıyı yerleştir
      card[randomRowIndex][colIndex] = number;
      rowCounts[randomRowIndex]++;
    });
  });

  // Her satırda en az 5 sayı olmalı - eğer yoksa rastgele ekle
  card.forEach((row, rowIndex) => {
    const filledCount = row.filter(cell => cell !== null).length;
    if (filledCount < 5) {
      const additionalNeeded = 5 - filledCount;
      
      // Boş hücrelerin indekslerini bul
      const emptyCellIndices = row.map((cell, index) => cell === null ? index : -1)
        .filter(index => index !== -1);
      
      // Rastgele boş hücreleri doldur
      for (let i = 0; i < additionalNeeded; i++) {
        if (emptyCellIndices.length === 0) break;
        
        const randomEmptyIndex = Math.floor(Math.random() * emptyCellIndices.length);
        const colIndex = emptyCellIndices[randomEmptyIndex];
        
        // Bu sütun için kullanılabilir sayılar
        const range = columnRanges[colIndex];
        const available = [];
        
        for (let num = range.start; num <= range.end; num++) {
          // Sayının kartta zaten olup olmadığını kontrol et
          const isUsed = card.some(r => r[colIndex] === num);
          if (!isUsed) {
            available.push(num);
          }
        }
        
        if (available.length > 0) {
          // Rastgele bir sayı seç
          const randomNumber = available[Math.floor(Math.random() * available.length)];
          card[rowIndex][colIndex] = randomNumber;
        }
        
        // Bu hücreyi listeden çıkar
        emptyCellIndices.splice(randomEmptyIndex, 1);
      }
    }
  });

  return card;
};

/**
 * Belirtilen sayıda tombala kartı oluşturur
 * @param {number} count - Oluşturulacak kart sayısı
 * @returns {Array} Tombala kartlarının dizisi
 */
export const generateTombalaCards = (count = 1) => {
  const cards = [];
  
  for (let i = 0; i < count; i++) {
    // Her kart için benzersiz bir ID oluştur
    const card = {
      id: `card_${Date.now()}_${i}`,
      numbers: generateTombalaCard(),
      marked: []
    };
    
    cards.push(card);
  }
  
  return cards;
};

/**
 * Çinko veya tombala kazanma durumunu kontrol eder
 * @param {Array} card - Oyuncunun tombala kartı (3x9 matris)
 * @param {Array} markedNumbers - İşaretlenen numaralar
 * @returns {Object} Kazanma durumları { cinko1, cinko2, tombala }
 */
export const checkWinningCondition = (card, markedNumbers) => {
  if (!card || !markedNumbers || markedNumbers.length === 0) {
    return { cinko1: false, cinko2: false, tombala: false };
  }

  // Her satırda kaç sayı işaretlendiğini kontrol et
  const rows = [0, 1, 2].map(rowIndex => {
    // Satırdaki null olmayan sayıları filtrele
    const rowNumbers = card[rowIndex].filter(num => num !== null);
    
    // İşaretlenen sayıların bu satırdaki sayıları içerip içermediğini kontrol et
    const markedInRow = rowNumbers.filter(num => markedNumbers.includes(num));
    
    return {
      total: rowNumbers.length,
      marked: markedInRow.length,
      isComplete: markedInRow.length === rowNumbers.length
    };
  });

  // Tamamlanan satır sayısını hesapla
  const completedRows = rows.filter(row => row.isComplete).length;

  // Kazanma durumlarını belirle
  const cinko1 = completedRows >= 1;
  const cinko2 = completedRows >= 2;
  const tombala = completedRows === 3;

  return { cinko1, cinko2, tombala };
};

/**
 * Belirli bir kazanma türünün geçerli olup olmadığını kontrol eder
 * @param {Array} card - Oyuncunun tombala kartı
 * @param {Array} markedNumbers - İşaretlenen numaralar
 * @param {string} winType - Kazanma türü ('cinko1', 'cinko2', 'tombala')
 * @returns {boolean} Kazanma durumu geçerli mi
 */
export const isValidWin = (card, markedNumbers, winType) => {
  const winConditions = checkWinningCondition(card, markedNumbers);
  return winConditions[winType] || false;
};

/**
 * İki kart arasındaki farkı karşılaştırır
 * @param {Array} card1 - Birinci kart
 * @param {Array} card2 - İkinci kart
 * @returns {number} İki kart arasındaki farklı sayıların sayısı
 */
export const compareCards = (card1, card2) => {
  if (!card1 || !card2) return -1;
  
  // Her iki kartın tüm sayılarını düz dizilere çevir
  const flatCard1 = card1.flat().filter(num => num !== null);
  const flatCard2 = card2.flat().filter(num => num !== null);
  
  // Karşılaştırma
  let differences = 0;
  
  flatCard1.forEach(num => {
    if (!flatCard2.includes(num)) {
      differences++;
    }
  });
  
  flatCard2.forEach(num => {
    if (!flatCard1.includes(num)) {
      differences++;
    }
  });
  
  return differences;
};

/**
 * Tombala kartındaki tüm sayıların çekilip çekilmediğini kontrol eder
 * @param {Array} card - Oyuncunun tombala kartı
 * @param {Array} drawnNumbers - Çekilen numaralar
 * @returns {boolean} Tüm sayılar çekilmiş mi
 */
export const isCardComplete = (card, drawnNumbers) => {
  if (!card || !drawnNumbers || drawnNumbers.length === 0) {
    return false;
  }
  
  // Karttaki tüm sayıları düz bir diziye çevir
  const allNumbers = card.flat().filter(num => num !== null);
  
  // Tüm sayıların çekilip çekilmediğini kontrol et
  return allNumbers.every(num => drawnNumbers.includes(num));
};

/**
 * Karttaki işaretli sayı sayısını kontrol eder ve 15 işaretli sayı olduğunda tombala durumunu belirler
 * @param {Array} card - Oyuncunun tombala kartı
 * @param {Array} drawnNumbers - Çekilen numaralar
 * @returns {Object} Kazanma durumu ve işaretli sayı sayısı
 */
export const checkCardMarkedNumbers = (card, drawnNumbers) => {
  if (!card || !drawnNumbers || drawnNumbers.length === 0) {
    return { isTombala: false, markedCount: 0 };
  }
  
  // Karttaki tüm sayıları düz bir diziye çevir
  const allNumbers = card.flat().filter(num => num !== null);
  
  // İşaretlenen sayıları bul
  const markedNumbers = allNumbers.filter(num => drawnNumbers.includes(num));
  
  // İşaretlenen sayı sayısı
  const markedCount = markedNumbers.length;
  
  // Tombala durumu - 15 işaretli sayı olduğunda
  const isTombala = markedCount === 15;
  
  return { isTombala, markedCount };
}; 