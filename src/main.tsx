import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './i18n';
import './components/styles';
import './style.css';
import { KeyboardShortcutsProvider } from './contexts/KeyboardShortcutsContext';
import { ToastProvider } from './contexts/ToastContext';

// This avoids some issues with popovers in development mode
const Root = (
  import.meta.env.DEV
    ? <ToastProvider><KeyboardShortcutsProvider><App /></KeyboardShortcutsProvider></ToastProvider>
    : <StrictMode><ToastProvider><KeyboardShortcutsProvider><App /></KeyboardShortcutsProvider></ToastProvider></StrictMode>
);

createRoot(document.getElementById('app')!).render(
  Root
);
