import React, { createContext, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

export const ThemeContext = createContext();

export const CustomThemeProvider = ({ children }) => {
  const theme = useMemo(() => createTheme({
    typography: {
      fontFamily: '"Oxanium", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
      h1: {
        fontFamily: '"Oxanium", sans-serif',
        fontWeight: 700,
      },
      h2: {
        fontFamily: '"Oxanium", sans-serif',
        fontWeight: 600,
      },
      h3: {
        fontFamily: '"Oxanium", sans-serif',
        fontWeight: 600,
      },
      h4: {
        fontFamily: '"Oxanium", sans-serif',
        fontWeight: 500,
      },
      h5: {
        fontFamily: '"Oxanium", sans-serif',
        fontWeight: 500,
      },
      h6: {
        fontFamily: '"Oxanium", sans-serif',
        fontWeight: 500,
      },
      button: {
        fontFamily: '"Oxanium", sans-serif',
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          /* Font yüklemeleri için Google Fonts CSS'ini tercih edelim */
          body {
            font-family: 'Oxanium', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          }
        `,
      },
    },
    palette: {
      primary: {
        main: '#8a7bff',
        light: '#a29bff',
        dark: '#6c5dd3',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#6c5dd3',
        light: '#8a7bff',
        dark: '#5a4cbe',
        contrastText: '#ffffff',
      },
      background: {
        default: '#0f1123',
        paper: '#1a1c37',
      },
      text: {
        primary: '#ffffff',
        secondary: '#a8a8b3',
      },
    },
  }), []);

  return (
    <ThemeContext.Provider value={theme}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}; 