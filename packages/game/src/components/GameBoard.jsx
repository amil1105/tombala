import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { 
  generateTombalaCard, 
  drawNumber, 
  checkWinningCondition,
  initializeSocket,
  joinLobby,
  startGame as emitStartGame,
  emitDrawNumber,
  announceWin,
  onPlayersUpdate,
  onNumberDrawn,
  onGameStatusUpdate,
  onWinnerAnnounced,
  closeSocket
} from '@tombala/common';
import TombalaCard from './TombalaCard';
import NumberBoard from './NumberBoard';
import LobbyInfo from './LobbyInfo';

const GameBoardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  
  @media (max-width: 768px) {
    padding: 0.5rem;
  }
`;

const GameHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(90deg, rgba(30, 32, 68, 0.8) 0%, rgba(23, 25, 52, 0.8) 100%);
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%237c4dff' fill-opacity='0.05' fill-rule='evenodd'%3E%3Cpath d='M0 20L20 0v20H0zm20 0v20l20-20H20z'/%3E%3C/g%3E%3C/svg%3E");
    opacity: 0.2;
    z-index: 0;
  }
`;

const GameTitle = styled.h1`
  font-size: 2rem;
  background: linear-gradient(45deg, #4a7dff, #7c4dff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: 0;
  position: relative;
  z-index: 1;
  
  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const GameContent = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const PlayerPanel = styled.div`
  background: rgba(30, 32, 68, 0.8);
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0px 12px 24px rgba(0, 0, 0, 0.25);
  }
`;

const ControlPanel = styled.div`
  grid-column: 1 / -1;
  background: linear-gradient(90deg, rgba(30, 32, 68, 0.8) 0%, rgba(23, 25, 52, 0.8) 100%);
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const GameStatus = styled.div`
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
  font-size: 0.9rem;
  
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
  
  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${props => {
      switch(props.$status) {
        case 'waiting': return '#FFC107';
        case 'playing': return '#4CAF50';
        case 'finished': return '#F44336';
        default: return 'var(--text-light)';
      }
    }};
  }
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 4px;
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
      box-shadow: 0 4px 12px rgba(124, 77, 255, 0.3);
    }
    
    &:disabled {
      background: #666;
      transform: none;
      box-shadow: none;
      cursor: not-allowed;
    }
  `}
  
  ${props => props.$secondary && `
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-light);
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `}
  
  @media (max-width: 600px) {
    width: 100%;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  width: 100%;
  justify-content: center;
  
  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const AutoDrawControl = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  
  label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  input {
    accent-color: var(--primary-color);
  }
`;

const WinControls = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  
  h3 {
    font-size: 1.2rem;
    margin: 0;
  }
  
  button {
    padding: 0.5rem 1rem;
  }
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

const LogContainer = styled.div`
  margin-top: 2rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.9rem;
  
  p {
    margin: 0.2rem 0;
  }
  
  .info {
    color: #64B5F6;
  }
  
  .success {
    color: #81C784;
  }
  
  .warning {
    color: #FFD54F;
  }
  
  .error {
    color: #E57373;
  }
`;

const PanelHeader = styled.h2`
  font-size: 1.5rem;
  margin-bottom: 1rem;
`;

const WinStatusButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const WinStatusButton = styled.button`
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 4px;
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
      box-shadow: 0 4px 12px rgba(124, 77, 255, 0.3);
    }
    
    &:disabled {
      background: #666;
      transform: none;
      box-shadow: none;
      cursor: not-allowed;
    }
  `}
  
  ${props => props.$active && `
    background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
    color: white;
  `}
  
  @media (max-width: 600px) {
    width: 100%;
  }
`;

const WinIcon = styled.span`
  margin-left: 0.5rem;
  font-size: 1.2rem;
`;

const PlayersSection = styled.div`
  margin-top: 1rem;
`;

const PlayersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
`;

const PlayerCard = styled.div`
  background: rgba(30, 32, 68, 0.8);
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.25);
  }
  
  ${props => props.$isHost && `
    background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
    color: white;
  `}
`;

const PlayerName = styled.h3`
  font-size: 1.2rem;
  margin: 0;
`;

const HostBadge = styled.span`
  background: var(--primary-color);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
  margin-left: 0.5rem;
`;

const ControlPanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const CurrentNumberDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CurrentNumber = styled.span`
  font-size: 1.2rem;
  font-weight: bold;
`;

const AutoDrawingToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Switch = styled.input.attrs({ type: 'checkbox' })`
  accent-color: var(--primary-color);
  width: 40px;
  height: 20px;
  cursor: pointer;
