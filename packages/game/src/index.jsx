import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Doğrudan sabit değerleri tanımla - process polyfill'inden daha güvenli
const APP_CONFIG = {
  API_URL: 'http://localhost:5000',
  SOCKET_URL: 'http://localhost:5000'
};

// Global değişken olarak ekle
window.APP_CONFIG = APP_CONFIG;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
); 