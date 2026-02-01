import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './i18n';
import './components/styles';
import './style.css';

// This avoids some issues with popovers in development mode
const Root = (
  import.meta.env.DEV
    ? <App />
    : <StrictMode><App /></StrictMode>
);

createRoot(document.getElementById('app')!).render(
  Root
);
