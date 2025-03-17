import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { API_URL, initializeSocket, closeSocket, joinLobby } from '@tombala/common';
import GameBoard from './components/GameBoard';
import LobbyInfo from './components/LobbyInfo';
import NotFound from './components/NotFound';

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--background-dark);
`;

const Header = styled.header`
  background: linear-gradient(90deg, #1F2937 0%, #111827 100%);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--text-light);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  span {
    background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
`;

const Content = styled.main`
  flex: 1;
  padding: 2rem;
`;

const ErrorContainer = styled.div`
  color: var(--error-color);
  background: rgba(255, 53, 53, 0.1);
  padding: 2rem;
  border-radius: 0.5rem;
  text-align: center;
  
  button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    border: none;
    border-radius: 0.25rem;
    color: white;
    cursor: pointer;
    
    &:hover {
      background: var(--secondary-color);
    }
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--text-light);
  font-size: 1.2rem;
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

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lobbyData, setLobbyData] = useState(null);
  const [params, setParams] = useState({});
  const [connected, setConnected] = useState(false);

  // Socket bağlantısını kurma ve lobi verilerini alma
  useEffect(() => {
    // URL'den parametreleri al
    const searchParams = new URLSearchParams(location.search);
    const lobbyId = searchParams.get('lobbyId');
    const token = searchParams.get('token');
    
    console.log('URL Parametreleri:', { lobbyId, token: token ? '***' + token.slice(-6) : null });
    
    setParams({ lobbyId, token });
    
    if (!lobbyId || !token) {
      setError('Geçersiz lobi bilgileri. lobbyId ve token parametreleri gereklidir.');
      setLoading(false);
      return;
    }

    // Önce WebSocket bağlantısını deneyelim
    try {
      const socket = initializeSocket(token);
      
      socket.on('connect', () => {
        setConnected(true);
        console.log('WebSocket bağlantısı kuruldu');
        
        // Lobiye katıl
        joinLobby(lobbyId);
        
        // Gerçek API'den lobi verilerini al
        fetchLobbyData(lobbyId, token);
      });
      
      socket.on('connect_error', (error) => {
        console.error('WebSocket bağlantı hatası:', error);
        console.log('WebSocket bağlantısı kurulamadı, yine de devam edilecek.');
        
        // WebSocket bağlantısı başarısız olsa bile lobi verilerini al
        fetchLobbyData(lobbyId, token);
      });
      
      socket.on('disconnect', () => {
        setConnected(false);
        console.log('WebSocket bağlantısı kesildi');
      });
      
      // Temizleme fonksiyonu
      return () => {
        closeSocket();
      };
    } catch (error) {
      console.error('Socket başlatma hatası:', error);
      console.log('WebSocket bağlantısı kurulamadı, yine de devam edilecek.');
      
      // Hata oluşsa bile lobi verilerini al
      fetchLobbyData(lobbyId, token);
    }
  }, [location.search]);

  // API'den lobi verilerini alma
  const fetchLobbyData = async (lobbyId, token) => {
    try {
      // API çağrısını yapmadan önce yüklenme durumunu göster
      setLoading(true);
      
      // Her zaman mock data kullan (geliştirme aşamasında)
      console.log('Mock veri kullanılıyor - Geliştirme modu');
      
      // 1 saniye gecikme ekle (gerçek API çağrısını simüle etmek için)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mocklanan veri
      const mockLobbyData = {
        id: lobbyId,
        name: 'Tombala Turnuvası',
        lobbyCode: 'ABC123',
        players: [
          { id: '1', username: 'Siz', isHost: true },
          { id: '2', username: 'Ahmet', isHost: false },
          { id: '3', username: 'Mehmet', isHost: false },
          { id: '4', username: 'Ayşe', isHost: false }
        ],
        maxPlayers: 6,
        game: 'tombala',
        status: 'playing',
        betAmount: 100
      };
      
      setLobbyData(mockLobbyData);
      setLoading(false);
      setError(null);
      return;
      
      /* 
      // Gerçek API çağrısı
      console.log(`Lobi verileri alınıyor: ${API_URL}/api/lobbies/${lobbyId}`);
      const response = await fetch(`${API_URL}/api/lobbies/${lobbyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include' // CORS için önemli
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lobi bilgileri alınamadı (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Lobi verileri alındı:', data);
      
      setLobbyData(data);
      setError(null);
      */
    } catch (error) {
      console.error('Lobi verileri alınırken hata:', error);
      setError(error.message || 'Lobi bilgileri alınamadı');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppContainer>
        <Header>
          <Logo>
            <span>Tombala</span> Oyunu
          </Logo>
        </Header>
        <Content>
          <LoadingContainer>Yükleniyor...</LoadingContainer>
        </Content>
      </AppContainer>
    );
  }

  if (error) {
    return (
      <AppContainer>
        <Header>
          <Logo>
            <span>Tombala</span> Oyunu
          </Logo>
        </Header>
        <Content>
          <ErrorContainer>
            <h2>Hata Oluştu</h2>
            <p>{error}</p>
            <div>
              <p>Parametreler: lobbyId={params.lobbyId}, token={params.token ? '...' + params.token.slice(-6) : 'yok'}</p>
            </div>
            <button onClick={() => navigate('/')}>Ana Sayfaya Dön</button>
          </ErrorContainer>
        </Content>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <Header>
        <Logo>
          <span>TOMBALA</span> Oyunu
        </Logo>
        
        <ConnectionStatus $connected={connected}>
          {connected ? 'Bağlı' : 'Bağlantı Kesildi'}
        </ConnectionStatus>
      </Header>

      <Content>
        {loading && (
          <LoadingContainer>
            Yükleniyor...
          </LoadingContainer>
        )}
        
        {error && !loading && (
          <ErrorContainer>
            <h2>Hata Oluştu</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/')}>Ana Sayfaya Dön</button>
          </ErrorContainer>
        )}
        
        {!loading && !error && lobbyData && (
          <Routes>
            <Route path="/" element={<GameBoard lobbyData={lobbyData} />} />
            <Route path="/info" element={<LobbyInfo lobbyData={lobbyData} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </Content>
    </AppContainer>
  );
}

export default App; 