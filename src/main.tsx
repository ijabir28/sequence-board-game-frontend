import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { installCopyGuard } from './copyGuard';
import { captureInstallPrompt } from './pwa/install';
import { registerServiceWorker } from './pwa/serviceWorker';
import './styles/global.css';

installCopyGuard();
captureInstallPrompt();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
