// Punto de entrada de la PWA: solo Order Approval, sin router ni barra
// lateral. Comparte los mismos módulos que la suite completa — no es una
// copia del código, es el mismo componente montado en un cascarón ligero.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PermissionsProvider } from './context/PermissionsContext.jsx';
import PwaShell from './pwa/PwaShell.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PermissionsProvider>
      <PwaShell />
    </PermissionsProvider>
  </React.StrictMode>
);

// El service worker solo se registra en producción: en desarrollo estorba
// porque sirve versiones cacheadas mientras se edita el código.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Sin service worker la app funciona igual, solo pierde el arranque
      // sin red. No vale la pena molestar al usuario con un error.
    });
  });
}
