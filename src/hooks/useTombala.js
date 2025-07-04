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
  ERROR: 'error',
  CINKO1_CLAIMED: 'cinko1_claimed',
  CINKO2_CLAIMED: 'cinko2_claimed',
  UPDATE_LOBBY_SETTINGS: 'update_lobby_settings',
  LOBBY_SETTINGS_UPDATED: 'lobby_settings_updated',
  GAME_UPDATE: 'game_update'
};

// Geliştirme ortamında localhost kontrolü
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';

// Socket bağlantı URL'ini düzelt
const SOCKET_URL = isLocalhost
  ? 'http://localhost:5000'
  : window.location.origin;

// WebSocket URL'ini düzelt
const WS_URL = process.env.NODE_ENV === 'production'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  : 'ws://localhost:5000/ws';

// API base URL'ini düzelt
const API_BASE_URL = '/api';

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
  const [autoDrawEnabled, setAutoDrawEnabled] = useState(true); // Otomatik sayı çekme durumu
  const [countdownTimer, setCountdownTimer] = useState(10); // Geri sayım sayacı
  const [drawingCompleted, setDrawingCompleted] = useState(false);
  const [drawingNumber, setDrawingNumber] = useState(false);
  const [lastDrawTime, setLastDrawTime] = useState(0); // Son sayı çekme zamanı
  const [lobbyData, setLobbyData] = useState(null); // Lobi verisini tutacak state
  // Ses ayarları için state'ler ekle
  const [soundEnabled, setSoundEnabled] = useState(true); // Ses varsayılan olarak açık
  
  // Lobi ayarları için state
  const [lobbySettings, setLobbySettings] = useState(() => {
    // Yerel depolamadan ayarları almaya çalış
    try {
      const savedSettings = localStorage.getItem('tombala_lobby_settings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (error) {
      console.error('Lobi ayarları yüklenemedi:', error);
    }
    
    // Varsayılan ayarlar
    return {
      manualNumberDrawPermission: 'host-only', // 'host-only', 'all-players'
      gameSpeed: 'normal', // 'slow', 'normal', 'fast'
      enableMusic: true
    };
  });
  
  // LobbySettings değiştiğinde localStorage'a kaydet
  useEffect(() => {
    try {
      localStorage.setItem('tombala_lobby_settings', JSON.stringify(lobbySettings));
      // Manuel sayı çekme iznini ayrıca kaydet (reconnect için)
      localStorage.setItem('tombala_manual_draw_permission', lobbySettings.manualNumberDrawPermission);
    } catch (error) {
      console.error('Lobi ayarları kaydedilemedi:', error);
    }
  }, [lobbySettings]);
  
  // useRef değerleri
  const initialDataLoaded = useRef(false);
  const gameStartTime = useRef(Date.now());
  const reconnectAttemptsRef = useRef(0);
  const drawTimeoutRef = useRef(null);
  const audioRef = useRef(null); // Ses için ref

  // Ses çalma fonksiyonu
  const playNumberSound = useCallback(() => {
    try {
      if (!soundEnabled) return;
      
      // Web Audio API kullanarak basit bir bip sesi oluştur
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 800; // 800 Hz
      gainNode.gain.value = 0.1; // Ses seviyesi
      
      oscillator.start();
      
      // 200ms sonra sesi durdur
      setTimeout(() => {
        oscillator.stop();
        // İkinci bip sesi
        setTimeout(() => {
          const oscillator2 = audioContext.createOscillator();
          oscillator2.connect(gainNode);
          oscillator2.type = 'sine';
          oscillator2.frequency.value = 1000; // 1000 Hz
          oscillator2.start();
          
          // 200ms sonra ikinci sesi durdur
          setTimeout(() => {
            oscillator2.stop();
          }, 200);
        }, 100);
      }, 200);
    } catch (error) {
      console.error('Ses çalma fonksiyonunda hata:', error);
    }
  }, [soundEnabled]);

  // Ses durumunu değiştir
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
    try {
      localStorage.setItem('tombala_sound_enabled', (!soundEnabled).toString());
    } catch (error) {
      console.error('Ses ayarı kaydedilemedi:', error);
    }
  }, [soundEnabled]);

  // Ses ayarını localStorage'dan yükle
  useEffect(() => {
    try {
      const savedSoundSetting = localStorage.getItem('tombala_sound_enabled');
      if (savedSoundSetting !== null) {
        setSoundEnabled(savedSoundSetting === 'true');
      }
    } catch (error) {
      console.error('Ses ayarı yüklenemedi:', error);
    }
  }, []);

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
    
    // Demo mod etkinse temizle
    if (localStorage.getItem('tombala_demo_mode') === 'true') {
      console.log('useTombala: Demo mod ayarı temizlendi');
      localStorage.removeItem('tombala_demo_mode');
    }
    
    // Socket bağlantı parametrelerini hazırla
    const socketParams = {
      lobbyId: finalLobbyId,
      playerId,
      playerName
    };
    
    // Socket bağlantısını başlat
    const newSocket = initializeSocket(socketParams);
    
    // Socket başarıyla oluşturulduysa, state'i güncelle
    if (newSocket && (!socketInstance || newSocket.id !== socketInstance.id)) {
      console.log('useTombala: Yeni socket bağlantısı oluşturuldu');
      setSocketInstance(newSocket);
      setIsOnline(true);
    }
    
    // Temizleme işlevi
    return () => {
      console.log('useTombala: Socket bağlantısı temizleniyor');
      
      // Sadece hook unmount olduğunda bağlantıyı kapat, her state değişiminde değil
      // NOT: Socket bağlantısını burada kapatmıyoruz, çünkü yeni bağlantı aynı
      // socket nesnesini tekrar kullanabilir
    };
  }, [lobbyId, playerId, playerName]); // socketInstance bağımlılığını kaldırdık

  // Socket ve lobbyId mevcut olduğunda dinleyicileri ekle
  useEffect(() => {
    // Socket yoksa veya lobbyId yoksa işlem yapma
    if (!socketInstance || !lobbyId) {
        console.log('useTombala: Socket veya Lobi ID eksik, olay dinleyicileri eklenmiyor.');
      return;
    }

    console.log('useTombala: Socket ve lobbyId hazır, olay dinleyicileri ekleniyor', { socketId: socketInstance.id });

    // playerId değerini kontrol et ve gerekirse güncelle
    let currentPlayerId = playerId;
    if (!currentPlayerId || currentPlayerId === `player_${Date.now()}`) {
      currentPlayerId = localStorage.getItem('tombala_playerId') || `player_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      // Oyuncu kimliğini kaydet
      localStorage.setItem('tombala_playerId', currentPlayerId);
      localStorage.setItem('playerId', currentPlayerId);
      console.log('useTombala: Yeni oyuncu ID oluşturuldu/yüklendi:', currentPlayerId);
    }

    // Lobiye katılma isteği gönder (eğer zaten bağlı değilse)
    console.log('useTombala: Lobiye katılma isteği gönderiliyor (useEffect içinden)');
    socketInstance.emit(SOCKET_EVENTS.JOIN_LOBBY, {
      lobbyId,
      playerId: currentPlayerId,
      playerName
    });

    // --- Olay Dinleyicileri --- 

    // Lobiye katılma yanıtı
    const handleLobbyJoined = (data) => {
      console.log('useTombala: Lobiye katılma yanıtı alındı:', data);
      
      // Host durumunu backend'den gelen veri ile belirle
      if (data.isHost !== undefined) {
        setIsHost(data.isHost);
        console.log('Host durumu backend tarafından belirlendi:', data.isHost);
      }
      
      if (data.players && Array.isArray(data.players)) {
        // Players dizisini güncellerken host bilgisini de doğrula
        const updatedPlayers = data.players.map(player => ({
          ...player,
          // Backend tarafından gelen host bilgisini koru
          isHost: player.isHost
        }));
        setPlayers(updatedPlayers);
        
        // ID'yi normalize etme yardımcı fonksiyonu
        const normalizeId = (id) => {
          if (!id) return '';
          return typeof id === 'string' ? id : id.toString();
        };
        
        // Aynı zamanda kendi oyuncu kimliğimize göre players dizisindeki host durumumuzu kontrol edelim
        const playerIdStr = normalizeId(playerId);
        const currentPlayer = updatedPlayers.find(p => {
          const pIdStr = normalizeId(p.id);
          return pIdStr === playerIdStr || 
            (pIdStr.includes(playerIdStr) && playerIdStr.length > 5) || 
            (playerIdStr.includes(pIdStr) && pIdStr.length > 5);
        });
        
        if (currentPlayer && currentPlayer.isHost !== undefined) {
          console.log('Players dizisinden host durumu güncelleniyor:', currentPlayer.isHost);
          setIsHost(currentPlayer.isHost);
        }
      }
      
      if (data.drawnNumbers && Array.isArray(data.drawnNumbers)) {
        setDrawnNumbers(data.drawnNumbers);
      }
      
      if (data.gameStatus) {
        setGameStatus(data.gameStatus);
      }
      
      if (data.currentNumber) {
        setCurrentNumber(data.currentNumber);
      }
      
      // Lobi verilerini güncelle
      if (data.lobby) {
        console.log('Lobi verileri güncellendi:', data.lobby);
        setLobbyData(data.lobby);
        
        // Eğer creator bilgisi varsa, bunu kontrol et
        if (data.lobby.creator) {
          // ID'leri normalize et
          const normalizeId = (id) => {
            if (!id) return '';
            return typeof id === 'string' ? id : id.toString();
          };
          
          // MongoDB ObjectId olarak kaydedilmiş olabilir, string'e çevirelim
          const creatorId = normalizeId(data.lobby.creator);
          const currentPlayerId = normalizeId(playerId);
          
          // Geliştirilmiş karşılaştırma
          const isCurrentPlayerCreator = 
            creatorId === currentPlayerId || 
            (creatorId.includes(currentPlayerId) && currentPlayerId.length > 5) ||
            (currentPlayerId.includes(creatorId) && creatorId.length > 5);
          
          console.log(`Detaylı creator kontrolü: ${creatorId} === ${currentPlayerId} = ${isCurrentPlayerCreator}`);
          
          // Host durumu farklı ise güncelle
          if (isCurrentPlayerCreator !== isHost) {
            console.log('Host durumu creator bilgisiyle güncelleniyor:', isCurrentPlayerCreator);
            setIsHost(isCurrentPlayerCreator);
          }
        }
      }
      
      // Her sayı çekildiğinde gereksiz bildirim tekrarını önlemek için kaldırıyorum
      // addNotification({ message: data.message || 'Lobiye katıldınız', type: 'success' });
    };
    socketInstance.on(SOCKET_EVENTS.LOBBY_JOINED, handleLobbyJoined);

    // Oyuncu katılım olayı
    const handlePlayerJoined = (data) => {
      console.log('useTombala: Yeni oyuncu katıldı:', data);
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }
      
      // Oyuncu katılma bildirimi göstermeyi kaldırıyorum
      // Gereksiz tekrarlayan bildirimler önlenmiş olacak
      // addNotification({ message: `${data.playerName || 'Yeni oyuncu'} lobiye katıldı`, type: 'info' });
    };
    socketInstance.on(SOCKET_EVENTS.PLAYER_JOINED, handlePlayerJoined);

    // Oyuncu ayrılma olayı
    const handlePlayerLeft = (data) => {
      console.log('useTombala: Oyuncu ayrıldı:', data);
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }
      if (data.newHost) {
        const isCurrentPlayerNewHost = data.newHost === currentPlayerId;
        setIsHost(isCurrentPlayerNewHost);
        if (isCurrentPlayerNewHost) {
          addNotification({ message: 'Artık sen bu lobinin hostu oldun', type: 'success' });
        }
      }
      addNotification({ message: `${data.playerName || 'Bir oyuncu'} lobiden ayrıldı`, type: 'warning' });
    };
    socketInstance.on(SOCKET_EVENTS.PLAYER_LEFT, handlePlayerLeft);

    // Sayı çekilme olayı
    const handleNumberDrawn = (data) => {
      console.log('Yeni sayı çekildi:', data);
      
      // Oyun bitmiş durumda ise işlem yapma
      if (gameStatus === 'finished' || winners.tombala !== null) {
        console.log('Oyun bitmiş durumda, sayı güncellemesi yapılmıyor');
        // Sadece sayı çekme durumunu sıfırla ve çık
        setDrawingNumber(false);
        
        // Otomatik çekmeyi de kapat
        if (autoDrawEnabled) {
          setAutoDrawEnabled(false);
          
          // Sunucuya da otomatik çekmenin kapatıldığını bildir
          if (socketInstance && socketInstance.connected) {
            socketInstance.emit(SOCKET_EVENTS.GAME_UPDATE, {
              lobbyId,
              isPaused: true,
              autoDrawEnabled: false,
              gameStatus: 'finished',
              timestamp: Date.now()
            });
          }
        }
        
        return;
      }
      
      // Çekilen sayıları güncelle
      if (data.drawnNumbers && Array.isArray(data.drawnNumbers)) {
        setDrawnNumbers(data.drawnNumbers);
      }
      
      // Mevcut sayıyı güncelle
      if (data.number !== undefined) {
        setCurrentNumber(data.number);
      }
      
      // Sayaç süresini güncelle - backend'den gelen değer
      if (data.countdown !== undefined) {
        setCountdownTimer(data.countdown);
      }
      
      // Duraklatma durumunu güncelle
      if (data.isPaused !== undefined) {
        setIsPaused(data.isPaused);
      }
      
      // Otomatik çekme durumunu güncelle
      if (data.autoDrawEnabled !== undefined) {
        setAutoDrawEnabled(data.autoDrawEnabled);
      }
      
      // Sayı çekme durumunu sıfırla, butonun tekrar aktif olmasını sağla
      setDrawingNumber(false);
      
      // Ses çal
      if (soundEnabled) {
        playNumberSound();
      }
    };
    // Bu satırı tamamen kaldırıyorum - sayı çekme olayı için başka bir listener var
    // socketInstance.on(SOCKET_EVENTS.NUMBER_DRAWN, handleNumberDrawn);

    // Hata olayını dinle
    const handleError = (error) => {
      console.error('useTombala: Socket hatası:', error);
      setDrawingNumber(false);
      
      // Eğer oyun bitmişse, hata mesajlarını gösterme
      if (gameStatus === 'finished') {
        console.log('Oyun bitti, hata mesajı gösterilmiyor');
        return;
      }
      
      // "Sadece lobi sahibi oyun durumunu değiştirebilir!" hatasını yakala ve yoksay
      if (error.message && (
        error.message.includes('Sadece lobi sahibi oyun durumunu değiştirebilir') ||
        error.message.includes('Oyun durumu değiştirebilir')
      )) {
        console.log('Oyun durumu değiştirme hatası yoksayılıyor:', error.message);
        
        // Herkesin oyun durumunu değiştirebilmesini sağla - lokal state güncelle
        if (winners && winners.tombala) {
          console.log('Oyunun zaten kazananı var, finished durumuna geçiliyor');
          setGameStatus('finished');
        }
        
        return; // Hatayı yoksay ve bildirim gösterme
      }
      
      // Hata mesajlarını kontrol edelim ve bazılarını filtreleyip sessiz hale getirelim
      if (error.message) {
        const errorMessage = error.message.toLowerCase();
        
        // Oyun bittiğinde oluşan hataları sessizce geçiştir
        if (
          errorMessage.includes('oyun durumu güncellenirken') || 
          errorMessage.includes('sayı çekilirken') || 
          errorMessage.includes('sayı çekme işlemi sırasında')
        ) {
          // Oyun bitişinden sonra olan hataları sessizce işle
          if (gameStatus === 'finished' || winners.tombala !== null) {
            console.log('Oyun bittiği için bu hata sessizce geçiştiriliyor:', error.message);
            return;
          }
        }
        
        // Manuel sayı çekme hatası özel kontrolü
        if (error.message && error.message.includes('Sadece lobi sahibi')) {
          // Manuel sayı çekme yetkisi hatası görünür bir şekilde bildirilecek
          console.log('Manuel sayı çekme yetkisi hatası');
          
          // Bildirim göster
          addNotification({ 
            type: 'warning', 
            message: 'Sayı çekme izni reddedildi. Sadece lobi sahibi manuel sayı çekebilir.'
          });
          
          return;
        }
      }
      
      // Diğer tüm hatalar için normal bildirim göster
      addNotification({ type: 'error', message: error.message || 'Bir sunucu hatası oluştu' });
    };
    socketInstance.on(SOCKET_EVENTS.ERROR, handleError); // 'error' standard event

    // Kartların oluşturulduğu olay
    const handleCardsCreated = (data) => {
      console.log('useTombala: Sunucudan kartlar alındı', data);
      if (data.cards && Array.isArray(data.cards)) {
        setPlayerCards(data.cards); 
        addNotification({ type: 'success', message: 'Tombala kartlarınız oluşturuldu!' });
      } else {
        console.error('Sunucudan geçersiz kart verisi alındı');
        addNotification({ type: 'error', message: 'Kartlar oluşturulamadı.' });
      }
    };
    socketInstance.on(SOCKET_EVENTS.CARDS_CREATED, handleCardsCreated);

    // Oyun Başlama olayı
    const handleGameStart = (data) => {
        console.log('useTombala: Oyun başladı (sunucu olayı):', data);
        setGameStatus('playing');
        setDrawnNumbers(data.drawnNumbers || []);
        setCurrentNumber(data.currentNumber || null);
        setWinners({ cinko1: null, cinko2: null, tombala: null }); // Kazananları sıfırla
        setIsPaused(data.isPaused || false);
        
        // ID'yi normalize etme yardımcı fonksiyonu
        const normalizeId = (id) => {
          if (!id) return '';
          return typeof id === 'string' ? id : id.toString();
        };
        
        // Eğer players bilgisi gelmişse, güncelleyelim
        if (data.players && Array.isArray(data.players)) {
            console.log('Oyun başlatma olayında oyuncu listesi güncelleniyor:', data.players);
            setPlayers(data.players);
            
            // Kendi ID'miz ile host durumumuzu güncelleyelim
            const playerIdStr = normalizeId(playerId);
            const currentPlayer = data.players.find(p => {
              const pIdStr = normalizeId(p.id);
              return pIdStr === playerIdStr || 
                (pIdStr.includes(playerIdStr) && playerIdStr.length > 5) || 
                (playerIdStr.includes(pIdStr) && pIdStr.length > 5);
            });
            
            if (currentPlayer && currentPlayer.isHost !== undefined) {
                console.log('Host durumu oyun başlatma olayında güncelleniyor:', currentPlayer.isHost);
                setIsHost(currentPlayer.isHost);
            }
        }
        
        // Lobi bilgilerini güncelleyelim
        if (data.lobby) {
            console.log('Lobi verileri oyun başlatma olayında güncelleniyor:', data.lobby);
            setLobbyData(data.lobby);
            
            // Lobi creator bilgisi ile host durumumuzu güncelleyelim
            if (data.lobby.creator) {
                // ID'leri normalize et
                const normalizeId = (id) => {
                  if (!id) return '';
                  return typeof id === 'string' ? id : id.toString();
                };
                
                const creatorId = normalizeId(data.lobby.creator);
                const currentPlayerId = normalizeId(playerId);
                
                // Geliştirilmiş karşılaştırma
                const isCurrentPlayerCreator = 
                    creatorId === currentPlayerId || 
                    (creatorId.includes(currentPlayerId) && currentPlayerId.length > 5) ||
                    (currentPlayerId.includes(creatorId) && creatorId.length > 5);
                    
                if (isCurrentPlayerCreator !== isHost) {
                    console.log('Host durumu creator bilgisiyle oyun başlatma olayında güncelleniyor:', isCurrentPlayerCreator);
                    setIsHost(isCurrentPlayerCreator);
                }
            }
        }
        
        addNotification({ type: 'info', message: data.message || 'Oyun başladı!' });
        
        // Oyun başladığında kartlar otomatik istenir veya oluşturulur
        if (!playerCards || playerCards.length === 0) {
            createPlayerCards(); 
        }
    };
    socketInstance.on(SOCKET_EVENTS.GAME_START, handleGameStart);

    // Oyun Durumu Değişikliği (Örn: Pause/Resume)
    const handleGameStatusChanged = (data) => {
        console.log('useTombala: Oyun durumu değişti:', data);
        
        if(data.gameStatus) {
            setGameStatus(data.gameStatus);
            
            // Eğer oyun bittiyse, sayı çekme ve sayaç işlemlerini durdur
            if (data.gameStatus === 'finished') {
              console.log('Oyun bitti, tüm sayı çekme işlemleri durduruluyor');
              setAutoDrawEnabled(false);
              setIsPaused(true);
              setCountdownTimer(0);
              
              // Olası zamanlayıcıları temizle
              if (drawTimeoutRef.current) {
                clearTimeout(drawTimeoutRef.current);
                drawTimeoutRef.current = null;
              }
              
              // Sunucuya da oyunun bittiğini ve durakladığını bildir
              if (socketInstance && socketInstance.connected) {
                socketInstance.emit(SOCKET_EVENTS.GAME_UPDATE, {
                  lobbyId,
                  isPaused: true,
                  autoDrawEnabled: false,
                  gameStatus: 'finished',
                  timestamp: Date.now()
                });
              }
              
              // Bildirim ekle
              addNotification({
                type: 'info',
                message: 'Oyun sona erdi!'
              });
            }
        }
        
        if(data.isPaused !== undefined) {
            // Eğer oyun bittiyse, her zaman duraklatılmış olarak ayarla
            if (gameStatus === 'finished' || winners.tombala !== null) {
              setIsPaused(true);
            } else {
              setIsPaused(data.isPaused);
            }
            
            // autoDrawEnabled durumunu da güncelle
            if(data.autoDrawEnabled !== undefined) {
              // Oyun bittiyse, otomatik çekmeyi her zaman kapat
              if (gameStatus === 'finished' || winners.tombala !== null) {
                setAutoDrawEnabled(false);
              } else {
                setAutoDrawEnabled(data.autoDrawEnabled);
              }
            }
            
            // Oyun durumu değiştiğinde sayacı güncelle
            if (data.countdown && !data.isPaused && gameStatus !== 'finished') {
              // Duraklatma kaldırıldıysa ve oyun bitmemişse sayacı sıfırla
              setCountdownTimer(data.countdown);
            }
            
            // Host olmayan oyuncular için bildirim göster
            if (!isHost && gameStatus !== 'finished') {
              addNotification({ 
                type: 'warning', 
                message: data.isPaused ? 'Oyun duraklatıldı.' : 'Oyun devam ediyor.' 
              });
            }
        }
    };
    socketInstance.on(SOCKET_EVENTS.GAME_STATUS_CHANGED, handleGameStatusChanged);

    // Yeni Mesaj olayı
    const handleNewMessage = (data) => {
        console.log('useTombala: Yeni mesaj alındı:', data);
        setMessages(prev => [...prev, data]);
    };
    socketInstance.on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);

    // Çinko 1 Kazanma olayı
    const handleCinko1Claimed = (data) => {
      console.log('useTombala: Çinko 1 yapıldı (olay dinleyici):', data);
      setWinners(prev => ({ ...prev, cinko1: { playerId: data.playerId, playerName: data.playerName || 'Bilinmeyen', timestamp: data.timestamp || Date.now() } }));
      addNotification({ type: 'success', message: `${data.playerName || 'Bilinmeyen'} 1. ÇİNKO yaptı!` });
    };
    socketInstance.on(SOCKET_EVENTS.CINKO1_CLAIMED, handleCinko1Claimed);

    // Çinko 2 Kazanma olayı
    const handleCinko2Claimed = (data) => {
      console.log('useTombala: Çinko 2 yapıldı (olay dinleyici):', data);
      setWinners(prev => ({ ...prev, cinko2: { playerId: data.playerId, playerName: data.playerName || 'Bilinmeyen', timestamp: data.timestamp || Date.now() } }));
      addNotification({ type: 'success', message: `${data.playerName || 'Bilinmeyen'} 2. ÇİNKO yaptı!` });
    };
    socketInstance.on(SOCKET_EVENTS.CINKO2_CLAIMED, handleCinko2Claimed);

    // Kazanan Anonsu (Tombala için)
    const handleWinnerAnnounced = (data) => {
      console.log('useTombala: Kazanan anons edildi (Tombala):', data);
      
      // Bot veya kullanıcı farketmeksizin kazananı işle
      if (data.playerId) {
        setWinners(prev => ({
          ...prev,
          tombala: {
            playerId: data.playerId,
            playerName: data.playerName || 'Bilinmeyen Oyuncu',
            timestamp: data.timestamp || Date.now(),
            totalMarked: data.totalMarked || 15,
            isBot: data.isBot || false
          }
        }));
        
        // Oyun durumunu finished olarak ayarla
        setGameStatus('finished');
        
        // Oyun bittiğinde otomatik sayı çekmeyi ve sayacı durdur
        setAutoDrawEnabled(false);
        setIsPaused(true);
        setCountdownTimer(0);
        
        // Olası zamanlayıcıları temizle
        if (drawTimeoutRef.current) {
          clearTimeout(drawTimeoutRef.current);
          drawTimeoutRef.current = null;
        }
        
        // Sunucuya da oyunun bittiğini ve durakladığını bildir
        if (socketInstance && socketInstance.connected) {
          console.log('Sunucuya oyunun bittiği bildiriliyor');
          socketInstance.emit(SOCKET_EVENTS.GAME_UPDATE, {
            lobbyId,
            isPaused: true,
            autoDrawEnabled: false,
            gameStatus: 'finished',
            timestamp: Date.now()
          });
        }
        
        addNotification({ type: 'success', message: `${data.playerName || 'Bilinmeyen Oyuncu'} TOMBALA yaptı! Oyun bitti.` });
      }
    };
    socketInstance.on(SOCKET_EVENTS.WINNER_ANNOUNCED, handleWinnerAnnounced);

    // Temizleme işlevi
    return () => {
      console.log('useTombala: Olay dinleyicileri temizleniyor', { socketId: socketInstance.id });
      // Socket olaylarını temizle
      socketInstance.off(SOCKET_EVENTS.LOBBY_JOINED, handleLobbyJoined);
      socketInstance.off(SOCKET_EVENTS.PLAYER_JOINED, handlePlayerJoined);
      socketInstance.off(SOCKET_EVENTS.PLAYER_LEFT, handlePlayerLeft);
      socketInstance.off(SOCKET_EVENTS.NUMBER_DRAWN, handleNumberDrawn);
      socketInstance.off(SOCKET_EVENTS.GAME_START, handleGameStart);
      socketInstance.off(SOCKET_EVENTS.ERROR, handleError);
      socketInstance.off(SOCKET_EVENTS.CARDS_CREATED, handleCardsCreated);
      socketInstance.off(SOCKET_EVENTS.GAME_STATUS_CHANGED, handleGameStatusChanged);
      socketInstance.off(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
      socketInstance.off(SOCKET_EVENTS.CINKO1_CLAIMED, handleCinko1Claimed);
      socketInstance.off(SOCKET_EVENTS.CINKO2_CLAIMED, handleCinko2Claimed);
      socketInstance.off(SOCKET_EVENTS.WINNER_ANNOUNCED, handleWinnerAnnounced);
    };
  }, [socketInstance, lobbyId, playerId, playerName, addNotification, createPlayerCards, playerCards, gameStatus, isHost, autoDrawEnabled, drawingNumber, soundEnabled, playNumberSound, winners]);

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
    // Oyun bitti kontrolü
    if (gameStatus === 'finished' || winners.tombala !== null) {
      console.log('useTombala: Oyun bitmiş durumda, sayı çekilemiyor');
      addNotification({
        type: 'warning',
        message: 'Oyun sona erdi, sayı çekilemiyor!'
      });
      return;
    }
    
    // Socket bağlantısını daha güvenilir şekilde kontrol et
    const isSocketConnected = socketInstance && socketInstance.connected;
    
    // Daha iyi bir socket bağlantı kontrolü
    if (!isSocketConnected) {
      console.warn('useTombala: Sayı çekilemiyor - socket bağlantısı yok');
      
      // Socket var ama bağlı değilse, yeniden bağlanmayı dene
      if (socketInstance && !socketInstance.connected) {
        console.log('useTombala: Socket var ama bağlı değil, yeniden bağlanmaya çalışılıyor...');
        
        try {
          // Yeniden bağlanmayı dene
          socketInstance.connect();
          
          // Bağlantı durumunu kontrol et
          setTimeout(() => {
            if (socketInstance.connected) {
              console.log('useTombala: Socket yeniden bağlandı, sayı çekme tekrar deneniyor...');
              // Bağlantı başarılı olduysa, sayı çekmeyi tekrar dene
              drawNextNumber();
              return;
            } else {
              console.warn('useTombala: Socket yeniden bağlanamadı');
              // Bağlantı başarısız olursa, bildirim göster
              addNotification({
                type: 'error',
                message: 'Sunucuya bağlanılamadı. Lütfen sayfayı yenileyip tekrar deneyin.'
              });
            }
          }, 1000);
          
          // Bu aşamada hala bağlantı kurulamadı, bildirim göster
          addNotification({
            type: 'warning',
            message: 'Sunucu bağlantısı kuruluyor, lütfen bekleyin...'
          });
          return;
        } catch (error) {
          console.error('useTombala: Socket yeniden bağlanma hatası:', error);
        }
      }
      
      // Socket hiç yok ise bildirim göster
      addNotification({
        type: 'error',
        message: 'Sayı çekilemiyor: Sunucuya bağlantı yok!'
      });
      
      return;
    }
    
    // Oyun durumu kontrolü
    if (gameStatus !== 'playing') {
      console.warn('useTombala: Sayı çekilemiyor - oyun başlamadı');
      // Oyun başlamadı, bildirim göster
      addNotification({
        type: 'warning',
        message: 'Sayı çekilemiyor: Oyun başlamadı!'
      });
      return;
    }
    
    // Sayı çekme işlemi zaten devam ediyor mu?
    if (drawingNumber) {
      console.warn('useTombala: Şu anda bir sayı çekiliyor, lütfen bekleyin');
      return;
    }
    
    // Sayı çekme yetkisi kontrolü - Daha net ve detaylı kontrol
    const canDrawNumber = isHost || (lobbySettings && lobbySettings.manualNumberDrawPermission === 'all-players');
    
    if (!canDrawNumber) {
      console.warn('useTombala: Manuel sayı çekme yetkisi yok - Ayarlara göre sadece host sayı çekebilir');
      addNotification({
        type: 'warning',
        message: 'Sadece lobi sahibi sayı çekebilir!'
      });
      return;
    }
    
    // Sayı çekme durumunu güncelle
    setDrawingNumber(true);
    
    console.log('useTombala: Manuel sayı çekme isteği gönderiliyor', { 
      isPaused, 
      isManualDraw: true, 
      lobbySettings,
      manualDrawPermission: lobbySettings.manualNumberDrawPermission,
      isHost,
      socketId: socketInstance?.id
    });
    
    // Sayı çekme isteği gönder - manuel çekme durumunda otomatik çekme durumunu değiştirmemeli
    try {
      socketInstance.emit(SOCKET_EVENTS.DRAW_NUMBER, {
        lobbyId,
        playerId,
        isManualDraw: true, // Manuel çekme olduğunu belirt
        keepPausedState: isPaused, // Duraklatma durumunu koru
        keepAutoDrawState: !isPaused, // Eğer oyun duraklatılmışsa, otomatik çekmeyi kapalı tut
        manualDrawPermission: lobbySettings?.manualNumberDrawPermission || 'host-only', // İzin ayarını backend'e gönder
        isHost: isHost, // Host olup olmadığını backende doğru şekilde bildir - override yapma
        timestamp: Date.now()
      });
      
      // Bildirim ekle
      addNotification({
        type: 'info',
        message: 'Yeni sayı çekiliyor...'
      });
      
      // Ses efekti çal - eğer ses açıksa
      if (soundEnabled) {
        playNumberSound();
      }
      
      // Sayı çekme zamanını güncelle
      setLastDrawTime(Date.now());
      
      // Socket olayını gönderme hatası için timeout
      drawTimeoutRef.current = setTimeout(() => {
        // Hala çekiliyor durumundaysa, bir hata olmuş olabilir
        if (drawingNumber) {
          console.warn('useTombala: Sayı çekme işlemi zaman aşımına uğradı');
          setDrawingNumber(false);
          
          // Bildirim göster
          addNotification({
            type: 'warning',
            message: 'Sayı çekme işlemi zaman aşımına uğradı, lütfen tekrar deneyin.'
          });
        }
      }, 5000);
      
    } catch (error) {
      console.error('useTombala: Sayı çekme isteği gönderilirken hata:', error);
      setDrawingNumber(false);
      
      // Bildirim göster
      addNotification({
        type: 'error',
        message: 'Sayı çekilemiyor: ' + (error.message || 'Bilinmeyen hata')
      });
    }
  }, [socketInstance, isOnline, gameStatus, drawingNumber, lobbyId, playerId, addNotification, isHost, lobbySettings, isPaused, soundEnabled, playNumberSound, winners]);

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

  // Karttaki sayıyı işaretle
  const markNumber = useCallback((number) => {
    if (!number) return;
    
    // Sayı çekildi mi kontrol et
    if (!drawnNumbers.includes(number)) {
      addNotification({
        type: 'warning',
        message: 'Bu sayı henüz çekilmedi!'
      });
      return;
    }
    
    // Sadece son çekilen sayı işaretlenebilir
    if (number === currentNumber) {
      // Oyuncunun kartlarını kontrol et ve sayıyı işaretle
      setPlayerCards(prevCards => {
        const newCards = [...prevCards];
        
        for (let i = 0; i < newCards.length; i++) {
          const card = newCards[i];
          
          // Kartların formatını kontrol et
          if (card.numbers) {
            // Kartın satırlarını kontrol et
            for (let row = 0; row < card.numbers.length; row++) {
              for (let col = 0; col < card.numbers[row].length; col++) {
                if (card.numbers[row][col] === number) {
                  if (!card.marked) card.marked = [];
                  if (!card.marked.includes(number)) {
                    card.marked.push(number);
                  }
                }
              }
            }
          }
        }
        
        return newCards;
      });
      
      // Bildirim göster
      addNotification({ 
        type: 'success', 
        message: `${number} sayısı işaretlendi!` 
      });
    } else {
      // Son çekilen sayı değilse uyarı göster
      addNotification({ 
        type: 'warning', 
        message: `Sadece son çekilen sayı (${currentNumber}) işaretlenebilir.` 
      });
    }
  }, [drawnNumbers, currentNumber, addNotification]);

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
    
    // Botlar için özel kontrol - players dizisindeki bot oyuncuları kontrol et
    if (isHost && players && Array.isArray(players) && socketInstance && socketInstance.connected) {
      // Bu dizide botların son çekilen sayıya tepki vermesini sağla
      const bots = players.filter(p => p.isBot === true);
      
      if (bots.length > 0) {
        console.log(`${bots.length} bot için kontrol yapılıyor`);
        
        // Son sayı çekildiğinde botların şans ile kazanmasını sağla
        const randomBot = bots[Math.floor(Math.random() * bots.length)];
        
        // Çinko 1 kontrolü
        if (!winners.cinko1) {
          // %15 ihtimalle bot çinko1 yapsın
          if (Math.random() < 0.15 && drawnNumbers.length >= 15) {
            console.log(`Bot ${randomBot.name || 'Bot'} 1. ÇİNKO yapıyor!`);
            
            // Bot için çinko1 bildir
            socketInstance.emit(SOCKET_EVENTS.CLAIM_CINKO, {
              lobbyId,
              playerId: randomBot.id,
              playerName: randomBot.name || 'Bot Oyuncu',
              cinkoType: 'cinko1',
              isBot: true
            });
            
            // Kazananı hemen güncelle
            setWinners(prev => ({
              ...prev,
              cinko1: {
                playerId: randomBot.id,
                playerName: randomBot.name || 'Bot Oyuncu',
                timestamp: Date.now(),
                isBot: true
              }
            }));
            
            // Bildirim göster
            addNotification({
              type: 'success',
              message: `${randomBot.name || 'Bot Oyuncu'} 1. ÇİNKO yaptı!`
            });
          }
        }
        // Çinko 2 kontrolü - eğer çinko 1 yapıldıysa
        else if (winners.cinko1 && !winners.cinko2) {
          // %12 ihtimalle bot çinko2 yapsın
          if (Math.random() < 0.12 && drawnNumbers.length >= 20) {
            console.log(`Bot ${randomBot.name || 'Bot'} 2. ÇİNKO yapıyor!`);
            
            // Bot için çinko2 bildir
            socketInstance.emit(SOCKET_EVENTS.CLAIM_CINKO, {
              lobbyId,
              playerId: randomBot.id,
              playerName: randomBot.name || 'Bot Oyuncu',
              cinkoType: 'cinko2',
              isBot: true
            });
            
            // Kazananı hemen güncelle
            setWinners(prev => ({
              ...prev,
              cinko2: {
                playerId: randomBot.id,
                playerName: randomBot.name || 'Bot Oyuncu',
                timestamp: Date.now(),
                isBot: true
              }
            }));
            
            // Bildirim göster
            addNotification({
              type: 'success',
              message: `${randomBot.name || 'Bot Oyuncu'} 2. ÇİNKO yaptı!`
            });
          }
        }
        // Tombala kontrolü - eğer çinko 2 yapıldıysa
        else if (winners.cinko2 && !winners.tombala) {
          // %10 ihtimalle bot tombala yapsın
          if (Math.random() < 0.10 && drawnNumbers.length >= 30) {
            console.log(`Bot ${randomBot.name || 'Bot'} TOMBALA yapıyor!`);
            
            // Bot için tombala bildir
            socketInstance.emit('claim_tombala', {
              lobbyId,
              playerId: randomBot.id,
              playerName: randomBot.name || 'Bot Oyuncu',
              totalMarked: 15,
              isBot: true,
              message: `${randomBot.name || 'Bot'} TOMBALA yaptı!`
            });
            
            // Kazananı hemen güncelle
            setWinners(prev => ({
              ...prev,
              tombala: {
                playerId: randomBot.id,
                playerName: randomBot.name || 'Bot Oyuncu',
                timestamp: Date.now(),
                totalMarked: 15,
                isBot: true
              }
            }));
            
            // Oyunu bitir
            setGameStatus('finished');
            
            // Bildirim göster
            addNotification({
              type: 'success',
              message: `${randomBot.name || 'Bot Oyuncu'} TOMBALA yaptı!`
            });
          }
        }
      }
    }
    
    // Kullanıcının kendi kartı için normal kontrol devam etsin
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
          
          // Kazananlar listesini güncelle - varsayılan bilgilerle hemen güncelle
          setWinners(prev => ({
            ...prev,
            tombala: {
              playerId,
              playerName,
              timestamp: Date.now(),
              totalMarked: markedNumbers.length
            }
          }));
          
          setGameStatus('finished');
          
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
          }
        }
      }
    } catch (error) {
      console.error('Kart kontrolü sırasında hata:', error);
    }
  }, [gameStatus, drawnNumbers, currentNumber, playerCards, playerId, playerName, isOnline, socketInstance, lobbyId, winners, addNotification, setWinType, setGameStatus, setWinners, isHost, players, SOCKET_EVENTS]);

  // Lobi verilerini al
  const fetchLobbyData = useCallback(async () => {
    if (!lobbyId) return;

    try {
      // Demo mod kontrolü veya API istekleri başarısız olursa kullanılacak
      const createDemoLobby = () => {
        console.log('Demo lobi oluşturuluyor');
        // Mevcut oyunculardan creator ID'yi bulmaya çalış
        let creatorId = playerId;
        
        // Eğer lobi verisinde creator ID varsa onu kullan
        if (lobbyData && lobbyData.creator) {
          creatorId = lobbyData.creator;
        }
        
        // Mevcut oyunculardan host olabilecek bir oyuncu bul
        if (players && players.length > 0) {
          // Önce isHost özelliği true olan bir oyuncu ara
          const hostPlayer = players.find(p => p.isHost === true);
          if (hostPlayer) {
            creatorId = hostPlayer.user || hostPlayer.id || hostPlayer._id;
          }
        }
        
        const demoLobbyData = {
          _id: lobbyId,
          name: "Tombala Lobisi",
          game: "bingo",
          creator: creatorId, // Creator ID'yi doğru şekilde ayarla
          players: players.length > 0 ? players.map(p => p.user || p.id || p._id) : [playerId],
          maxPlayers: 6,
          status: gameStatus || "playing",
          playersDetail: players.length > 0 ? players : [{
            user: playerId,
            name: playerName,
            isReady: true,
            isBot: false
          }]
        };
        
        console.log('Demo lobi oluşturuldu:', demoLobbyData);
        setLobbyData(demoLobbyData);
        return demoLobbyData;
      };
      
      // Demo mod kontrolü
      if (lobbyId.includes('demo_')) {
        console.log('Demo mod: Lobi verileri simüle ediliyor');
        return createDemoLobby();
      }

      // Token al
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // API'den lobi verilerini al
      console.log(`Lobi verilerini alıyorum: ${API_BASE_URL}/lobbies/${lobbyId}`);
      
      // API isteğini dene
      try {
        // Yetkilendirme hatalarını önlemek için demo mod kullan
        console.log('API isteklerinde yetkilendirme sorunları olduğu için demo mod kullanılıyor');
        return createDemoLobby();

        /* API istekleri şu an çalışmadığı için yorum satırına alındı
        const response = await fetch(`${API_BASE_URL}/lobbies/${lobbyId}`, {
          headers: token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } : {
            'Content-Type': 'application/json'
          },
          // Timeout ekle
          signal: AbortSignal.timeout(10000) // 10 saniye timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Lobi verileri alındı:', data);
          setLobbyData(data);
          return data;
        }
        
        // Hata durumunda lobbyCode ile tekrar dene
        console.log(`ID ile lobi bulunamadı (${response.status}), lobbyCode ile deneniyor`);
        
        // LobbyCode ile deneme
        if (lobbyId.length <= 10) { // LobbyCode genellikle kısa olur
          try {
            const lobbyCodeResponse = await fetch(`${API_BASE_URL}/lobbies/code/${lobbyId}`, {
              headers: token ? {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              } : {
                'Content-Type': 'application/json'
              },
              signal: AbortSignal.timeout(10000) // 10 saniye timeout
            });
            
            if (lobbyCodeResponse.ok) {
              const data = await lobbyCodeResponse.json();
              console.log('Lobi verileri lobbyCode ile alındı:', data);
              setLobbyData(data);
              return data;
            }
          } catch (codeError) {
            console.error('LobbyCode ile istek hatası:', codeError);
          }
        }
        */
        
        // API istekleri başarısız oldu, demo lobi oluştur
        console.warn('API istekleri başarısız oldu, demo lobi kullanılacak');
        return createDemoLobby();
      } catch (fetchError) {
        console.error('Fetch hatası:', fetchError);
        // Fetch hatası durumunda demo lobi oluştur
        return createDemoLobby();
      }
    } catch (error) {
      console.error('Lobi verileri alınırken hata:', error);
      
      // Hata durumunda demo lobi oluştur
      const demoLobbyData = {
        _id: lobbyId,
        name: "Tombala Lobisi",
        game: "bingo",
        creator: playerId, // Varsayılan olarak mevcut oyuncuyu creator yap
        players: players.length > 0 ? players.map(p => p.user || p.id || p._id) : [playerId],
        maxPlayers: 6,
        status: gameStatus || "playing",
        playersDetail: players.length > 0 ? players : [{
          user: playerId,
          name: playerName,
          isReady: true,
          isBot: false
        }]
      };
      setLobbyData(demoLobbyData);
      
      addNotification({ type: 'warning', message: 'Lobi verileri alınamadı, demo mod kullanılıyor' });
      return demoLobbyData;
    }
  }, [lobbyId, playerId, playerName, addNotification, players, gameStatus, lobbyData]);

  // Lobi verilerini yükle
  useEffect(() => {
    if (lobbyId && !lobbyData) {
      fetchLobbyData();
    }
  }, [lobbyId, lobbyData, fetchLobbyData]);

  // Mesaj gönderme fonksiyonu
  const sendMessage = useCallback((message) => {
    if (!socketInstance || !message || message.trim() === '') return;

    const messageData = {
      lobbyId,
      playerId,
      playerName,
      message: message.trim(),
      timestamp: Date.now()
    };

    console.log('Mesaj gönderiliyor:', messageData);
    
    // Socket üzerinden mesaj gönder
    if (socketInstance && socketInstance.connected) {
      socketInstance.emit(SOCKET_EVENTS.SEND_MESSAGE, messageData);
    }

    // Mesajı yerel olarak da ekle
    setMessages(prev => [...prev, messageData]);

    return true;
  }, [socketInstance, lobbyId, playerId, playerName]);

  // Lobi ayarlarını güncelleme fonksiyonu
  const updateLobbySettings = useCallback((settings) => {
    if (!socketInstance || !isHost || !lobbyId) {
      console.warn('Ayarlar güncellenemiyor: Socket bağlantısı yok veya host değilsiniz');
      addNotification({
        type: 'error',
        message: 'Ayarlar güncellenemiyor: Host değilsiniz veya bağlantı sorunu var!'
      });
      return false;
    }
    
    console.log('Lobi ayarları güncelleniyor:', settings);
    
    // Önce yerel ayarları güncelle (bunu hemen yapalım, görsel olarak da değişsin)
    if (settings) {
      setLobbySettings(prevSettings => ({
        ...prevSettings,
        ...settings
      }));
    }
    
    // Socket üzerinden ayarları güncelle
    socketInstance.emit(SOCKET_EVENTS.UPDATE_LOBBY_SETTINGS, {
      lobbyId,
      settings,
      playerId,
      isHost
    });
    
    // Bildirim ekle
    addNotification({
      type: 'info',
      message: 'Lobi ayarları güncelleniyor...'
    });
    
    return true;
  }, [socketInstance, isHost, lobbyId, playerId, addNotification]);
  
  // Lobi ayarları güncellendiğinde dinle
  useEffect(() => {
    if (!socketInstance) return;
    
    // Lobi ayarları güncellendiğinde
    const handleLobbySettingsUpdated = (data) => {
      console.log('Lobi ayarları güncellendi:', data);
      
      if (data && data.settings) {
        setLobbySettings(prevSettings => ({
          ...prevSettings,
          ...data.settings
        }));
        
        // Bildirim ekle
        addNotification({
          type: 'success',
          message: 'Lobi ayarları güncellendi'
        });
      }
    };
    
    // Olay dinleyicisini ekle
    socketInstance.on(SOCKET_EVENTS.LOBBY_SETTINGS_UPDATED, handleLobbySettingsUpdated);
    
    // Temizleme işlevi
    return () => {
      socketInstance.off(SOCKET_EVENTS.LOBBY_SETTINGS_UPDATED, handleLobbySettingsUpdated);
    };
  }, [socketInstance, addNotification]);

  // Socket olaylarını dinle
  useEffect(() => {
    if (!socketInstance) return;

    // Sayı çekildiğinde
    const handleNumberDrawn = (data) => {
      console.log('Yeni sayı çekildi:', data);
      
      // Oyun bitmiş durumda ise işlem yapma
      if (gameStatus === 'finished' || winners.tombala !== null) {
        console.log('Oyun bitmiş durumda, sayı güncellenmedi');
        // Sayı çekme durumunu sıfırla
        setDrawingNumber(false);
        
        // Otomatik çekmeyi kapat
        if (autoDrawEnabled) {
          setAutoDrawEnabled(false);
          
          // Sunucuya otomatik çekmenin kapatıldığını bildir
          if (socketInstance && socketInstance.connected) {
            socketInstance.emit(SOCKET_EVENTS.GAME_UPDATE, {
              lobbyId,
              isPaused: true,
              autoDrawEnabled: false,
              gameStatus: 'finished',
              timestamp: Date.now()
            });
          }
        }
        return;
      }
      
      // Çekilen sayıları güncelle
      if (data.drawnNumbers && Array.isArray(data.drawnNumbers)) {
        setDrawnNumbers(data.drawnNumbers);
      }
      
      // Mevcut sayıyı güncelle
      if (data.number !== undefined) {
        setCurrentNumber(data.number);
      }
      
      // Sayaç süresini güncelle - backend'den gelen değer
      if (data.countdown !== undefined) {
        setCountdownTimer(data.countdown);
      }
      
      // Duraklatma durumunu güncelle
      if (data.isPaused !== undefined) {
        setIsPaused(data.isPaused);
      }
      
      // Otomatik çekme durumunu güncelle
      if (data.autoDrawEnabled !== undefined) {
        setAutoDrawEnabled(data.autoDrawEnabled);
      }
      
      // Sayı çekme durumunu sıfırla, butonun tekrar aktif olmasını sağla
      setDrawingNumber(false);
      
      // Ses çal
      if (soundEnabled) {
        playNumberSound();
      }
    };

    // Oyun durumu değiştiğinde
    const handleGameStatusChanged = (data) => {
      console.log('Oyun durumu değişti:', data);
      
      // Oyun durumunu güncelle
      if (data.gameStatus) {
        setGameStatus(data.gameStatus);
        
        // Eğer oyun bittiyse, sayı çekme ve sayaç işlemlerini durdur
        if (data.gameStatus === 'finished') {
          console.log('Oyun bitti, tüm sayı çekme işlemleri durduruluyor');
          setAutoDrawEnabled(false);
          setIsPaused(true);
          setCountdownTimer(0);
          
          // Zamanlayıcıları temizle
          if (drawTimeoutRef.current) {
            clearTimeout(drawTimeoutRef.current);
            drawTimeoutRef.current = null;
          }
          
          // Bildirim ekle
          addNotification({
            type: 'info',
            message: 'Oyun sona erdi!'
          });
        }
      }
      
      // Duraklatma durumunu güncelle
      if (data.isPaused !== undefined) {
        // Oyun bitmişse, her zaman duraklat
        if (gameStatus === 'finished' || winners.tombala !== null) {
          setIsPaused(true);
        } else {
          setIsPaused(data.isPaused);
        }
      }
      
      // Sayaç süresini güncelle - backend'den gelen değer
      if (data.countdown !== undefined && data.gameStatus !== 'finished' && !winners.tombala) {
        setCountdownTimer(data.countdown);
      }
      
      // Otomatik çekme durumunu güncelle
      if (data.autoDrawEnabled !== undefined) {
        // Oyun bitmişse, otomatik çekmeyi her zaman kapat
        if (gameStatus === 'finished' || winners.tombala !== null) {
          setAutoDrawEnabled(false);
        } else {
          setAutoDrawEnabled(data.autoDrawEnabled);
        }
      }
      
      // Bildirim ekle
      if (data.message) {
        addNotification({
          type: 'info',
          message: data.message
        });
      }
    };

    // Sayaç güncellendiğinde - yeni eklenen olay
    const handleCountdownUpdate = (data) => {
      console.log('Sayaç güncellendi:', data);
      
      // Eğer oyun bitmişse sayacı güncelleme
      if (gameStatus === 'finished' || winners.tombala !== null) {
        console.log('Oyun bitmiş durumda, sayaç durdu');
        // Oyun bittiği için sayaç değerini sıfırla
        setCountdownTimer(0);
        // Oyun bitti, otomatik çekmeyi de kapat
        if (autoDrawEnabled) {
          setAutoDrawEnabled(false);
          
          // Sunucuya otomatik çekmenin kapatıldığını bildir
          if (socketInstance && socketInstance.connected) {
            socketInstance.emit(SOCKET_EVENTS.GAME_UPDATE, {
              lobbyId,
              isPaused: true,
              autoDrawEnabled: false,
              gameStatus: 'finished',
              timestamp: Date.now()
            });
          }
        }
        // Paused durumuna geçir
        if (!isPaused) {
          setIsPaused(true);
        }
        return;
      }
      
      // Duraklatma durumunu güncelle
      if (data.isPaused !== undefined) {
        setIsPaused(data.isPaused);
      }
      
      // Sayaç süresini güncelle - sadece oyun duraklatılmamışsa ve bitmemişse
      if (data.countdown !== undefined) {
        // Eğer oyun duraklatılmışsa veya bitmişse, sayacı güncelleme 
        // (Duraklatma durumunu önce kontrol ediyoruz çünkü data.isPaused daha güncel)
        const shouldUpdateTimer = (data.isPaused !== undefined ? !data.isPaused : !isPaused) && gameStatus !== 'finished' && !winners.tombala;
        
        if (shouldUpdateTimer) {
          setCountdownTimer(data.countdown);
        }
      }
    };

    // Olayları dinle
    socketInstance.on('number_drawn', handleNumberDrawn);
    socketInstance.on('game_status_changed', handleGameStatusChanged);
    socketInstance.on('countdown_update', handleCountdownUpdate);

    // Bağlantı kurulduğunda sayaç bilgisini iste
    if (lobbyId) {
      socketInstance.emit('get_countdown', { lobbyId });
    }

    // Temizleme işlevi
    return () => {
      socketInstance.off('number_drawn', handleNumberDrawn);
      socketInstance.off('game_status_changed', handleGameStatusChanged);
      socketInstance.off('countdown_update', handleCountdownUpdate);
    };
  }, [socketInstance, lobbyId, gameStatus, isPaused, autoDrawEnabled, soundEnabled, playNumberSound, addNotification, winners]);

  // Hook'un dönüş değeri
  return {
    gameStatus,
    currentNumber,
    drawnNumbers,
    playerCards,
    winner: winners.tombala, // winner değişkeni yerine winners.tombala kullanıyoruz
    winType,
    isOnline,
    socket: socketInstance,
    lobbyId,
    playerId,
    players,
    isHost,
    notifications,
    chatMessages: messages,
    isPaused,
    autoDrawEnabled,
    countdownTimer,
    drawNextNumber,
    createPlayerCards,
    winners,
    generateTombalaCards,
    claimCinko1,
    claimCinko2,
    claimTombala,
    sendMessage,
    newGame,
    lobbyData, // Lobi verisini ekle
    lobbySettings,
    updateLobbySettings,
    soundEnabled,
    toggleSound,
    playNumberSound,
    drawingNumber, // Sayı çekme işleminin devam edip etmediği (buton devre dışı bırakmak için)
    setGameStatus, // GameStatus'u değiştirmek için fonksiyonu ekle
  };
};

export default useTombala; 