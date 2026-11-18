import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AnoLetivoProvider } from './context/AnoLetivoContext';
import { SchoolProvider } from './context/SchoolContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnoLetivoProvider>
      <SchoolProvider>
        <App />
      </SchoolProvider>
    </AnoLetivoProvider>
  </StrictMode>,
);
