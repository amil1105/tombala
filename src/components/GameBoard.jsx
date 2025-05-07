import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Grid, Paper, Typography, Button, Badge, Chip, Divider, List, ListItem, ListItemText, Avatar, TextField, IconButton, CircularProgress, Container, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, ListItemAvatar, AppBar, Toolbar, Collapse } from '@mui/material';
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

const NumberCircle = styled(Box)(({theme, marked = false, highlight = false}) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: marked ? '36px' : '50px',
  height: marked ? '36px' : '50px',
  borderRadius: '50%',
  backgroundColor: highlight ? '#ff5722' : marked ? '#7c4dff' : 'rgba(124, 77, 255, 0.2)',
  color: marked || highlight ? 'white' : theme?.palette?.text?.primary || '#fff',
  margin: '4px',
  transition: 'all 0.3s ease',
  fontWeight: highlight ? 'bold' : 'normal',
}));

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
    drawNextNumber: hookDrawNextNumber,
    createPlayerCards,
    winners,
    generateTombalaCards
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
  const [autoDrawEnabled, setAutoDrawEnabled] = useState(true);
  const [countdownTimer, setCountdownTimer] = useState(10);
  const [isPlayerListOpen, setIsPlayerListOpen] = useState(true);

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
    
    // Kullanıcı profil fotoğrafı varsa
    if (player.profileImage) {
      return player.profileImage;
    }
    
    // Bot için farklı renk
    const bgColor = player.isBot ? '#4a548e' : '#2a2c4e';
    
    // Kullanıcı adının baş harfini içeren bir SVG döndür
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
    console.log("GameBoard: Sayı çekme isteği", { socket, isHost, gameStatus, isPaused });
    
    // Hook'tan gelen drawNextNumber fonksiyonunu çağır
    hookDrawNextNumber();
    
  }, [hookDrawNextNumber, socket, isHost, gameStatus, isPaused]);

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

  // GameControls bileşeni için bir useEffect hook'u
  useEffect(() => {
    // Eğer kullanıcı oyun içindeyse ve oyun devam ediyorsa otomatik sayı çekmeyi başlat
    if (gameStatus === 'playing' && !isPaused && isOnline && socket && autoDrawEnabled) {
      // Countdown timer'ı güncelle
      const countdownId = setInterval(() => {
        setCountdownTimer((prevCount) => {
          if (prevCount <= 1) {
            // 0'a ulaştığında sayı çek ve sayacı 10'a resetle
            drawNextNumber();
            return 10;
          }
          return prevCount - 1;
        });
      }, 1000); // Her saniye timer'ı güncelle
      
      // Temizleme işlevi döndür
      return () => {
        clearInterval(countdownId);
      };
    } else {
      // Duraklatıldıysa countdown'ı resetle
      setCountdownTimer(10);
    }
  }, [gameStatus, isPaused, isOnline, socket, drawNextNumber, autoDrawEnabled]);

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

  // Oyunu başlatma (sadece host için)
  const togglePause = useCallback(() => {
    if (!socket || !isHost) return;

    socket.emit('game_update', {
          lobbyId,
      isPaused: !isPaused
    });
  }, [socket, isHost, lobbyId, isPaused]);

  // Oyun durumu değiştiğinde özet ekranını göster
  useEffect(() => {
    if (gameStatus === 'finished') {
      console.log("Oyun bitti, kazanan bilgileri (orijinal winners state):", winners);
      console.log("Mevcut oyuncu listesi (players state):", players);

      // Kazanan adını bulma yardımcı fonksiyonu
      const getWinnerName = (winnerData) => {
        if (!winnerData) return 'Kazanan yok';
        
        // Önce playerId ile players state'inde ara
        if (winnerData.playerId && players && players.length > 0) {
            const playerInState = players.find(p => { 
                // 1. Doğrudan ID eşleşmesi (Botlar veya düzeltilmiş veri için)
                if (p.id === winnerData.playerId) return true;
                
                // 2. Stringleşmiş ID içindeki eşleşme (Mevcut sorunu çözmek için)
                if (typeof p.id === 'string' && p.id.includes(winnerData.playerId)) return true;
                
                // 3. Diğer olası ID alanlarını kontrol et (fallback)
                if (p._id === winnerData.playerId) return true;
                if (p.user && (p.user === winnerData.playerId || p.user._id === winnerData.playerId)) return true;
                
                return false; // Eşleşme bulunamadı
            });

            if (playerInState && playerInState.name) {
                console.log(`Kazanan (${winnerData.playerId}) local players state'inden bulundu (güncellenmiş kontrol): ${playerInState.name}`);
                return playerInState.name;
            }
        }
        
        // Bulunamazsa, winnerData içindeki playerName'i kullan (fallback)
        if (winnerData.playerName) {
            console.warn(`Kazanan (${winnerData.playerId || 'ID yok'}) local players state'inde bulunamadı, winners objesindeki isim kullanılıyor: ${winnerData.playerName}`);
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
  }, [gameStatus, winners, drawnNumbers, players]); // players bağımlılığını ekle

  // Otomatik sayı çekmeyi başlatma/durdurma
  const toggleAutoDrawing = useCallback(() => {
    setAutoDrawEnabled(prev => !prev);
  }, []);

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

    return (
      <CompactPlayerList dense>
        {players.map((player) => (
          <ListItem key={player.id || player._id || player.user || `player-${player.name}-${Math.random().toString(36).substr(2, 9)}`}>
            <ListItemAvatar>
              <Avatar 
                sx={{ bgcolor: player.isBot ? '#1a237e' : '#7b1fa2', width: 30, height: 30, fontSize: '0.75rem' }}
                src={player.profileImage}
              >
                {player.name ? player.name.charAt(0).toUpperCase() : "?"}
              </Avatar>
            </ListItemAvatar>
            <ListItemText 
              primary={
                <Box display="flex" alignItems="center">
                  <Typography variant="body2">{player.name}</Typography>
                  {player.isHost && (
                    <Chip 
                      size="small" 
                      label="Host" 
                      color="primary" 
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
        ))}
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="div">
          <Typography variant="h5" align="center" fontWeight="bold">
            Oyun Sona Erdi
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            {drawnNumbers.length >= 90 && (
              <Typography variant="subtitle1" align="center" color="primary" fontWeight="bold" mb={3}>
                Tüm sayılar çekildi! (90/90)
              </Typography>
            )}
            
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <EmojiEventsIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
              
              <Typography variant="h6" mb={3}>
                Kazananlar
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 183, 77, 0.2)' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      1. Çinko
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {gameSummary.cinko1Winner ? 
                        (gameSummary.cinko1Winner.playerName || 'Bilinmeyen Oyuncu') : 
                        'Kazanan yok'}
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, backgroundColor: 'rgba(77, 182, 172, 0.2)' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      2. Çinko
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {gameSummary.cinko2Winner ? 
                        (gameSummary.cinko2Winner.playerName || 'Bilinmeyen Oyuncu') :
                        'Kazanan yok'}
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, backgroundColor: 'rgba(123, 31, 162, 0.2)' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Tombala
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {gameSummary.tombalaWinner ? 
                        (gameSummary.tombalaWinner.playerName || 'Bilinmeyen Oyuncu') :
                        'Kazanan yok'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
            
            <Typography variant="subtitle2" gutterBottom align="center">
              Oyun İstatistikleri
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2">Çekilen Sayılar:</Typography>
              <Typography variant="body2" fontWeight="bold">{drawnNumbers.length}/90</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2">Oyuncu Sayısı:</Typography>
              <Typography variant="body2" fontWeight="bold">{players.length}</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {
              // Hard-coded URL yerine parent frame'e mesaj gönder
              if (window !== window.parent) {
                // iframe içinde çalışıyorsa ana pencereye mesaj gönder
                window.parent.postMessage({ 
                  type: 'NAVIGATE_HOME', 
                  source: 'tombala-game',
                  timestamp: Date.now() 
                }, '*');
                console.log('Ana sayfaya dönmek için parent pencereye mesaj gönderildi');
              } else {
                // Direkt erişim durumunda (iframe dışı)
                window.location.href = '/tombala';
              }
              // Modal'ı kapat
              setShowGameSummary(false);
            }}
            fullWidth
            startIcon={<HomeIcon />}
          >
            Ana Sayfa
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Oyuncular panelini açıp kapatma
  const togglePlayerList = useCallback(() => {
    setIsPlayerListOpen(prev => !prev);
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 0.25, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="transparent" elevation={0} component="header" sx={{ mb: 0.25 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', minHeight: '32px', py: 0 }}>
          <Typography variant="body1" component="h1" fontWeight="medium">
            Tombala Oyunu
          </Typography>
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
                  ) : (
                    <Button 
                      variant="outlined" 
                      color="primary" 
                      fullWidth
                      onClick={togglePause}
                      disabled={!isOnline || gameStatus === 'finished'}
                      size="small"
                    >
                      {isPaused ? 'Devam Et' : 'Duraklat'}
                    </Button>
                  )}
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
                  
                  {/* Otomatik sayı çekme kontrolü */}
                  {!isPaused && (
                    <Button
                      variant="outlined"
                      size="small"
                      color={autoDrawEnabled ? "error" : "success"}
                      onClick={toggleAutoDrawing}
                      startIcon={autoDrawEnabled ? <PauseIcon /> : <PlayArrowIcon />}
                      sx={{ minWidth: 'auto', fontSize: '0.7rem', py: 0.5 }}
                    >
                      {autoDrawEnabled ? "Otomatiği Durdur" : "Otomatik Başlat"}
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
                  {gameStatus === 'playing' && !isPaused && autoDrawEnabled && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <TimerIcon fontSize="small" color="action" />
                      <CountdownCircle>
                        <CircularProgress
                          variant="determinate"
                          value={(countdownTimer / 10) * 100}
                          size={36}
                          thickness={4}
                          sx={{ position: 'absolute', color: 'primary.main' }}
                        />
                        <Typography variant="caption" fontWeight="bold">
                          {countdownTimer}
                        </Typography>
                      </CountdownCircle>
                    </Box>
                  )}
                </Box>
                
                <RecentNumbersList>
                  {lastTenNumbers.length > 0 ? lastTenNumbers.map((num, index) => (
                    <NumberCircle 
                      key={`recent-${num}`} 
                      marked={true}
                      highlight={index === 0}
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
                    <NumberCircle>
                      <Typography variant="h4" fontWeight="bold">
                        {currentNumber || '-'}
                      </Typography>
                    </NumberCircle>
                    {/* Sayı çekme butonu */}
                    <Button 
                      variant="contained" 
                      color="primary"
                      disabled={gameStatus !== 'playing' || isPaused}
                      onClick={hookDrawNextNumber}
                      sx={{ mb: 1 }}
                      size="small"
                    >
                      Sonraki Sayı
                    </Button>
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

  
    </Container>
  );
};

export default GameBoard;