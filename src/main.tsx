import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'

// Service worker registration happens inside <UpdatePrompt /> so it can drive
// the "new version available" banner. See src/pwa/registerServiceWorker.ts.

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
