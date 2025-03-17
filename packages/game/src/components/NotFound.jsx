import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem;
  max-width: 600px;
  margin: 0 auto;
`;

const NotFoundTitle = styled.h1`
  font-size: 3rem;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const NotFoundText = styled.p`
  font-size: 1.2rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: bold;
  background: var(--primary-color);
  color: var(--text-light);
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
`;

function NotFound() {
  const navigate = useNavigate();
  
  return (
    <NotFoundContainer>
      <NotFoundTitle>404</NotFoundTitle>
      <NotFoundText>
        Aradığınız sayfa bulunamadı. Sayfa kaldırılmış veya URL değişmiş olabilir.
      </NotFoundText>
      <Button onClick={() => navigate('/')}>
        Ana Sayfaya Dön
      </Button>
    </NotFoundContainer>
  );
}

export default NotFound; 