import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useTombala } from '../hooks/useTombala';
import TombalaCard from './TombalaCard';
import { useInterval } from "../hooks/useInterval";
import { 
  isConnected, 
  eventEmitter, 
  playerService, 
  tombalaService,
  joinGameRoom,
  broadcastGameState,
  broadcastNewNumber,
  socket,
  processBotPlayers
} from "@tombala/common";
import { FaUser, FaCrown, FaArrowRight, FaTrophy, FaHistory, FaUsers, FaHome, FaInfoCircle, FaCoins } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

// Konfeti animasyonu
const confettiAnimation = keyframes`
  0% { transform: translateY(0) rotate(0deg); }
  100% { transform: translateY(100vh) rotate(720deg); }
`;

const Confetti = styled.div`
  position: fixed;
  width: 10px;
  height: 10px;
  background: ${props => props.color};
  top: -10px;
  left: ${props => props.$left}%;
  animation: ${confettiAnimation} ${props => props.$duration}s linear infinite;
`;

const WinnerOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 1000;
`;

const WinnerText = styled(motion.h1)`
  font-size: 3rem;
  color: gold;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  margin-bottom: 2rem;
`;

const PrizeAmount = styled(motion.div)`
  font-size: 2rem;
  color: #4CAF50;
  margin-bottom: 2rem;
`;

const HomeButton = styled.button`
  padding: 1rem 2rem;
  font-size: 1.2rem;
  background: #4a7dff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #2196F3;
    transform: translateY(-2px);
  }
`;

// Stil tanÄ±mlamalarÄ±
const GameContainer = styled.div`
  max-width: 1300px;
  margin: 0 auto;
  padding: 20px;
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto;
  gap: 20px;
  
  @media (min-width: 1200px) {
    grid-template-columns: 3fr 1fr;
    grid-template-areas:
      "header sidebar"
      "info sidebar"
      "content sidebar"
      "actions sidebar";
    grid-template-rows: auto auto 1fr auto;
  }
`;

const MainContent = styled.div`
  grid-area: content;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  grid-area: sidebar;
  
  @media (max-width: 1200px) {
    grid-area: unset;
  }
`;

const TabContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: rgba(25, 25, 45, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex: 1;
`;

const TabHeader = styled.div`
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const TabButton = styled.button`
  background: ${props => props.$active ? 'rgba(124, 77, 255, 0.2)' : 'transparent'};
  border: none;
  padding: 12px 15px;
  flex: 1;
  color: ${props => props.$active ? 'var(--primary-color)' : 'var(--text-light)'};
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: ${props => props.$active ? 'var(--primary-color)' : 'transparent'};
    transition: all 0.2s;
  }
  
  &:hover {
    background: rgba(124, 77, 255, 0.1);
  }
  
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const TabContent = styled.div`
  padding: 15px;
  overflow-y: auto;
  max-height: 400px;
  flex: 1;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(124, 77, 255, 0.3);
    border-radius: 3px;
  }
`;

const PlayersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PlayerItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

const PlayerAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: white;
  font-size: 18px;
`;

const PlayerInfo = styled.div`
  flex: 1;
  
  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-light);
  }
  
  p {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary);
  }
