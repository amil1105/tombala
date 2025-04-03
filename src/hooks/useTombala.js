import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  generateTombalaCard as generateTombalaCardUtil, 
  generateTombalaCards as generateTombalaCardsUtil,
  checkWinningCondition, 
  checkCardMarkedNumbers,
  drawNumber as getRandomNumber,
  isConnected,
  eventEmitter,
  initializeSocket,
  tombalaService,
  socket
} from '../utils';
import { saveGameStatus, loadSavedGameStatus, saveGameResults } from '../services/tombalaService';
import { STORAGE_KEYS } from '../utils/config';

const STORAGE_KEY = 'tombala_game_history';

// Socket olay sabitleri
const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  JOIN_LOBBY: 'join_lobby',
  LOBBY_JOINED: 'lobby_joined',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  GAME_START: 'game_start',
  DRAW_NUMBER: 'draw_number',
  NUMBER_DRAWN: 'number_drawn',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  CLAIM_CINKO: 'claim_cinko',
  CLAIM_TOMBALA: 'claim_tombala',
  CLAIM_RESULT: 'claim_result',
  CREATE_CARDS: 'create_cards',
  CARDS_CREATED: 'cards_created',
  GAME_STATUS_CHANGED: 'game_status_changed',
  PLAYERS_UPDATED: 'players_updated',
  WINNER_ANNOUNCED: 'winner_announced',
  ERROR: 'error'
};

// Socket bağlantı URL'sini düzelt
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:5000';

// API base URL'ini düzelt
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : 'http://localhost:5000/api';

