import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { isConnected } from '@tombala/common';
import { Typography } from '@mui/material';

const NavbarContainer = styled.nav`
  background-color: ${({ theme }) => theme.navBg};
  background-image: ${({ theme }) => theme.gradient.secondary};
  box-shadow: ${({ theme }) => theme.boxShadow};
  padding: 0 16px;
  height: 70px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
`;

const Logo = styled.a`
  font-size: 28px;
  font-weight: bold;
  color: ${({ theme }) => theme.textPrimary};
  text-decoration: none;
  display: flex;
  align-items: center;
  
  &:hover {
    text-decoration: none;
    color: ${({ theme }) => theme.primary};
  }
  
  span {
    color: ${({ theme }) => theme.primary};
    margin-right: 8px;
    font-size: 32px;
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  
  @media (max-width: 768px) {
    gap: 10px;
  }
`;

const NavLink = styled.a`
  color: ${({ theme }) => theme.textSecondary};
  text-decoration: none;
  font-weight: 500;
  font-size: 16px;
  padding: 8px 16px;
  border-radius: 8px;
  transition: ${({ theme }) => theme.transition};
  
  &:hover {
    color: ${({ theme }) => theme.textPrimary};
    background-color: rgba(255, 255, 255, 0.1);
    text-decoration: none;
  }
  
  @media (max-width: 768px) {
    font-size: 14px;
    padding: 6px 10px;
  }
`;

const ConnectionStatus = styled.div`
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  background-color: ${({ $connected, theme }) => 
    $connected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.15)'};
  color: ${({ $connected, theme }) => 
    $connected ? theme.success : theme.danger};
  border: 1px solid ${({ $connected, theme }) => 
    $connected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'};
  
  &::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: ${({ $connected, theme }) => 
      $connected ? theme.success : theme.danger};
    margin-right: 8px;
    box-shadow: 0 0 0 rgba(${({ $connected }) => 
      $connected ? '76, 175, 80' : '244, 67, 54'}, 0.4);
    animation: ${({ $connected }) => 
      $connected ? 'pulse 2s infinite' : 'none'};
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
    }
  }
  
  @media (max-width: 576px) {
    font-size: 12px;
    padding: 4px 8px;
  }
`;

function Navbar() {
  const [connected, setConnected] = useState(isConnected());
  
  useEffect(() => {
    // 3 saniyede bir bağlantı durumunu kontrol et
    const interval = setInterval(() => {
      setConnected(isConnected());
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <NavbarContainer>
      <Logo href="/">
        <Typography variant="span" component="span" sx={{ display: 'inline-block', marginRight: '4px' }}>●</Typography> TOMBALA
      </Logo>
      
      <NavLinks>
        <NavLink href="/">Ana Sayfa</NavLink>
        <ConnectionStatus $connected={connected}>
          {connected ? 'Çevrimiçi' : 'Çevrimdışı'}
        </ConnectionStatus>
      </NavLinks>
    </NavbarContainer>
  );
}

export default Navbar; 