`;

const PlayerStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatusBadge = styled.span`
  padding: 4px 8px;
  border-radius: 30px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch(props.$type) {
      case 'cinko1': return 'rgba(33, 150, 243, 0.2)';
      case 'cinko2': return 'rgba(156, 39, 176, 0.2)';
      case 'tombala': return 'rgba(76, 175, 80, 0.2)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: ${props => {
    switch(props.$type) {
      case 'cinko1': return '#2196F3';
      case 'cinko2': return '#9C27B0';
      case 'tombala': return '#4CAF50';
      default: return 'var(--text-light)';
    }
  }};
  border: 1px solid ${props => {
    switch(props.$type) {
      case 'cinko1': return 'rgba(33, 150, 243, 0.4)';
      case 'cinko2': return 'rgba(156, 39, 176, 0.4)';
      case 'tombala': return 'rgba(76, 175, 80, 0.4)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  }};
`;

const LogsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const LogItem = styled.div`
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border-left: 3px solid ${props => {
    switch(props.$type) {
      case 'number': return '#2196F3';
      case 'cinko1': return '#9C27B0';
      case 'cinko2': return '#FF9800';
      case 'tombala': return '#4CAF50';
      case 'info': return '#03A9F4';
      case 'error': return '#F44336';
      default: return 'var(--text-light)';
    }
  }};
  
  p {
    margin: 0;
    font-size: 14px;
    color: var(--text-light);
  }
  
  .time {
    color: var(--text-secondary);
    font-size: 12px;
    margin-top: 4px;
  }
`;

// Oyun geÃ§miÅŸi bileÅŸeni
const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HistoryItem = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

const HistoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  
  h4 {
    margin: 0;
    font-size: 15px;
    color: var(--text-light);
    font-weight: 600;
  }
  
  span {
    font-size: 12px;
    color: var(--text-secondary);
  }
`;

const HistoryDetail = styled.div`
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .stats {
    display: flex;
    gap: 12px;
    margin-top: 4px;
    
    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
      
      .label {
        color: var(--text-tertiary);
      }
      
      .value {
        color: var(--primary-color);
        font-weight: 600;
      }
    }
  }
`;

const WinnerBadge = styled.span`
  display: inline-block;
  padding: 3px 8px;
  border-radius: 30px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.4);
`;

const GameHeader = styled.div`
  text-align: center;
  margin-bottom: 0;
  grid-area: header;
`;

const GameTitle = styled.h1`
  font-size: 36px;
  margin-bottom: 10px;
  font-weight: 800;
  background: linear-gradient(45deg, ${({ theme }) => theme.primary}, ${({ theme }) => theme.secondary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const GameInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-radius: 12px;
  background-color: rgba(25, 25, 45, 0.7);
  backdrop-filter: blur(10px);
  box-shadow: ${({ theme }) => theme.boxShadow};
  border: 1px solid rgba(255, 255, 255, 0.1);
  grid-area: info;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
  }
`;

const GameStatus = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.textPrimary};
  
  span {
    color: ${({ theme }) => theme.primary};
  }
`;

const ConnectionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  
  span {
    font-weight: 600;
    color: ${({ $isOnline }) => $isOnline ? '#4CAF50' : '#F44336'};
  }
  
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: ${({ $isOnline }) => $isOnline ? '#4CAF50' : '#F44336'};
    position: relative;
  }
  
  ${({ $isOnline }) => $isOnline && `
    .dot::after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-color: #4CAF50;
      animation: pulse 1.5s infinite;
      left: 0;
      top: 0;
    }
    
    @keyframes pulse {
      0% {
        transform: scale(1);
        opacity: 0.8;
      }
      70% {
        transform: scale(2);
        opacity: 0;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }
  `}
`;

const ButtonsContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-bottom: 0;
  grid-area: actions;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 10px;
  }
`;

const Button = styled.button`
  background: ${props => props.$primary ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.$primary ? 'white' : 'var(--text-light)'};
  border: ${props => props.$primary ? 'none' : '1px solid var(--border-color)'};
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${props => props.$primary ? '0 4px 8px rgba(0, 0, 0, 0.15)' : 'none'};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    background: ${props => props.$primary ? 'var(--primary-hover)' : 'rgba(255, 255, 255, 0.05)'};
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const CurrentNumberContainer = styled.div`
  text-align: center;
  margin-bottom: 15px;
`;

const CurrentNumber = styled.div`
  font-size: 64px;
  font-weight: 800;
  color: ${({ theme }) => theme.primary};
  text-shadow: 0 0 15px rgba(124, 77, 255, 0.5);
  background: ${({ theme }) => theme.gradient.primary};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
  margin-bottom: 10px;
  
  @media (max-width: 768px) {
    font-size: 48px;
  }
`;

const DrawnNumbers = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-bottom: 25px;
  max-width: 800px;
  margin: 0 auto 20px auto;
`;

const DrawnNumber = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  background: ${({ theme }) => theme.gradient.primary};
  color: white;
  box-shadow: ${({ theme }) => theme.boxShadow};
  
  @media (max-width: 768px) {
    width: 34px;
    height: 34px;
    font-size: 14px;
  }
`;

const CardsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
  margin-bottom: 0;
  
  @media (min-width: 992px) {
    grid-template-columns: 1fr;
  }
`;

const WinnerMessage = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(25, 25, 45, 0.95);
  backdrop-filter: blur(10px);
  color: white;
  padding: 30px 50px;
  border-radius: 15px;
  text-align: center;
  z-index: 100;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
  animation: popIn 0.5s forwards;
  border: 2px solid var(--primary-color);
  width: 90%;
  max-width: 500px;
  
  .trophy {
    font-size: 60px;
    color: gold;
    margin-bottom: 15px;
    filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5));
  }
  
  h2 {
    font-size: 28px;
    margin-bottom: 10px;
    background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  p {
    font-size: 18px;
    margin-bottom: 25px;
    color: var(--text-light);
  }
  
  .button-container {
    display: flex;
    justify-content: center;
    gap: 15px;
    
    @media (max-width: 480px) {
      flex-direction: column;
    }
  }
  
  button {
    padding: 10px 20px;
    border-radius: 8px;
    background: var(--primary-color);
    color: white;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }
    
    &.secondary {
      background: transparent;
      border: 1px solid var(--primary-color);
      color: var(--primary-color);
    }
  }
  
  @keyframes popIn {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
    100% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  
  @media (max-width: 768px) {
    padding: 20px 30px;
    
    h2 {
      font-size: 24px;
    }
    
    p {
      font-size: 16px;
    }
  }
`;

const StatusBox = styled.div`
  padding: 15px 20px;
  border-radius: 10px;
  background-color: ${({ $winner }) => 
    $winner ? 'rgba(76, 175, 80, 0.15)' : 'rgba(33, 150, 243, 0.15)'};
  border: 1px solid ${({ $winner }) => 
    $winner ? 'rgba(76, 175, 80, 0.3)' : 'rgba(33, 150, 243, 0.3)'};
  color: ${({ $winner, theme }) => 
    $winner ? theme.success : theme.info};
  margin-bottom: 20px;
  text-align: center;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
`;

const WinActionContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 0;
  margin-bottom: 20px;
  
  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const WinActionButton = styled(Button)`
  flex: 1;
  padding: 1rem;
  margin: 0 0.5rem;
  border-radius: 12px;
  font-weight: bold;
  letter-spacing: 0.5px;
  
  ${props => props.$active && `
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    box-shadow: 0 6px 12px rgba(124, 77, 255, 0.2);
    
    &:hover {
      background: linear-gradient(135deg, var(--primary-hover), var(--secondary-hover));
    }
  `}
  
  @media (max-width: 600px) {
    margin: 0;
  }
`;

const Notification = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  border-radius: 8px;
  color: white;
  z-index: 1000;
  opacity: ${props => props.$show ? 1 : 0};
  transform: translateY(${props => props.$show ? '0' : '-20px'});
  transition: all 0.3s ease;
  background-color: ${props => {
    switch(props.$type) {
      case 'error': return '#ff5353';
      case 'success': return '#4CAF50';
      default: return '#4a7dff';
    }
  }};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
`;

const NotificationContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1000;
`;

const NotificationItem = styled.div`
  padding: 12px 18px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  animation: fadeInRight 0.3s ease-out forwards;
  background-color: ${props => {
    switch(props.$type) {
      case 'error': return '#ff5353';
      case 'success': return '#4CAF50';
      case 'warning': return '#FF9800';
      default: return '#4a7dff';
    }
  }};
  
  @keyframes fadeInRight {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

// Oyun TahtasÄ± BileÅŸeni
function GameBoard() {
  const {
    gameStatus, setGameStatus,
    playerCards, setPlayerCards, 
    drawnNumbers, setDrawnNumbers,
    currentNumber,
    updatePlayerCard, setWinner, 
    winner, createNewGame,
    updateLobbyStatus,
    lobbyId, setLobbyId,
    createGameState
  } = useTombala();
  
  const [players, setPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState('players');
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [gameId, setGameId] = useState(null);
  const [cardsPurchased, setCardsPurchased] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const navigate = useNavigate();
  const [lobbyName, setLobbyName] = useState('Tombala Oyunu');
  const [totalPrize, setTotalPrize] = useState(0);
  const [winType, setWinType] = useState(null);
  const [lastClaimedCinko, setLastClaimedCinko] = useState(null);
  const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  
  // Referans deÄŸiÅŸkenleri
  const currentPlayerRef = useRef(null);
  const botTimersRef = useRef([]);
  const socketCleanupRef = useRef(null);
  
  // Oyun oturumu ve lobbyId deÄŸerini yÃ¶netme
  const [playerId, setPlayerId] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  // Bot hareketlerini yÃ¶netmek iÃ§in state
  const [botActions, setBotActions] = useState([]);
  
  // Oyuncu ID'sini localStorage'dan almak iÃ§in useEffect
  useEffect(() => {
    try {
      // localStorage'dan playerId'yi alalÄ±m, URL parametrelerinden de kontrol edelim
      const urlParams = new URLSearchParams(window.location.search);
      const urlPlayerId = urlParams.get('playerId');
      const storedPlayerId = localStorage.getItem('tombala_playerId') || urlPlayerId;
      
      if (storedPlayerId) {
        console.log("GameBoard: localStorage/URL'den playerId alÄ±ndÄ±:", storedPlayerId);
        setPlayerId(storedPlayerId);
      } else {
        // EÄŸer localStorage'da yoksa veya URL'de yoksa, kullanÄ±cÄ± ID'si iÃ§in varsayÄ±lan bir deÄŸer ata
        console.warn("GameBoard: playerId bulunamadÄ±, varsayÄ±lan deÄŸer kullanÄ±lÄ±yor");
        const anonymousId = `user_${Date.now()}`;
        setPlayerId(anonymousId);
        
        // VarsayÄ±lan deÄŸeri localStorage'a kaydet
        try {
          localStorage.setItem('tombala_playerId', anonymousId);
        } catch (e) {
          console.warn("localStorage kayÄ±t hatasÄ±:", e);
        }
      }
    } catch (error) {
      console.error("GameBoard: playerId alÄ±nÄ±rken hata:", error);
      // Hata durumunda varsayÄ±lan bir deÄŸer ata
      const anonymousId = `user_${Date.now()}`;
      setPlayerId(anonymousId);
      
      // VarsayÄ±lan deÄŸeri localStorage'a kaydet
      try {
        localStorage.setItem('tombala_playerId', anonymousId);
      } catch (e) {
        console.warn("localStorage kayÄ±t hatasÄ±:", e);
      }
    }
  }, []);
  
  // URL parametrelerinden veya window objesinden lobbyId'yi alÄ±n
  useEffect(() => {
    try {
      console.log("GameBoard: lobbyId alÄ±nmaya Ã§alÄ±ÅŸÄ±lÄ±yor...");
      
      // Vite uygulamasÄ±nÄ±n window objesinden tombalaParams deÄŸerlerini al
      const tombalaParams = window.tombalaParams || {};
      console.log("GameBoard: window.tombalaParams:", tombalaParams);
      
      // URL parametrelerinden doÄŸrudan lobbyId'yi almayÄ± dene
      const urlParams = new URLSearchParams(window.location.search);
      const urlLobbyId = urlParams.get('lobbyId');
      const urlLobbyName = urlParams.get('lobbyName') || tombalaParams.lobbyName || 'Tombala Oyunu';
      setLobbyName(urlLobbyName);
      
      console.log("GameBoard: URL'den alÄ±nan lobbyId:", urlLobbyId);
      console.log("GameBoard: URL'den alÄ±nan lobbyName:", urlLobbyName);
      
      // URL'den lobbyId alÄ±namadÄ±ysa path'ten almayÄ± dene
      // Ã–rnek: /game/tombala/BRD0EU gibi bir URL yapÄ±sÄ± iÃ§in
      let pathLobbyId = null;
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length > 2) {
        pathLobbyId = pathParts[pathParts.length - 1];
        console.log("GameBoard: Path'ten alÄ±nan lobbyId:", pathLobbyId);
      }
      
      // postMessage ile gÃ¶nderilmiÅŸ olabilecek veriyi kontrol et
      // tombalaParams.lobbyId bu ÅŸekilde doldurulmuÅŸ olabilir
      
      // En yÃ¼ksek Ã¶ncelikli kaynak URL, ardÄ±ndan params objesi, ardÄ±ndan path
      const finalLobbyId = urlLobbyId || tombalaParams.lobbyId || pathLobbyId;
      console.log("GameBoard: Belirlenen lobbyId:", finalLobbyId);
      
      if (finalLobbyId) {
        setLobbyId(finalLobbyId);
        console.log("GameBoard: lobbyId baÅŸarÄ±yla ayarlandÄ±:", finalLobbyId);
        
        // Bir kez lobbyId'yi aldÄ±ktan sonra localStorage'da kÄ±sa sÃ¼reli sakla
        // Bu sayede yeniden yÃ¼kleme durumunda bu bilgi korunur
        try {
          localStorage.setItem('tombala_lobbyId', finalLobbyId);
          localStorage.setItem('tombala_lobbyTimestamp', Date.now());
        } catch (storageError) {
          console.warn("GameBoard: localStorage hatasÄ±:", storageError);
        }
      } else {
        // EÄŸer URL'den alamadÄ±ysak, localStorage'dan son kaydedilen deÄŸeri kontrol et
        // Ancak bu deÄŸer son 5 dakika iÃ§inde kaydedilmiÅŸ olmalÄ±
        try {
          const savedLobbyId = localStorage.getItem('tombala_lobbyId');
          const timestamp = localStorage.getItem('tombala_lobbyTimestamp');
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          
          if (savedLobbyId && timestamp && parseInt(timestamp) > fiveMinutesAgo) {
            setLobbyId(savedLobbyId);
            console.log("GameBoard: localStorage'dan alÄ±nan lobbyId:", savedLobbyId);
          } else {
            console.warn("GameBoard: GeÃ§erli lobbyId bulunamadÄ± veya sÃ¼resi dolmuÅŸ");
            addLog('Lobi bilgisi alÄ±namadÄ±. Ana sayfaya yÃ¶nlendiriliyorsunuz...', 'error');
            showNotification('Lobi bilgisi alÄ±namadÄ±', 'error');
            
            // 3 saniye sonra ana sayfaya yÃ¶nlendir
    setTimeout(() => {
              window.location.href = '/';
    }, 3000);
          }
        } catch (storageError) {
          console.warn("GameBoard: localStorage okuma hatasÄ±:", storageError);
        }
      }
    } catch (error) {
      console.error("GameBoard: lobbyId alÄ±nÄ±rken hata:", error);
      addLog('Bir hata oluÅŸtu. LÃ¼tfen tekrar deneyin.', 'error');
      showNotification('Bir hata oluÅŸtu', 'error');
    }
  }, []);
  
  // Lobi ID'si deÄŸiÅŸtiÄŸinde oyun odasÄ±na katÄ±l
  useEffect(() => {
    if (lobbyId) {  // playerId koÅŸulunu kaldÄ±rdÄ±k, sadece lobbyId varsa devam etsin
      // Oyun odasÄ±na katÄ±lma iÅŸlemi
      joinGameRoom(lobbyId);
      addLog(`${lobbyId} kodlu lobiye baÄŸlanÄ±lÄ±yor...`, 'info');
      
      // Oyuncu bilgilerini al
      fetchPlayers();
    }
  }, [lobbyId]);  // sadece lobbyId deÄŸiÅŸtiÄŸinde tetiklensin
  
  // Bildirim gÃ¶sterme
  const showNotification = (message, type = 'info') => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    
    // 5 saniye sonra bildirimi kaldÄ±r
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };
  
  // Log ekleme
  const addLog = (message, type = 'info') => {
    const log = {
      id: Date.now(),
      message,
      time: new Date().toLocaleTimeString(),
      type
    };
    
    setLogs(prevLogs => [log, ...prevLogs].slice(0, 100));
  };
  
  // Oyuncu durumunu gÃ¼ncelleme
  const updatePlayerStatus = (playerId, status) => {
    setPlayers(prevPlayers => 
      prevPlayers.map(player => 
        player.id === playerId 
          ? { ...player, status }
          : player
      )
    );
  };
  
  // Aktif oyuncularÄ± Ã§ekme
  const fetchPlayers = async () => {
    try {
      console.log('Oyuncular getiriliyor...');
      const apiHost = window.location.hostname;
      // Lobi kimliÄŸi veya kodu ile oyuncularÄ± al
      let playersData = [];
      
      try {
        console.log(`Lobi kimliÄŸi (${lobbyId}) ile oyuncular getiriliyor...`);
        const lobbyResponse = await fetch(`http://${apiHost}:3000/api/lobbies/code/${lobbyId}`);
        
        if (lobbyResponse.ok) {
          const lobbyData = await lobbyResponse.json();
          console.log('Lobi verileri:', lobbyData);
          
          if (lobbyData && lobbyData.players && Array.isArray(lobbyData.players)) {
            playersData = lobbyData.players.map(player => ({
              id: player.id || player._id,
              name: player.username || player.name,
              points: player.points || 0,
              isBot: player.isBot || false,
              isReady: player.isReady || false,
              isHost: player.isHost || false,
            }));
            
            console.log('API\'den gelen oyuncular:', playersData);
            
            // EÄŸer lobi adÄ± varsa gÃ¼ncelle
            if (lobbyData.name) {
              setLobbyName(lobbyData.name);
            }
          }
        } else {
          console.warn(`Lobi bilgileri alÄ±namadÄ±: ${lobbyResponse.status}`);
        }
      } catch (error) {
        console.error('Lobi bilgileri alÄ±nÄ±rken hata:', error);
      }
      
      // EÄŸer API'den oyuncu gelmezse veya az oyuncu varsa demo oyuncular ekle
      if (!playersData || playersData.length === 0) {
        console.log('GerÃ§ek oyuncu bulunamadÄ±, aktif oyuncular getiriliyor...');
        try {
          const playerService = new PlayerService();
          const activePlayers = await playerService.getActivePlayers();
          
          if (activePlayers && activePlayers.length > 0) {
            console.log('Aktif oyuncular:', activePlayers);
            playersData = activePlayers;
          } else {
            console.log('Aktif oyuncu bulunamadÄ±, demo oyuncular oluÅŸturuluyor...');
            playersData = createDemoPlayers();
          }
        } catch (playerError) {
          console.error('Aktif oyuncular getirilirken hata:', playerError);
          playersData = createDemoPlayers();
        }
      }
      
      console.log('Final oyuncu listesi:', playersData);
      setPlayers(playersData);
    } catch (error) {
      console.error('OyuncularÄ± getirirken hata:', error);
      showNotification('Oyuncular getirilemedi!', 'error');
      
      // Hata durumunda demo oyuncular kullan
      const demoPlayers = createDemoPlayers();
      setPlayers(demoPlayers);
    }
  };
  
  // Lobbyid veya gameStatus deÄŸiÅŸtiÄŸinde lobi durumunu gÃ¼ncelle
  useEffect(() => {
    if (!lobbyId) return;

    // Oyun durumuna gÃ¶re lobi durumunu gÃ¼ncelle
    if (gameStatus === 'playing') {
      console.log('Lobi durumu "playing" olarak gÃ¼ncelleniyor...');
      updateLobbyStatus('playing');
    } else if (gameStatus === 'finished') {
      console.log('Lobi durumu "finished" olarak gÃ¼ncelleniyor...');
      updateLobbyStatus('finished');
    }
  }, [lobbyId, gameStatus, updateLobbyStatus]);

  // Oyun ilk yÃ¼klendiÄŸinde veya lobbyId deÄŸiÅŸtiÄŸinde lobby durumunu baÅŸlatmak iÃ§in
  useEffect(() => {
    if (!lobbyId) return;
    
    // OyuncularÄ± getir
    fetchPlayers();
    
    // Mevcut lobi durumunu kontrol et
    fetch(`${window.location.origin}/api/lobbies/code/${lobbyId}`)
      .then(response => response.json())
      .then(data => {
        if (data && data.status) {
          console.log('Mevcut lobi durumu:', data.status);
          
          // Oyun durumunu lobi durumuna gÃ¶re ayarla
          if (data.status === 'playing') {
            setGameStatus('playing');
          } else if (data.status === 'finished') {
            setGameStatus('finished');
          }
        }
      })
      .catch(error => {
        console.error('Lobi durumu alÄ±nÄ±rken hata:', error);
      });
  }, [lobbyId]);

  // BaÄŸlantÄ± durumu deÄŸiÅŸikliklerini dinle ve baÄŸlantÄ± kurulduÄŸunda veri gÃ¼ncelle
  useEffect(() => {
    const handleConnectionChange = (isConnected) => {
      setConnectionStatus(isConnected);
      
      if (isConnected) {
        showNotification('Sunucu baÄŸlantÄ±sÄ± kuruldu', 'success');
        addLog('Sunucu baÄŸlantÄ±sÄ± kuruldu', 'success');
        
        // BaÄŸlantÄ± kurulduÄŸunda oyuncu ve lobi verilerini yenile
        fetchPlayers();
        
        // Lobi durumunu senkronize et
        if (lobbyId && gameStatus) {
          updateLobbyStatus(gameStatus);
        }
      } else {
        showNotification('Sunucu baÄŸlantÄ±sÄ± kesildi, Ã§evrimdÄ±ÅŸÄ± mod etkin', 'warning');
        addLog('Sunucu baÄŸlantÄ±sÄ± kesildi, Ã§evrimdÄ±ÅŸÄ± mod etkin', 'warning');
      }
    };
    
    // BaÄŸlantÄ± deÄŸiÅŸikliklerini dinle
    const unsubscribe = eventEmitter.on('connectionChange', handleConnectionChange);
    
    // BaÄŸlantÄ± hatalarÄ±nÄ± dinle
    const errorUnsubscribe = eventEmitter.on('error', (error) => {
      showNotification(`BaÄŸlantÄ± hatasÄ±: ${error.message}`, 'error');
      addLog(`BaÄŸlantÄ± hatasÄ±: ${error.message}`, 'error');
    });
    
    // Socket.io odasÄ±na katÄ±l
    const gameRoomId = lobbyId || gameId;
    
    if (gameRoomId) {
      // Varolan temizleyiciyi kaldÄ±r
      if (socketCleanupRef.current) {
        socketCleanupRef.current();
      }
      
      // Oyun odasÄ±na katÄ±l ve gÃ¼ncellemeleri dinle
      socketCleanupRef.current = joinGameRoom(gameRoomId, playerId, handleGameUpdate);
      
      showNotification(`${gameRoomId} oyun odasÄ±na baÄŸlandÄ±nÄ±z`, 'info');
      addLog(`${gameRoomId} oyun odasÄ±na baÄŸlandÄ±nÄ±z`, 'info');
    }
    
    return () => {
      unsubscribe();
      errorUnsubscribe();
      
      // Socket temizleme
      if (socketCleanupRef.current) {
        socketCleanupRef.current();
      }
    };
  }, [lobbyId, gameId, playerId, gameStatus, updateLobbyStatus]);
  
  // Oyun gÃ¼ncellemelerini iÅŸle
  const handleGameUpdate = (data) => {
    console.log('Oyun gÃ¼ncellemesi alÄ±ndÄ±:', data);
    
    if (data.type === 'gameUpdate' && data.gameState) {
      // Oyun durumunu gÃ¼ncelle
      const newGameState = data.gameState;
      setGameStatus(newGameState.status);
      if (newGameState.drawnNumbers) setDrawnNumbers(newGameState.drawnNumbers);
      
      // Ã‡ekilen sayÄ±larÄ± gÃ¼ncelle
      if (data.gameState.drawnNumbers && Array.isArray(data.gameState.drawnNumbers)) {
        if (drawnNumbers.length !== data.gameState.drawnNumbers.length) {
          showNotification(`Ã‡ekilen yeni sayÄ±: ${data.gameState.currentNumber}`, 'info');
          addLog(`Ã‡ekilen yeni sayÄ±: ${data.gameState.currentNumber}`, 'info');
        }
      }
      
      // Kazanma durumunu gÃ¼ncelle
      if (data.gameState.winner && data.gameState.winType) {
        const winMessage = `${data.gameState.winner} ${data.gameState.winType} yaptÄ±!`;
        showNotification(winMessage, 'success');
        addLog(winMessage, 'success');
        setShowWinnerOverlay(true);
      }
    } else if (data.type === 'numberDrawn') {
      // Yeni sayÄ± Ã§ekildiÄŸinde
      showNotification(`Ã‡ekilen yeni sayÄ±: ${data.number}`, 'info');
      addLog(`Ã‡ekilen yeni sayÄ±: ${data.number}`, 'info');
      
      // Bot oyuncularÄ±n hareketlerini iÅŸle
      processBotMovements(data.number);
    } else if (data.type === 'playerJoined') {
      // Yeni oyuncu katÄ±ldÄ±ÄŸÄ±nda
      showNotification(`${data.player.name} oyuna katÄ±ldÄ±`, 'info');
      addLog(`${data.player.name} oyuna katÄ±ldÄ±`, 'info');
      
      // Oyuncular listesini gÃ¼ncelle
      setPlayers(prevPlayers => {
        const playerExists = prevPlayers.some(p => p.id === data.player.id);
        if (!playerExists) {
          return [...prevPlayers, data.player];
        }
        return prevPlayers;
      });
    } else if (data.type === 'playerLeft') {
      // Oyuncu ayrÄ±ldÄ±ÄŸÄ±nda
      showNotification(`${data.player.name} oyundan ayrÄ±ldÄ±`, 'info');
      addLog(`${data.player.name} oyundan ayrÄ±ldÄ±`, 'info');
      
      // Oyuncular listesini gÃ¼ncelle
      setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== data.player.id));
    } else if (data.type === 'gameEnded') {
      // Oyun bittiÄŸinde
      showNotification('Oyun sona erdi', 'info');
      addLog('Oyun sona erdi', 'info');
      setShowWinnerOverlay(true);
    }
  };
  
  // Bot hareketlerini iÅŸle
  const processBotMovements = (newNumber) => {
    // Ã–nce varolan zamanlayÄ±cÄ±larÄ± temizle
    botTimersRef.current.forEach(timer => clearTimeout(timer));
    botTimersRef.current = [];
    
    // Bot oyuncularÄ± filtrele
    const botPlayers = players.filter(player => player.isBot);
    
    // Botlar iÃ§in eylemleri hesapla
    const actions = processBotPlayers(botPlayers, playerCards, drawnNumbers, newNumber);
    setBotActions(actions);
    
    // Her bot eylemi iÃ§in zamanlayÄ±cÄ± oluÅŸtur
    actions.forEach(action => {
      // Mark eylemi iÃ§in zamanlayÄ±cÄ±
      if (action.action === 'mark') {
        const markTimer = setTimeout(() => {
          addLog(`Bot ${action.botId} sayÄ±yÄ± iÅŸaretledi: ${action.number}`, 'info');
        }, action.delay);
        
        botTimersRef.current.push(markTimer);
      }
      
      // Ã‡inko/Tombala talebi iÃ§in zamanlayÄ±cÄ±
      if (action.claim) {
        const claimDelay = action.delay + 1000; // Ä°ÅŸaretlemeden sonra biraz beklet
        
        const claimTimer = setTimeout(() => {
          addLog(`Bot ${action.botId} ${action.claim.type} talep etti!`, 'warning');
          // Kazanma durumunu eÅŸitle
          setLastClaimedCinko(action.claim.type);
          
          // Kazanan bot ise
          if (action.winResult[action.claim.type]) {
            showNotification(`Bot ${action.botId} ${action.claim.type} yaptÄ±!`, 'success');
            // Kazanan olarak ayarla
            const winningBot = players.find(p => p.id === action.botId);
            setShowWinnerOverlay(true);
          }
        }, claimDelay);
        
        botTimersRef.current.push(claimTimer);
      }
    });
  };
  
  // Oyun baÅŸlatma fonksiyonu
  const startGame = async () => {
    try {
      console.log('Oyun baÅŸlatÄ±lÄ±yor...');
      showNotification('Oyun baÅŸlatÄ±lÄ±yor!', 'info');
      addLog('Oyun baÅŸlatÄ±lÄ±yor...', 'info');
      
      // Oyun durumunu oluÅŸtur ve baÅŸlat
      createGameState('playing');
      
      // OyuncularÄ±n kartlarÄ±nÄ± getir veya oluÅŸtur
      if (!playerCards || playerCards.length === 0) {
        try {
          const apiHost = window.location.hostname;
          const response = await fetch(`http://${apiHost}:3000/api/players/cards/${lobbyId}`);
          
          if (response.ok) {
            const data = await response.json();
            setPlayerCards(data.cards || []);
          } else {
            console.log('Kartlar API\'den alÄ±namadÄ±, yeni kartlar oluÅŸturuluyor...');
            generateNewCards();
          }
        } catch (error) {
          console.error('Kart alma hatasÄ±:', error);
          generateNewCards();
        }
      }
      
      // Lobi durumunu gÃ¼ncelle (WebSocket)
      try {
        console.log('Lobi durumu gÃ¼ncelleniyor: playing');
        await updateLobbyStatus('playing');
        console.log('Lobi durumu baÅŸarÄ±yla gÃ¼ncellendi');
      } catch (err) {
        console.error('Lobi durumu gÃ¼ncellenirken hata:', err);
        // API ile direkt gÃ¼ncelleme dene
        try {
          const apiHost = window.location.hostname;
          const response = await fetch(`http://${apiHost}:3000/api/lobbies/update-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              lobbyId,
              status: 'playing',
            }),
          });
          
          if (response.ok) {
            console.log('Lobi durumu API ile gÃ¼ncellendi');
          } else {
            console.error('Lobi durumu API ile gÃ¼ncellenemedi:', await response.text());
          }
        } catch (apiErr) {
          console.error('API ile lobi durumu gÃ¼ncellenirken hata:', apiErr);
        }
      }
    } catch (error) {
      console.error('Oyun baÅŸlatma hatasÄ±:', error);
      showNotification('Oyun baÅŸlatÄ±lÄ±rken bir hata oluÅŸtu!', 'error');
      addLog('Oyun baÅŸlatÄ±lÄ±rken hata: ' + error.message, 'error');
    }
  };
  
  // SayÄ± Ã§ekme fonksiyonu
  const drawNumber = () => {
    // Ã‡ekilebilecek tÃ¼m sayÄ±lar (1-90)
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    
    // HenÃ¼z Ã§ekilmemiÅŸ sayÄ±lar
    const availableNumbers = allNumbers.filter(num => !drawnNumbers.includes(num));
    
    if (availableNumbers.length === 0) {
      showNotification('TÃ¼m sayÄ±lar Ã§ekildi!', 'info');
      addLog('TÃ¼m sayÄ±lar Ã§ekildi', 'info');
      return null;
    }
    
    // Rastgele bir sayÄ± seÃ§
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const newNumber = availableNumbers[randomIndex];
    
    // Durumu gÃ¼ncelle
    setCurrentNumber(newNumber);
    setDrawnNumbers(prev => [...prev, newNumber]);
    
    // Log ekle
    addLog(`Ã‡ekilen sayÄ±: ${newNumber}`, 'number');
    
    return newNumber;
  };
  
  // Kart numarasÄ± iÅŸaretleme
  const markNumber = (cardId, number) => {
    updatePlayerCard(cardId, number);
  };
  
  // Yeni oyun
  const newGame = () => {
    // Eski oyunu temizle
    setDrawnNumbers([]);
    setCurrentNumber(null);
    setWinner(null);
    
    // Oyuncu durumlarÄ±nÄ± sÄ±fÄ±rla
    setPlayers(prevPlayers => 
      prevPlayers.map(player => ({
        ...player,
        status: null
      }))
    );
    
    // Oyun durumunu ayarla
    setGameStatus('playing');
    
    // KartlarÄ± sÄ±fÄ±rla
    createNewGame();
  };
  
  // Ã‡inko 1 talep etme
  const claimCinko1 = () => {
    // KartÄ±n ilk satÄ±rÄ±nÄ±n tamamÄ± Ã§ekildi mi kontrol et
    const playerCard = playerCards[0]; // Ä°lk oyuncu kartÄ±
    
    if (!playerCard) return false;
    
    // Ä°lk satÄ±r numaralarÄ±
    const firstRow = playerCard.numbers[0];
    
    // Ä°lk satÄ±rÄ±n tÃ¼m numaralarÄ± Ã§ekildi mi?
    const allMarked = firstRow.every(num => 
      num === null || playerCard.marked.includes(num) || drawnNumbers.includes(num)
    );
    
    if (allMarked) {
      // Oyuncuyu gÃ¼ncelle
      const currentPlayer = currentPlayerRef.current || { id: playerId, name: 'Siz' };
      updatePlayerStatus(currentPlayer.id, 'cinko1');
      return true;
    }
    
    return false;
  };
  
  // Ã‡inko 2 talep etme
  const claimCinko2 = () => {
    // KartÄ±n ikinci satÄ±rÄ±nÄ±n tamamÄ± Ã§ekildi mi kontrol et
    const playerCard = playerCards[0]; // Ä°lk oyuncu kartÄ±
    
    if (!playerCard) return false;
    
    // Ä°kinci satÄ±r numaralarÄ±
    const secondRow = playerCard.numbers[1];
    
    // Ä°kinci satÄ±rÄ±n tÃ¼m numaralarÄ± Ã§ekildi mi?
    const allMarked = secondRow.every(num => 
      num === null || playerCard.marked.includes(num) || drawnNumbers.includes(num)
    );
    
    if (allMarked) {
      // Oyuncuyu gÃ¼ncelle
      const currentPlayer = currentPlayerRef.current || { id: playerId, name: 'Siz' };
      updatePlayerStatus(currentPlayer.id, 'cinko2');
      return true;
    }
    
    return false;
  };
  
  // Tombala talep etme
  const claimTombala = () => {
    // KartÄ±n tÃ¼m numaralarÄ± Ã§ekildi mi kontrol et
    const playerCard = playerCards[0]; // Ä°lk oyuncu kartÄ±
    
    if (!playerCard) return false;
    
    // TÃ¼m satÄ±rlarÄ±n numaralarÄ±
    const allNumbers = playerCard.numbers.flat();
    
    // TÃ¼m numaralar Ã§ekildi mi?
    const allMarked = allNumbers.every(num => 
      num === null || playerCard.marked.includes(num) || drawnNumbers.includes(num)
    );
    
    if (allMarked) {
      // Oyuncuyu gÃ¼ncelle
      const currentPlayer = currentPlayerRef.current || { id: playerId, name: 'Siz' };
      updatePlayerStatus(currentPlayer.id, 'tombala');
      setWinner(currentPlayer.name);
      return true;
    }
    
    return false;
  };
  
  // Ä°lk yÃ¼kleme ve oyun baÅŸlangÄ±cÄ±
  useEffect(() => {
    // URL parametrelerinden lobi adÄ±nÄ± al
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyNameParam = urlParams.get('lobbyName') || window.tombalaParams?.lobbyName || 'Tombala Oyunu';
    setLobbyName(lobbyNameParam);
    
    // OyuncularÄ± getir
    fetchPlayers();
    
    // Oyun baÅŸlatma
    if (gameStatus === 'waiting') {
      const delayedStart = setTimeout(() => {
    startGame();
        showNotification('Oyun baÅŸlÄ±yor!', 'success');
        addLog('Oyun baÅŸladÄ±', 'success');
      }, 2000);
      
      return () => clearTimeout(delayedStart);
    }
  }, []);
  
  // Otomatik sayÄ± Ã§ekme
  useInterval(() => {
    if (gameStatus === 'playing' && !winner) {
      drawNumber();
      
      // Sunucuya yeni Ã§ekilen sayÄ±yÄ± bildir
      if (currentNumber && connectionStatus) {
        broadcastNewNumber(lobbyId || gameId, currentNumber);
      }
    }
  }, 5000);
  
  // Kart iÅŸaretleme
  const handleCardNumberClick = (number) => {
    // EÄŸer oyuncu izleyici ise veya oyun baÅŸlamadÄ±ysa iÅŸlem yapma
    if (isSpectator || gameStatus !== 'playing') return;
    
    // Ã‡ekilen sayÄ±lar iÃ§inde var mÄ± kontrol et
    if (drawnNumbers.includes(number)) {
      // Ä°ÅŸaretlenmiÅŸ sayÄ±yÄ± bul
      const playerCardsCopy = [...playerCards];
      const currentPlayerCard = playerCardsCopy.find(card => card.playerId === players.find(p => p.isCurrentPlayer)?.id);
      
      if (currentPlayerCard) {
        // SayÄ± zaten iÅŸaretli mi kontrol et
        if (!currentPlayerCard.marked.includes(number)) {
          currentPlayerCard.marked.push(number);
          setPlayerCards(playerCardsCopy);
          
          // Kart gÃ¼ncellemesini WebSocket ile gÃ¶nder
          updatePlayerCard(currentPlayerCard);
          
          // Bildirim gÃ¶ster
          showNotification(`${number} sayÄ±sÄ± iÅŸaretlendi!`, 'success');
        }
      }
    }
  };
  
  // Yeni oyun baÅŸlatma
  const handleNewGame = () => {
    // Bot zamanlayÄ±cÄ±larÄ±nÄ± temizle
    botTimersRef.current.forEach(timer => clearTimeout(timer));
    botTimersRef.current = [];
    
    newGame();
    setLastClaimedCinko(null);
    setShowWinnerOverlay(false);
    addLog('Yeni oyun baÅŸlatÄ±ldÄ±', 'success');
    showNotification('Yeni oyun baÅŸlatÄ±ldÄ±!', 'success');
    
    // Sunucuya yeni oyun bilgisini gÃ¶nder
    if (connectionStatus) {
      broadcastGameState(lobbyId || gameId, { status: 'playing', drawnNumbers: [], currentNumber: null });
    }
  };
  
  // Ã‡inko 1 talep etme
  const handleClaimCinko1 = () => {
    const isValid = claimCinko1();
    
    if (isValid) {
      setLastClaimedCinko('cinko1');
      addLog('Ä°lk Ã‡inko baÅŸarÄ±yla yapÄ±ldÄ±!', 'success');
      showNotification('Tebrikler! Ä°lk Ã‡inko yaptÄ±nÄ±z!', 'success');
      
      // Sunucuya bildir
      if (connectionStatus) {
        const currentPlayer = currentPlayerRef.current || { id: playerId, name: 'Siz' };
        broadcastGameState(lobbyId || gameId, { 
          winner: currentPlayer.name, 
          winType: 'cinko1'
        });
      }
    } else {
      addLog('Ã‡inko talebi geÃ§ersiz!', 'error');
      showNotification('GeÃ§ersiz Ã‡inko talebi!', 'error');
    }
  };
  
  // Ã‡inko 2 talep etme
  const handleClaimCinko2 = () => {
    const isValid = claimCinko2();
    
    if (isValid) {
      setLastClaimedCinko('cinko2');
      addLog('Ä°kinci Ã‡inko baÅŸarÄ±yla yapÄ±ldÄ±!', 'success');
      showNotification('Tebrikler! Ä°kinci Ã‡inko yaptÄ±nÄ±z!', 'success');
      
      // Sunucuya bildir
      if (connectionStatus) {
        const currentPlayer = currentPlayerRef.current || { id: playerId, name: 'Siz' };
        broadcastGameState(lobbyId || gameId, { 
          winner: currentPlayer.name, 
          winType: 'cinko2'
        });
      }
    } else {
      addLog('Ã‡inko talebi geÃ§ersiz!', 'error');
      showNotification('GeÃ§ersiz Ã‡inko talebi!', 'error');
    }
  };
  
  // Tombala talep etme
  const handleClaimTombala = () => {
    // Tombala talebini kontrol et
    if (claimTombala()) {
      // KullanÄ±cÄ± arayÃ¼zÃ¼nÃ¼ gÃ¼ncelle
      showNotification('ðŸŽ‰ TOMBALA! Tebrikler, kazandÄ±nÄ±z!', 'success');
      addLog('TOMBALA! Oyunu kazandÄ±nÄ±z.', 'success');
      setShowWinnerOverlay(true);
      
      // Lobi durumunu "finished" olarak gÃ¼ncelle
      updateLobbyStatus('finished');
      
      // Sunucuya bildir
      if (connectionStatus && lobbyId) {
        // Oyun sonucunu sunucuya bildir
        socket.emit('gameEnded', {
          lobbyId: lobbyId,
          gameId: gameId || lobbyId,
          winner: {
            id: playerId,
            name: 'Siz'
          },
          status: 'finished',
          winType: 'tombala'
        });
      }
    } else {
      // GeÃ§erli bir tombala deÄŸilse
      showNotification('GeÃ§ersiz tombala talebi.', 'error');
      addLog('GeÃ§ersiz tombala talebi.', 'error');
    }
  };
  
  // Ana sayfaya dÃ¶nme
  const goToHomePage = () => {
    // Oyun sonucunu kaydet
    if (connectionStatus && lobbyId) {
      tombalaService.saveGameResult(lobbyId, {
        winner: winner || null,
        winType: winType || null,
        players: players
      });
      
      // Lobi durumunu "finished" olarak gÃ¼ncelle (oyuncu ayrÄ±lÄ±yor)
      updateLobbyStatus('finished');
    }
    
    // URL parametrelerinden parentUrl'i al
    const urlParams = new URLSearchParams(window.location.search);
    const parentUrl = urlParams.get('parentUrl') || '/';
    
    // Frontend iÃ§in sabit URL oluÅŸtur (port 5173)
    const hostname = window.location.hostname; // localhost veya domain adÄ±
    const frontendURL = `http://${hostname}:5173`; // DoÄŸrudan 5173 portunu belirt
    
    // Tam URL oluÅŸtur - frontend URL'i kullanarak
    const fullUrl = parentUrl.startsWith('http') 
      ? parentUrl 
      : `${frontendURL}${parentUrl.startsWith('/') ? parentUrl : `/${parentUrl}`}`

  // Demo oyuncular oluÅŸtur
  const createDemoPlayers = () => {
    console.log('Demo oyuncular oluÅŸturuluyor...');
    const demoPlayers = [
      { id: 'player_1', name: 'Siz', isCurrentPlayer: true, points: 100, isBot: false, isReady: true, isHost: true },
      { id: 'player_2', name: 'Ali', points: 75, isBot: true, isReady: true, difficultyLevel: 'normal' },
      { id: 'player_3', name: 'AyÅŸe', points: 80, isBot: true, isReady: true, difficultyLevel: 'hard' },
      { id: 'player_4', name: 'Mehmet', points: 60, isBot: true, isReady: true, difficultyLevel: 'easy' }
    ];
    
    showNotification('GerÃ§ek oyuncular bulunamadÄ±, demo oyuncular kullanÄ±lÄ±yor.', 'warning');
    addLog('Demo oyuncular oluÅŸturuldu', 'warning');
    
    return demoPlayers;
  };

  // Yeni kart oluÅŸtur
  const generateNewCards = () => {
    console.log('Yeni kartlar oluÅŸturuluyor...');
    // Oyuncu baÅŸÄ±na 1 kart oluÅŸtur
    const newCards = players.map(player => {
      return {
        id: `card_${player.id}`,
        playerId: player.id,
        numbers: generateCardNumbers(),
        marked: []
      };
    });
    
    setPlayerCards(newCards);
  };

  // Tombala kartÄ± iÃ§in rastgele sayÄ±lar oluÅŸtur
  const generateCardNumbers = () => {
    // 3 satÄ±r, her satÄ±rda 9 sÃ¼tun, her satÄ±rda 5 sayÄ±
    const rows = 3;
    const cols = 9;
    const numbersPerRow = 5;
    
    // Her sÃ¼tun iÃ§in aralÄ±k belirle (1-9, 10-19, 20-29, ...)
    const ranges = Array.from({ length: cols }, (_, i) => ({
      min: i * 10 + 1,
      max: (i + 1) * 10
    }));
    
    // BoÅŸ kart oluÅŸtur
    const card = Array.from({ length: rows }, () => Array(cols).fill(null));
    
    // Her satÄ±r iÃ§in
    for (let row = 0; row < rows; row++) {
      // Rastgele 5 sÃ¼tun seÃ§
      const selectedCols = [];
      while (selectedCols.length < numbersPerRow) {
        const col = Math.floor(Math.random() * cols);
        if (!selectedCols.includes(col)) {
          selectedCols.push(col);
        }
      }
      
      // SeÃ§ilen sÃ¼tunlara rastgele sayÄ±lar yerleÅŸtir
      for (const col of selectedCols) {
        const { min, max } = ranges[col];
        // DiÄŸer satÄ±rlarda aynÄ± sÃ¼tunda kullanÄ±lan sayÄ±larÄ± kontrol et
        const usedNumbers = [];
        for (let r = 0; r < rows; r++) {
          if (r !== row && card[r][col] !== null) {
            usedNumbers.push(card[r][col]);
          }
        }
        
        // KullanÄ±lmayan bir sayÄ± seÃ§
        let number;
        do {
          number = Math.floor(Math.random() * (max - min + 1)) + min;
        } while (usedNumbers.includes(number));
        
        card[row][col] = number;
      }
    }
    
    // 1D diziye dÃ¶nÃ¼ÅŸtÃ¼r
    const flatCard = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        flatCard.push({
          value: card[row][col],
          row,
          col
        });
      }
    }
    
    return flatCard;
  };
}