`;

function GameBoard({ lobbyData }) {
  const [playerCard, setPlayerCard] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [gameStatus, setGameStatus] = useState(lobbyData?.status || 'waiting');
  const [winStatus, setWinStatus] = useState({
    cinko1: false,
    cinko2: false,
    tombala: false
  });
  const [isAutoDrawing, setIsAutoDrawing] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState(null);
  const [isHost, setIsHost] = useState(lobbyData?.players?.[0]?.isHost || false);
  const [players, setPlayers] = useState(lobbyData?.players || []);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((message, type = 'info') => {
    setLogs(prevLogs => [...prevLogs, { message, type, timestamp: new Date() }]);
  }, []);

  useEffect(() => {
    if (lobbyData) {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (!token) {
        addLog('Token bulunamadı! Lütfen tekrar giriş yapın.', 'error');
        return;
      }
      
      const socket = initializeSocket(token);
      
      socket.on('connect', () => {
        setConnected(true);
        addLog('Sunucuya bağlanıldı', 'success');
        
        joinLobby(lobbyData.id);
        addLog(`Lobiye katılındı: ${lobbyData.name}`, 'info');
      });
      
      socket.on('disconnect', () => {
        setConnected(false);
        addLog('Sunucu bağlantısı kesildi', 'error');
      });
      
      return () => {
        closeSocket();
      };
    }
  }, [lobbyData, addLog]);

  useEffect(() => {
    if (!lobbyData) return;
    
    const unsubscribePlayers = onPlayersUpdate((data) => {
      if (!data) {
        setPlayers([]);
        addLog('Oyuncu verileri alınamadı', 'error');
        return;
      }
      
      const playerList = data.players || [];
      setPlayers(playerList);
      
      if (playerList.length > 0 && data.currentPlayerId) {
        const currentPlayer = playerList.find(p => p.id === data.currentPlayerId);
        if (currentPlayer) {
          setIsHost(currentPlayer.isHost || false);
        }
      }
      
      addLog(`Oyuncu listesi güncellendi: ${playerList.length} oyuncu`, 'info');
    });
    
    return () => {
      unsubscribePlayers();
    };
  }, [lobbyData, addLog]);

  useEffect(() => {
    if (gameStatus === 'playing') {
      setIsAutoDrawing(true);
      
      const interval = setInterval(() => {
        if (drawnNumbers.length >= 90) {
          clearInterval(interval);
          return;
        }
        
        let newNumber;
        do {
          newNumber = Math.floor(Math.random() * 90) + 1;
        } while (drawnNumbers.includes(newNumber));
        
        setCurrentNumber(newNumber);
        setDrawnNumbers(prev => [...prev, newNumber]);
        addLog(`Yeni sayı çekildi: ${newNumber}`, 'info');
        
      }, 3000);
      
      setAutoDrawInterval(interval);
      return () => clearInterval(interval);
    }
  }, [gameStatus, drawnNumbers]);

  useEffect(() => {
    if (lobbyData?.status === 'playing') {
      const savedCard = localStorage.getItem(`tombala_card_${lobbyData.id}`);
      const savedDrawnNumbers = localStorage.getItem(`tombala_drawn_numbers_${lobbyData.id}`);
      
      if (savedCard && !playerCard) {
        setPlayerCard(JSON.parse(savedCard));
        addLog('Kaydedilmiş kartınız yüklendi', 'success');
      } else if (!playerCard) {
        const newCard = generateTombalaCard();
        setPlayerCard(newCard);
        localStorage.setItem(`tombala_card_${lobbyData.id}`, JSON.stringify(newCard));
        addLog('Yeni kart oluşturuldu ve kaydedildi', 'success');
      }
      
      if (savedDrawnNumbers && drawnNumbers.length === 0) {
        setDrawnNumbers(JSON.parse(savedDrawnNumbers));
        const lastNumber = JSON.parse(savedDrawnNumbers).slice(-1)[0];
        setCurrentNumber(lastNumber);
        addLog(`Kaydedilmiş ${JSON.parse(savedDrawnNumbers).length} sayı yüklendi`, 'info');
      } else if (drawnNumbers.length === 0) {
        const initialNumbers = Array.from({length: 10}, () => Math.floor(Math.random() * 90) + 1);
        const uniqueNumbers = [...new Set(initialNumbers)];
        setDrawnNumbers(uniqueNumbers);
        setCurrentNumber(uniqueNumbers[uniqueNumbers.length - 1]);
        localStorage.setItem(`tombala_drawn_numbers_${lobbyData.id}`, JSON.stringify(uniqueNumbers));
        addLog(`${uniqueNumbers.length} sayı çekildi`, 'info');
      }
      
      setGameStatus('playing');
    }
  }, [lobbyData, playerCard]);

  useEffect(() => {
    if (lobbyData && drawnNumbers.length > 0) {
      localStorage.setItem(`tombala_drawn_numbers_${lobbyData.id}`, JSON.stringify(drawnNumbers));
    }
  }, [drawnNumbers, lobbyData]);

  useEffect(() => {
    if (!lobbyData) return;
    
    const unsubscribeStatus = onGameStatusUpdate((data) => {
      if (!data) {
        addLog('Oyun durumu verisi alınamadı', 'error');
        return;
      }
      
      setGameStatus(data.status);
      
      if (data.status === 'playing' && !playerCard) {
        const newCard = generateTombalaCard();
        setPlayerCard(newCard);
        addLog('Oyun başladı! Kartınız hazırlandı.', 'success');
      } else if (data.status === 'finished') {
        setIsAutoDrawing(false);
        addLog('Oyun sona erdi!', 'warning');
      }
    });
    
    const unsubscribeNumber = onNumberDrawn((data) => {
      if (!data) {
        addLog('Sayı verisi alınamadı', 'error');
        return;
      }
      
      const newNumber = data.number;
      if (newNumber) {
        setCurrentNumber(newNumber);
        setDrawnNumbers(prev => [...prev, newNumber]);
        addLog(`Yeni sayı çekildi: ${newNumber}`, 'info');
      }
    });
    
    const unsubscribeWinner = onWinnerAnnounced((data) => {
      if (!data) {
        addLog('Kazanan bilgisi alınamadı', 'error');
        return;
      }
      
      const { playerId, winType } = data;
      
      if (!winType) {
        addLog('Kazanma türü belirtilmemiş', 'error');
        return;
      }
      
      setWinStatus(prev => ({
        ...prev,
        [winType]: true
      }));
      
      let winnerName = 'Bilinmeyen Oyuncu';
      
      if (playerId && players && players.length > 0) {
        const winner = players.find(p => p.id === playerId);
        if (winner && winner.username) {
          winnerName = winner.username;
        }
      }
      
      const winMessages = {
        cinko1: `${winnerName} Çinko yaptı!`,
        cinko2: `${winnerName} İkinci Çinko yaptı!`,
        tombala: `${winnerName} TOMBALA yaptı!`
      };
      
      addLog(winMessages[winType], 'success');
      
      if (winType === 'tombala') {
        setGameStatus('finished');
        setIsAutoDrawing(false);
      }
    });
    
    return () => {
      unsubscribeStatus();
      unsubscribeNumber();
      unsubscribeWinner();
    };
  }, [lobbyData, playerCard, players, addLog]);

  const handleStartGame = () => {
    if (!isHost) {
      addLog('Sadece lobi sahibi oyunu başlatabilir', 'warning');
      return;
    }
    
    emitStartGame(lobbyData.id);
    addLog('Oyun başlatma isteği gönderildi', 'info');
  };

  const handleDrawNumber = () => {
    if (gameStatus !== 'playing') {
      addLog('Oyun aktif değil, sayı çekilemez', 'warning');
      return;
    }
    
    if (drawnNumbers.length >= 90) {
      addLog('Tüm sayılar çekildi!', 'warning');
      return;
    }
    
    let newNumber;
    do {
      newNumber = Math.floor(Math.random() * 90) + 1;
    } while (drawnNumbers.includes(newNumber));
    
    setCurrentNumber(newNumber);
    setDrawnNumbers(prev => [...prev, newNumber]);
    addLog(`Yeni sayı çekildi: ${newNumber}`, 'info');
  };

  const checkAndAnnounceWin = (winType) => {
    if (gameStatus !== 'playing') {
      addLog('Oyun aktif değil, çinko/tombala yapılamaz', 'warning');
      return;
    }
    
    if (!playerCard) {
      addLog('Kart bulunamadı', 'error');
      return;
    }
    
    const result = checkWinningCondition(playerCard, drawnNumbers);
    
    if (result[winType]) {
      announceWin(lobbyData.id, winType);
      addLog(`${winType} bildirimi yapıldı!`, 'success');
      
      setWinStatus(prev => ({
        ...prev,
        [winType]: true
      }));
    } else {
      addLog(`${winType} koşulları sağlanmadı!`, 'error');
    }
  };

  const toggleAutoDrawing = () => {
    setIsAutoDrawing(!isAutoDrawing);
    
    if (!isAutoDrawing) {
      addLog('Otomatik sayı çekme başlatıldı', 'info');
    } else {
      addLog('Otomatik sayı çekme durduruldu', 'info');
      
      if (autoDrawInterval) {
        clearInterval(autoDrawInterval);
        setAutoDrawInterval(null);
      }
    }
  };

  if (!lobbyData) {
    return <div>Lobi bilgileri yükleniyor...</div>;
  }

  return (
    <>
      <ConnectionStatus $connected={connected}>
        {connected ? 'Bağlı' : 'Bağlantı Kesildi'}
      </ConnectionStatus>
      
      <GameBoardContainer>
        <GameHeader>
          <GameTitle>Tombala</GameTitle>
          <GameStatus $status={gameStatus}>
            {gameStatus === 'waiting' && 'Oyun Başlamadı'}
            {gameStatus === 'playing' && 'Oyun Devam Ediyor'}
            {gameStatus === 'finished' && 'Oyun Bitti'}
          </GameStatus>
        </GameHeader>
        
        {gameStatus === 'waiting' ? (
          <>
            <LobbyInfo lobbyData={lobbyData} />
            
            {isHost && (
              <Button $primary onClick={handleStartGame}>
                Oyunu Başlat
              </Button>
            )}
          </>
        ) : (
          <>
            <GameContent>
              <PlayerPanel>
                <PanelHeader>Tombala Kartınız</PanelHeader>
                {playerCard && (
                  <TombalaCard 
                    card={playerCard} 
                    drawnNumbers={drawnNumbers} 
                  />
                )}

                <WinControls>
                  <h3>Kazanma Durumu</h3>
                  <WinStatusButtons>
                    <WinStatusButton 
                      $active={winStatus.cinko1}
                      onClick={() => checkAndAnnounceWin('cinko1')}
                      disabled={winStatus.cinko1}
                    >
                      Çinko 1
                      {winStatus.cinko1 && <WinIcon />}
                    </WinStatusButton>
                    
                    <WinStatusButton 
                      $active={winStatus.cinko2}
                      onClick={() => checkAndAnnounceWin('cinko2')}
                      disabled={!winStatus.cinko1 || winStatus.cinko2}
                    >
                      Çinko 2
                      {winStatus.cinko2 && <WinIcon />}
                    </WinStatusButton>
                    
                    <WinStatusButton 
                      $primary
                      $active={winStatus.tombala}
                      onClick={() => checkAndAnnounceWin('tombala')}
                      disabled={!winStatus.cinko2 || winStatus.tombala}
                    >
                      Tombala
                      {winStatus.tombala && <WinIcon />}
                    </WinStatusButton>
                  </WinStatusButtons>
                </WinControls>
              </PlayerPanel>
              
              <PlayerPanel>
                <PanelHeader>Sayı Tahtası</PanelHeader>
                <NumberBoard 
                  drawnNumbers={drawnNumbers} 
                  currentNumber={currentNumber} 
                />

                <PlayersSection>
                  <PanelHeader>Oyuncular</PanelHeader>
                  <PlayersGrid>
                    {players.map((player) => (
                      <PlayerCard key={player.id} $isHost={player.isHost}>
                        <PlayerName>{player.username}</PlayerName>
                        {player.isHost && <HostBadge>Host</HostBadge>}
                      </PlayerCard>
                    ))}
                  </PlayersGrid>
                </PlayersSection>
              </PlayerPanel>
            </GameContent>
            
            <ControlPanel>
              {gameStatus === 'playing' && (
                <>
                  <ControlPanelHeader>
                    <CurrentNumberDisplay>
                      <span>Son Çekilen Sayı</span>
                      <CurrentNumber>{currentNumber}</CurrentNumber>
                    </CurrentNumberDisplay>
                    
                    <AutoDrawingToggle>
                      <span>Otomatik Çekim</span>
                      <Switch 
                        checked={isAutoDrawing}
                        onChange={toggleAutoDrawing}
                      />
                    </AutoDrawingToggle>
                  </ControlPanelHeader>
                  
                  <ButtonGroup>
                    {isHost && (
                      <Button 
                        $primary 
                        onClick={handleDrawNumber}
                        disabled={isAutoDrawing}
                      >
                        Sayı Çek
                      </Button>
                    )}
                  </ButtonGroup>
                </>
              )}
              
              <LogContainer>
                <h3>Oyun Logları</h3>
                {logs.map((log, index) => (
                  <p key={index} className={log.type}>
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </p>
                ))}
              </LogContainer>
            </ControlPanel>
          </>
        )}
      </GameBoardContainer>
    </>
  );
}

export default GameBoard; 