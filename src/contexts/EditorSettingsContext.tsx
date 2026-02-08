import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface LockingPoint {
  id: string;
  sourceY: number;       // px from top of source content
  translationY: number;  // px from top of translation content
}

const DEFAULT_LOCKING_POINT: LockingPoint = {
  id: 'origin',
  sourceY: 0,
  translationY: 0,
};

interface EditorSettings {
  scrollSyncEnabled: boolean;
  lockingPoints: LockingPoint[];
}

interface EditorSettingsContextType extends EditorSettings {
  toggleScrollSync: () => void;
  setScrollSyncEnabled: (enabled: boolean) => void;
  addLockingPoint: (sourceY: number, translationY: number) => void;
  removeLockingPoint: (id: string) => void;
  setLockingPoints: (points: LockingPoint[]) => void;
}

const EditorSettingsContext = createContext<EditorSettingsContextType | null>(null);

interface EditorSettingsProviderProps {
  children: ReactNode;
  defaultScrollSync?: boolean;
}

export function EditorSettingsProvider({
  children,
  defaultScrollSync = true,
}: EditorSettingsProviderProps) {
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(defaultScrollSync);
  const [lockingPoints, setLockingPoints] = useState<LockingPoint[]>([DEFAULT_LOCKING_POINT]);

  const toggleScrollSync = useCallback(() => {
    setScrollSyncEnabled(prev => !prev);
  }, []);

  const addLockingPoint = useCallback((sourceY: number, translationY: number) => {
    const newPoint: LockingPoint = {
      id: crypto.randomUUID(),
      sourceY,
      translationY,
    };
    setLockingPoints(pts => [...pts, newPoint].sort((a, b) => a.sourceY - b.sourceY));
  }, []);

  const removeLockingPoint = useCallback((id: string) => {
    setLockingPoints(pts => {
      const filtered = pts.filter(p => p.id !== id);
      // Always keep at least one lock point
      return filtered.length > 0 ? filtered : [DEFAULT_LOCKING_POINT];
    });
  }, []);

  const setLockingPointsExplicit = useCallback((points: LockingPoint[]) => {
    setLockingPoints(points.length > 0 ? points : [DEFAULT_LOCKING_POINT]);
  }, []);

  return (
    <EditorSettingsContext.Provider
      value={{
        scrollSyncEnabled,
        lockingPoints,
        toggleScrollSync,
        setScrollSyncEnabled,
        addLockingPoint,
        removeLockingPoint,
        setLockingPoints: setLockingPointsExplicit,
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
