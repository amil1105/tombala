import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Grid, Paper, Typography, Button, Badge, Chip, Divider, List, ListItem, ListItemText, Avatar, TextField, IconButton, CircularProgress, Container, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, ListItemAvatar, AppBar, Toolbar } from '@mui/material';
import { styled } from '@mui/system';
import SendIcon from '@mui/icons-material/Send';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
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
  padding: '16px',
  background: 'rgba(25, 25, 45, 0.7)',
  borderRadius: '8px',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column'
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
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: 'rgba(124, 77, 255, 0.2)',
  marginBottom: '16px'
});

const NumberCircle = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '70px',
  height: '70px',
  borderRadius: '50%',
  backgroundColor: '#7c4dff',
  color: 'white',
  margin: '10px 0'
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

  // Son mesaj referansı
  const messagesEndRef = useRef(null);

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
    if (gameStatus === 'playing' && !isPaused && isOnline && socket) {
      // Her 10 saniyede bir sayı çek - eğer host ise
      const intervalId = setInterval(() => {
        // Sayı çekmeden önce kontrolleri yap
        if (gameStatus === 'playing' && !isPaused && isOnline && socket) {
          console.log("GameBoard: Otomatik sayı çekme işlemi");
          drawNextNumber();
        }
      }, 10000); // 10 saniye aralık
      
      // Temizleme işlevi döndür
      return () => clearInterval(intervalId);
    }
  }, [gameStatus, isPaused, isOnline, socket, drawNextNumber]);

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

  // Oyuncu listesini oluştur
  const renderPlayerList = () => {
    if (!players || players.length === 0) {
      return (
        <Box p={2} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Oyuncular yükleniyor...
          </Typography>
        </Box>
      );
    }

    return (
      <PlayerList>
        {players.map((player) => (
          <ListItem key={player.id || player._id || player.user || `player-${player.name}-${Math.random().toString(36).substr(2, 9)}`}>
            <ListItemAvatar>
              <Avatar 
                sx={{ bgcolor: player.isBot ? '#1a237e' : '#7b1fa2' }}
                src={player.profileImage}
              >
                {player.name ? player.name.charAt(0).toUpperCase() : "?"}
              </Avatar>
            </ListItemAvatar>
            <ListItemText 
              primary={
                <Box display="flex" alignItems="center">
                  <Typography variant="body1">{player.name}</Typography>
                  {player.isHost && (
                    <Chip 
                      size="small" 
                      label="Host" 
                      color="primary" 
                      sx={{ ml: 1, height: 20, fontSize: '0.625rem' }}
                    />
                  )}
                  {player.isBot && (
                    <Chip 
                      size="small" 
                      label="Bot" 
                      color="default" 
                      sx={{ ml: 1, height: 20, fontSize: '0.625rem' }}
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
      </PlayerList>
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

  // Sonraki sayıyı çek butonunu hazırla - artık sadece host olmayanlar bile görebilir
  const drawButton = useMemo(() => {
    console.log("GameBoard: Sayı çekme isteği", { socket, gameStatus, isPaused });
    return (
      <Button 
        variant="contained" 
        color="primary"
        disabled={gameStatus !== 'playing' || isPaused}
        onClick={hookDrawNextNumber}
        sx={{ mb: 2 }}
      >
        Sonraki Sayıyı Çek
      </Button>
    );
  }, [hookDrawNextNumber, socket, gameStatus, isPaused]);

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
            onClick={() => window.location.href = 'http://localhost:3000/home'}
            fullWidth
            startIcon={<HomeIcon />}
          >
            Ana Sayfa
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="transparent" elevation={0} component="header">
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h5" component="h1">
            Tombala Oyunu
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <StatusBadge status={isOnline ? 'online' : 'offline'} variant="dot">
              <Typography variant="body2">
                {isOnline ? 'Bağlı' : 'Bağlantı Yok'}
              </Typography>
            </StatusBadge>
            
            <Chip 
              label={`Lobi: ${lobbyId || 'Bilinmiyor'}`}
              variant="outlined"
              size="small"
            />
          </Box>
        </Toolbar>
      </AppBar>
      
      <Grid container spacing={2} sx={{ flex: 1 }}>
        {/* Sol Panel - Oyuncu Listesi */}
        <Grid item xs={12} md={3}>
          <StyledPaper>
            <Typography variant="h6" gutterBottom>
              Oyuncular ({players?.length || 0})
            </Typography>
            {renderPlayerList()}
            
            {isHost && (
              <Box mt={2}>
                {gameStatus === 'waiting' ? (
                  <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth
                    onClick={startGame}
                    disabled={!isOnline}
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
                  >
                    {isPaused ? 'Devam Et' : 'Duraklat'}
                  </Button>
                )}
        </Box>
            )}
          </StyledPaper>
        </Grid>
        
        {/* Orta Panel - Oyun Alanı */}
        <Grid item xs={12} md={6}>
          <StyledPaper>
            {/* Oyun Durumu */}
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
              <Chip 
                label={gameStatus === 'waiting' ? 'Bekleniyor' : gameStatus === 'playing' ? 'Oyun Devam Ediyor' : 'Oyun Bitti'}
                color={gameStatus === 'waiting' ? 'default' : gameStatus === 'playing' ? 'primary' : 'secondary'}
                variant="outlined"
              />
              
              {gameStatus === 'playing' && (
                <Chip 
                  label={isPaused ? 'Duraklatıldı' : 'Aktif'} 
                  color={isPaused ? 'warning' : 'success'}
                  size="small"
                />
              )}
            </Box>
            
            {/* Mevcut Çekilen Sayı */}
            {gameStatus === 'playing' && (
              <CurrentNumberDisplay>
                <Typography variant="subtitle2" fontWeight="medium">Son Çekilen Sayı</Typography>
                <NumberCircle>
                  <Typography variant="h3" fontWeight="bold">
                    {currentNumber || '-'}
                  </Typography>
                </NumberCircle>
                {/* Sayı çekme butonu */}
                {drawButton}
              </CurrentNumberDisplay>
            )}
            
            {/* Çekilen Sayılar */}
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                Çekilen Sayılar ({drawnNumbers.length}/90)
              </Typography>
              <NumberBoard 
                numbers={Array.from({ length: 90 }, (_, i) => i + 1)}
                drawnNumbers={drawnNumbers}
              />
            </Box>
            
            {/* Oyuncu Kartı */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Tombala Kartınız
              </Typography>
              {playerCards && playerCards.length > 0 ? (
            <TombalaCard
                  card={playerCards[selectedCard]} 
              drawnNumbers={drawnNumbers}
                  currentNumber={currentNumber}
                />
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" p={4} border="1px dashed rgba(255,255,255,0.3)" borderRadius={2}>
                  <Typography color="text.secondary">
                    {gameStatus === 'waiting' 
                      ? 'Kartlar hazırlanıyor, lütfen bekleyin...' 
                      : 'Kartlar yükleniyor...'}
                  </Typography>
            </Box>
          )}
            </Box>
            
            {/* Çinko/Tombala Butonları */}
            {gameStatus === 'playing' && !isPaused && (
              <Box mt={2} display="flex" justifyContent="center" gap={2}>
                <Button 
                  variant="outlined" 
                  color="primary"
                  onClick={() => claimCinko('cinko1')}
                  disabled={!isOnline}
                >
                  1. Çinko
                </Button>
                <Button 
                  variant="outlined" 
                  color="primary"
                  onClick={() => claimCinko('cinko2')}
                  disabled={!isOnline}
                >
                  2. Çinko
                </Button>
                <Button 
                  variant="contained" 
                  color="secondary"
                  onClick={claimTombala}
                  disabled={!isOnline}
                  endIcon={<EmojiEventsIcon />}
                >
                  Tombala
                </Button>
              </Box>
            )}
            
            {/* Kazanan Bilgisi */}
            {(winners.cinko1 || winners.cinko2 || winners.tombala) && (
              <Box mt={2} p={2} borderRadius={1} bgcolor="rgba(76, 175, 80, 0.2)">
                <Typography variant="subtitle1" align="center">
                  <EmojiEventsIcon color="primary" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Kazananlar
                </Typography>
                
                {winners.cinko1 && (
                  <Typography variant="body2" align="center">
                    1. Çinko: <b>{winners.cinko1.playerName || 'Bilinmeyen Oyuncu'}</b>
                  </Typography>
                )}
                
                {winners.cinko2 && (
                  <Typography variant="body2" align="center">
                    2. Çinko: <b>{winners.cinko2.playerName || 'Bilinmeyen Oyuncu'}</b>
                  </Typography>
                )}
                
                {winners.tombala && (
                  <Typography variant="body2" align="center">
                    Tombala: <b>{winners.tombala.playerName || 'Bilinmeyen Oyuncu'}</b>
                  </Typography>
                )}
                
                {drawnNumbers.length >= 90 && (
                  <Typography variant="body2" align="center" color="primary" sx={{ mt: 1, fontWeight: 'bold' }}>
                    Tüm sayılar çekildi! (90/90)
                  </Typography>
                )}
              </Box>
            )}
          </StyledPaper>
        </Grid>
        
        {/* Sağ Panel - Sohbet */}
        <Grid item xs={12} md={3}>
          <StyledPaper>
            <Typography variant="h6" gutterBottom>
              Sohbet
            </Typography>
            
            <ChatContainer>
              {renderChatMessages}
              
              <ChatForm component="form" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Mesajınızı yazın..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!isOnline}
                />
                <IconButton 
                  type="submit" 
                  color="primary"
                  disabled={!message.trim() || !isOnline}
                >
                  <SendIcon />
                </IconButton>
              </ChatForm>
            </ChatContainer>
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