import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          textAlign: 'center',
          py: 4
        }}
      >
        <Typography variant="h1" color="primary" sx={{ fontSize: { xs: '6rem', md: '10rem' }, fontWeight: 700 }}>
          404
        </Typography>
        
        <Typography variant="h5" color="text.secondary" sx={{ mt: 2, mb: 4 }}>
          Aradığınız sayfa bulunamadı veya kaldırıldı.
        </Typography>
        
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          onClick={handleGoHome}
          sx={{ 
            py: 1.5, 
            px: 4, 
            borderRadius: 8,
            fontSize: '1.1rem'
          }}
        >
          Ana Sayfaya Dön
        </Button>
      </Box>
    </Container>
  );
};

export default NotFound; 