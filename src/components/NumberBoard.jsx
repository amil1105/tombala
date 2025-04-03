import React from 'react';
import styled from 'styled-components';
import { Box, Typography } from '@mui/material';

const BoardContainer = styled(Box)`
  background: linear-gradient(145deg, #1a1c37 0%, #141530 100%);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%236c5dd3' fill-opacity='0.05' fill-rule='evenodd'%3E%3Cpath d='M0 20L20 0v20H0zm20 0v20l20-20H20z'/%3E%3C/g%3E%3C/svg%3E");
    opacity: 0.2;
    z-index: 0;
  }
`;

const BoardTitle = styled(Typography)`
  font-size: 1.2rem;
  margin: 0;
  text-align: center;
  position: relative;
  z-index: 1;
  
  background: linear-gradient(90deg, #8a7bff, #6c5dd3);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const CurrentNumberDisplay = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
  position: relative;
  z-index: 1;
`;

const CurrentNumberLabel = styled(Typography)`
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 500;
`;

const CurrentNumber = styled(Box)`
  font-size: 4rem;
  font-weight: bold;
  color: white;
  background: linear-gradient(45deg, #8a7bff, #6c5dd3);
  border-radius: 50%;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  animation: ${props => props.$current ? 'appear 0.5s ease-out' : 'none'};
  
  @keyframes appear {
    0% {
      transform: scale(0.5);
      opacity: 0;
    }
    70% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  &::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% {
      transform: scale(0.95);
      opacity: 0.7;
    }
    70% {
      transform: scale(1.05);
      opacity: 0.3;
    }
    100% {
      transform: scale(0.95);
      opacity: 0.7;
    }
  }
`;

const NumbersGrid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 0.5rem;
  position: relative;
  z-index: 1;
`;

const NumberCell = styled(Box)`
  aspect-ratio: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${props => props.$drawn ? 'bold' : 'normal'};
  background: ${props => {
    if (props.$current) return 'linear-gradient(45deg, #8a7bff, #6c5dd3)';
    if (props.$drawn) return 'rgba(138, 123, 255, 0.2)';
    return 'rgba(255, 255, 255, 0.05)';
  }};
  color: ${props => {
    if (props.$current) return 'white';
    if (props.$drawn) return '#8a7bff';
    return 'var(--text-secondary)';
  }};
  transition: all 0.2s ease;
  box-shadow: ${props => props.$current ? '0 4px 8px rgba(0, 0, 0, 0.2)' : 'none'};
  transform: ${props => props.$current ? 'scale(1.1)' : 'scale(1)'};
  animation: ${props => props.$current ? 'pop 0.5s ease' : 'none'};
  font-size: 0.875rem;
  
  @keyframes pop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1.1);
    }
  }
`;

const DrawnNumbersInfo = styled(Box)`
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
`;

function NumberBoard({ drawnNumbers = [], currentNumber, onRefresh }) {
  // 1-90 arası tüm sayıları oluştur
  const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  
  return (
    <BoardContainer>
      <BoardTitle variant="h6">Çekilen Sayılar</BoardTitle>
      
      {currentNumber && (
        <CurrentNumberDisplay>
          <CurrentNumberLabel variant="body2">Son Çekilen Sayı</CurrentNumberLabel>
          <CurrentNumber $current={true}>{currentNumber}</CurrentNumber>
        </CurrentNumberDisplay>
      )}
      
      <NumbersGrid>
        {allNumbers.map(num => (
          <NumberCell 
            key={num}
            $drawn={drawnNumbers.includes(num)}
            $current={num === currentNumber}
          >
            {num}
          </NumberCell>
        ))}
      </NumbersGrid>
      
      <DrawnNumbersInfo>
        <Typography variant="body2">Toplam: {drawnNumbers.length}/90</Typography>
        <Typography variant="body2">Kalan: {90 - drawnNumbers.length}</Typography>
      </DrawnNumbersInfo>
    </BoardContainer>
  );
}

export default NumberBoard;