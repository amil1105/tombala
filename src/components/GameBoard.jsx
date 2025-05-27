import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Grid, Paper, Typography, Button, Badge, Chip, Divider, List, ListItem, ListItemText, Avatar, TextField, IconButton, CircularProgress, Container, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, ListItemAvatar, AppBar, Toolbar, Collapse, FormControl, FormControlLabel, RadioGroup, Radio, FormLabel, Switch } from '@mui/material';
import { styled } from '@mui/system';
import SendIcon from '@mui/icons-material/Send';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import TimerIcon from '@mui/icons-material/Timer';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupIcon from '@mui/icons-material/Group';
import ViewComfyIcon from '@mui/icons-material/ViewComfy';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useTombala } from '../hooks/useTombala';
import NumberBoard from './NumberBoard';
import TombalaCard from './TombalaCard';
import { GAME_SETTINGS, STORAGE_KEYS } from '../utils/config';

// Socket olay sabitleri - direkt tanımla
const SOCKET_EVENTS = {
  SEND_MESSAGE: 'send_message',
  CLAIM_CINKO: 'claim_cinko',
  CLAIM_TOMBALA: 'claim_tombala',
  GAME_START: 'game_start',
  GAME_UPDATE: 'game_update',
  DRAW_NUMBER: 'draw_number'
};

// Stil bileşenleri
const StyledPaper = styled(Paper)({
  padding: '12px',
  background: 'rgba(25, 25, 45, 0.7)',
  borderRadius: '8px',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  width: '100%'
});

const Header = ({ children, ...props }) => (
  <AppBar position="static" color="transparent" elevation={0} {...props}>
    <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
      {children}
    </Toolbar>
  </AppBar>
);

const StatusBadge = styled(Badge)(({ theme, status }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: status === 'online' ? '#4CAF50' : '#F44336',
    color: 'white',
    boxShadow: `0 0 0 2px ${theme?.palette?.background?.paper || '#121212'}`,
    '&::after': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      animation: status === 'online' ? 'ripple 1.2s infinite ease-in-out' : 'none',
      border: '1px solid currentColor',
      content: '""',
    },
  },
  '@keyframes ripple': {
    '0%': {
      transform: 'scale(.8)',
      opacity: 1,
    },
    '100%': {
      transform: 'scale(2.4)',
      opacity: 0,
    },
  },
}));

const PlayerList = styled(List)({
  maxHeight: 300,
  overflowY: 'auto',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '3px',
  }
});

const ChatContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%'
});

const ChatMessages = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  padding: '8px',
  marginBottom: '8px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '8px',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '3px',
  }
});

const ChatForm = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
});

const CurrentNumberDisplay = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
  borderRadius: '8px',
  backgroundColor: 'rgba(124, 77, 255, 0.2)',
  marginBottom: '8px'
});

// Yeni NumberCircle fonksiyon bileşeni
const NumberCircle = ({ marked, highlight, big, children, ...props }) => {
  // Boolean değerleri doğrudan DOM'a geçirmek yerine sx içinde kullanıyoruz
  const isMarked = Boolean(marked);
  const isHighlight = Boolean(highlight);
  const isBig = Boolean(big);
  
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: isBig ? '70px' : (isMarked ? '36px' : '50px'),
        height: isBig ? '70px' : (isMarked ? '36px' : '50px'),
        borderRadius: '50%',
        backgroundColor: isHighlight ? '#ff5722' : isMarked ? '#7c4dff' : 'rgba(124, 77, 255, 0.2)',
        color: isMarked || isHighlight ? 'white' : (theme) => theme?.palette?.text?.primary || '#fff',
        margin: '4px',
        transition: 'all 0.3s ease',
        fontWeight: isHighlight ? 'bold' : 'normal',
        fontSize: isBig ? '2.5rem' : undefined,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

const RecentNumbersContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px',
  borderRadius: '8px',
  backgroundColor: 'rgba(124, 77, 255, 0.15)',
  marginBottom: '8px',
});

const RecentNumbersList = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '4px',
});

const CountdownCircle = styled(Box)({
  position: 'relative',
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& .MuiCircularProgress-root': {
    transition: 'transform 0.5s ease',
  }
});

const CompactPlayerList = styled(List)({
  overflowY: 'auto',
  padding: 0,
  height: '100%',
  '& .MuiListItem-root': {
    padding: '4px 8px',
  },
  '& .MuiListItemAvatar-root': {
    minWidth: '36px',
  },
  '& .MuiAvatar-root': {
    width: '30px',
    height: '30px',
    fontSize: '12px',
  },
  '& .MuiTypography-root': {
    fontSize: '0.85rem',
  },
  '& .MuiListItemText-secondary': {
    fontSize: '0.7rem',
  },
  '&::-webkit-scrollbar': {
    width: '4px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '3px',
  }
});

