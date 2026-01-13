import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { TerminalProvider } from './contexts/TerminalContext';
import { LanguageProvider } from './contexts/LanguageContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <LanguageProvider>
    <TerminalProvider>
      <App />
    </TerminalProvider>
  </LanguageProvider>
);
