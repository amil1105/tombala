import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CustomThemeProvider } from './contexts/ThemeContext';
import './index.css';

// Global playerId değişkeni güvenlik önlemi
if (typeof window !== 'undefined') {
  // Global playerId değişkenini tanımla
  window.playerId = localStorage.getItem('tombala_playerId') || 
                   localStorage.getItem('playerId') || 
                   `player_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  
  // localStorage'a kaydet
  localStorage.setItem('tombala_playerId', window.playerId);
  localStorage.setItem('playerId', window.playerId);
  
  console.log('Global playerId değişkeni main.jsx\'de tanımlandı:', window.playerId);
  
  // Global scope'a ekle
  window.addEventListener('DOMContentLoaded', () => {
    // Tüm script'lerin yüklenmesinden önce global değişkeni ayarla
    const script = document.createElement('script');
    script.textContent = `var playerId = "${window.playerId}";`;
    document.head.appendChild(script);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CustomThemeProvider>
      <BrowserRouter basename="/tombala">
        <App />
      </BrowserRouter>
    </CustomThemeProvider>
  </React.StrictMode>
); 