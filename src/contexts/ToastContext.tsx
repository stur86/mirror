import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { OverlayToaster, Intent } from '../components';
import type { ToastProps } from '../components';

interface ToastContextValue {
  showToast: (message: string, intent?: Intent) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasterRef = useRef<OverlayToaster>(null);

  const showToast = useCallback((message: string, intent: Intent = Intent.NONE) => {
    toasterRef.current?.show({ message, intent, timeout: 2500 } satisfies ToastProps);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <OverlayToaster ref={toasterRef} position="bottom" />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
