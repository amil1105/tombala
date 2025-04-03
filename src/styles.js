import { createGlobalStyle } from 'styled-components';

// Global stillerimiz
export const GlobalStyle = createGlobalStyle`
  :root {
    --primary-color: #7c4dff;
    --primary-hover: #6a3cec;
    --secondary-color: #ff4081;
    --secondary-hover: #f02e76;
    --background-color: #1e2044;
    --background-secondary: #14152c;
    --card-bg: rgba(30, 32, 68, 0.7);
    --text-light: #e1e1fb;
    --text-secondary: #a9a9bc;
    --text-tertiary: #7e7e9a;
    --border-color: rgba(255, 255, 255, 0.1);
    --success-color: #4CAF50;
    --warning-color: #FF9800;
    --error-color: #F44336;
    --info-color: #2196F3;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    font-family: 'Roboto', 'Segoe UI', 'Arial', sans-serif;
    background: linear-gradient(135deg, var(--background-color) 0%, var(--background-secondary) 100%);
    color: var(--text-light);
    min-height: 100vh;
    font-size: 16px;
    line-height: 1.5;
  }

  #root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Poppins', 'Segoe UI', 'Arial', sans-serif;
    font-weight: 700;
    margin-bottom: 1rem;
    color: var(--text-light);
  }

  p {
    margin-bottom: 1rem;
  }

  a {
    color: var(--primary-color);
    text-decoration: none;
    transition: all 0.2s;
    
    &:hover {
      color: var(--primary-hover);
    }
  }

  button, input, select, textarea {
    font-family: inherit;
  }

  /* Animations */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes shine {
    0% {
      background-position: -100px;
    }
    100% {
      background-position: 200px;
    }
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.4;
    }
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
  }
`;

// Tema nesnesi (styled-components Provider için)
export const theme = {
  // Renkler
  primary: "#7c4dff",
  primaryDark: "#6a3cec",
  secondary: "#ff4081",
  secondaryDark: "#f02e76",
  
  // Metin renkleri
  textPrimary: "#e1e1fb",
  textSecondary: "#a9a9bc",
  textTertiary: "#7e7e9a",
  
  // Arkaplan renkleri
  background: "#1e2044",
  backgroundSecondary: "#14152c",
  cardBg: "rgba(30, 32, 68, 0.7)",
  
  // Durum renkleri
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#F44336",
  info: "#2196F3",
  
  // Gölgeler
  boxShadow: "0 8px 15px rgba(0, 0, 0, 0.1)",
  elevatedShadow: "0 12px 20px rgba(0, 0, 0, 0.15)",
  
  // Gradyanlar
  gradient: {
    primary: "linear-gradient(135deg, #7c4dff, #ff4081)",
    dark: "linear-gradient(135deg, #1e2044, #14152c)",
  },
  
  // Responsive tasarım
  breakpoints: {
    xs: "0px",
    sm: "576px",
    md: "768px",
    lg: "992px",
    xl: "1200px"
  },
  
  // Yuvarlak köşeler
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    circle: "50%"
  },
  
  // Animasyon
  transition: {
    fast: "all 0.2s ease",
    medium: "all 0.3s ease",
    slow: "all 0.5s ease"
  },
  
  // Boşluklar
  spacing: (value) => `${value * 0.25}rem`,
};

function removeDuplicatePlayers(players) {
  // Benzersiz ID'leri tutmak için set kullanıyoruz
  const uniqueIds = new Set();
  const uniquePlayers = [];
  
  // Önce mevcut kullanıcıyı ekleyelim (her zaman öncelikli olsun)
  const currentUser = players.find(player => player.id === user?.id);
  if (currentUser) {
    uniquePlayers.push(currentUser);
    uniqueIds.add(currentUser.id);
  }
  
  // Sonra diğer oyuncuları ekleyelim
  for (const player of players) {
    // Geçersiz ID'li veya zaten eklenmiş ID'li oyuncuları atla
    if (!player.id || uniqueIds.has(player.id) || player.id === user?.id) continue;
    
    uniquePlayers.push(player);
    uniqueIds.add(player.id);
  }
  
  return uniquePlayers;
} 