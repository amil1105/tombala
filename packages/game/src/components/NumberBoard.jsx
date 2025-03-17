import React from 'react';
import styled from 'styled-components';

const BoardContainer = styled.div`
  background: linear-gradient(145deg, #1e2044 0%, #171934 100%);
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
    transform: translateY(-5px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%237c4dff' fill-opacity='0.05' fill-rule='evenodd'%3E%3Cpath d='M0 20L20 0v20H0zm20 0v20l20-20H20z'/%3E%3C/g%3E%3C/svg%3E");
    opacity: 0.1;
    z-index: 0;
  }
`;

const BoardTitle = styled.h2`
  font-size: 1.2rem;
  margin: 0;
  text-align: center;
  position: relative;
  z-index: 1;
  
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const CurrentNumberDisplay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
  position: relative;
  z-index: 1;
`;

const CurrentNumberLabel = styled.div`
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 500;
`;

const CurrentNumber = styled.div`
  font-size: 4rem;
  font-weight: bold;
  color: white;
  background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
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

const NumbersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 0.5rem;
  position: relative;
  z-index: 1;
`;

const NumberCell = styled.div`
  background-color: ${props => props.$drawn 
    ? (props.$current 
      ? 'linear-gradient(45deg, var(--primary-color), var(--secondary-color))' 
      : 'rgba(124, 77, 255, 0.2)') 
    : 'rgba(255, 255, 255, 0.05)'
  };
  background: ${props => props.$current 
    ? 'linear-gradient(45deg, var(--primary-color), var(--secondary-color))' 
    : (props.$drawn 
      ? 'rgba(124, 77, 255, 0.2)' 
      : 'rgba(255, 255, 255, 0.05)')
  };
  border-radius: 8px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${props => props.$drawn ? 'bold' : 'normal'};
  color: ${props => props.$current ? 'white' : (props.$drawn ? 'var(--primary-color)' : 'var(--text-light)')};
  transition: all 0.2s ease;
  box-shadow: ${props => props.$current ? '0 4px 8px rgba(0, 0, 0, 0.2)' : 'none'};
  transform: ${props => props.$current ? 'scale(1.1)' : 'scale(1)'};
  animation: ${props => props.$current ? 'pop 0.5s ease' : 'none'};
  
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

const DrawnNumbersInfo = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
`;

function NumberBoard({ drawnNumbers, currentNumber }) {
  // 1-90 arası tüm sayıları oluştur
  const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  
  return (
    <BoardContainer>
      <BoardTitle>Çekilen Sayılar</BoardTitle>
      
      {currentNumber && (
        <CurrentNumberDisplay>
          <CurrentNumberLabel>Son Çekilen Sayı</CurrentNumberLabel>
          <CurrentNumber $current={true}>{currentNumber}</CurrentNumber>
        </CurrentNumberDisplay>
      )}
      
      <NumbersGrid>
        {allNumbers.map(number => (
          <NumberCell 
            key={number}
            $drawn={drawnNumbers.includes(number)}
            $current={number === currentNumber}
          >
            {number}
          </NumberCell>
        ))}
      </NumbersGrid>
      
      <DrawnNumbersInfo>
        <span>Toplam: {drawnNumbers.length}/90</span>
        <span>Kalan: {90 - drawnNumbers.length}</span>
      </DrawnNumbersInfo>
    </BoardContainer>
  );
}

export default NumberBoard;