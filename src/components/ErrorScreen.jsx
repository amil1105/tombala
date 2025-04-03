import React from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #f1f1f1;
  background-color: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  margin: 2rem auto;
  max-width: 600px;
`;

const ErrorIcon = styled.div`
  font-size: 3rem;
  color: #f44336;
  margin-bottom: 1rem;
`;

const ErrorMessage = styled.div`
  font-size: 1.2rem;
  text-align: center;
  margin-bottom: 1.5rem;
`;

const RetryButton = styled.button`
  padding: 0.75rem 1.5rem;
  background: linear-gradient(45deg, #4a7dff, #7c4dff);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

function ErrorScreen({ message = 'Bir hata oluştu', onRetry }) {
  return (
    <ErrorContainer>
      <ErrorIcon>❌</ErrorIcon>
      <ErrorMessage>{message}</ErrorMessage>
      {onRetry && (
        <RetryButton onClick={onRetry}>
          Tekrar Dene
        </RetryButton>
      )}
    </ErrorContainer>
  );
}

export default ErrorScreen; 