// Akıllı yeniden deneme mekanizması ekle
const fetchWithRetry = async (url, options, retries = 3) => {
  try {
    const response = await fetch(url, options);
    if (response.status === 503 && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

// API istek fonksiyonu
const makeApiRequest = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20sn'ye çıkar

  try {
    const response = await fetchWithRetry(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Timeout': '20000',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP Hatası: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`API Hatası [${error.name}]:`, error.message);
    throw error;
  }
};

/**
 * Tombala oyun mantığını yöneten hook
 * @returns {Object} Oyun durumu ve fonksiyonları
 */
export const useTombala = () => {
  // Demo mod ayarını temizle
  try {
    localStorage.removeItem('tombala_demo_mode');
    console.log('useTombala: Demo mod ayarı temizlendi');
  } catch (error) {
    console.error('Demo mod ayarı temizlenirken hata:', error);
  }
  
  // Oyuncu kimliği bilgilerini başta tanımla
  const playerId = localStorage.getItem('playerId') || localStorage.getItem('tombala_playerId') || localStorage.getItem(STORAGE_KEYS.PLAYERID) || `player_${Date.now()}`;
  const playerName = localStorage.getItem('playerName') || localStorage.getItem(STORAGE_KEYS.PLAYERNAME) || 'Misafir Oyuncu';
  
  // Oyun durumu state'leri
  const [gameStatus, setGameStatus] = useState('waiting'); // waiting, playing, finished
  const [playerCards, setPlayerCards] = useState([]);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [winners, setWinners] = useState({
    cinko1: null,
    cinko2: null,
    tombala: null
  });
  const [winType, setWinType] = useState(null); // cinko1, cinko2, tombala
  const [isOnline, setIsOnline] = useState(isConnected()); // Bağlantı durumunu state'te tut
  const [socketInstance, setSocketInstance] = useState(socket); // socket örneğini state'te tut
  const [gameHistory, setGameHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
      console.error('Geçmiş oyunlar yüklenemedi:', error);
      return [];
    }
  });
  
  // Diğer state'ler
  const [gameId, setGameId] = useState(() => `game_${Date.now()}`);
  const [apiError, setApiError] = useState(null);
  const [lobbyId, setLobbyId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [players, setPlayers] = useState([]); 
  const [messages, setMessages] = useState([]); 
  const [isPaused, setIsPaused] = useState(false);
  const [drawingCompleted, setDrawingCompleted] = useState(false);
  const [drawingNumber, setDrawingNumber] = useState(false);
  const [lastDrawTime, setLastDrawTime] = useState(0); // Son sayı çekme zamanı
  
  // useRef değerleri
  const initialDataLoaded = useRef(false);
  const gameStartTime = useRef(Date.now());
  const reconnectAttemptsRef = useRef(0);
  const drawTimeoutRef = useRef(null);

  // Bir sütunda sayının daha önce kullanılıp kullanılmadığını kontrol et
  const isNumberUsedInColumn = (card, col, number) => {
    for (let row = 0; row < 3; row++) {
      if (card.rows[row][col] === number) {
        return true;
      }
    }
    return false;
  };

  // Belirli bir aralıktan rastgele benzersiz sayılar seç
  const getRandomColumns = (count, max) => {
    const columns = [];
    while (columns.length < count) {
      const col = Math.floor(Math.random() * max);
      if (!columns.includes(col)) {
        columns.push(col);
      }
    }
    return columns;
  };

  // Tombala kartı oluştur
  const generateTombalaCard = useCallback(() => {
    return generateTombalaCardUtil();
  }, []);

  // Sütunlara kaç sayı dağıtılacağını belirle (toplam 15 sayı)
  const createColumnCounts = () => {
    // Başlangıçta her sütun için 0 sayı
    const columnCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    let remainingNumbers = 15;
    
    // Her sütunda en az 1 sayı olmak üzere rastgele dağıt
    for (let col = 0; col < 9 && remainingNumbers > 0; col++) {
      columnCounts[col] = 1;
      remainingNumbers--;
    }
    
    // Kalan sayıları rastgele dağıt, en fazla her sütunda 3 sayı olabilir
    while (remainingNumbers > 0) {
      const randomCol = Math.floor(Math.random() * 9);
      if (columnCounts[randomCol] < 3) {
        columnCounts[randomCol]++;
        remainingNumbers--;
      }
    }
    
    return columnCounts;
  };

  // Her satıra 5 sayı düşecek şekilde sütunları dağıt
  const distributeNumbersToRows = (columnCounts, rowFilledColumns) => {
    // Toplam 5*3=15 sayılık bir dağılım olmalı (15 sayı)
    const totalNumbers = columnCounts.reduce((sum, count) => sum + count, 0);
    if (totalNumbers !== 15) {
      console.error(`Toplam sayı sayısı 15 olmalı, şu an ${totalNumbers} sayı var`);
      return null;
    }
    
    // Her satırda tam olarak 5 sayı olmalı
    const targetNumbersPerRow = 5;
    
    // Her satır için kullanılacak sütunları belirle
    for (let row = 0; row < 3; row++) {
      let numbersInRow = 0;
      
      // Her sütun için
      for (let col = 0; col < 9; col++) {
        // Bu sütunda kaç sayı kullanılmış
        const usedInThisColumn = rowFilledColumns.slice(0, row).filter(r => r.includes(col)).length;
        
        // Bu sütunda daha kullanılabilecek sayı var mı?
        if (usedInThisColumn < columnCounts[col]) {
          // Bu satıra 5'ten az sayı yerleştirilmişse ve bu sütun kullanılabilirse
          if (numbersInRow < targetNumbersPerRow) {
            rowFilledColumns[row].push(col);
            numbersInRow++;
          }
        }
      }
      
      // Eğer bu satırda 5 sayı yoksa, rastgele sütunlar ekleyerek tamamla
      while (numbersInRow < targetNumbersPerRow) {
        const randomCol = Math.floor(Math.random() * 9);
        const usedInThisColumn = rowFilledColumns.slice(0, row + 1).filter(r => r.includes(randomCol)).length;
        
        // Bu sütun bu satırda kullanılmamışsa ve sütunda yer varsa
        if (!rowFilledColumns[row].includes(randomCol) && usedInThisColumn < columnCounts[randomCol]) {
          rowFilledColumns[row].push(randomCol);
          numbersInRow++;
        }
      }
      
      // Satırdaki sütunları sırala
      rowFilledColumns[row].sort((a, b) => a - b);
    }
    
    return rowFilledColumns;
  };

  // Kart matrisine sayıları yerleştir
  const fillCardMatrix = (cardMatrix, rowFilledColumns, numberRanges) => {
    // Her satır için
    for (let row = 0; row < 3; row++) {
      const columnsToFill = rowFilledColumns[row];
      
      for (let i = 0; i < columnsToFill.length; i++) {
        const col = columnsToFill[i];
        const [min, max] = numberRanges[col];
        
        // Bu sütunda daha önce kullanılmış sayıları bul
        const usedNumbers = [];
        for (let r = 0; r < 3; r++) {
          if (cardMatrix[r][col] !== null) {
            usedNumbers.push(cardMatrix[r][col]);
          }
        }
        
        // Bu aralıktan kullanılmamış rastgele bir sayı seç
        let number;
        do {
          number = Math.floor(Math.random() * (max - min + 1)) + min;
        } while (usedNumbers.includes(number));
        
        // Sayıyı matrise yerleştir
        cardMatrix[row][col] = number;
      }
    }
  };
  
  // Diziyi karıştır (Fisher-Yates algoritması)
  const shuffleArray = (array) => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  // Bildirim ekleme fonksiyonu - Socket listener'lardan önce tanımlanmalı
  const addNotification = useCallback((notification) => {
    if (!notification) return;
    
    const newNotification = {
      id: Date.now(),
      timestamp: Date.now(),
      ...notification
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // 5 saniye sonra otomatik kaldır
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 5000);
    
    return newNotification;
  }, []);

  // Tombala Kartları Üretme fonksiyonu - createPlayerCards'dan önce tanımlanmalı
  const generateTombalaCards = useCallback((cardCount = 1) => {
    try {
      const cards = [];
      
      for (let c = 0; c < cardCount; c++) {
        // Kart üretim kurallarına göre her sütundaki sayı aralıkları
        const numberRanges = [
          [1, 9],     // 1. sütun: 1-9
          [10, 19],   // 2. sütun: 10-19
          [20, 29],   // 3. sütun: 20-29
          [30, 39],   // 4. sütun: 30-39
          [40, 49],   // 5. sütun: 40-49
          [50, 59],   // 6. sütun: 50-59
          [60, 69],   // 7. sütun: 60-69
          [70, 79],   // 8. sütun: 70-79
          [80, 90]    // 9. sütun: 80-90
        ];
        
        // Kart matrisi oluştur - tüm elemanları null yap
        const cardMatrix = [
          [null, null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null, null]
        ];
        
        // Her sütun için 1-3 arası sayı atanacak, toplam 15 sayı olmalı
        // Önce tüm sütunlara en az bir sayı atayalım, sonra kalan sayıları dağıtalım
        const columnCounts = Array(9).fill(1);  // Başlangıçta her sütuna 1 sayı
        let remainingNumbers = 15 - 9;  // 9 sayı dağıttık, 6 kaldı
        
        // Kalan 6 sayıyı rastgele sütunlara dağıt (her sütunda en fazla 3 sayı olabilir)
        while (remainingNumbers > 0) {
          const randomColumn = Math.floor(Math.random() * 9);
          if (columnCounts[randomColumn] < 3) {  // Sütunda en fazla 3 sayı olabilir
            columnCounts[randomColumn]++;
            remainingNumbers--;
          }
        }
        
        // Her satıra tam olarak 5 sayı düşecek şekilde sütunları dağıtalım
        const rowCounts = [0, 0, 0];  // Her satırdaki sayı miktarını tut
        
        // Tüm sütunlar için sayıları yerleştirelim
        for (let col = 0; col < 9; col++) {
          const colCount = columnCounts[col];  // Bu sütuna kaç sayı yerleştirilecek
          const [min, max] = numberRanges[col]; // Bu sütunun sayı aralığı
          
          // Bu sütun için benzersiz rastgele sayılar oluştur
          const columnNumbers = [];
          while (columnNumbers.length < colCount) {
            const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
            if (!columnNumbers.includes(randomNumber)) {
              columnNumbers.push(randomNumber);
            }
          }
          
          // Sayıları sıralayıp sütuna yerleştir
          columnNumbers.sort((a, b) => a - b);
          
          // Bu sütundaki sayıları satırlara dağıt (her satırda en fazla 5 sayı olabilir)
          for (let i = 0; i < colCount; i++) {
            // En az sayı olan satırı bul
            let minRow = 0;
            for (let r = 1; r < 3; r++) {
              if (rowCounts[r] < rowCounts[minRow]) {
                minRow = r;
              }
            }
            
            // Satıra 5'ten fazla sayı yerleştirilmeyecek
            if (rowCounts[minRow] < 5) {
              cardMatrix[minRow][col] = columnNumbers[i];
              rowCounts[minRow]++;
            }
          }
        }
        
        // Kontrol: her satırda tam olarak 5 sayı olmalı
        for (let row = 0; row < 3; row++) {
          const numbersInRow = cardMatrix[row].filter(n => n !== null).length;
          
          if (numbersInRow !== 5) {
            console.error(`Satır ${row} için sayı dağılımı hatalı! Sayı: ${numbersInRow}`);
            
            // Eğer 5'ten az sayı varsa, eksik sayıları ekle
            if (numbersInRow < 5) {
              const missingCount = 5 - numbersInRow;
              const emptyColumns = [];
              
              // Boş sütunları bul
              for (let col = 0; col < 9; col++) {
                if (cardMatrix[row][col] === null) {
                  emptyColumns.push(col);
                }
              }
              
              // Rastgele emptyColumns seçip doldur
              for (let i = 0; i < missingCount && emptyColumns.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * emptyColumns.length);
                const col = emptyColumns[randomIndex];
                const [min, max] = numberRanges[col];
                
                // Bu sütunda henüz kullanılmamış bir sayı bul
                const usedNumbers = [];
                for (let r = 0; r < 3; r++) {
                  if (cardMatrix[r][col] !== null) {
                    usedNumbers.push(cardMatrix[r][col]);
                  }
                }
                
                // Kullanılabilir sayıları bul
                const availableNumbers = [];
                for (let num = min; num <= max; num++) {
                  if (!usedNumbers.includes(num)) {
                    availableNumbers.push(num);
                  }
                }
                
                if (availableNumbers.length > 0) {
                  // Rastgele bir sayı seç
                  const randomNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
                  cardMatrix[row][col] = randomNumber;
                }
                
                // Bu sütunu listeden çıkar
                emptyColumns.splice(randomIndex, 1);
              }
            }
            // Eğer 5'ten fazla sayı varsa, fazla sayıları çıkar
            else if (numbersInRow > 5) {
              const excessCount = numbersInRow - 5;
              const filledColumns = [];
              
              // Dolu sütunları bul
              for (let col = 0; col < 9; col++) {
                if (cardMatrix[row][col] !== null) {
                  filledColumns.push(col);
                }
              }
              
              // Rastgele filledColumns seçip boşalt
              for (let i = 0; i < excessCount && filledColumns.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * filledColumns.length);
                const col = filledColumns[randomIndex];
                cardMatrix[row][col] = null;
                
                // Bu sütunu listeden çıkar
                filledColumns.splice(randomIndex, 1);
              }
            }
          }
        }
        
        // Son kontrol: Her satırda tam olarak 5 sayı var mı?
        for (let row = 0; row < 3; row++) {
          const rowNumbers = cardMatrix[row].filter(num => num !== null);
          console.assert(rowNumbers.length === 5, `Satır ${row}'de 5 sayı olmalı, şu an ${rowNumbers.length} sayı var`);
        }
        
        // Son kontrol: Toplamda tam olarak 15 sayı var mı?
        const allNumbers = cardMatrix.flat().filter(num => num !== null);
        console.assert(allNumbers.length === 15, `Toplam 15 sayı olmalı, şu an ${allNumbers.length} sayı var`);
        
        cards.push(cardMatrix);
      }
      
      return cards;
    } catch (error) {
      console.error('useTombala: Kart üretiminde hata:', error);
      return [];
    }
  }, []);

  // Oyuncu kartlarını oluştur - generateTombalaCards fonksiyonundan sonra tanımlandığından emin olalım
  const createPlayerCards = useCallback(() => {
    console.log('useTombala: Oyuncu kartları oluşturuluyor', { socketInstance, isOnline });
    
    // Socket bağlantısı varsa ve online ise sunucudan kart iste
    if (socketInstance && socketInstance.connected && isOnline) {
      console.log('useTombala: Socket bağlantısı var, sunucudan kart oluşturma isteniyor');
      
      // Sunucudan kart oluşturma isteği gönder
      socketInstance.emit(SOCKET_EVENTS.CREATE_CARDS, {
        lobbyId,
        playerId,
        count: 3 // 3 kart oluştur
      });
    } else {
      // Offline ise veya socket bağlantısı yoksa yerel olarak oluştur
      console.log('useTombala: Kart oluşturma - offline/yerel mod, socket bağlı değil');
      const generatedCards = generateTombalaCards(3);
      console.log('useTombala: Yerel oluşturulan kartlar:', generatedCards);
      setPlayerCards(generatedCards);
      
      // Önceki çekilen sayıları local storage'dan almaya çalış
      try {
        const storedNumbers = localStorage.getItem('tombala_drawn_numbers');
        if (storedNumbers) {
          const parsedNumbers = JSON.parse(storedNumbers);
          if (Array.isArray(parsedNumbers) && parsedNumbers.length > 0) {
            console.log('useTombala: Local storage\'dan çekilen sayılar yüklendi:', parsedNumbers.length);
            setDrawnNumbers(parsedNumbers);
          }
        }
        
        const storedCurrentNumber = localStorage.getItem('tombala_current_number');
        if (storedCurrentNumber) {
          const number = parseInt(storedCurrentNumber, 10);
          if (!isNaN(number)) {
            console.log('useTombala: Local storage\'dan mevcut sayı yüklendi:', number);
            setCurrentNumber(number);
          }
        }
      } catch (err) {
        console.error('useTombala: Local storage\'dan sayı yükleme hatası:', err);
      }
    }
  }, [socketInstance, isOnline, lobbyId, playerId, generateTombalaCards]);

  // Kartlar yoksa ve oyun oynanıyorsa kartları oluştur
  useEffect(() => {
    if (gameStatus === 'playing' && (!playerCards || playerCards.length === 0)) {
      console.log('useTombala: Kartlar bulunamadı, otomatik oluşturuluyor');
      // Oyun başladığında kartları hemen oluştur, socketInstance varlığını kontrol etme
      createPlayerCards();
    }
  }, [gameStatus, playerCards, createPlayerCards]);

  // Demo modu etkinleştirme fonksiyonu
  const enableDemoMode = useCallback(() => {
    console.log('useTombala: Demo mod etkinleştiriliyor...');
    
    // Demo mod ayarlarını kaydet
    localStorage.setItem('tombala_demo_mode', 'true');
    
    // Demo mod durumunu ayarla
    setIsOnline(true); // Demo modda online gibi davran
    
    // Demo oyuncuları oluştur
    const demoPlayers = [
      { id: playerId, name: playerName || 'Sen', isHost: true, isOnline: true, status: 'ready' },
      { id: 'bot1', name: 'Bot Oyuncu 1', isHost: false, isOnline: true, status: 'ready', isBot: true },
      { id: 'bot2', name: 'Bot Oyuncu 2', isHost: false, isOnline: true, status: 'ready', isBot: true },
      { id: 'bot3', name: 'Bot Oyuncu 3', isHost: false, isOnline: true, status: 'ready', isBot: true },
    ];
    
    setPlayers(demoPlayers);
    setIsHost(true); // Demo modda her zaman host ol
    
    // Eğer oyun henüz başlamadıysa, otomatik başlat
    if (gameStatus === 'waiting') {
      setGameStatus('playing');
    }
    
    // Bildirim ekle
    addNotification('Demo mod etkinleştirildi - çevrimdışı oynuyorsunuz', 'info');
  }, [playerId, playerName, gameStatus, addNotification]);

  // Bağlantıyı başlat - hook yüklendiğinde
  useEffect(() => {
    console.log('useTombala: Socket bağlantısı başlatılıyor');
    
    // URL'den lobi ID'sini al
    let finalLobbyId = lobbyId;
    
    if (!finalLobbyId) {
      // URL'den lobi ID'sini çıkarmaya çalış
      const path = window.location.pathname;
      console.log('useTombala: LobbyId URL path\'inden alındı:', path);
      
      // URL path'i "/tombala/game/:lobbyId" veya "/game/:lobbyId" formatında
      const pathSegments = path.split('/').filter(segment => segment.length > 0);
      if (pathSegments.length > 1) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment.length >= 6) {
          finalLobbyId = lastSegment;
          console.log('useTombala: Lobi ID alındı ve kaydedildi:', finalLobbyId);
          setLobbyId(finalLobbyId);
        }
      }
    }
    
    if (!finalLobbyId) {
      console.error('useTombala: Lobi ID bulunamadı, bağlantı kurulamıyor');
      return;
    }
    
    // Yeniden bağlanma sayacı
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectInterval = 3000; // 3 saniye
    
    // Demo mod etkinse temizle
    if (localStorage.getItem('tombala_demo_mode') === 'true') {
      console.log('useTombala: Demo mod ayarı temizlendi');
      localStorage.removeItem('tombala_demo_mode');
    }
    
    const connectSocket = () => {
      try {
        // Socket bağlantısını başlatmaya çalış
        const socketConn = typeof initializeSocket === 'function' 
          ? initializeSocket({
              lobbyId: finalLobbyId,
              playerId: playerId,
              playerName: playerName
            })
          : null;
      
        if (socketConn) {
          setSocketInstance(socketConn);
          reconnectAttempts = 0; // Başarılı bağlantı durumunda sıfırla
          console.log('useTombala: Socket bağlantısı başarıyla kuruldu');
          setIsOnline(true);
          
          // Bağlantı kesilme durumunu dinle
          socketConn.on('disconnect', (reason) => {
            console.warn('useTombala: Socket bağlantısı kesildi:', reason);
            setIsOnline(false);
            
            // Belirli durumlarda otomatik yeniden bağlanma dene
            if (reason === 'io server disconnect' || reason === 'transport close') {
              // Yeniden bağlanma zamanlaması
              setTimeout(() => {
                if (reconnectAttempts < maxReconnectAttempts) {
                  console.log(`useTombala: Yeniden bağlanma deneniyor (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
                  connectSocket(); // Yeniden bağlanma fonksiyonunu çağır
                  reconnectAttempts++;
                } else {
                  console.error('useTombala: Maksimum yeniden bağlanma denemesi aşıldı');
                  setApiError('Sunucuya bağlanılamadı. Lütfen daha sonra tekrar deneyin.');
                  // Demo moda geçiş
                  enableDemoMode();
                }
              }, reconnectInterval);
            }
          });
          
          // Bağlantı hatası durumunu dinle
          socketConn.on('connect_error', (error) => {
            console.error('useTombala: Socket bağlantı hatası:', error);
            setIsOnline(false);
            
            // Yeniden bağlanma dene
            if (reconnectAttempts < maxReconnectAttempts) {
              setTimeout(() => {
                console.log(`useTombala: Bağlantı hatası sonrası yeniden deneniyor (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
                connectSocket();
                reconnectAttempts++;
              }, reconnectInterval);
            } else {
              console.error('useTombala: Maksimum bağlantı hatası denemesi aşıldı, demo mod aktifleştiriliyor');
              enableDemoMode();
            }
          });
          
          // Lobiye otomatik katılımı sağla
          if (finalLobbyId && playerId) {
            console.log(`useTombala: Lobiye katılma isteği gönderiliyor - Lobi: ${finalLobbyId}, Oyuncu: ${playerId}`);
            socketConn.emit(SOCKET_EVENTS.JOIN_LOBBY, {
              lobbyId: finalLobbyId,
              playerId: playerId,
              playerName: playerName || 'Misafir Oyuncu'
            });
          }
      } else {
        console.warn('useTombala: Socket bağlantısı kurulamadı, demo mod aktif');
          setIsOnline(false);
          // Demo moda geçiş
          enableDemoMode();
      }
    } catch (socketError) {
      console.error('useTombala: Socket bağlantısı başlatılırken hata:', socketError);
        setIsOnline(false);
        
        // Offline mod için bir yeniden deneme daha
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => {
            connectSocket();
            reconnectAttempts++;
          }, reconnectInterval);
        } else {
          // Demo moda geçiş
          enableDemoMode();
        }
      }
    };
    
    // İlk bağlantıyı başlat
    connectSocket();
    
    // Temizleme işlevi
    return () => {
      console.log('useTombala: Socket bağlantısı temizleniyor');
      
      if (socketInstance) {
        // Dinleyicileri temizle
        socketInstance.off('connect');
        socketInstance.off('disconnect');
        socketInstance.off('connect_error');
        socketInstance.off(SOCKET_EVENTS.LOBBY_JOINED);
        socketInstance.off(SOCKET_EVENTS.PLAYER_JOINED);
        socketInstance.off(SOCKET_EVENTS.NUMBER_DRAWN);
        socketInstance.off(SOCKET_EVENTS.GAME_START);
        socketInstance.off(SOCKET_EVENTS.GAME_END);
        socketInstance.off(SOCKET_EVENTS.CINKO_CLAIMED);
        socketInstance.off(SOCKET_EVENTS.TOMBALA_CLAIMED);
        
        // Bağlantıyı kapat
        if (socketInstance.connected) {
          socketInstance.disconnect();
        }
      }
    };
  }, [lobbyId, playerId, playerName]);

  // Bağlantı kurulduktan sonra lobi bilgilerini al ve katıl
  useEffect(() => {
    // Socket yoksa veya lobbyId yoksa işlem yapma
    if (!socketInstance || !lobbyId) return;
    
    console.log('useTombala: Socket ve lobbyId hazır, lobiye katılma isteği gönderiliyor');

    // playerId değerini kontrol et ve gerekirse güncelle
    let currentPlayerId = playerId;
    if (!currentPlayerId || currentPlayerId === `player_${Date.now()}`) {
      currentPlayerId = localStorage.getItem('tombala_playerId') || `player_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      // Oyuncu kimliğini kaydet
      localStorage.setItem('tombala_playerId', currentPlayerId);
      localStorage.setItem('playerId', currentPlayerId);
    }
    
    // Lobiye katılma isteği gönder
    socketInstance.emit(SOCKET_EVENTS.JOIN_LOBBY, {
      lobbyId,
      playerId: currentPlayerId,
      playerName
    });
    
    // Lobi olaylarını dinle
    
    // Lobiye katılma yanıtı
    socketInstance.on(SOCKET_EVENTS.LOBBY_JOINED, (data) => {
      console.log('useTombala: Lobiye katılma yanıtı alındı:', data);
      
      // Host durumunu güncelle
      setIsHost(data.isHost);
      
      // Oyuncuları güncelle
      if (data.players && Array.isArray(data.players)) {
        console.log('useTombala: Güncellenmiş oyuncu listesi:', data.players.length, 'oyuncu');
        // Oyuncu listesindeki her bir oyuncuyu log'a yazdır
        data.players.forEach(player => {
          console.log(`Oyuncu: ${player.name}, ID: ${player.id}, Host: ${player.isHost}, Bot: ${player.isBot}`);
        });
        
        setPlayers(data.players);
      }
      
      // Çekilen sayıları güncelle
      if (data.drawnNumbers && Array.isArray(data.drawnNumbers)) {
        setDrawnNumbers(data.drawnNumbers);
      }
      
      // Oyun durumunu güncelle
      if (data.gameStatus) {
        setGameStatus(data.gameStatus);
      }
      
      // Son çekilen sayıyı güncelle
      if (data.currentNumber) {
        setCurrentNumber(data.currentNumber);
      }
      
      // Bildirim ekle
      setNotifications(prev => [
        {
          id: Date.now(),
          message: data.message || 'Lobiye katıldınız',
          type: 'success',
          timestamp: Date.now()
        },
        ...prev
      ]);
    });
    
    // Oyuncu katılım olayı
    socketInstance.on(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
      console.log('useTombala: Yeni oyuncu katıldı:', data);
      
      // Oyuncuları güncelle
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }
      
      // Bildirim ekle
      setNotifications(prev => [
        {
          id: Date.now(),
          message: `${data.playerName || 'Yeni oyuncu'} lobiye katıldı`,
          type: 'info',
          timestamp: Date.now()
        },
        ...prev
      ]);
    });
    
    // Oyuncu ayrılma olayı
    socketInstance.on(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
      console.log('useTombala: Oyuncu ayrıldı:', data);
      
      // Oyuncuları güncelle
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }
      
      // Host değişikliği varsa güncelle
      if (data.newHost) {
        const isCurrentPlayerNewHost = data.newHost === currentPlayerId;
        setIsHost(isCurrentPlayerNewHost);
        
        if (isCurrentPlayerNewHost) {
          // Bildirim ekle
          setNotifications(prev => [
            {
              id: Date.now(),
              message: 'Artık sen bu lobinin hostu oldun',
              type: 'success',
              timestamp: Date.now()
            },
            ...prev
          ]);
        }
      }
    });
    
    // Oyuncu durum güncellemesi olayı
    socketInstance.on(SOCKET_EVENTS.PLAYER_STATUS_UPDATE, (data) => {
      console.log('useTombala: Oyuncu durum güncellemesi:', data);
      
      // Oyuncuları güncelle
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }
    });
    
    // Lobi bilgileri güncellemesi
    socketInstance.on(SOCKET_EVENTS.LOBBY_INFO, (data) => {
      console.log('useTombala: Lobi bilgileri güncellendi:', data);
      
      // Oyuncuları güncelle
      if (data.players && Array.isArray(data.players)) {
        console.log('useTombala: Lobi bilgilerinden gelen oyuncular:', data.players.length, 'oyuncu');
        // Oyuncu listesindeki her bir oyuncuyu log'a yazdır
        data.players.forEach(player => {
          console.log(`Oyuncu: ${player.name}, ID: ${player.id}, Host: ${player.isHost}, Bot: ${player.isBot || false}`);
        });
        
        setPlayers(data.players);
        
        // Eğer oyuncu listesinde kendimiz varsak ve host isek, host durumunu güncelle
        const currentPlayer = data.players.find(player => player.id === currentPlayerId);
        if (currentPlayer && currentPlayer.isHost && !isHost) {
          console.log('useTombala: Lobi bilgilerinden host durumu güncellendi');
          setIsHost(true);
        }
      }
      
      // Oyun durumunu güncelle
      if (data.status) {
        setGameStatus(data.status);
      }
    });
    
    // Sayı çekilme olayı
    socketInstance.on(SOCKET_EVENTS.NUMBER_DRAWN, (data) => {
      console.log('useTombala: Yeni sayı çekildi:', data);
      
      // Sayı çekme durumunu sıfırla
      setDrawingNumber(false);
      
      // Çekilen sayıyı güncelle
      if (data.number) {
        setCurrentNumber(data.number);
        
        // Sayı başarıyla çekildi bildirimi
        addNotification({
          type: 'success',
          message: `Yeni sayı çekildi: ${data.number}`
        });
      }
      
      // Çekilen sayılar listesini güncelle
      if (data.drawnNumbers && Array.isArray(data.drawnNumbers)) {
        console.log(`useTombala: Çekilen sayılar güncellendi. Toplam: ${data.drawnNumbers.length}/90`);
        console.log(`useTombala: Çekilen sayılar: [${data.drawnNumbers.join(', ')}]`);
        
        // Sunucudan gelen güncel listeyi kullan
        setDrawnNumbers([...data.drawnNumbers]);
        
        // Local Storage'a kaydet (sayfa yenilemesi durumunda kullanmak için)
        try {
          localStorage.setItem('tombala_drawn_numbers', JSON.stringify(data.drawnNumbers));
          localStorage.setItem('tombala_current_number', data.number.toString());
          localStorage.setItem('tombala_last_update', Date.now().toString());
        } catch (err) {
          console.error('useTombala: Local storage kayıt hatası:', err);
        }
        
        // Tüm sayılar çekildiyse oyunu bitir
        if (data.drawnNumbers.length >= 90) {
          console.log('useTombala: Tüm sayılar çekildi, oyun bitiyor');
          
          // Oyun durumunu güncelle
          setGameStatus('finished');
          
          // Bildirim ekle
          addNotification({
            type: 'info',
            message: 'Tüm sayılar çekildi, oyun bitti!'
          });
        }
        
        // Kart kontrolü yap - işaretli sayıları güncelle
        if (playerCards && playerCards.length > 0) {
          console.log('useTombala: Sayılar güncellendi, kartlar kontrol ediliyor');
          const myCard = playerCards[0];
          if (myCard && myCard.numbers) {
            const allCardNumbers = myCard.numbers.flat().filter(num => num !== null);
            const markedNumbers = allCardNumbers.filter(num => data.drawnNumbers.includes(num));
            console.log(`useTombala: İşaretli sayı kontrolü: ${markedNumbers.length}/15`);
          }
        }
      } else {
        console.warn('useTombala: Sunucudan gelen çekilen sayılar dizisi bulunamadı veya geçerli değil');
      }
    });
    
    // Hata olayını dinle (özellikle sayı çekme hatası için)
    socketInstance.on('error', (error) => {
      console.error('useTombala: Socket hatası:', error);
      
      // Sayı çekme durumunu sıfırla (hata durumunda)
      setDrawingNumber(false);
      
      // Kullanıcıya bildir
      addNotification({
        type: 'error',
        message: error.message || 'Bir hata oluştu'
      });
    });
    
    // Temizleme işlevi
    return () => {
      // Socket olaylarını temizle
      socketInstance.off(SOCKET_EVENTS.LOBBY_JOINED);
      socketInstance.off(SOCKET_EVENTS.PLAYER_JOINED);
      socketInstance.off(SOCKET_EVENTS.PLAYER_LEFT);
      socketInstance.off(SOCKET_EVENTS.PLAYER_STATUS_UPDATE);
      socketInstance.off(SOCKET_EVENTS.LOBBY_INFO);
      socketInstance.off(SOCKET_EVENTS.NUMBER_DRAWN);
      socketInstance.off(SOCKET_EVENTS.GAME_START);
      socketInstance.off(SOCKET_EVENTS.GAME_END);
      socketInstance.off(SOCKET_EVENTS.CINKO_CLAIMED);
      socketInstance.off(SOCKET_EVENTS.TOMBALA_CLAIMED);
      socketInstance.off(SOCKET_EVENTS.NEW_MESSAGE);
      socketInstance.off(SOCKET_EVENTS.SYSTEM_MESSAGE);
      
      // Lobiden çık
      socketInstance.emit(SOCKET_EVENTS.LEAVE_LOBBY, {
        lobbyId,
        playerId: currentPlayerId
      });
    };
  }, [socketInstance, lobbyId]);
  
  // Hata gösterme fonksiyonu
  const showError = useCallback((message) => {
    console.error(message);
    setApiError(message);
    
    // Bildirim olarak da hata göster
    setNotifications(prev => [
      ...prev, 
      {
        id: Date.now(),
        type: 'error',
        message: message,
        timestamp: Date.now()
      }
    ]);
    
    // 5 saniye sonra bildirimi kaldır
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.message !== message));
    }, 5000);
  }, []);

  // Oyun geçmişine kayıt ekle
  const addGameHistoryEntry = useCallback((entry) => {
    if (!entry) return;
    
    // Tarih bilgisi yoksa ekle
    if (!entry.timestamp) {
      entry.timestamp = Date.now();
    }
    
    // ID yoksa ekle
    if (!entry.id) {
      entry.id = `history_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    // Oyun geçmişine ekle
    setGameHistory(prev => [...prev, entry]);
    
    return entry;
  }, []);

  // Oyun geçmişini güncelle
  const updateGameHistory = useCallback((gameData) => {
    const updatedHistory = [gameData, ...gameHistory].slice(0, 10); // Son 10 oyunu tut
    setGameHistory(updatedHistory);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Oyun geçmişi kaydedilemedi:', error);
    }
  }, [gameHistory]);

  // Lobi durumunu güncelle
  const updateLobbyStatus = useCallback(async (status) => {
    try {
      // LobbyId yoksa işlem yapma
      if (!lobbyId) {
        console.warn('Lobi ID olmadan durum güncellenemez');
        return { success: false, error: 'Lobi ID yok' };
      }

      console.log(`Lobi durumu güncelleniyor: ${status}`);
      
      // Demo mod kontrolü
      if (lobbyId.includes('demo_')) {
        console.log('Demo mod: Durum güncellendi sayılıyor');
        return { success: true, demo: true };
      }
      
      // API isteği için retry mekanizması
      const makeApiRequest = async (url, retryCount = 0) => {
        try {
          // URL'yi düzenle - tam URL eksikse
          let fullUrl = url;
          if (!url.startsWith('http')) {
            const apiHost = window.location.hostname;
            // Backend portu 5000'dir
            fullUrl = `http://${apiHost}:5000${url.startsWith('/') ? url : `/${url}`}`;
          }
          
          console.log(`API isteği yapılıyor: ${fullUrl}`);
          
          // Timeout kontrolü için
          const controller = new AbortController();
          const signal = controller.signal;
          
          // Timeout süresi artırıldı ve referansı saklandı
          const timeoutId = setTimeout(() => {
            console.log(`API isteği zaman aşımına uğradı: ${fullUrl}`);
            controller.abort('Zaman aşımı');
          }, 30000);
          
          const fetchOptions = {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ status }),
            signal
          };
          
          // Offline durumu kontrol et
          if (!navigator.onLine) {
            clearTimeout(timeoutId);
            console.log('Cihaz çevrimdışı, yerel mod kullanılıyor');
            return { success: true, offline: true, data: { status, offlineMode: true }};
          }

          const response = await fetch(fullUrl, fetchOptions);
          
          // İstek tamamlandı, timeout'u temizle
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const result = await response.json();
            console.log(`Lobi durumu API ile güncellendi (${url}):`, result);
            return { success: true, data: result };
          } else if (response.status === 401 && retryCount < 2) {
            // Token yenileme
            console.log('Token yenileniyor ve istek tekrarlanıyor...');
            localStorage.setItem('authToken', `refreshed_token_${Date.now()}`);
            return makeApiRequest(url, retryCount + 1);
          } else if (response.status === 404 && url.includes('/api/lobbies/')) {
            // ID ile güncellenemedi, code ile deneyelim
            if (!url.includes('/code/')) {
              const lobbyCode = lobbyId;
              return makeApiRequest(`/api/lobbies/code/${lobbyCode}`);
            }
          }
          
          console.warn(`Lobi durumu güncellenemedi (${url}):`, response.status);
          
          // Özel hata durumları için fallback
          if (response.status === 500 || response.status === 503) {
            console.log('Sunucu hatası, yerel mod kullanılıyor');
            return { success: true, serverError: true, data: { status, offlineMode: true }};
          }
          
          return { success: false, error: response.status };
        } catch (error) {
          console.error(`API çağrısı sırasında hata (${url}):`, error.name, error.message);
          
          // AbortError özel işleme
          if (error.name === 'AbortError') {
            console.log('İstek iptal edildi (timeout veya abort). Demo moda geçiliyor...');
            return { 
              success: true, 
              timeout: true,
              data: { 
                status, 
                offlineMode: true,
                message: 'Zaman aşımı nedeniyle çevrimdışı mod aktif'
              } 
            };
          }
          
          // Ağ hatalarında yeniden deneme
          if ((error.name === 'TypeError' || error.name === 'NetworkError' || error.message.includes('network')) && retryCount < 2) {
            console.log(`Ağ hatası, ${retryCount + 1}. yeniden deneme başlatılıyor...`);
            return new Promise(resolve => {
              setTimeout(() => {
                resolve(makeApiRequest(url, retryCount + 1));
              }, 2000);
            });
          }
          
          // Diğer hatalar için offline mod
          return { 
            success: true, 
            error: error.message,
            errorType: error.name,
            offlineMode: true,
            data: { 
              status: status, 
              offlineMode: true,
              updatedAt: new Date().toISOString() 
            } 
          };
        }
      };
      
      // Önce ID ile, başarısız olursa kod ile dene
      let result = await makeApiRequest(`/api/lobbies/${lobbyId}`);
      
      // ID ile başarısız oldu ve kod format uygunsa, kod ile dene
      if (!result.success && lobbyId.length <= 10 && !result.retried) {
        result = await makeApiRequest(`/api/lobbies/code/${lobbyId}`);
      }
      
      // Demo yanıt oluştur
      if (!result.success) {
        console.log('API güncellemesi başarısız, demo yanıt oluşturuluyor');
      return { 
        success: true, 
          demo: true, 
          data: { 
            id: lobbyId, 
            status: status, 
            updatedAt: new Date().toISOString() 
          } 
        };
      }
      
      return result;
    } catch (generalError) {
      console.error('Lobi durumu güncellenirken genel hata:', generalError);
      
      // Genel hata durumunda demo yanıt
      return { 
        success: true, 
        demo: true, 
        error: generalError.message,
        data: { 
          id: lobbyId, 
          status: status, 
          updatedAt: new Date().toISOString() 
        } 
      };
    }
  }, [lobbyId]);

  // Sonraki sayıyı çek
  const drawNextNumber = useCallback(() => {
    if (!socketInstance || !isOnline) {
      console.warn('useTombala: Sayı çekilemiyor - socket bağlantısı yok');
      // Bağlantı yok, bildirim göster
      addNotification({
        type: 'error',
        message: 'Sayı çekilemiyor: Sunucuya bağlantı yok!'
      });
      return;
    }
    
    if (gameStatus !== 'playing') {
      console.warn('useTombala: Sayı çekilemiyor - oyun başlamadı');
      // Oyun başlamadı, bildirim göster
      addNotification({
        type: 'warning',
        message: 'Sayı çekilemiyor: Oyun başlamadı!'
      });
      return;
    }
    
    if (drawingNumber) {
      console.warn('useTombala: Şu anda bir sayı çekiliyor, lütfen bekleyin');
      return;
    }
    
    // Sayı çekme durumunu güncelle
    setDrawingNumber(true);
    
    console.log('useTombala: Sayı çekme isteği gönderiliyor');
    
    // Sayı çekme isteği gönder
    socketInstance.emit(SOCKET_EVENTS.DRAW_NUMBER, {
      lobbyId,
      playerId
    });
    
    // Bildirim ekle
    addNotification({
      type: 'info',
      message: 'Yeni sayı çekiliyor...'
    });
    
    // Sayı çekme zamanını güncelle
    setLastDrawTime(Date.now());
  }, [socketInstance, isOnline, gameStatus, drawingNumber, lobbyId, playerId, addNotification]);

  // Oyun durumunu güncelle
  const setGameState = useCallback((newState) => {
    console.log('Oyun durumu güncelleniyor:', newState);
    
    // State değişkenlerini güncelle
    if (newState.gameStatus !== undefined) {
      setGameStatus(newState.gameStatus);
    }
    
    if (newState.playerCards !== undefined) {
      setPlayerCards(newState.playerCards);
    }
    
    if (newState.currentNumber !== undefined) {
      setCurrentNumber(newState.currentNumber);
    }
    
    if (newState.drawnNumbers !== undefined) {
      setDrawnNumbers(newState.drawnNumbers);
    }
    
    if (newState.winners !== undefined) {
      setWinners(newState.winners);
    }
    
    if (newState.winType !== undefined) {
      setWinType(newState.winType);
    }
    
    // Oyun durumu değiştiğinde ilgili işlemler yap
    if (newState.gameStatus === 'finished' && isOnline) {
      updateLobbyStatus('finished');
    } else if (newState.gameStatus === 'playing' && isOnline) {
      updateLobbyStatus('playing');
    }
    
    return newState;
  }, [isOnline, updateLobbyStatus]);

  // Oyuncu kartını güncelle
  const updatePlayerCard = useCallback((card) => {
    if (!card) return false;
    
    // Card ID yoksa oluştur
    if (!card.id) {
      card.id = `card_${Date.now()}`;
    }
    
    // Yerel state güncelle
    setPlayerCards(prev => {
      const existing = prev.findIndex(c => c.id === card.id);
      
      if (existing >= 0) {
        // Varolan kartı güncelle
        const updated = [...prev];
        updated[existing] = card;
        return updated;
      } else {
        // Yeni kart ekle
        return [...prev, card];
      }
    });
    
    // WebSocket ile kart güncellemesi gönder
    if (isOnline && socketInstance && socketInstance.connected) {
      socketInstance.emit('playerCardUpdate', {
        lobbyId,
        card,
        timestamp: Date.now()
      });
    }
    
    // Oyun geçmişine kaydet
    addGameHistoryEntry({
      action: 'cardUpdated',
      cardId: card.id,
      marked: card.marked,
      timestamp: Date.now()
    });
    
    return true;
  }, [lobbyId, isOnline, socketInstance, addGameHistoryEntry]);

  // Yeni oyun durumu oluştur
  const createGameState = useCallback(async (status) => {
    try {
      console.log(`Yeni oyun durumu oluşturuluyor: ${status}`);
      
      // Mevcut oyun durumunu al
      const gameState = {
        gameStatus: status,
        playerCards,
        drawnNumbers: status === 'reset' ? [] : drawnNumbers,
        currentNumber: status === 'reset' ? null : currentNumber,
        winners: status === 'reset' ? {} : winners,
        winType: status === 'reset' ? null : winType,
        updatedAt: new Date().toISOString()
      };
      
      // Eğer isHost false ise sadece durumu güncelle, API çağrısı yapma
      if (!isHost) {
        console.log('Bu kullanıcı host değil, sadece lokal durumu güncelleniyor');
        
        // Oyun durumunu güncelle - burada setGameState kullanıyoruz
        setGameState({
          gameStatus: status,
          currentNumber: status === 'reset' ? null : currentNumber,
          drawnNumbers: status === 'reset' ? [] : drawnNumbers,
          winners: status === 'reset' ? {} : winners,
          winType: status === 'reset' ? null : winType
        });
        
        return {
          status: 'success',
          message: 'Lokal oyun durumu güncellendi'
        };
      }
      
      // REST API ile lobi durum güncellemesi
      const updatedLobby = await updateLobbyStatus(status);
      if (!updatedLobby.success) {
        console.error('Lobi durumu güncellenemedi:', updatedLobby.error);
      }
      
      console.log('Lobi durumu güncellendi, oyun durumu API\'ye gönderiliyor');
      
      // WebSocket ile oyun durumunu yayınla
      if (isOnline && socketInstance && socketInstance.connected) {
        console.log('Oyun durumu socket üzerinden yayınlanıyor:', gameState);
        socketInstance.emit('gameStateUpdate', {
          gameId: lobbyId,
          gameState
        });
      }
      
      // Yeni sayı çek
      if (status === 'playing' && drawnNumbers.length === 0) {
        console.log('İlk sayı çekiliyor');
        setTimeout(() => {
          drawNextNumber();
        }, 3000);
      }
      
      // Durumu güncelle
      setGameState(gameState);
      
      // Başarılı sonucu döndür
      return {
        status: 'success',
        gameState
      };
    } catch (error) {
      console.error('Oyun durumu oluşturulurken hata:', error);
      
      // Hataya rağmen lokal durumu güncelle
      setGameState({
        gameStatus: status
      });
      
      return { status, error: error.message };
    }
  }, [lobbyId, isOnline, isHost, playerCards, drawnNumbers, currentNumber, winType, socketInstance, drawNextNumber, updateLobbyStatus, setGameState]);

  // Yeni oyun oluştur
  const createNewGame = useCallback(() => {
    // Oyunu sıfırla
    setDrawnNumbers([]);
    setCurrentNumber(null);
    setWinners({ cinko1: null, cinko2: null, tombala: null });
    
    // Yeni oyun durumu oluştur
    createGameState('waiting');
    
    return {
      gameStatus: 'waiting',
      drawnNumbers: [],
      currentNumber: null,
      winners: { cinko1: null, cinko2: null, tombala: null }
    };
  }, [createGameState]);

  // Oyun başlatma
  const startGame = useCallback(async () => {
    try {
      console.log('Oyun başlatılıyor...');
      
      // Oyun durumunu güncelle
      const gameState = createGameState('playing');
      
      // Oyuncu kartı var mı kontrol et ve HEMEN OLUŞTUR
      if (!playerCards || playerCards.length === 0) {
        console.log('Oyuncu kartı bulunamadı, yeni kart oluşturuluyor...');
        createPlayerCards();
      }
      
      // Oyun geçmişine kayıt ekle
      addGameHistoryEntry({
        action: 'gameStarted',
        timestamp: Date.now()
      });
      
      // Lobi durumunu API'de güncelle
      if (isOnline) {
        const statusResult = await updateLobbyStatus('playing');
        console.log('Lobi durumu güncelleme sonucu:', statusResult);
      }
      
      // İlk sayı çekilsin (eğer host ise veya çevrimdışı ise)
      if (!isOnline || isHost) {
        setTimeout(() => {
          drawNextNumber();
        }, 2000);
      }
      
      return gameState;
    } catch (error) {
      console.error('Oyun başlatılırken hata:', error);
      showError('Oyun başlatılamadı: ' + error.message);
      return null;
    }
  }, [createGameState, playerCards, isOnline, lobbyId, updateLobbyStatus, isHost, drawNextNumber, addGameHistoryEntry, showError, createPlayerCards]);

  // Sayı işaretleme
  const markNumber = useCallback((cardId, number) => {
    // Eğer sayı çekilmişse işaretle
    if (drawnNumbers.includes(number)) {
      // Kart durumunu güncelle (işaretlenmiş olarak)
      setPlayerCards(prev => 
        prev.map(card => 
          card.id === cardId 
            ? { ...card, marked: [...(card.marked || []), number] } 
            : card
        )
      );
    }
  }, [drawnNumbers]);

  // Yeni oyun başlatma
  const newGame = useCallback(() => {
    setGameStatus('waiting');
    setCurrentNumber(null);
    setDrawnNumbers([]);
    setWinners({ cinko1: null, cinko2: null, tombala: null });
    setWinType(null);
    
    // Yeni kartlar oluştur
    const newCard = {
      id: 'player_card',
      numbers: generateTombalaCard(),
      marked: []
    };
    setPlayerCards([newCard]);
    
    // Yeni oyun ID'si oluştur
    const newGameId = `game_${Date.now()}`;
    setGameId(newGameId);
  }, []);

  // Çinko ve Tombala kontrolü
  const checkWin = useCallback((cardId, type) => {
    const card = playerCards.find(c => c.id === cardId);
    if (!card) return false;
    
    const result = checkWinningCondition(card.numbers, drawnNumbers);
    
    if (type === 'cinko1' && result.cinko1) {
      return true;
    }
    
    if (type === 'cinko2' && result.cinko2) {
      return true;
    }
    
    if (type === 'tombala' && result.tombala) {
      return true;
    }
    
    return false;
  }, [playerCards, drawnNumbers]);

  // İlk Çinko durumunu kontrol et
  const claimCinko1 = useCallback(() => {
    const isValid = checkWin('player_card', 'cinko1');
    if (isValid && !winType) {
      setWinType('cinko1');
    }
    return isValid;
  }, [checkWin, winType]);

  // İkinci Çinko durumunu kontrol et
  const claimCinko2 = useCallback(() => {
    const isValid = checkWin('player_card', 'cinko2');
    if (isValid && winType === 'cinko1') {
      setWinType('cinko2');
    }
    return isValid;
  }, [checkWin, winType]);

  // Kazananı duyur
  const announceWin = useCallback(async (playerId, type) => {
    setWinners(prev => [...prev, playerId]);
    setWinType(type);
    setGameStatus('finished');
    
    // Bağlantı varsa sunucuya bildir
    if (isOnline) {
      eventEmitter.emit('winnerAnnounced', { playerId, type });
    }
    
    // Oyun sonuç verileri
    const resultData = {
      id: gameId,
      startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Tahmini başlangıç zamanı (5 dk önce)
      endTime: new Date().toISOString(),
      status: 'finished',
      winners: [playerId],
      winType: type,
      drawnNumbers,
      numDrawn: drawnNumbers.length
    };
    
    // Oyun sonuçlarını geçmişe kaydet
    updateGameHistory(resultData);
    
    // Oyun sonucunu API'ye kaydet
    if (isOnline) {
      try {
        await tombalaService.saveGameResult(gameId, resultData);
      } catch (error) {
        console.error('Oyun sonucu kaydedilemedi:', error);
      }
    }
  }, [isOnline, gameId, drawnNumbers, updateGameHistory]);

  // Tombala durumunu kontrol et
  const claimTombala = useCallback(() => {
    const isValid = checkWin('player_card', 'tombala');
    if (isValid && (winType === 'cinko2' || !winType)) {
      setWinType('tombala');
      setGameStatus('finished');
      setWinners(prev => Array.isArray(prev) ? [...prev, playerId] : [playerId]);
      
      // Kazananı sunucuya bildir
      if (isOnline && socket) {
        socket.emit('claim_tombala', { playerId, lobbyId });
      }
      
      // Oyun sonu bilgilerini kaydet
      announceWin(playerId, 'tombala');
    }
    return isValid;
  }, [checkWin, winType, playerId, isOnline, socket, lobbyId, announceWin]);

  // Oyunun durumunu kaydederek oyuncunun sayfa yenileme sonrası aynı kartla devam etmesini sağlayalım
  useEffect(() => {
    if (gameStatus === 'playing') {
      const gameState = {
        gameId,
        playerCards,
        drawnNumbers,
        currentNumber,
        winners,
        winType,
        gameStatus
      };
      
      try {
        localStorage.setItem('tombala_current_game', JSON.stringify(gameState));
        
        // Oyun durumunu API'ye kaydet
        if (isOnline) {
          tombalaService.saveGameStatus(gameId, {
            ...gameState,
            status: gameStatus
          })
          .then(() => console.log('Oyun durumu kaydedildi'))
          .catch(err => console.error('Oyun durumu kaydedilemedi:', err));
          
          // Lobi durumunu güncelle
          updateLobbyStatus('playing');
        }
      } catch (error) {
        console.error('Oyun durumu kaydedilemedi:', error);
      }
    } else if (gameStatus === 'finished') {
      // Oyun bittiyse MongoDB'de oyun ve lobi durumunu güncelle
      if (isOnline && winners.length > 0) {
        tombalaService.saveGameStatus(gameId, {
          status: "finished",
          winners,
          winType: winType,
          finishedAt: new Date().toISOString()
        })
        .then(() => console.log('Oyun sonuç durumu kaydedildi'))
        .catch(err => console.error('Oyun sonuç durumu kaydedilemedi:', err));
        
        // Lobi durumunu "finished" olarak güncelle
        updateLobbyStatus('finished');
      }
    }
  }, [gameId, playerCards, drawnNumbers, currentNumber, winners, winType, gameStatus, isOnline, updateLobbyStatus]);

  // Sayfa yüklendiğinde önceki oyun durumunu kontrol et
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('tombala_current_game');
      if (savedState) {
        const gameState = JSON.parse(savedState);
        // winners değişkeni undefined olabilir, bu yüzden güvenli şekilde kontrol edelim
        if (gameState.gameStatus === 'playing' && (!winners || winners.length === 0)) {
          // Önceki oyuna devam et
          setGameId(gameState.gameId);
          setPlayerCards(gameState.playerCards);
          setDrawnNumbers(gameState.drawnNumbers);
          setCurrentNumber(gameState.currentNumber);
          setWinType(gameState.winType);
          setWinners(gameState.winners || {}); // winners null/undefined ise boş dizi ata
          setGameStatus(gameState.gameStatus);
          
          console.log('Önceki oyun durumu yüklendi:', gameState);
        }
      }
    } catch (error) {
      console.error('Oyun durumu yüklenemedi:', error);
    }
  }, []);

  // Olay dinleyicilerini ayarla
  useEffect(() => {
    // Bağlantı değişikliklerini dinle
    const connectionChangeHandler = (isOnline) => {
      if (isOnline && gameStatus === 'playing') {
        // Bağlantı yeniden kurulduysa oyun durumunu senkronize et
        eventEmitter.emit('syncGameState', { 
          gameStatus, 
          drawnNumbers, 
          currentNumber, 
          winners, 
          winType 
        });
      }
    };
    
    // Olay dinleyicisini ekle
    eventEmitter.on('connectionChange', connectionChangeHandler);
    
    // Temizlik fonksiyonu
    return () => {
      // Olay dinleyicisini kaldır
      eventEmitter.removeListener('connectionChange', connectionChangeHandler);
    };
  }, [gameStatus, drawnNumbers, currentNumber, winners, winType]);

  // Oyun durumunu kaydet fonksiyonu
  const saveGameState = useCallback(() => {
    if (!lobbyId) {
      console.error('Oyun durumu kaydedilemedi: lobbyId eksik');
      return;
    }
    
    const gameState = {
      lobbyId,
      gameStatus,
      playerCards,
      playerData: players,
      drawnNumbers,
      currentNumber,
      winners,
      winType,
      lastUpdate: Date.now()
    };
    
    console.log('Oyun durumu kaydediliyor...');
    
    // tombalaService'deki saveGameStatus fonksiyonunu kullan
    saveGameStatus(lobbyId, gameState)
      .then(result => {
        if (result.success) {
          console.log('Oyun durumu kaydedildi', result);
        } else {
          console.error('Oyun durumu kaydedilemedi:', result.error);
        }
      })
      .catch(error => {
        console.error('Oyun durumu kaydetme hatası:', error);
      });
    
  }, [lobbyId, gameStatus, playerCards, players, drawnNumbers, currentNumber, winners, winType]);

  // Kaydedilmiş oyun durumunu yükle
  const loadGameState = useCallback(() => {
    try {
      console.log('Kaydedilen oyun durumu yükleniyor');
      const savedState = loadSavedGameStatus(lobbyId);
      
      if (savedState) {
        console.log('Kaydedilen oyun durumu bulundu:', savedState);
        
        if (savedState.gameStatus) setGameStatus(savedState.gameStatus);
        if (savedState.drawnNumbers) setDrawnNumbers(savedState.drawnNumbers);
        if (savedState.currentNumber !== undefined) setCurrentNumber(savedState.currentNumber);
        if (savedState.playerCards) setPlayerCards(savedState.playerCards);
        
        // Güvenli bir şekilde kazananları ayarla - hata durumunu önlemek için boş dizi varsayılan olarak
        if (savedState.winners) {
          setWinners(savedState.winners);
        } else {
          setWinners({ cinko1: null, cinko2: null, tombala: null });
        }
        
        // Oyun başlama zamanını ayarla
        if (savedState.startTime) {
          setGameStartTime(new Date(savedState.startTime));
        }
      } else {
        console.log('Kaydedilen oyun durumu bulunamadı, varsayılan durum kullanılıyor');
      }
    } catch (error) {
      console.error('Oyun durumu yüklenirken hata:', error);
    }
  }, [lobbyId]);

  // Oyun durumunu kontrol et ve gerekli adımları uygula
  useEffect(() => {
    if (gameStatus === 'playing') {
      // Oyun oynuyor ve kazanan yoksa
      if ((!winners || winners.length === 0) && playerCards.length > 0) {
        // Oyunda kazanılıp kazanılmadığını kontrol et - checkForWins() çağrısını kaldırıyoruz
        // Bu useEffect'i şimdilik tamamen pasifleştirelim
      }
    }
  }, [gameStatus, drawingCompleted, drawingNumber, playerCards, winners]);

  // useEffect içinde oyun durumu değişikliklerini takip et ve kaydet
  useEffect(() => {
    // Oyun durumu değiştiğinde kaydetme
    if (lobbyId && gameStatus === 'playing') {
      saveGameState();
    }
  }, [lobbyId, gameStatus, drawnNumbers, currentNumber, winners, saveGameState]);

  // Oyun başlangıcında kaydedilmiş durumu yükleme
  useEffect(() => {
    if (lobbyId && !initialDataLoaded.current) {
      const loaded = loadGameState();
      initialDataLoaded.current = true;
      
      if (loaded) {
        console.log('Kaydedilmiş oyun durumu başarıyla yüklendi');
      }
    }
  }, [lobbyId, loadGameState]);

  // Oyun sonuçlarını kaydet
  const saveGameResult = useCallback((resultData) => {
    if (!lobbyId) return;
    
    const gameResult = {
      lobbyId,
      winners: resultData.winners || winners,
      winType: resultData.winType || winType,
      players: players,
      drawnNumbers,
      completedAt: new Date().toISOString(),
      duration: Date.now() - gameStartTime.current
    };
    
    // tombalaService'in saveGameResults fonksiyonunu kullan
    saveGameResults(lobbyId, gameResult)
      .then(result => {
        console.log('Oyun sonuçları kaydedildi:', result);
      })
      .catch(error => {
        console.error('Oyun sonuçları kaydetme hatası:', error);
      });
  }, [lobbyId, winners, winType, players, drawnNumbers]);

  // Kart durumunu kontrol et ve gerekirse otomatik tombala talep et
  useEffect(() => {
    if (gameStatus !== 'playing' || !drawnNumbers || drawnNumbers.length === 0 || !playerCards || playerCards.length === 0) {
      return; // Koşullar sağlanmazsa kontrolü atla
    }
    
    try {
      // Oyuncunun kartını bul - farklı kart formatlarını destekle
      const myCard = playerCards.find(c => c.id === 'player_card') || playerCards[0];
      if (!myCard) return;
      
      // Kartın sayılarını al - farklı kart formatlarını destekle
      let cardNumbers;
      if (myCard.numbers && Array.isArray(myCard.numbers)) {
        // numbers bir matris ise (2D array)
        cardNumbers = myCard.numbers.flat().filter(num => num !== null);
      } else if (Array.isArray(myCard)) {
        // Kart doğrudan bir matris ise (2D array)
        cardNumbers = myCard.flat().filter(num => num !== null);
      } else {
        console.error('Kart formatı tanınamadı:', myCard);
        return;
      }
      
      // Kartın işaretli sayılarını bul
      const markedNumbers = cardNumbers.filter(num => drawnNumbers.includes(num));
      console.log(`Kart işaretli sayı kontrolü: ${markedNumbers.length}/15`);
      
      // Tüm sayılar işaretlendiyse (Tombala)
      if (markedNumbers.length >= 15 && gameStatus === 'playing') {
        console.log('15 işaretli sayı tespit edildi! Tombala durumu.');
        
        // Eğer daha önce tombala yapılmadıysa
        if (!winners.tombala) {
          // Oyun durumunu güncelle - önce yerel durumu değiştir
          setWinType('tombala');
          setGameStatus('finished');
          
          // Kazananlar listesini güncelle
          setWinners(prev => ({
            ...prev,
            tombala: {
              playerId,
              playerName,
              timestamp: Date.now(),
              totalMarked: markedNumbers.length
            }
          }));
          
          // Sunucuya tombala talebini gönder
          if (socketInstance && socketInstance.connected && isOnline) {
            console.log('Tombala talebi sunucuya gönderiliyor:', {
              lobbyId,
              playerId,
              playerName,
              totalMarked: markedNumbers.length
            });
            
            // Tombala talebi gönder
            socketInstance.emit('claim_tombala', {
              lobbyId,
              playerId,
              playerName,
              totalMarked: markedNumbers.length,
              message: 'Tombala! Tüm sayılar işaretlendi!'
            });
            
            // Bildirim ekle
            addNotification({
              type: 'success',
              message: 'Tombala! Tüm sayıları işaretlediniz!'
            });
          } else if (!isOnline) {
            // Çevrimdışı modda (demo mod) otomatik olarak kazananı belirle
            console.log('Demo modda tombala yapıldı');
            
            // Bildirim ekle
            addNotification({
              type: 'success',
              message: 'Tombala! Tüm sayıları işaretlediniz!'
            });
            
            // Oyun sonucunu yerel olarak kaydet
            const gameResult = {
              lobbyId: lobbyId || 'demo',
              playerId,
              playerName,
              gameStatus: 'finished',
              winners: {
                tombala: {
                  playerId,
                  playerName,
                  timestamp: Date.now(),
                  totalMarked: 15
                }
              },
              winType: 'tombala',
              completedAt: new Date().toISOString()
            };
            
            // Oyun sonucunu kaydet
            try {
              localStorage.setItem('tombala_last_game', JSON.stringify(gameResult));
            } catch (error) {
              console.error('Oyun sonucu kaydedilemedi:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Kart kontrolü sırasında hata:', error);
    }
  }, [gameStatus, drawnNumbers, playerCards, playerId, playerName, isOnline, socketInstance, lobbyId, winners, addNotification, setWinType, setGameStatus, setWinners]);

  // Socket olaylarını dinle (yeni sayı çekilmesi, oyun başlaması/bitmesi vb.)
  useEffect(() => {
    // Socket veya lobbyId yoksa işlem yapma
    if (!socketInstance || !lobbyId) return;
    
    console.log('useTombala: Socket olayları dinleniyor', { 
      socketID: socketInstance.id, 
      isConnected: socketInstance?.connected || false 
    });
    
    // Lobiye katılma sonucu
    socketInstance.on(SOCKET_EVENTS.LOBBY_JOINED, (data) => {
      console.log('useTombala: Lobiye katıldınız:', data);
      
      // gameStatus'u güncelle
      if (data.gameStatus) {
        setGameStatus(data.gameStatus);
        
        // Oyun durumunu local storage'a kaydet
        try {
          localStorage.setItem('tombala_game_status', data.gameStatus);
        } catch (err) {
          console.error('useTombala: Local storage\'a oyun durumu kaydedilemedi:', err);
        }
      }
      
      // Çekilen sayıları güncelle
      if (data.drawnNumbers && Array.isArray(data.drawnNumbers)) {
        setDrawnNumbers(data.drawnNumbers);
        
        // Son çekilen sayıyı güncelle
        if (data.currentNumber) {
          setCurrentNumber(data.currentNumber);
        }
        
        // Çekilen sayıları local storage'a kaydet
        try {
          localStorage.setItem('tombala_drawn_numbers', JSON.stringify(data.drawnNumbers));
          if (data.currentNumber) {
            localStorage.setItem('tombala_current_number', data.currentNumber.toString());
          }
        } catch (err) {
          console.error('useTombala: Local storage\'a sayılar kaydedilemedi:', err);
        }
      }
      
      // Oyuncuları güncelle
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
        
        // Eğer oyuncu listesinde kendimiz varsak ve host isek, host durumunu güncelle
        const currentPlayer = data.players.find(player => player.id === playerId);
        if (currentPlayer && currentPlayer.isHost) {
          setIsHost(true);
        }
      }
      
      // Bildirim ekle
      setNotifications(prev => [
        {
          id: Date.now(),
          message: data.message || 'Lobiye katıldınız',
          type: 'success',
          timestamp: Date.now()
        },
        ...prev
      ]);
    });
    
    // Temizleme işlevi
    return () => {
      if (socketInstance) {
        socketInstance.off(SOCKET_EVENTS.LOBBY_JOINED);
      }
    };
  }, [socketInstance, lobbyId, playerId]);

  // Hook'un dönüş değeri
  return {
    gameStatus,
    playerCards,
    currentNumber,
    drawnNumbers,
    winners,
    winType,
    isOnline,
    gameHistory,
    apiError,
    lobbyId,
    isHost,
    notifications,
    players,
    messages,
    isPaused,
    socket: socketInstance,
    // Eklemeler - drawingCompleted ve drawingNumber değişkenlerini ekliyoruz
    drawingCompleted,
    drawingNumber,
    // checkForWins fonksiyonunu çıkarıyoruz
    
    // Fonksiyonlar
    createNewGame,
    createPlayerCards,
    drawNextNumber,
    updatePlayerCard,
    checkWin,
    claimCinko1,
    claimCinko2,
    claimTombala,
    announceWin,
    setLobbyId,
    setIsHost,
    setGameState,
    addGameHistoryEntry,
    showError,
    updateLobbyStatus,
    addNotification
  };
};

export default useTombala; 