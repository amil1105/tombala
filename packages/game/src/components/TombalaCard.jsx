import React from 'react';
import styled from 'styled-components';

const CardContainer = styled.div`
  background: linear-gradient(145deg, #1e2044 0%, #171934 100%);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%237c4dff' fill-opacity='0.05' fill-rule='evenodd'%3E%3Cpath d='M0 20L20 0v20H0zm20 0v20l20-20H20z'/%3E%3C/g%3E%3C/svg%3E");
    opacity: 0.1;
    z-index: 0;
    pointer-events: none;
  }
`;

const CardTitle = styled.h2`
  font-size: 1.2rem;
  color: white;
  margin: 0 0 1rem 0;
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

const CardGrid = styled.div`
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: 0.5rem;
`;

const CardRow = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 0.5rem;
`;

const CardCell = styled.div`
  background-color: ${props => props.$marked 
    ? 'rgba(124, 77, 255, 0.2)' 
    : props.$empty 
      ? 'transparent' 
      : 'rgba(255, 255, 255, 0.05)'
  };
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1;
  font-weight: ${props => props.$marked ? 'bold' : 'normal'};
  color: ${props => props.$marked ? 'var(--primary-color)' : 'var(--text-light)'};
  transition: all 0.2s ease;
  position: relative;
  box-shadow: ${props => props.$marked ? '0 0 8px rgba(124, 77, 255, 0.3)' : 'none'};
  
  ${props => !props.$empty && !props.$marked && `
    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
      transform: scale(1.05);
    }
  `}
  
  ${props => props.$marked && `
    &::after {
      content: '';
      position: absolute;
      width: 60%;
      height: 60%;
      border-radius: 50%;
      border: 2px solid var(--primary-color);
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0% {
        transform: scale(0.9);
        opacity: 0.8;
      }
      70% {
        transform: scale(1.1);
        opacity: 0.3;
      }
      100% {
        transform: scale(0.9);
        opacity: 0.8;
      }
    }
  `}
`;

function TombalaCard({ card, drawnNumbers }) {
  return (
    <CardContainer>
      <CardTitle>Tombala Kartınız</CardTitle>
      <CardGrid>
        {card.map((row, rowIndex) => (
          <CardRow key={`row-${rowIndex}`}>
            {row.map((cell, colIndex) => {
              const isMarked = cell !== null && drawnNumbers.includes(cell);
              return (
                <CardCell 
                  key={`cell-${rowIndex}-${colIndex}`}
                  $empty={cell === null}
                  $marked={isMarked}
                >
                  {cell}
                </CardCell>
              );
            })}
          </CardRow>
        ))}
      </CardGrid>
    </CardContainer>
  );
}

export default TombalaCard;