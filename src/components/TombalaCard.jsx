import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Box, Typography } from '@mui/material';
import { FaCheck } from 'react-icons/fa';

// Kart konteyneri
const CardContainer = styled(Box)`
  background: linear-gradient(145deg, #1a1c37 0%, #141530 100%);
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  width: 100%;
  
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

// Kart başlığı
const CardTitle = styled(Typography)`
  font-size: 1.2rem;
  text-align: center;
  position: relative;
  z-index: 1;
  color: #8a7bff;
  font-weight: bold;
  margin-bottom: 0.5rem;
`;

// Kart tablosu
const CardTable = styled(Box)`
  background-color: #252749;
  border: 2px solid #5a4cbe;
  border-radius: 8px;
  padding: 0.75rem;
  margin: 0 auto;
  width: 100%;
  max-width: 400px;
`;

// Tablo hücresi
const TableCell = styled(Box)`
  border: 1px solid #6c5dd3;
  padding: 0.5rem;
  text-align: center;
  height: 3rem;
  position: relative;
  background-color: ${props => props.$drawn ? 'rgba(58, 60, 110, 0.8)' : '#1a1c37'};
  color: ${props => props.$drawn ? '#b8a9ff' : '#a8a8b3'};
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${props => props.$drawn ? 'rgba(58, 60, 110, 1)' : 'rgba(26, 28, 55, 0.8)'};
  }
`;

// İşaretleme ikonu
const NumberCheckmark = styled(Box)`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .check-icon {
    width: 1.5rem;
    height: 1.5rem;
    background-color: #6c5dd3;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
    color: white;
    font-size: 0.75rem;
  }
`;

// Bilgi konteyneri
const InfoContainer = styled(Box)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
  position: relative;
  z-index: 1;
`;

