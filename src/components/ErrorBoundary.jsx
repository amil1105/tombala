import React, { Component } from 'react';
import styled from 'styled-components';
import { FaExclamationTriangle, FaRedo, FaHome } from 'react-icons/fa';
import { Box, Typography, Button as MuiButton } from '@mui/material';

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 2rem;
  text-align: center;
  background: rgba(25, 25, 45, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  margin: 2rem;
`;

const ErrorIcon = styled.div`
  font-size: 4rem;
  color: #ff5353;
  margin-bottom: 1.5rem;
`;

const ErrorTitle = styled.h2`
  font-size: 2rem;
  margin-bottom: 1rem;
  color: var(--text-light);
`;

const ErrorMessage = styled.p`
  font-size: 1.1rem;
  margin-bottom: 2rem;
  max-width: 600px;
  color: var(--text-secondary);
  line-height: 1.6;
`;

const ErrorDetails = styled.details`
  margin-bottom: 2rem;
  text-align: left;
  width: 100%;
  max-width: 800px;
  
  summary {
    cursor: pointer;
    color: var(--text-secondary);
    font-weight: 600;
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
  }
  
  pre {
    background: rgba(0, 0, 0, 0.3);
    padding: 1rem;
    border-radius: 6px;
    overflow: auto;
    font-size: 0.9rem;
    color: #f8f9fa;
    max-height: 300px;
  }
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  
  @media (max-width: 576px) {
    flex-direction: column;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  
  @media (max-width: 576px) {
    flex-direction: column;
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.75rem 1.5rem;
  background: ${props => props.$primary ? 'var(--primary-color)' : 'transparent'};
  color: ${props => props.$primary ? 'white' : 'var(--text-light)'};
  border: ${props => props.$primary ? 'none' : '1px solid var(--border-color)'};
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    background: ${props => props.$primary ? 'var(--primary-hover)' : 'rgba(255, 255, 255, 0.1)'};
  }
`;

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Bir sonraki render'da error state'ini güncelle
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Hata detaylarını state'e kaydet
    this.setState({ error, errorInfo });
    console.error("Uygulama Hatası:", error, errorInfo);
    
    // Hata analizine yardımcı olması için hata bilgisini kaydet
    try {
      localStorage.setItem('tombala_last_error', JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        date: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Hata kaydedilemedi:', e);
    }
  }
  
  handleReload = () => {
    // Sayfayı yenile
    window.location.reload();
  };
  
  handleGoHome = () => {
    // Ana sayfaya dön
    try {
      // URL'den doğrudan kök dizine git
      window.location.href = window.location.origin;
    } catch (e) {
      console.error('Ana sayfaya yönlendirme hatası:', e);
      // Fallback olarak sayfayı yenile
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorContainer>
          <ErrorIcon>
            <FaExclamationTriangle />
          </ErrorIcon>
          <ErrorTitle>Uygulama Hatası</ErrorTitle>
          <ErrorMessage>
            Üzgünüz, bir hata oluştu. Lütfen sayfayı yenilemeyi deneyin veya ana sayfaya dönün.
          </ErrorMessage>
          
          {this.state.error && (
            <ErrorDetails>
              <summary>Hata Detayları</summary>
              <pre>
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </ErrorDetails>
          )}
          
          <ActionButtons>
            <MuiButton 
              variant="contained" 
              color="primary"
              onClick={this.handleReload}
              sx={{ mr: 2 }}
            >
              Sayfayı Yenile
            </MuiButton>
            
            <MuiButton 
              variant="outlined"
              onClick={this.handleGoHome}
            >
              Ana Sayfaya Dön
            </MuiButton>
          </ActionButtons>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 