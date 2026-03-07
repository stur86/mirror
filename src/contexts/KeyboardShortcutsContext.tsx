import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

interface KeyboardShortcutsContextValue {
  /** Register a handler for a chord. Returns an unregister function.
   *  chord format: lowercase key + modifiers, e.g. "ctrl+s", "meta+shift+s" */
  registerShortcut(chord: string, callback: () => void): () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

/** Returns true if running on macOS. */
export function isMac(): boolean {
  // navigator.userAgentData is the modern API; fall back to userAgent string
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.userAgent;
  return /mac/i.test(platform);
}

/** Returns the platform-appropriate chord for a key combination.
 *  key should be a single lowercase character, e.g. 's', 'o', 'n'. */
export function shortcutChord(key: string, shift = false): string {
  const mod = isMac() ? 'meta' : 'ctrl';
  return shift ? `${mod}+shift+${key}` : `${mod}+${key}`;
}

/** Returns a display string for the chord, e.g. "⌘S" or "Ctrl+S". */
export function formatShortcut(key: string, shift = false): string {
  const upper = key.toUpperCase();
  if (isMac()) {
    return shift ? `⇧⌘${upper}` : `⌘${upper}`;
  }
  return shift ? `Ctrl+Shift+${upper}` : `Ctrl+${upper}`;
}

/** Builds a chord string from a KeyboardEvent. */
function eventToChord(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.metaKey) parts.push('meta');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  // Map from chord → ref cell holding the latest callback
  const registryRef = useRef(new Map<string, { current: () => void }>());

  const registerShortcut = useCallback((chord: string, callback: () => void) => {
    const registry = registryRef.current;
    let cell = registry.get(chord);
    if (!cell) {
      cell = { current: callback };
      registry.set(chord, cell);
    } else {
      cell.current = callback;
    }
    return () => {
      registry.delete(chord);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const chord = eventToChord(e);
      const cell = registryRef.current.get(chord);
      if (cell) {
        e.preventDefault();
        cell.current();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <KeyboardShortcutsContext.Provider value={{ registerShortcut }}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  return ctx;
}

/** Convenience hook: registers a single shortcut and cleans up on unmount.
 *  Re-registers whenever chord or callback identity changes.
 *  Pass a stable callback (e.g. wrapped in useCallback) to avoid unnecessary re-registration. */
export function useShortcut(chord: string, callback: () => void): void {
  const { registerShortcut } = useKeyboardShortcuts();
  useEffect(() => {
    return registerShortcut(chord, callback);
  }, [registerShortcut, chord, callback]);
}