// Tombala kartı bileşeni
function TombalaCard({ card, drawnNumbers = [], currentNumber, onCardUpdate }) {
  const [markedCells, setMarkedCells] = useState([]);
  const [matchedNumbers, setMatchedNumbers] = useState([]);
  const [hoverEffect, setHoverEffect] = useState(false);
  const prevDrawnNumbersRef = useRef([]);
  
  // Çizili sayı sayısını sayma
  const markedCount = markedCells.length;
  
  // Kart formatını kontrol et ve düzenle
  const cardMatrix = Array.isArray(card) ? card : (card?.numbers || []);
  
  // Sırayla satırların tamamlanma durumu
  const firstRowCompleted = Array.isArray(cardMatrix) && Array.isArray(cardMatrix[0])
    ? cardMatrix[0].filter(num => num !== null && drawnNumbers.includes(num)).length === 5
    : false;
    
  const secondRowCompleted = Array.isArray(cardMatrix) && Array.isArray(cardMatrix[1])
    ? cardMatrix[1].filter(num => num !== null && drawnNumbers.includes(num)).length === 5
    : false;
    
  const thirdRowCompleted = Array.isArray(cardMatrix) && Array.isArray(cardMatrix[2])
    ? cardMatrix[2].filter(num => num !== null && drawnNumbers.includes(num)).length === 5
    : false;
  
  // Tüm sayılar çekildi mi?
  const allNumbersDrawn = Array.isArray(cardMatrix)
    ? cardMatrix.flat().filter(num => num !== null).every(num => drawnNumbers.includes(num))
    : false;
  
  // Eşleşen sayıları hesapla
  useEffect(() => {
    if (!Array.isArray(cardMatrix) || !Array.isArray(drawnNumbers)) return;
    
    // Tüm sayıları düzleştir ve null olmayanları filtrele
    const allCardNumbers = cardMatrix.flat().filter(num => num !== null);
    
    // Çekilen sayılarla kesişen sayıları bul
    const matched = allCardNumbers.filter(num => drawnNumbers.includes(num));
    setMatchedNumbers(matched);
    
    // Yeni çekilen sayıları kontrol et
    if (drawnNumbers.length > prevDrawnNumbersRef.current.length) {
      const newDrawnNumbers = drawnNumbers.filter(num => !prevDrawnNumbersRef.current.includes(num));
      
      // Yeni çekilen sayı kartta var mı kontrol et
      newDrawnNumbers.forEach(newNum => {
        if (allCardNumbers.includes(newNum)) {
          // Sayı kartımızda var, görsel efekt göster
          setHoverEffect(true);
          setTimeout(() => setHoverEffect(false), 1000);
        }
      });
    }
    
    // Referansı güncelle
    prevDrawnNumbersRef.current = [...drawnNumbers];
  }, [cardMatrix, drawnNumbers]);

  // Sayıya tıklama işleyicisi
  const handleCellClick = (number, rowIndex, colIndex) => {
    if (!number || !drawnNumbers.includes(number)) return;
    
    const cellKey = `${rowIndex}-${colIndex}`;
    const isAlreadyMarked = markedCells.includes(cellKey);
    
    if (isAlreadyMarked) {
      // İşaretlemeyi kaldır
      const updatedMarked = markedCells.filter(cell => cell !== cellKey);
      setMarkedCells(updatedMarked);
      
      // Kart güncelleme callback'ini çağır
      if (typeof onCardUpdate === 'function') {
        onCardUpdate({
          marked: updatedMarked
        });
      }
    } else {
      // İşaretle
      const updatedMarked = [...markedCells, cellKey];
      setMarkedCells(updatedMarked);
      
      // Kart güncelleme callback'ini çağır
      if (typeof onCardUpdate === 'function') {
        onCardUpdate({
          marked: updatedMarked
        });
      }
    }
  };

  // Eğer kart matris formatında değilse veya boşsa, yükleme durumunu göster
  if (!cardMatrix || !Array.isArray(cardMatrix) || cardMatrix.length === 0) {
    return (
      <CardContainer>
        <CardTitle variant="subtitle1">
          Tombala Kartım
        </CardTitle>
        <Box display="flex" justifyContent="center" alignItems="center" p={4} border="1px dashed rgba(255,255,255,0.3)" borderRadius={2}>
          <Typography color="text.secondary">Kart verisi yüklenemedi</Typography>
        </Box>
      </CardContainer>
    );
  }
  
  return (
    <CardContainer 
      sx={{ 
        borderColor: hoverEffect ? '#8a7bff' : 'transparent',
        borderWidth: 2,
        borderStyle: 'solid'
      }}
    >
      <CardTitle variant="subtitle1">
        Tombala Kartım
      </CardTitle>
      
      <CardTable>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {cardMatrix.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Array.isArray(row) && row.map((number, colIndex) => {
                  const cellKey = `${rowIndex}-${colIndex}`;
                  const isDrawn = number !== null && drawnNumbers.includes(number);
                  const isMarked = number !== null && markedCells.includes(cellKey);
                  const isCurrentNumber = number === currentNumber;
                  
                  return (
                    <TableCell
                      key={cellKey}
                      component="td"
                      $drawn={isDrawn}
                      $marked={isMarked}
                      $active={isCurrentNumber}
                      onClick={() => handleCellClick(number, rowIndex, colIndex)}
                      sx={{ cursor: (number && isDrawn) ? 'pointer' : 'default' }}
                    >
                      <Typography 
                        sx={{ 
                          fontSize: '1.125rem', 
                          fontWeight: isDrawn ? 'bold' : 'normal',
                          color: isCurrentNumber ? '#fff' : (isDrawn ? '#b8a9ff' : '#a8a8b3')
                        }}
                      >
                        {number}
                      </Typography>
                      
                      {isMarked && (
                        <NumberCheckmark>
                          <Box className="check-icon">
                            <FaCheck />
                          </Box>
                        </NumberCheckmark>
                      )}
                    </TableCell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardTable>
      
      <InfoContainer>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          İşaretli: {markedCount}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          Eşleşen: {matchedNumbers.length}
        </Typography>
      </InfoContainer>
      
      {(firstRowCompleted || secondRowCompleted || thirdRowCompleted) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {firstRowCompleted && (
            <Typography 
              variant="body2"
              sx={{ 
                bgcolor: 'rgba(138, 123, 255, 0.2)', 
                color: '#8a7bff', 
                px: 1.5, 
                py: 0.5, 
                borderRadius: 1,
                fontWeight: 'bold'
              }}
            >
              1. Çinko
            </Typography>
          )}
          
          {secondRowCompleted && (
            <Typography 
              variant="body2"
              sx={{ 
                bgcolor: 'rgba(138, 123, 255, 0.2)', 
                color: '#8a7bff', 
                px: 1.5, 
                py: 0.5, 
                borderRadius: 1,
                fontWeight: 'bold'
              }}
            >
              2. Çinko
            </Typography>
          )}
          
          {thirdRowCompleted && (
            <Typography 
              variant="body2"
              sx={{ 
                bgcolor: 'rgba(138, 123, 255, 0.2)', 
                color: '#8a7bff', 
                px: 1.5, 
                py: 0.5, 
                borderRadius: 1,
                fontWeight: 'bold'
              }}
            >
              3. Çinko
            </Typography>
          )}
          
          {allNumbersDrawn && (
            <Typography 
              variant="body2"
              sx={{ 
                bgcolor: 'rgba(90, 76, 190, 0.3)', 
                color: '#b8a9ff', 
                px: 1.5, 
                py: 0.5, 
                borderRadius: 1,
                fontWeight: 'bold'
              }}
            >
              TOMBALA!
            </Typography>
          )}
        </Box>
      )}
    </CardContainer>
  );
}

export default TombalaCard;