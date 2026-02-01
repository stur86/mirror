import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface EditorSettings {
  lockPositionPercent: number;  // 0-100, default 50 (center)
  scrollSyncEnabled: boolean;   // true = locked, false = independent
}

interface EditorSettingsContextType extends EditorSettings {
  setLockPositionPercent: (percent: number) => void;
  toggleScrollSync: () => void;
  setScrollSyncEnabled: (enabled: boolean) => void;
}

const EditorSettingsContext = createContext<EditorSettingsContextType | null>(null);

interface EditorSettingsProviderProps {
  children: ReactNode;
  defaultLockPosition?: number;
  defaultScrollSync?: boolean;
}

export function EditorSettingsProvider({
  children,
  defaultLockPosition = 50,
  defaultScrollSync = true,
}: EditorSettingsProviderProps) {
  const [lockPositionPercent, setLockPositionPercent] = useState(defaultLockPosition);
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(defaultScrollSync);

  const toggleScrollSync = useCallback(() => {
    setScrollSyncEnabled(prev => !prev);
  }, []);

  return (
    <EditorSettingsContext.Provider
      value={{
        lockPositionPercent,
        scrollSyncEnabled,
        setLockPositionPercent,
        toggleScrollSync,
        setScrollSyncEnabled,
      }}
    >
      {children}
    </EditorSettingsContext.Provider>
  );
}

export function useEditorSettings() {
  const context = useContext(EditorSettingsContext);
  if (!context) {
    throw new Error('useEditorSettings must be used within an EditorSettingsProvider');
  }
  return context;
}
