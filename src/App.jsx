import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Container } from '@mui/material';
import { styled } from '@mui/system';
import GameBoard from './components/GameBoard';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import { STORAGE_KEYS } from './utils/config';
import './index.css';

// Stil bileşenleri
const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  background: 'linear-gradient(135deg, #1a237e 0%, #311b92 100%)'
}));

// URL parametrelerinden lobi ID'sini okumak için içe yönetim bileşeni
const GameWrapper = () => {
  const { lobbyId } = useParams();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // URL'den gelen lobi kimliğini al
    const lobbyIdFromParams = lobbyId;
    
    // Lobi kimliğini kaydet
    if (lobbyIdFromParams) {
      localStorage.setItem(STORAGE_KEYS.LOBBYID, lobbyIdFromParams);
      console.log('Lobi kimliği URL\'den alındı ve kaydedildi:', lobbyIdFromParams);
    }
    
    // URL parametrelerini kontrol et
    const searchParams = new URLSearchParams(location.search);
    const codeFromQuery = searchParams.get('code') || searchParams.get('lobbyId');
    
    if (codeFromQuery && !lobbyIdFromParams) {
      localStorage.setItem(STORAGE_KEYS.LOBBYID, codeFromQuery);
      console.log('Lobi kimliği sorgu parametresinden alındı ve kaydedildi:', codeFromQuery);
    }
    
    // Kısa yükleme gecikmesi ekle (API bağlantıları için)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [lobbyId, location]);
  
  if (isLoading) {
    return (
      <LoadingContainer>
        <CircularProgress color="primary" size={60} thickness={4} />
        <Typography variant="h6" color="white" mt={2}>
          Tombala Lobisi Yükleniyor...
        </Typography>
      </LoadingContainer>
    );
  }
  
  return <GameBoard />;
};

// Ana bileşen
const App = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  
  useEffect(() => {
    // Uygulama ilklendirmeleri burada yapılabilir
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (isInitializing) {
    return (
      <LoadingContainer>
        <CircularProgress color="primary" size={60} thickness={4} />
        <Typography variant="h6" color="white" mt={2}>
          Tombala Oyunu Başlatılıyor...
        </Typography>
      </LoadingContainer>
    );
  }
  
  return (
    <ErrorBoundary>
      <Routes>
        {/* Ana sayfa */}
        <Route path="/" element={<Navigate to="/game" replace />} />
        
        {/* Oyun rotaları */}
        <Route path="/game" element={<GameWrapper />} />
        <Route path="/game/:lobbyId" element={<GameWrapper />} />
        
        {/* Direct-tombala rotaları için (harici bağlantılar) */}
        <Route path="/direct-tombala/:lobbyId" element={<GameWrapper />} />
        
        {/* Lobi kodu rotaları */}
        <Route path="/:lobbyId" element={<GameWrapper />} />
        
        {/* 404 sayfası */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
};

export default App; 