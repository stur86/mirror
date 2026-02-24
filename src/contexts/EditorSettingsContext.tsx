import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { LOCK_POINT_COLOR_COUNT } from '../constants/lockPointColors';

export interface LockingPoint {
  id: string;
  sourceY: number;       // px from top of source content
  translationY: number;  // px from top of translation content
  colorIndex: number;    // 0–7, assigned at creation from cycling counter
}

const DEFAULT_LOCKING_POINT: LockingPoint = {
  id: 'origin',
  sourceY: 0,
  translationY: 0,
  colorIndex: 0,
};

interface EditorSettings {
  scrollSyncEnabled: boolean;
  lockingPoints: LockingPoint[];
  activeLockIndex: number;
  pendingLockSide: 'source' | 'translation' | null;
  pendingLockY: number | null;
}

interface EditorSettingsContextType extends EditorSettings {
  toggleScrollSync: () => void;
  setScrollSyncEnabled: (enabled: boolean) => void;
  addLockingPoint: (sourceY: number, translationY: number) => void;
  removeLockingPoint: (id: string) => void;
  setLockingPoints: (points: LockingPoint[]) => void;
  setActiveLockIndex: (index: number) => void;
  beginLockCreation: (side: 'source' | 'translation', y: number) => void;
  completeLockCreation: (y: number) => void;
  abortLockCreation: () => void;
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
  const [activeLockIndex, setActiveLockIndexState] = useState(0);
  const [pendingLockSide, setPendingLockSide] = useState<'source' | 'translation' | null>(null);
  const [pendingLockY, setPendingLockY] = useState<number | null>(null);

  // Cycling color counter persists across adds/removes
  const colorCounterRef = useRef(1); // 0 is used by the default origin point

  const toggleScrollSync = useCallback(() => {
    setScrollSyncEnabled(prev => !prev);
  }, []);

  const setActiveLockIndex = useCallback((index: number) => {
    setLockingPoints(pts => {
      const clamped = Math.max(0, Math.min(index, pts.length - 1));
      setActiveLockIndexState(clamped);
      return pts;
    });
  }, []);

  const addLockingPoint = useCallback((sourceY: number, translationY: number) => {
    const colorIndex = colorCounterRef.current % LOCK_POINT_COLOR_COUNT;
    colorCounterRef.current++;

    const newPoint: LockingPoint = {
      id: crypto.randomUUID(),
      sourceY,
      translationY,
      colorIndex,
    };

    setLockingPoints(pts => {
      const newPts = [...pts, newPoint].sort((a, b) => a.sourceY - b.sourceY);
      // Adjust activeLockIndex to keep pointing at the same logical point
      setActiveLockIndexState(prev => {
        const insertedIdx = newPts.indexOf(newPoint);
        if (insertedIdx <= prev) return prev + 1;
        return prev;
      });
      return newPts;
    });
  }, []);

  const removeLockingPoint = useCallback((id: string) => {
    setLockingPoints(pts => {
      const removedIdx = pts.findIndex(p => p.id === id);
      const filtered = pts.filter(p => p.id !== id);
      const result = filtered.length > 0 ? filtered : [DEFAULT_LOCKING_POINT];

      setActiveLockIndexState(prev => {
        if (filtered.length === 0) return 0;
        if (removedIdx < prev) return prev - 1;
        if (removedIdx === prev) return Math.min(prev, result.length - 1);
        return Math.min(prev, result.length - 1);
      });

      return result;
    });
  }, []);

  const setLockingPointsExplicit = useCallback((points: LockingPoint[]) => {
    // Backfill colorIndex for points loaded from old data
    const withColors = points.map((p, i) => (
      p.colorIndex == null ? { ...p, colorIndex: i % LOCK_POINT_COLOR_COUNT } : p
    ));
    const result = withColors.length > 0 ? withColors : [DEFAULT_LOCKING_POINT];
    setLockingPoints(result);
    setActiveLockIndexState(prev => Math.min(prev, result.length - 1));
  }, []);

  const beginLockCreation = useCallback((side: 'source' | 'translation', y: number) => {
    setPendingLockSide(side);
    setPendingLockY(y);
  }, []);

  const completeLockCreation = useCallback((y: number) => {
    // Read pending state — we need the current values
    setPendingLockSide(prevSide => {
      setPendingLockY(prevY => {
        if (prevSide && prevY !== null) {
          const sourceY = prevSide === 'source' ? prevY : y;
          const translationY = prevSide === 'translation' ? prevY : y;
          // Use setTimeout to avoid setState-in-setState issues
          setTimeout(() => addLockingPoint(sourceY, translationY), 0);
        }
        return null;
      });
      return null;
    });
  }, [addLockingPoint]);

  const abortLockCreation = useCallback(() => {
    setPendingLockSide(null);
    setPendingLockY(null);
  }, []);

  return (
    <EditorSettingsContext.Provider
      value={{
        scrollSyncEnabled,
        lockingPoints,
        activeLockIndex,
        pendingLockSide,
        pendingLockY,
        toggleScrollSync,
        setScrollSyncEnabled,
        addLockingPoint,
        removeLockingPoint,
        setLockingPoints: setLockingPointsExplicit,
        setActiveLockIndex,
        beginLockCreation,
        completeLockCreation,
        abortLockCreation,
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
