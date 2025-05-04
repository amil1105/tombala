import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Box, Typography, List, ListItem } from '@mui/material';
import { 
  initializeSocket, 
  joinLobby, 
  onPlayersUpdate, 
  closeSocket 
} from '@tombala/common';

const LobbyContainer = styled.div`
  background: linear-gradient(145deg, #1e2044 0%, #171934 100%);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  max-width: 800px;
  margin: 0 auto;
`;

const LobbyHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 1rem;
`;

const LobbyTitle = styled.h1`
  font-size: 2rem;
  margin: 0;
  background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const LobbyDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
`;

const DetailItem = styled.div`
  h3 {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin: 0 0 0.5rem 0;
  }
  
  p {
    font-size: 1.2rem;
    margin: 0;
  }
`;

const PlayerList = styled.div`
  h2 {
    font-size: 1.5rem;
    margin: 0 0 1rem 0;
  }
  
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }
`;

const PlayerCard = styled.li`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
  }
  
  .info {
    flex: 1;
    
    .name {
      font-weight: bold;
      margin-bottom: 0.2rem;
    }
    
    .tag {
      font-size: 0.8rem;
      background: rgba(124, 77, 255, 0.2);
      color: #7C4DFF;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
    }
  }
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  
  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const Button = styled.button`
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  ${props => props.$primary && `
    background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
    color: white;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(124, 77, 255, 0.3);
    }
  `}
  
  ${props => props.$secondary && `
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-light);
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  `}
`;

const GameStatus = styled.div`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: bold;
  background-color: ${props => {
    switch(props.$status) {
      case 'waiting': return 'rgba(255, 193, 7, 0.2)';
      case 'playing': return 'rgba(76, 175, 80, 0.2)';
      case 'finished': return 'rgba(244, 67, 54, 0.2)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: ${props => {
    switch(props.$status) {
      case 'waiting': return '#FFC107';
      case 'playing': return '#4CAF50';
      case 'finished': return '#F44336';
      default: return 'var(--text-light)';
    }
  }};
`;

const ConnectionStatus = styled.div`
  position: fixed;
  top: 1rem;
  right: 1rem;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: ${props => props.$connected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'};
  color: ${props => props.$connected ? 'var(--success-color)' : 'var(--error-color)'};
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${props => props.$connected ? 'var(--success-color)' : 'var(--error-color)'};
  }
`;

const CopyButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s ease;
  margin-left: 0.5rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

function LobbyInfo({ lobbyData }) {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // WebSocket bağlantısını kurma
  useEffect(() => {
    if (lobbyData) {
      // URL'den token'ı al
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (!token) {
        console.error('Token bulunamadı!');
        return;
      }
      
      // Socket bağlantısını başlat
      const socket = initializeSocket(token);
      
      // Bağlantı olaylarını dinle
      socket.on('connect', () => {
        setConnected(true);
        
        // Lobiye katıl
        joinLobby(lobbyData.id);
      });
      
      socket.on('disconnect', () => {
        setConnected(false);
      });
      
      // Temizleme fonksiyonu
      return () => {
        closeSocket();
      };
    }
  }, [lobbyData]);

  // Oyuncu bilgilerini ayarla
  useEffect(() => {
    if (lobbyData) {
      // Mock oyuncu verileri (gerçek uygulamada backend'den gelecek)
      const mockPlayers = [
        { id: 'player1', username: 'Siz', isHost: true },
        { id: 'player2', username: 'Oyuncu 2', isHost: false },
        { id: 'player3', username: 'Oyuncu 3', isHost: false },
        { id: 'player4', username: 'Oyuncu 4', isHost: false }
      ];
      
      setPlayers(mockPlayers);
      setPlayerId('player1');
      setIsHost(true); // Şimdilik her kullanıcı host olsun
    }
  }, [lobbyData]);

  // WebSocket olaylarını dinle
  useEffect(() => {
    if (!lobbyData) return;
    
    // Oyuncu listesi güncellendiğinde
    const unsubscribePlayers = onPlayersUpdate((data) => {
      if (data && data.players) {
        setPlayers(data.players);
      } else {
        // Eğer data.players yoksa boş dizi ata
        setPlayers([]);
      }
    });
    
    // Temizleme fonksiyonu
    return () => {
      unsubscribePlayers();
    };
  }, [lobbyData]);

  // Oyuna katılma
  const handleJoinGame = () => {
    navigate('/');
  };

  // Davet linkini kopyala
  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/join/lobby/${lobbyData.lobbyCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!lobbyData) {
    return <Box>Lobi bilgileri yükleniyor...</Box>;
  }

  return (
    <>
      <ConnectionStatus $connected={connected}>
        {connected ? 'Bağlı' : 'Bağlantı Kesildi'}
      </ConnectionStatus>
      
      <LobbyContainer>
        <LobbyHeader>
          <LobbyTitle>{lobbyData.name}</LobbyTitle>
          <GameStatus $status={lobbyData.status}>
            {lobbyData.status === 'waiting' && 'Bekleniyor'}
            {lobbyData.status === 'playing' && 'Oyun Devam Ediyor'}
            {lobbyData.status === 'finished' && 'Oyun Bitti'}
          </GameStatus>
        </LobbyHeader>
        
        <LobbyDetails>
          <DetailItem>
            <Typography variant="h6" component="h3">Oyun</Typography>
            <Typography variant="body1" component="p">Tombala</Typography>
          </DetailItem>
          
          <DetailItem>
            <Typography variant="h6" component="h3">Oyuncu Limiti</Typography>
            <Typography variant="body1" component="p">{players.length} / {lobbyData.maxPlayers}</Typography>
          </DetailItem>
          
          <DetailItem>
            <Typography variant="h6" component="h3">Lobi Kodu</Typography>
            <Typography variant="body1" component="p">
              {lobbyData.lobbyCode}
              <CopyButton onClick={copyInviteLink}>
                {copySuccess ? 'Kopyalandı!' : 'Kopyala'}
              </CopyButton>
            </Typography>
          </DetailItem>
          
          {lobbyData.betAmount > 0 && (
            <DetailItem>
              <Typography variant="h6" component="h3">Bahis Miktarı</Typography>
              <Typography variant="body1" component="p">{lobbyData.betAmount} Jeton</Typography>
            </DetailItem>
          )}
        </LobbyDetails>
        
        <PlayerList>
          <Typography variant="h5" component="h2">Oyuncular</Typography>
          <List>
            {players.map(player => (
              <ListItem key={player.id} component={PlayerCard} sx={{ display: 'block', padding: 0 }}>
                <Box className="avatar">
                  {player.username.charAt(0)}
                </Box>
                <Box className="info">
                  <Box className="name">{player.username}</Box>
                  {player.isHost && <Box className="tag">Host</Box>}
                </Box>
              </ListItem>
            ))}
          </List>
        </PlayerList>
        
        <ButtonsContainer>
          <Button $primary onClick={handleJoinGame}>
            Oyuna Katıl
          </Button>
          
          <Button $secondary onClick={() => navigate(-1)}>
            Geri Dön
          </Button>
        </ButtonsContainer>
      </LobbyContainer>
    </>
  );
}

export default LobbyInfo; 