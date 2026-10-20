import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { FinancialProvider } from './context/FinancialContext';
import { HabitsProvider } from './context/HabitsContext';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FinancialProvider>
      <HabitsProvider>
        <App />
      </HabitsProvider>
    </FinancialProvider>
  </React.StrictMode>
);
