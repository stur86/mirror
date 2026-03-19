import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './electrobun/view';
import './i18n';
import './components/styles';
import './style.css';
import { KeyboardShortcutsProvider } from './contexts/KeyboardShortcutsContext';

// This avoids some issues with popovers in development mode
const Root = (
  import.meta.env.DEV
    ? <KeyboardShortcutsProvider><App /></KeyboardShortcutsProvider>
    : <StrictMode><KeyboardShortcutsProvider><App /></KeyboardShortcutsProvider></StrictMode>
);

createRoot(document.getElementById('app')!).render(
  Root
);