const GameBoard = () => {
  // useTombala hook'unu kullan
  const {
    gameStatus,
    currentNumber,
    drawnNumbers,
    playerCards,
    winner,
    winType,
    isOnline,
    socket,
    lobbyId,
    playerId, 
    players,
    isHost,
    notifications,
    chatMessages,
    isPaused,
    autoDrawEnabled,
    countdownTimer,
    drawNextNumber: hookDrawNextNumber,
    createPlayerCards,
    winners,
    generateTombalaCards,
    lobbyData,
    lobbySettings,
    updateLobbySettings
  } = useTombala();
  
  // Yerel state'ler
  const [message, setMessage] = useState('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('info');
  const [selectedCard, setSelectedCard] = useState(0);
  const [autoDrawInterval, setAutoDrawInterval] = useState(null);
  const [showGameSummary, setShowGameSummary] = useState(false);
  const [gameSummary, setGameSummary] = useState({
    cinko1Winner: null,
    cinko2Winner: null,
    tombalaWinner: null
  });
  const [isPlayerListOpen, setIsPlayerListOpen] = useState(true);
  
  // Ayarlar modalı için state'ler
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSettings, setTempSettings] = useState({
    manualNumberDrawPermission: 'host-only',
    gameSpeed: 'normal',
    enableMusic: true
  });

  // Son mesaj referansı
  const messagesEndRef = useRef(null);

  // Son çekilen 10 sayıyı alın (son çekilen en başta olacak şekilde)
  const lastTenNumbers = useMemo(() => {
    if (!drawnNumbers || drawnNumbers.length === 0) return [];
    return [...drawnNumbers].reverse().slice(0, 10);
  }, [drawnNumbers]);

  // Avatar oluşturma yardımcı fonksiyonu
  const getPlayerAvatar = (player) => {
    if (!player) {
      return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#2a2c4e"/><text x="50" y="50" font-size="50" text-anchor="middle" dominant-baseline="middle" font-family="Arial" fill="white">U</text></svg>')}`;
    }
    
    // Bot için Dicebear API kullan
    if (player.isBot) {
      return `https://api.dicebear.com/6.x/bottts/svg?seed=${player.name || 'Bot'}&_t=${Date.now()}`;
    }
    
    // Kullanıcı profil fotoğrafı varsa
    if (player.profileImage) {
      return player.profileImage;
    }
    
    // Normal kullanıcı için SVG avatar
    const bgColor = '#2a2c4e';
    const initial = player.name ? player.name.charAt(0).toUpperCase() : 'U';
    return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="' + bgColor + '"/><text x="50" y="50" font-size="50" text-anchor="middle" dominant-baseline="middle" font-family="Arial" fill="white">' + initial + '</text></svg>')}`;
  };

  // Mesajları otomatik kaydır
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Bir sonraki sayıyı çekme (sadece host için)
  const drawNextNumber = useCallback(() => {
    console.log("GameBoard: Sayı çekme isteği", { isHost, gameStatus, isPaused, lobbySettings });
    
    // Sayı çekme yetkisi kontrolü - ayarlara göre
    const canDrawNumber = isHost || (lobbySettings && lobbySettings.manualNumberDrawPermission === 'all-players');
    
    if (!canDrawNumber) {
      setAlertMessage('Sayı çekme yetkiniz bulunmuyor! Sadece lobi sahibi sayı çekebilir.');
      setAlertSeverity('warning');
      setAlertOpen(true);
      return;
    }
    
    // Oyun durumu kontrolü
    if (gameStatus !== 'playing') {
      setAlertMessage('Oyun başlamadan sayı çekemezsiniz!');
      setAlertSeverity('warning');
      setAlertOpen(true);
      return;
    }
    
    // Hook'taki fonksiyonu çağır
    hookDrawNextNumber();
  }, [gameStatus, isPaused, isHost, lobbySettings, hookDrawNextNumber, setAlertMessage, setAlertSeverity, setAlertOpen]);

  // Yeni oyun başlatma fonksiyonu
  const startGame = () => {
    console.log('Yeni oyun başlatılıyor...');
    if (gameStatus === 'finished') {
      // Oyun bittiyse, sayfayı yenilemeden yeni oyun başlat
      setAlertMessage('Yeni tur başlatılıyor...');
      setAlertSeverity('info');
      setAlertOpen(true);
      
      // Önce oyunu sıfırla
      setDrawnNumbers([]);
      setCurrentNumber(null);
      
      // Sonra yeni oyun başlat
      if (socket && isHost) {
        socket.emit('game_start', { 
          lobbyId,
          newGame: true,
          message: 'Yeni oyun başlatıldı!' 
        });
      }
    } else {
      // İlk kez oyun başlatma
      if (socket && isHost) {
        setAlertMessage('Oyun başlatılıyor...');
        setAlertSeverity('info');
        setAlertOpen(true);
        
        socket.emit('game_start', { 
          lobbyId,
          message: 'Tombala oyunu başladı!' 
        });
      }
    }
  };

  // Bildirimleri Snackbar'da göster
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const latestNotification = notifications[0];
      setAlertMessage(latestNotification.message);
      setAlertSeverity(latestNotification.type);
      setAlertOpen(true);
    }
  }, [notifications]);

  // Tombala kartları yoksa oluştur - Komponent yüklendiğinde hemen kontrol et ve çağır
  useEffect(() => {
    console.log('GameBoard: Tombala kartlarını kontrol etme', {playerCards, gameStatus});
    
    // Kartlar yoksa, gameStatus'tan bağımsız olarak oluştur
    if (!playerCards || playerCards.length === 0) {
      console.log('GameBoard: Tombala kartı bulunamadı, hemen oluşturuluyor');
      createPlayerCards();
    }
  }, []); // Sadece komponent yüklendiğinde çalışsın

  // Oyun durumu değiştiğinde kartları kontrol et
  useEffect(() => {
    // Oyun durumu değiştiğinde kartları tekrar kontrol et
    if (gameStatus === 'playing' && (!playerCards || playerCards.length === 0)) {
      console.log('GameBoard: Oyun başladı ama kart bulunamadı, yeni kart oluşturuluyor');
      createPlayerCards();
    }
    
    // İşaretli sayı sayısını logla - debug için
    if (playerCards && playerCards.length > 0 && drawnNumbers && drawnNumbers.length > 0) {
      const myCard = playerCards[0];
      if (myCard && myCard.numbers) {
        const allCardNumbers = myCard.numbers.flat().filter(num => num !== null);
        const markedNumbers = allCardNumbers.filter(num => drawnNumbers.includes(num));
        console.log(`İşaretli sayı kontrolü (GameBoard): ${markedNumbers.length}/15`);
        
        if (markedNumbers.length === 15) {
          console.log('TOMBALA! Tüm sayılar işaretlendi!');
        }
      }
    }
  }, [gameStatus, playerCards, createPlayerCards, drawnNumbers]);

  // Debug için lobi ve oyuncu verilerini konsola yazdır
  useEffect(() => {
    console.log('Lobi verileri:', lobbyData);
    console.log('Oyuncular:', players);
  }, [lobbyData, players]);

  // Otomatik sayı çekmeyi başlatma/durdurma
  const toggleAutoDrawing = useCallback(() => {
    if (!socket || !isHost) {
      setAlertMessage('Sadece lobi sahibi otomatik sayı çekmeyi kontrol edebilir!');
      setAlertSeverity('warning');
      setAlertOpen(true);
      return;
    }

    const newAutoDrawState = !autoDrawEnabled;
    console.log(`Otomatik sayı çekme durumu değiştiriliyor: autoDrawEnabled = ${newAutoDrawState}`);
    
    // Aynı zamanda oyunun duraklatma durumunu da güncelle
    socket.emit('game_update', {
      lobbyId,
      isPaused: !newAutoDrawState, // autoDrawEnabled true ise isPaused false olmalı
      timestamp: Date.now()
    });
    
    // Bildirim ekle
    setAlertMessage(newAutoDrawState ? 'Otomatik sayı çekme açıldı' : 'Otomatik sayı çekme kapatıldı');
    setAlertSeverity('info');
    setAlertOpen(true);
  }, [socket, isHost, autoDrawEnabled, lobbyId, setAlertMessage, setAlertSeverity, setAlertOpen]);

  // Mesaj gönderme işlevi
  const sendMessage = useCallback(() => {
    if (!message.trim() || !socket) return;

    socket.emit('send_message', {
          lobbyId,
      playerId,
      message: message.trim(),
      timestamp: Date.now()
    });

    setMessage('');
  }, [message, socket, lobbyId, playerId]);

  // Çinko talep etme
  const claimCinko = useCallback((cinkoType) => {
    if (!socket) return;

    socket.emit('claim_cinko', {
          lobbyId, 
          playerId, 
      cinkoType,
      cardIndex: selectedCard
    });
  }, [socket, lobbyId, playerId, selectedCard]);

  // Tombala talep etme
  const claimTombala = useCallback(() => {
    if (!socket) return;

    socket.emit('claim_tombala', {
          lobbyId, 
          playerId, 
      cardIndex: selectedCard
    });
  }, [socket, lobbyId, playerId, selectedCard]);

  // Oyunu duraklatma/devam ettirme (sadece host için)
  const togglePause = useCallback(() => {
    if (!socket || !isHost) {
      setAlertMessage('Sadece lobi sahibi oyunu duraklatabilir/devam ettirebilir!');
      setAlertSeverity('warning');
      setAlertOpen(true);
      return;
    }

    const newPausedState = !isPaused;
    console.log(`Oyun durumu değiştiriliyor: isPaused = ${newPausedState}`);

    socket.emit('game_update', {
      lobbyId,
      isPaused: newPausedState,
      timestamp: Date.now()
    });
    
    // Bildirim ekle
    setAlertMessage(newPausedState ? 'Oyun duraklatıldı' : 'Oyun devam ediyor');
    setAlertSeverity('info');
    setAlertOpen(true);
  }, [socket, isHost, lobbyId, isPaused, setAlertMessage, setAlertSeverity, setAlertOpen]);

  // Oyun durumu değiştiğinde özet ekranını göster
  useEffect(() => {
    if (gameStatus === 'finished') {
      console.log("Oyun bitti, kazanan bilgileri (orijinal winners state):", winners);
      console.log("Mevcut oyuncu listesi (players state):", players);

      // Kazanan adını bulma yardımcı fonksiyonu
      const getWinnerName = (winnerData) => {
        if (!winnerData) return 'Kazanan yok';
        
        // Önce playerId kontrol et ve mevcut kullanıcı değilse devam et
        if (winnerData.playerId && playerId) {
            const winnerIdStr = String(winnerData.playerId);
            const currentPlayerIdStr = String(playerId);
            
            // Eğer oyuncular aynı değilse (ID'ler farklıysa) normal işleme devam et
            // ID'leri tam karşılaştırma yapalım - böylece "kendisinin kazandığı" hatası çözülecek
            if (winnerIdStr === currentPlayerIdStr) {
                console.log(`Kazanan oyuncu mevcut kullanıcıdır: ${winnerData.playerName || 'İsim yok'}`);
            }
        }
        
        // Önce playerId ile players state'inde ara
        if (winnerData.playerId && players && players.length > 0) {
            const playerInState = players.find(p => { 
                // Stringe çevirip tam eşleşme kontrolü yapalım
                const pIdStr = String(p.id || '');
                const winnerIdStr = String(winnerData.playerId || '');
                
                return pIdStr === winnerIdStr;
            });

            if (playerInState && playerInState.name) {
                console.log(`Kazanan (${winnerData.playerId}) players state'inden bulundu: ${playerInState.name}`);
                return playerInState.name;
            }
        }
        
        // Bulunamazsa, winnerData içindeki playerName'i kullan
        if (winnerData.playerName) {
            console.log(`Kazanan (${winnerData.playerId || 'ID yok'}) ismi: ${winnerData.playerName}`);
            return winnerData.playerName;
        }
        
        // Hiçbir isim bulunamazsa
        return 'Bilinmeyen Oyuncu';
      };

      // Oyun sona erdiğinde kazananları topla ve doğru isimleri ata
      const summary = {
        cinko1Winner: winners.cinko1 ? { ...winners.cinko1, playerName: getWinnerName(winners.cinko1) } : null,
        cinko2Winner: winners.cinko2 ? { ...winners.cinko2, playerName: getWinnerName(winners.cinko2) } : null,
        tombalaWinner: winners.tombala ? { ...winners.tombala, playerName: getWinnerName(winners.tombala) } : null,
        allNumbersDrawn: drawnNumbers.length >= 90
      };
      
      console.log("Hazırlanan oyun özeti (doğru isimlerle):", summary);
      
      // Kazanan adını kontrol et (artık doğru olmalı)
      if (summary.tombalaWinner) {
        console.log("Tombala kazanan adı (özetten):", summary.tombalaWinner.playerName);
      }
      
      setGameSummary(summary);
      setShowGameSummary(true);
    }
  }, [gameStatus, winners, drawnNumbers, players, playerId]);

  // Oyuncu listesi render fonksiyonunu güncelliyorum
  const renderCompactPlayerList = () => {
    if (!players || players.length === 0) {
      return (
        <Box p={1} textAlign="center">
          <Typography variant="caption" color="text.secondary">
            Oyuncular yükleniyor...
          </Typography>
        </Box>
      );
    }

    console.log('Oyuncu Listesi Render: Players', players);
    console.log('Oyuncu Listesi Render: Lobby Data', lobbyData);
    
    // ID'yi normalize etme yardımcı fonksiyonu
    const normalizeId = (id) => {
      if (!id) return '';
      return typeof id === 'string' ? id : id.toString();
    };
    
    // Eğer lobbyData varsa creator'ı normalize edelim
    let creatorId = '';
    if (lobbyData && lobbyData.creator) {
      creatorId = normalizeId(lobbyData.creator);
      console.log(`Creator ID (normalized): ${creatorId}`);
    }
    
    // Host oyuncuyu listenin başına alacak şekilde sıralama yap
    const sortedPlayers = [...players].sort((a, b) => {
      // Önce direk isHost özelliğini kontrol et
      if (a.isHost === true && b.isHost !== true) return -1;
      if (a.isHost !== true && b.isHost === true) return 1;
      
      // Eğer isHost özelliği yoksa, creator ID'si ile karşılaştır
      if (creatorId && creatorId.length > 0) {
        const aId = normalizeId(a.id);
        const bId = normalizeId(b.id);
        
        const aIsCreator = aId === creatorId || 
          (aId.includes(creatorId) && creatorId.length > 5) || 
          (creatorId.includes(aId) && aId.length > 5);
          
        const bIsCreator = bId === creatorId || 
          (bId.includes(creatorId) && creatorId.length > 5) ||
          (creatorId.includes(bId) && bId.length > 5);
        
        if (aIsCreator && !bIsCreator) return -1;
        if (!aIsCreator && bIsCreator) return 1;
      }
      
      return 0;
    });
    
    return (
      <CompactPlayerList dense>
        {sortedPlayers.map((player) => {
          // Önce direk isHost özelliğini kontrol et
          let isPlayerHost = player.isHost === true;
          
          // Eğer isHost değeri yoksa veya false ise ve creatorId varsa
          // creatorId ile player.id karşılaştırması yaparak host olup olmadığını belirle
          if (!isPlayerHost && creatorId && creatorId.length > 0) {
            const playerId = normalizeId(player.id);
            isPlayerHost = playerId === creatorId || 
              (playerId.includes(creatorId) && creatorId.length > 5) ||
              (creatorId.includes(playerId) && playerId.length > 5);
          }
          
          console.log(`Oyuncu: ${player.name}, ID: ${player.id}, Host mu: ${isPlayerHost}`);
          
          return (
            <ListItem key={player.id || `player-${player.name}-${Math.random().toString(36).substr(2, 9)}`}>
              <ListItemAvatar>
                <Avatar 
                  sx={{ 
                    bgcolor: player.isBot ? '#1a237e' : isPlayerHost ? '#FFC107' : '#7b1fa2', 
                    width: 30, 
                    height: 30, 
                    fontSize: '0.75rem',
                    border: isPlayerHost ? '2px solid #FFC107' : 'none'
                  }}
                  src={getPlayerAvatar(player)}
                >
                  {player.name ? player.name.charAt(0).toUpperCase() : "?"}
                </Avatar>
              </ListItemAvatar>
              <ListItemText 
                primary={
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2">{player.name}</Typography>
                    {isPlayerHost && (
                      <Chip 
                        size="small" 
                        label="Host" 
                        color="warning" 
                        sx={{ ml: 1, height: 16, fontSize: '0.6rem' }}
                      />
                    )}
                    {player.isBot && (
                      <Chip 
                        size="small" 
                        label="Bot" 
                        color="default" 
                        sx={{ ml: 1, height: 16, fontSize: '0.6rem' }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {player.isReady ? 'Hazır' : 'Bekliyor'}
                  </Typography>
                }
              />
            </ListItem>
          );
        })}
      </CompactPlayerList>
    );
  };

  // Sohbet mesajlarını oluştur
  const renderChatMessages = useMemo(() => {
    return (
      <ChatMessages>
        {(chatMessages || []).map((msg, index) => (
          <Box key={index} sx={msg.playerId === playerId ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }}>
            <Typography variant="body2" fontWeight="bold" color={msg.color || 'primary'}>
              {msg.playerName || 'Misafir Oyuncu'}
            </Typography>
            <Typography variant="body2">
              {msg.message}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </Typography>
          </Box>
        ))}
        <Box ref={messagesEndRef} />
      </ChatMessages>
    );
  }, [chatMessages, playerId]);

  // Oyun özeti modal bileşeni
  const renderGameSummary = () => {
    return (
      <Dialog
        open={showGameSummary}
        onClose={() => setShowGameSummary(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(32, 32, 60, 0.95) 0%, rgba(18, 18, 40, 0.97) 100%)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }
        }}
      >
        {/* Konfeti efekti */}
        <Box sx={{ position: 'absolute', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          {[...Array(50)].map((_, i) => (
            <Box 
              key={i}
              component="span"
              sx={{
                position: 'absolute',
                top: `-10px`,
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 10 + 5}px`,
                height: `${Math.random() * 10 + 10}px`,
                borderRadius: '2px',
                backgroundColor: [
                  '#7c4dff', '#ff4081', '#00e5ff', '#76ff03', '#ffea00', 
                  '#ff9100', '#f50057', '#651fff', '#00b0ff', '#c6ff00'
                ][Math.floor(Math.random() * 10)],
                animation: `fall ${Math.random() * 3 + 2}s linear ${Math.random() * 2}s infinite`,
                transform: `rotate(${Math.random() * 360}deg)`,
                opacity: Math.random(),
                '@keyframes fall': {
                  '0%': { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                  '100%': { transform: `translateY(${window.innerHeight}px) rotate(360deg)`, opacity: 0 }
                }
              }}
            />
          ))}
        </Box>
        
        <DialogTitle 
          component="div" 
          sx={{
            textAlign: 'center',
            pt: 4,
            pb: 2,
            position: 'relative',
            zIndex: 1
          }}
        >
          <Typography 
            variant="h4" 
            fontWeight="bold"
            sx={{
              backgroundImage: 'linear-gradient(45deg, #7c4dff, #00e5ff)',
              backgroundClip: 'text',
              color: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              textShadow: '0px 2px 4px rgba(0,0,0,0.5)',
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.05)' },
                '100%': { transform: 'scale(1)' },
              }
            }}
          >
            Oyun Sona Erdi
          </Typography>
          
            {drawnNumbers.length >= 90 && (
            <Typography 
              variant="h6" 
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
                animation: 'slideIn 0.8s ease-out',
                '@keyframes slideIn': {
                  '0%': { transform: 'translateY(20px)', opacity: 0 },
                  '100%': { transform: 'translateY(0)', opacity: 1 },
                }
              }}
            >
                Tüm sayılar çekildi! (90/90)
              </Typography>
            )}
        </DialogTitle>
        
        <DialogContent sx={{ position: 'relative', zIndex: 1 }}>
          <Box 
            sx={{ 
              p: { xs: 1, sm: 2, md: 3 },
              animation: 'fadeIn 1s ease',
              '@keyframes fadeIn': {
                '0%': { opacity: 0 },
                '100%': { opacity: 1 },
              }
            }}
          >
            <Box 
              sx={{ 
                textAlign: 'center', 
                mb: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <Box 
                sx={{ 
                  position: 'relative',
                  display: 'inline-flex',
                  mb: 4
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: '-10px',
                    left: '-10px',
                    right: '-10px',
                    bottom: '-10px',
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #7c4dff, #00e5ff)',
                    opacity: 0.3,
                    animation: 'spin 4s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    }
                  }}
                />
                <EmojiEventsIcon 
                  color="primary" 
                  sx={{ 
                    fontSize: 80, 
                    color: '#ffd700',
                    animation: 'bounce 2s infinite',
                    '@keyframes bounce': {
                      '0%, 100%': { transform: 'translateY(0)' },
                      '50%': { transform: 'translateY(-10px)' },
                    }
                  }} 
                />
              </Box>
              
              <Typography 
                variant="h5" 
                mb={4}
                sx={{
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  color: '#fff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                Kazananlar
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 3,
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(255, 183, 77, 0.2) 0%, rgba(255, 183, 77, 0.05) 100%)',
                      border: '1px solid rgba(255, 183, 77, 0.3)',
                      backdropFilter: 'blur(10px)',
                      animation: 'slideUp 0.5s ease-out',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 5px 15px rgba(255, 183, 77, 0.3)'
                      },
                      '@keyframes slideUp': {
                        '0%': { transform: 'translateY(20px)', opacity: 0 },
                        '100%': { transform: 'translateY(0)', opacity: 1 },
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '160px',
                      position: 'relative',
                      overflow: 'hidden',
                      height: '100%',
                    }}
                  >
                    <Typography 
                      variant="subtitle1" 
                      component="span" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: '#ffb74d',
                        mb: 1,
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      1. Çinko
                    </Typography>
                    
                    <Box sx={{ 
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      {gameSummary.cinko1Winner ? (
                        <>
                          <Avatar 
                            src={gameSummary.cinko1Winner.isBot ? 
                              `https://api.dicebear.com/6.x/bottts/svg?seed=${gameSummary.cinko1Winner.playerName || 'Bot'}&_t=${Date.now()}` : 
                              `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#2a2c4e"/><text x="50" y="50" font-size="50" text-anchor="middle" dominant-baseline="middle" font-family="Arial" fill="white">${(gameSummary.cinko1Winner.playerName || "?").charAt(0).toUpperCase()}</text></svg>')}`} 
                            sx={{ width: 60, height: 60, mb: 1, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }} 
                          />
                          <Typography variant="body1" fontWeight="bold" color="white">
                            {gameSummary.cinko1Winner.playerName || 'Bilinmeyen Oyuncu'}
                    </Typography>
                        </>
                      ) : (
                        <Typography variant="body1" color="text.secondary">
                          Kazanan yok
                        </Typography>
                      )}
                    </Box>
                    
                    {gameSummary.cinko1Winner && (
                      <Box sx={{ 
                        position: 'absolute',
                        bottom: '-20px',
                        left: '-20px',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,183,77,0.3) 0%, rgba(255,183,77,0) 70%)',
                        zIndex: 0
                      }} />
                    )}
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 3,
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(77, 182, 172, 0.2) 0%, rgba(77, 182, 172, 0.05) 100%)',
                      border: '1px solid rgba(77, 182, 172, 0.3)',
                      backdropFilter: 'blur(10px)',
                      animation: 'slideUp 0.5s ease-out 0.1s',
                      animationFillMode: 'both',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 5px 15px rgba(77, 182, 172, 0.3)'
                      },
                      '@keyframes slideUp': {
                        '0%': { transform: 'translateY(20px)', opacity: 0 },
                        '100%': { transform: 'translateY(0)', opacity: 1 },
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '160px',
                      position: 'relative',
                      overflow: 'hidden',
                      height: '100%',
                    }}
                  >
                    <Typography 
                      variant="subtitle1" 
                      component="span" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: '#4db6ac',
                        mb: 1,
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      2. Çinko
                    </Typography>
                    
                    <Box sx={{ 
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      {gameSummary.cinko2Winner ? (
                        <>
                          <Avatar 
                            src={gameSummary.cinko2Winner.isBot ? 
                              `https://api.dicebear.com/6.x/bottts/svg?seed=${gameSummary.cinko2Winner.playerName || 'Bot'}&_t=${Date.now()}` : 
                              `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#2a2c4e"/><text x="50" y="50" font-size="50" text-anchor="middle" dominant-baseline="middle" font-family="Arial" fill="white">${(gameSummary.cinko2Winner.playerName || "?").charAt(0).toUpperCase()}</text></svg>')}`} 
                            sx={{ width: 60, height: 60, mb: 1, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }} 
                          />
                          <Typography variant="body1" fontWeight="bold" color="white">
                            {gameSummary.cinko2Winner.playerName || 'Bilinmeyen Oyuncu'}
                    </Typography>
                        </>
                      ) : (
                        <Typography variant="body1" color="text.secondary">
                          Kazanan yok
                        </Typography>
                      )}
                    </Box>
                    
                    {gameSummary.cinko2Winner && (
                      <Box sx={{ 
                        position: 'absolute',
                        bottom: '-20px',
                        left: '-20px',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(77,182,172,0.3) 0%, rgba(77,182,172,0) 70%)',
                        zIndex: 0
                      }} />
                    )}
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 3,
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(123, 31, 162, 0.2) 0%, rgba(123, 31, 162, 0.05) 100%)',
                      border: '1px solid rgba(123, 31, 162, 0.3)',
                      backdropFilter: 'blur(10px)',
                      animation: 'slideUp 0.5s ease-out 0.2s',
                      animationFillMode: 'both',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        boxShadow: '0 5px 15px rgba(123, 31, 162, 0.3)'
                      },
                      '@keyframes slideUp': {
                        '0%': { transform: 'translateY(20px)', opacity: 0 },
                        '100%': { transform: 'translateY(0)', opacity: 1 },
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '160px',
                      position: 'relative',
                      overflow: 'hidden',
                      height: '100%',
                    }}
                  >
                    <Typography 
                      variant="subtitle1" 
                      component="span" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: '#ba68c8',
                        mb: 1,
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      Tombala
                    </Typography>
                    
                    <Box sx={{ 
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      {gameSummary.tombalaWinner ? (
                        <>
                          <Avatar 
                            src={gameSummary.tombalaWinner.isBot ? 
                              `https://api.dicebear.com/6.x/bottts/svg?seed=${gameSummary.tombalaWinner.playerName || 'Bot'}&_t=${Date.now()}` : 
                              `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#2a2c4e"/><text x="50" y="50" font-size="50" text-anchor="middle" dominant-baseline="middle" font-family="Arial" fill="white">${(gameSummary.tombalaWinner.playerName || "?").charAt(0).toUpperCase()}</text></svg>')}`}
                            sx={{ 
                              width: 60, 
                              height: 60, 
                              mb: 1, 
                              boxShadow: '0 0 20px rgba(186,104,200,0.6)',
                              border: '2px solid #ba68c8'
                            }} 
                          />
                          <Typography variant="body1" fontWeight="bold" color="white">
                            {gameSummary.tombalaWinner.playerName || 'Bilinmeyen Oyuncu'}
                    </Typography>
                        </>
                      ) : (
                        <Typography variant="body1" color="text.secondary">
                          Kazanan yok
                        </Typography>
                      )}
                    </Box>
                    
                    {gameSummary.tombalaWinner && (
                      <Box sx={{ 
                        position: 'absolute',
                        bottom: '-20px',
                        left: '-20px',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(186,104,200,0.3) 0%, rgba(186,104,200,0) 70%)',
                        zIndex: 0
                      }} />
                    )}
                  </Box>
                </Grid>
              </Grid>
              
              {/* Oyun İstatistikleri */}
              <Box 
                sx={{
                  mt: 4,
                  p: 2,
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width: '100%',
                  animation: 'fadeIn 1s ease 0.5s both'
                }}
              >
                <Typography variant="subtitle1" align="center" mb={2} fontWeight="medium" color="primary.main">
              Oyun İstatistikleri
            </Typography>
            
                <Grid container spacing={2} textAlign="center">
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Çekilen Sayılar</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {drawnNumbers.length}/90
                    </Typography>
                  </Grid>
            
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Oyuncular</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {players ? players.length : 0}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Oyun Süresi</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {Math.floor(drawnNumbers.length * 0.8)} dk
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <Button 
            variant="contained" 
            onClick={() => setShowGameSummary(false)}
            sx={{
              borderRadius: '24px',
              background: 'linear-gradient(45deg, #7c4dff, #448aff)',
              px: 4,
              py: 1,
              fontWeight: 'bold',
              letterSpacing: '1px',
              boxShadow: '0 4px 20px rgba(124, 77, 255, 0.3)',
              '&:hover': {
                background: 'linear-gradient(45deg, #6a3dff, #2979ff)',
                boxShadow: '0 6px 25px rgba(124, 77, 255, 0.4)',
              }
            }}
          >
            Tamam
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Oyuncular panelini açıp kapatma
  const togglePlayerList = useCallback(() => {
    setIsPlayerListOpen(prev => !prev);
  }, []);

  // Ayarları lobi ayarlarıyla senkronize et
  useEffect(() => {
    setTempSettings(lobbySettings);
  }, [lobbySettings]);

  // Ayarları kaydet
  const saveSettings = () => {
    updateLobbySettings(tempSettings);
    setShowSettingsModal(false);
  };

  // Ayarlar modalı
  const renderSettingsModal = () => {
    return (
      <Dialog
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            background: 'linear-gradient(145deg, rgba(20, 20, 40, 0.95), rgba(30, 30, 60, 0.95))',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          py: 2, 
          background: 'linear-gradient(90deg, #7c4dff, #6e45e2)', 
          color: 'white',
          boxShadow: '0 2px 10px rgba(124, 77, 255, 0.2)'
        }}>
          <Box display="flex" alignItems="center">
            <SettingsIcon sx={{ mr: 1.5 }} />
            <Typography variant="h6" fontWeight="bold">Oyun Ayarları</Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 3 }}>
            {/* Kategorize edilmiş ayarlar */}
            <Box sx={{ 
              mb: 4, 
              p: 2, 
              bgcolor: 'rgba(124, 77, 255, 0.08)', 
              borderRadius: 2,
              border: '1px solid rgba(124, 77, 255, 0.2)'
            }}>
              <Typography 
                variant="subtitle1" 
                fontWeight="bold" 
                sx={{ 
                  mb: 2, 
                  display: 'flex', 
                  alignItems: 'center',
                  color: '#7c4dff'
                }}
              >
                <TimerIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                Oyun Hızı
              </Typography>
              <RadioGroup
                value={tempSettings.gameSpeed}
                onChange={(e) => setTempSettings({
                  ...tempSettings,
                  gameSpeed: e.target.value
                })}
                sx={{ 
                  display: 'flex', 
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  '& .MuiFormControlLabel-root': { 
                    m: 0,
                    width: '32%'
                  }
                }}
              >
                <FormControlLabel
                  value="slow"
                  control={
                    <Radio 
                      sx={{
                        color: 'rgba(124, 77, 255, 0.6)',
                        '&.Mui-checked': {
                          color: '#7c4dff',
                        }
                      }}
                    />
                  }
                  label={
                    <Box 
                      sx={{ 
                        textAlign: 'center', 
                        p: 1, 
                        bgcolor: tempSettings.gameSpeed === 'slow' ? 'rgba(124, 77, 255, 0.15)' : 'transparent',
                        borderRadius: 1,
                        border: tempSettings.gameSpeed === 'slow' ? '1px solid rgba(124, 77, 255, 0.3)' : '1px solid transparent',
                        transition: 'all 0.2s ease',
                        width: '100%'
                      }}
                    >
                      <Typography variant="body2" fontWeight={tempSettings.gameSpeed === 'slow' ? 'bold' : 'normal'}>
                        Yavaş
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        15 sn
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
                <FormControlLabel
                  value="normal"
                  control={
                    <Radio 
                      sx={{
                        color: 'rgba(124, 77, 255, 0.6)',
                        '&.Mui-checked': {
                          color: '#7c4dff',
                        }
                      }}
                    />
                  }
                  label={
                    <Box 
                      sx={{ 
                        textAlign: 'center', 
                        p: 1, 
                        bgcolor: tempSettings.gameSpeed === 'normal' ? 'rgba(124, 77, 255, 0.15)' : 'transparent',
                        borderRadius: 1,
                        border: tempSettings.gameSpeed === 'normal' ? '1px solid rgba(124, 77, 255, 0.3)' : '1px solid transparent',
                        transition: 'all 0.2s ease',
                        width: '100%'
                      }}
                    >
                      <Typography variant="body2" fontWeight={tempSettings.gameSpeed === 'normal' ? 'bold' : 'normal'}>
                        Normal
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        10 sn
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
                <FormControlLabel
                  value="fast"
                  control={
                    <Radio 
                      sx={{
                        color: 'rgba(124, 77, 255, 0.6)',
                        '&.Mui-checked': {
                          color: '#7c4dff',
                        }
                      }}
                    />
                  }
                  label={
                    <Box 
                      sx={{ 
                        textAlign: 'center', 
                        p: 1, 
                        bgcolor: tempSettings.gameSpeed === 'fast' ? 'rgba(124, 77, 255, 0.15)' : 'transparent',
                        borderRadius: 1,
                        border: tempSettings.gameSpeed === 'fast' ? '1px solid rgba(124, 77, 255, 0.3)' : '1px solid transparent',
                        transition: 'all 0.2s ease',
                        width: '100%'
                      }}
                    >
                      <Typography variant="body2" fontWeight={tempSettings.gameSpeed === 'fast' ? 'bold' : 'normal'}>
                        Hızlı
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        5 sn
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              </RadioGroup>
            </Box>

            <Box sx={{ 
              mb: 4, 
              p: 2, 
              bgcolor: 'rgba(124, 77, 255, 0.08)', 
              borderRadius: 2,
              border: '1px solid rgba(124, 77, 255, 0.2)'
            }}>
              <Typography 
                variant="subtitle1" 
                fontWeight="bold" 
                sx={{ 
                  mb: 2, 
                  display: 'flex', 
                  alignItems: 'center',
                  color: '#7c4dff'
                }}
              >
                <PersonIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                Manuel Sayı Çekme İzni
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: 1,
              }}>
                <Paper 
                  elevation={0} 
                  onClick={() => setTempSettings({
                    ...tempSettings,
                    manualNumberDrawPermission: 'host-only'
                  })}
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    bgcolor: tempSettings.manualNumberDrawPermission === 'host-only' 
                      ? 'rgba(124, 77, 255, 0.15)' 
                      : 'rgba(30, 30, 60, 0.3)',
                    border: tempSettings.manualNumberDrawPermission === 'host-only'
                      ? '1px solid rgba(124, 77, 255, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(124, 77, 255, 0.1)',
                      borderColor: 'rgba(124, 77, 255, 0.2)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Radio 
                        checked={tempSettings.manualNumberDrawPermission === 'host-only'}
                        sx={{
                          p: 0.5,
                          mr: 1,
                          color: 'rgba(124, 77, 255, 0.6)',
                          '&.Mui-checked': {
                            color: '#7c4dff',
                          }
                        }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={tempSettings.manualNumberDrawPermission === 'host-only' ? 'bold' : 'normal'}>
                          Sadece Host
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Sadece lobi sahibi manuel sayı çekebilir (daha kontrollü oyun için)
                        </Typography>
                      </Box>
                    </Box>
                    <Avatar 
                      sx={{ 
                        width: 36, 
                        height: 36, 
                        bgcolor: tempSettings.manualNumberDrawPermission === 'host-only' ? '#7c4dff' : 'rgba(124, 77, 255, 0.3)'
                      }}
                    >
                      <PeopleIcon sx={{ fontSize: '1.2rem' }} />
                    </Avatar>
                  </Box>
                </Paper>

                <Paper 
                  elevation={0} 
                  onClick={() => setTempSettings({
                    ...tempSettings,
                    manualNumberDrawPermission: 'all-players'
                  })}
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    bgcolor: tempSettings.manualNumberDrawPermission === 'all-players' 
                      ? 'rgba(124, 77, 255, 0.15)' 
                      : 'rgba(30, 30, 60, 0.3)',
                    border: tempSettings.manualNumberDrawPermission === 'all-players'
                      ? '1px solid rgba(124, 77, 255, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(124, 77, 255, 0.1)',
                      borderColor: 'rgba(124, 77, 255, 0.2)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Radio 
                        checked={tempSettings.manualNumberDrawPermission === 'all-players'}
                        sx={{
                          p: 0.5,
                          mr: 1,
                          color: 'rgba(124, 77, 255, 0.6)',
                          '&.Mui-checked': {
                            color: '#7c4dff',
                          }
                        }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={tempSettings.manualNumberDrawPermission === 'all-players' ? 'bold' : 'normal'}>
                          Tüm Oyuncular
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                          Not: Manuel sayı çekme, otomatik çekme özelliği duraklatıldığında bile çalışır. Özel durumlarda sayı çekmek için kullanılabilir.
                        </Typography>
                        
                        <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                          Not: Bazı sunucu sürümleri "Tüm Oyuncular" ayarını desteklemeyebilir. Bu durumda lobi sahibi dışındakilerin sayı çekme işlemleri başarısız olacaktır.
                        </Typography>
                      </Box>
                    </Box>
                    <Avatar 
                      sx={{ 
                        width: 36, 
                        height: 36, 
                        bgcolor: tempSettings.manualNumberDrawPermission === 'all-players' ? '#7c4dff' : 'rgba(124, 77, 255, 0.3)'
                      }}
                    >
                      <GroupIcon sx={{ fontSize: '1.2rem' }} />
                    </Avatar>
                  </Box>
                </Paper>
              </Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
                {isHost 
                 ? 'Host olarak sayı çekebilirsiniz'
                 : (lobbySettings && lobbySettings.manualNumberDrawPermission === 'all-players')
                   ? 'Tüm oyuncular sayı çekebilir'
                   : 'Sadece host sayı çekebilir'
                }
              </Typography>
            </Box>

            <Box sx={{ 
              p: 2, 
              bgcolor: 'rgba(124, 77, 255, 0.08)', 
              borderRadius: 2,
              border: '1px solid rgba(124, 77, 255, 0.2)'
            }}>
              <Typography 
                variant="subtitle1" 
                fontWeight="bold" 
                sx={{ 
                  mb: 2, 
                  display: 'flex', 
                  alignItems: 'center',
                  color: '#7c4dff'
                }}
              >
                <VolumeUpIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                Ses Ayarları
              </Typography>
              <Paper 
                elevation={0} 
                onClick={() => setTempSettings({
                  ...tempSettings,
                  enableMusic: !tempSettings.enableMusic
                })}
                sx={{ 
                  p: 2, 
                  cursor: 'pointer',
                  bgcolor: 'rgba(30, 30, 60, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(124, 77, 255, 0.1)',
                    borderColor: 'rgba(124, 77, 255, 0.2)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2">
                        Oyun Müziği
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Oyun sırasında müzik çalınsın mı?
                      </Typography>
                    </Box>
                  </Box>
                  <Switch 
                    checked={tempSettings.enableMusic} 
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#7c4dff',
                        '& + .MuiSwitch-track': {
                          backgroundColor: 'rgba(124, 77, 255, 0.5)',
                        },
                      },
                    }}
                  />
                </Box>
              </Paper>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ 
          px: 3, 
          py: 2, 
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          justifyContent: 'space-between'
        }}>
          <Button 
            onClick={() => setShowSettingsModal(false)}
            variant="outlined"
            startIcon={<CancelIcon />}
            sx={{ 
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
                bgcolor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            İptal
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={saveSettings}
            startIcon={<CheckCircleIcon />}
            sx={{ 
              background: 'linear-gradient(90deg, #7c4dff, #6e45e2)',
              boxShadow: '0 4px 12px rgba(124, 77, 255, 0.3)',
              '&:hover': {
                background: 'linear-gradient(90deg, #8c5dff, #7e55f2)',
                boxShadow: '0 6px 16px rgba(124, 77, 255, 0.4)',
              }
            }}
          >
            Ayarları Kaydet
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 0.25, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="transparent" elevation={0} component="header" sx={{ mb: 0.25 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', minHeight: '32px', py: 0 }}>
          <Box
            sx={{
              background: 'linear-gradient(45deg, #ff4081, #7c4dff, #ff4081)',
              backgroundSize: '200% 200%',
              borderRadius: '8px',
              padding: '4px 12px',
              display: 'inline-block',
              boxShadow: '0 4px 15px rgba(124, 77, 255, 0.3)',
              animation: 'gradient 3s ease infinite',
              '@keyframes gradient': {
                '0%': {
                  backgroundPosition: '0% 50%'
                },
                '50%': {
                  backgroundPosition: '100% 50%'
                },
                '100%': {
                  backgroundPosition: '0% 50%'
                }
              }
            }}
          >
            <Typography 
              variant="h6" 
              component="h1" 
              fontWeight="bold"
              sx={{
                fontFamily: 'Oxanium',
                background: 'linear-gradient(to right, #ffffff, #e1e1fb)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '1px',
                textShadow: '0px 4px 8px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ViewComfyIcon sx={{ mr: 1, fontSize: '1.25rem' }} />
              TOMBALA
          </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <StatusBadge status={isOnline ? 'online' : 'offline'} variant="dot" sx={{ '& .MuiBadge-badge': { width: '6px', height: '6px', minWidth: '6px' } }}>
              <Typography variant="caption">
                {isOnline ? 'Bağlı' : 'Bağlantı Yok'}
              </Typography>
            </StatusBadge>
            
            <Chip 
              label={`Lobi: ${lobbyId || 'Bilinmiyor'}`}
              variant="outlined"
              size="small"
              sx={{ height: '20px', '& .MuiChip-label': { fontSize: '0.7rem', py: 0 } }}
            />
          </Box>
        </Toolbar>
      </AppBar>
      
      <Grid container spacing={1} sx={{ 
        flex: 1, 
        height: 'calc(100vh - 40px)', 
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}>
        {/* Sol Panel - Oyuncu Listesi - Açılır Kapanır */}
        <Grid 
          item 
          sx={{ 
            height: '100%', 
            transition: 'all 0.3s ease',
            position: 'relative',
            width: isPlayerListOpen ? { xs: '100%', md: '16.666%' } : 'auto',
            flex: isPlayerListOpen ? { xs: '0 0 100%', md: '0 0 16.666%' } : '0 0 auto',
            display: 'flex',
            bgcolor: 'background.default',
            minWidth: isPlayerListOpen ? { xs: '100%', md: '200px' } : 'auto',
            maxWidth: isPlayerListOpen ? { xs: '100%', md: '280px' } : 'auto',
          }}
        >
          {/* Oyuncular Paneli - Collapse yerine doğrudan Box kullan */}
          <Box
            sx={{
              position: 'relative',
              height: '100%',
              width: '100%',
              display: isPlayerListOpen ? 'block' : 'none',
              bgcolor: 'background.default',
              transition: 'all 0.3s ease',
            }}
          >
            <StyledPaper sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%', 
              width: '100%',
              m: 0,
              p: 1,
            }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="subtitle2">
                  Oyuncular ({players?.length || 0})
                </Typography>
              </Box>
              
              <Box sx={{ 
                flexGrow: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden' 
              }}>
                {renderCompactPlayerList()}
              </Box>
              
              {isHost && (
                <Box mt={1}>
                  {gameStatus === 'waiting' ? (
                    <Button 
                      variant="contained" 
                      color="primary" 
                      fullWidth
                      onClick={startGame}
                      disabled={!isOnline}
                      size="small"
                    >
                      Oyunu Başlat
                    </Button>
                  ) : null}
                  {/* Ayarlar butonu - Sadece host için */}
                  <Button
                    variant="outlined"
                    color="secondary"
                    fullWidth
                    onClick={() => setShowSettingsModal(true)}
                    startIcon={<SettingsIcon />}
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Ayarlar
                  </Button>
                </Box>
              )}
            </StyledPaper>
          </Box>
          
          {/* Açma/Kapama Butonu */}
          <Paper 
            sx={{ 
              position: 'absolute', 
              right: isPlayerListOpen ? 0 : 'auto',
              left: isPlayerListOpen ? 'auto' : 0,
              top: '50%', 
              transform: 'translateY(-50%)',
              zIndex: 10,
              borderRadius: isPlayerListOpen ? '0 4px 4px 0' : '4px 0 0 4px',
              boxShadow: 2,
              overflow: 'hidden'
            }}
          >
            <IconButton onClick={togglePlayerList} size="small" sx={{ p: 0.5, borderRadius: 0 }}>
              {isPlayerListOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </Paper>
        </Grid>
        
        {/* Orta Panel - Oyun Alanı */}
        <Grid 
          item 
          sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            transition: 'all 0.3s ease',
            width: isPlayerListOpen ? { xs: '100%', md: 'calc(100% - 200px)' } : '100%',
            flex: isPlayerListOpen ? { xs: '0 0 100%', md: '1 0 0' } : '1 0 0%',
            bgcolor: 'background.default'
          }}
        >
          <StyledPaper sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Oyun Durumu - Daha kompakt */}
            <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={1}>
                <Chip 
                  label={gameStatus === 'waiting' ? 'Bekleniyor' : gameStatus === 'playing' ? 'Oyun Devam Ediyor' : 'Oyun Bitti'}
                  color={gameStatus === 'waiting' ? 'default' : gameStatus === 'playing' ? 'primary' : 'secondary'}
                  variant="outlined"
                  size="small"
                />
                
                {!isPlayerListOpen && (
                  <Chip
                    icon={<PeopleIcon fontSize="small" />}
                    label={players?.length || 0}
                    size="small"
                    variant="outlined"
                    onClick={togglePlayerList}
                    sx={{ cursor: 'pointer' }}
                  />
                )}
              </Box>
              
              {gameStatus === 'playing' && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip 
                    label={isPaused ? 'Duraklatıldı' : 'Aktif'} 
                    color={isPaused ? 'warning' : 'success'}
                    size="small"
                  />
                  
                  {/* Otomatik sayı çekme kontrolü - Sadece host için görünür */}
                  {isHost && (
                    <Button
                      variant="outlined"
                      size="small"
                      color={autoDrawEnabled ? "success" : "warning"}
                      onClick={toggleAutoDrawing}
                      startIcon={autoDrawEnabled ? <PlayArrowIcon /> : <PauseIcon />}
                      sx={{ minWidth: 'auto', fontSize: '0.7rem', py: 0.5 }}
                    >
                      {autoDrawEnabled ? "Otomatik Açık" : "Otomatik Kapalı"}
                    </Button>
                  )}
                </Box>
              )}
            </Box>
            
            {/* Son 10 Sayı */}
            {gameStatus === 'playing' && (
              <RecentNumbersContainer>
                <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" mb={1}>
                  <Typography variant="subtitle2" fontWeight="medium">Son 10 Sayı</Typography>
                  
                  {/* Geri sayım sayacı */}
                  {gameStatus === 'playing' && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <TimerIcon fontSize="small" color={isPaused ? "disabled" : "action"} />
                      <CountdownCircle>
                        <CircularProgress
                          variant="determinate"
                          value={isPaused ? 0 : (countdownTimer / (lobbySettings.gameSpeed === 'slow' ? 15 : lobbySettings.gameSpeed === 'fast' ? 5 : 10)) * 100}
                          size={36}
                          thickness={4}
                          sx={{ 
                            position: 'absolute', 
                            color: isPaused ? 'text.disabled' : 'primary.main',
                            opacity: isPaused ? 0.5 : 1,
                            animation: isPaused ? 'none' : undefined
                          }}
                        />
                        <Typography 
                          variant="caption" 
                          fontWeight="bold"
                          sx={{ 
                            color: isPaused ? 'text.disabled' : 'text.primary',
                            opacity: isPaused ? 0.7 : 1
                          }}
                        >
                          {isPaused ? <PauseIcon fontSize="small" /> : countdownTimer}
                        </Typography>
                      </CountdownCircle>
                    </Box>
                  )}
                </Box>
                
                <RecentNumbersList>
                  {lastTenNumbers.length > 0 ? lastTenNumbers.map((num, index) => (
                    <NumberCircle 
                      key={`recent-${num}`} 
                      marked={index === 0 ? true : true}
                      highlight={index === 0 ? true : false}
                    >
                      <Typography variant={index === 0 ? "h6" : "body2"} fontWeight={index === 0 ? "bold" : "normal"}>
                        {num}
                      </Typography>
                    </NumberCircle>
                  )) : (
                    <Typography variant="caption" color="text.secondary">
                      Henüz sayı çekilmedi
                    </Typography>
                  )}
                </RecentNumbersList>
              </RecentNumbersContainer>
            )}
            
            {/* İki Bölümlü Düzen - Daha kompakt bir yerleşim */}
            <Grid container spacing={1} sx={{ flexGrow: 1 }}>
              {/* Sol Taraf - Çekilen Sayılar ve Mevcut Sayı */}
              <Grid item xs={12} md={6}>
                {/* Mevcut Çekilen Sayı */}
                {gameStatus === 'playing' && (
                  <CurrentNumberDisplay>
                    <Typography variant="caption" fontWeight="medium">Son Çekilen Sayı</Typography>
                    <NumberCircle marked={false} highlight={false} big={true}>
                      <Typography variant="h3" fontWeight="bold" sx={{ fontSize: '2.5rem', lineHeight: 1 }}>
                        {currentNumber || '-'}
                      </Typography>
                    </NumberCircle>
                    {/* Sayı çekme butonu */}
                    {(isHost || (lobbySettings && lobbySettings.manualNumberDrawPermission === 'all-players')) && (
                      <Box sx={{ mb: 2, textAlign: 'center' }}>
                        <Button
                          variant="contained"
                          color="secondary"
                          disabled={gameStatus !== 'playing'}
                          onClick={drawNextNumber}
                          sx={{ 
                            mb: 1,
                            width: '100%',
                            fontSize: '0.7rem',
                            whiteSpace: 'nowrap',
                            padding: '6px 8px',
                          }}
                          size="small"
                          startIcon={<AutorenewIcon />}
                        >
                          Manuel Sayı Çek
                        </Button>
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
                          {isHost 
                            ? 'Host olarak sayı çekebilirsiniz'
                            : (lobbySettings && lobbySettings.manualNumberDrawPermission === 'all-players')
                              ? 'Tüm oyuncular sayı çekebilir'
                              : 'Sadece host sayı çekebilir'
                          }
                        </Typography>
                      </Box>
                    )}
                  </CurrentNumberDisplay>
                )}
                
                {/* Çekilen Sayılar */}
                <Box mb={1}>
                  <Typography variant="caption" gutterBottom>
                    Çekilen Sayılar ({drawnNumbers.length}/90)
                  </Typography>
                  <NumberBoard 
                    numbers={Array.from({ length: 90 }, (_, i) => i + 1)}
                    drawnNumbers={drawnNumbers}
                  />
                </Box>
              </Grid>
              
              {/* Sağ Taraf - Tombala Kartı ve Butonlar */}
              <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                {/* Oyuncu Kartı */}
                <Box>
                  <Typography variant="caption" gutterBottom>
                    Tombala Kartınız
                  </Typography>
                  {playerCards && playerCards.length > 0 ? (
                    <TombalaCard
                      card={playerCards[selectedCard]} 
                      drawnNumbers={drawnNumbers}
                      currentNumber={currentNumber}
                    />
                  ) : (
                    <Box display="flex" justifyContent="center" alignItems="center" p={2} border="1px dashed rgba(255,255,255,0.3)" borderRadius={2}>
                      <Typography color="text.secondary" variant="caption">
                        {gameStatus === 'waiting' 
                          ? 'Kartlar hazırlanıyor...' 
                          : 'Kartlar yükleniyor...'}
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                {/* Çinko/Tombala Butonları */}
                {gameStatus === 'playing' && !isPaused && (
                  <Box mt={1} display="flex" justifyContent="center" gap={1}>
                    <Button 
                      variant="outlined" 
                      color="primary"
                      onClick={() => claimCinko('cinko1')}
                      disabled={!isOnline}
                      size="small"
                    >
                      1. Çinko
                    </Button>
                    <Button 
                      variant="outlined" 
                      color="primary"
                      onClick={() => claimCinko('cinko2')}
                      disabled={!isOnline}
                      size="small"
                    >
                      2. Çinko
                    </Button>
                    <Button 
                      variant="contained" 
                      color="secondary"
                      onClick={claimTombala}
                      disabled={!isOnline}
                      endIcon={<EmojiEventsIcon />}
                      size="small"
                    >
                      Tombala
                    </Button>
                  </Box>
                )}
                
                {/* Kazanan Bilgisi - Daha kompakt */}
                {(winners.cinko1 || winners.cinko2 || winners.tombala) && (
                  <Box mt={1} p={1} borderRadius={1} bgcolor="rgba(76, 175, 80, 0.2)">
                    <Typography variant="body2" align="center">
                      <EmojiEventsIcon color="primary" sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1rem' }} />
                      Kazananlar
                    </Typography>
                    
                    {winners.cinko1 && (
                      <Typography variant="caption" align="center" display="block">
                        1. Çinko: <b>{winners.cinko1.playerName || 'Bilinmeyen'}</b>
                      </Typography>
                    )}
                    
                    {winners.cinko2 && (
                      <Typography variant="caption" align="center" display="block">
                        2. Çinko: <b>{winners.cinko2.playerName || 'Bilinmeyen'}</b>
                      </Typography>
                    )}
                    
                    {winners.tombala && (
                      <Typography variant="caption" align="center" display="block">
                        Tombala: <b>{winners.tombala.playerName || 'Bilinmeyen'}</b>
                      </Typography>
                    )}
                  </Box>
                )}
              </Grid>
            </Grid>
          </StyledPaper>
        </Grid>
      </Grid>
      
      {/* Oyun özeti modali */}
      {renderGameSummary()}
      
      {/* Bildirimler */}
      <Snackbar
        open={alertOpen}
        autoHideDuration={GAME_SETTINGS.NOTIFICATION_DURATION}
        onClose={() => setAlertOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setAlertOpen(false)} 
          severity={alertSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>

      {/* Ayarlar modalı */}
      {renderSettingsModal()}

    </Container>
  );
};

export default GameBoard;