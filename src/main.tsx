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

// A screen's chunk can fail to load when a deploy replaced the files under an open page (without the service worker,
// say on the first visit). Reloading fetches the new build; the flag stops a loop if the network is simply down.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('chunk-reload')) return;
    sessionStorage.setItem('chunk-reload', '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});
window.addEventListener('load', () => {
  try {
    sessionStorage.removeItem('chunk-reload');
  } catch {
    // Storage blocked: nothing to clear.
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
