# Testing, Keyboard Shortcuts & Save/Save As Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Bun unit test suite for pure utilities, a pub/sub keyboard shortcut system, and proper Save Project / Save Project As... file handling via the File System Access API.

**Architecture:** Tests live colocated with source as `*.test.ts`; pure logic is extracted from hooks/context into standalone helpers so it's testable without a DOM. Shortcuts use a React context with a ref-based registry so any component can own a chord without stale-closure issues. Saving uses `showSaveFilePicker` / `showOpenFilePicker` with a retained `FileSystemFileHandle` for overwrite-in-place on Save.

**Tech Stack:** Bun test runner, React context, File System Access API (`showSaveFilePicker`, `showOpenFilePicker`), BlueprintJS `MenuItem` `labelElement` prop.

---

### Task 1: Wire up `bun test` and write the detectLanguage tests

**Files:**
- Modify: `package.json`
- Create: `src/utils/detectLanguage.test.ts`

**Step 1: Add the test script**

In `package.json`, add to `"scripts"`:
```json
"test": "bun test"
```

**Step 2: Write the failing tests**

Create `src/utils/detectLanguage.test.ts`:
```ts
import { describe, it, expect } from 'bun:test';
import { detectLanguage } from './detectLanguage';

describe('detectLanguage', () => {
  it('detects English from a long English passage', () => {
    const text = 'The quick brown fox jumps over the lazy dog. ' +
      'This is a fairly long English sentence to give franc enough signal ' +
      'to detect the language correctly without any ambiguity.';
    expect(detectLanguage(text)).toBe('en');
  });

  it('detects Italian from a long Italian passage', () => {
    const text = 'Il veloce volpe marrone salta sopra il cane pigro. ' +
      'Questa è una frase abbastanza lunga in italiano per dare a franc ' +
      'abbastanza segnale per rilevare correttamente la lingua senza ambiguità.';
    expect(detectLanguage(text)).toBe('it');
  });

  it('returns null for empty string', () => {
    expect(detectLanguage('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(detectLanguage('   \n\t  ')).toBeNull();
  });

  it('returns null for very short text that franc cannot classify', () => {
    // franc returns 'und' for text too short to classify reliably
    expect(detectLanguage('hi')).toBeNull();
  });
});
```

**Step 3: Run to verify they fail** (they should pass since `detectLanguage` already exists — verify all 5 pass)

```bash
cd /home/gan_hope326/Projects/mirror && bun test src/utils/detectLanguage.test.ts
```

Expected: all 5 pass. If the "hi" test passes unexpectedly (franc guesses), increase assertion to expect null or adjust input length.

**Step 4: Commit**

```bash
git add package.json src/utils/detectLanguage.test.ts
git commit -m "test: add bun test script and detectLanguage tests"
```

---

### Task 2: Extract `findActiveLock` + scroll formula, write tests

The `findActiveLock` function and the scroll target formula are currently private to `useScrollSync.ts`. We export `findActiveLock` and add a tiny pure `computeTargetScrollTop` so both are unit-testable.

**Files:**
- Modify: `src/hooks/useScrollSync.ts` (export two functions)
- Create: `src/hooks/useScrollSync.test.ts`

**Step 1: Export the pure functions**

In `src/hooks/useScrollSync.ts`, change `function findActiveLock(` to `export function findActiveLock(` (line 23).

Then add this export just below `findActiveLock` (after line 63):
```ts
/** Pure formula: given the active lock and the current scrollTop on the from-side,
 *  compute what scrollTop the to-side should be set to. */
export function computeTargetScrollTop(
  fromY: number,
  toY: number,
  scrollTop: number,
): number {
  return toY - (fromY - scrollTop);
}
```

**Step 2: Write the tests**

Create `src/hooks/useScrollSync.test.ts`:
```ts
import { describe, it, expect } from 'bun:test';
import { findActiveLock, computeTargetScrollTop } from './useScrollSync';
import type { LockingPoint } from '../contexts/EditorSettingsContext';

function lp(id: string, sourceY: number, translationY: number): LockingPoint {
  return { id, sourceY, translationY, colorIndex: 0 };
}

describe('findActiveLock', () => {
  const points = [lp('a', 0, 0), lp('b', 500, 600), lp('c', 1000, 1200)];

  it('returns null for empty array', () => {
    expect(findActiveLock([], 'sourceY', 0, 800)).toBeNull();
  });

  it('returns topmost visible lock when multiple are in viewport', () => {
    // viewport 400-1200 (scrollTop=400, viewportH=800) — 'b' (500) and 'c' (1000) visible
    const result = findActiveLock(points, 'sourceY', 400, 800);
    expect(result?.lp.id).toBe('b'); // b has smaller sourceY
    expect(result?.index).toBe(1);
  });

  it('returns nearest-above when all locks are above viewport', () => {
    // scrollTop=1100, viewportH=800 — only 'a' (0), 'b' (500) are above
    const result = findActiveLock(points, 'sourceY', 1100, 800);
    expect(result?.lp.id).toBe('c'); // c is nearest above (1000 < 1100)
  });

  it('falls back to first lock when list is non-empty and all below', () => {
    const result = findActiveLock(points, 'sourceY', 0, 10);
    // 'a' at sourceY=0 is within [0, 10] — visible
    expect(result?.lp.id).toBe('a');
  });

  it('works with translationY key', () => {
    const result = findActiveLock(points, 'translationY', 550, 800);
    // translationY: a=0, b=600 (in viewport 550-1350), c=1200 (also in viewport)
    expect(result?.lp.id).toBe('b'); // b.translationY=600 is smallest in viewport
  });
});

describe('computeTargetScrollTop', () => {
  it('returns toY when scrollTop equals fromY (lock is at top of viewport)', () => {
    expect(computeTargetScrollTop(500, 600, 500)).toBe(600);
  });

  it('offsets proportionally when scrolled past lock', () => {
    // scrollTop=600, fromY=500 → scrolled 100 past lock
    // toY=600 → target = 600 - (500 - 600) = 700
    expect(computeTargetScrollTop(500, 600, 600)).toBe(700);
  });

  it('handles scrollTop=0 with origin lock at 0,0', () => {
    expect(computeTargetScrollTop(0, 0, 0)).toBe(0);
  });

  it('handles negative result correctly (pane is scrolled above lock)', () => {
    // scrollTop=100, fromY=500 → target = 600 - (500-100) = 200
    expect(computeTargetScrollTop(500, 600, 100)).toBe(200);
  });
});
```

**Step 3: Run tests**

```bash
bun test src/hooks/useScrollSync.test.ts
```

Expected: all tests pass. If `findActiveLock` import fails, verify the export was added correctly.

**Step 4: Commit**

```bash
git add src/hooks/useScrollSync.ts src/hooks/useScrollSync.test.ts
git commit -m "test: export and test findActiveLock and computeTargetScrollTop"
```

---

### Task 3: Extract lock point order helper, write tests

The order-enforcement logic inside `updateLockingPoint` in `EditorSettingsContext.tsx` is pure — extract it to a testable helper.

**Files:**
- Create: `src/utils/lockPointOrder.ts`
- Create: `src/utils/lockPointOrder.test.ts`
- Modify: `src/contexts/EditorSettingsContext.tsx`

**Step 1: Create the helper**

Create `src/utils/lockPointOrder.ts`:
```ts
import type { LockingPoint } from '../contexts/EditorSettingsContext';

/**
 * Returns true if moving `id`'s `side` coordinate to `y` would
 * invert the sorted order of that side's coordinates.
 * Returns false if the move is valid (or if the point is not found).
 */
export function wouldInvertOrder(
  pts: LockingPoint[],
  id: string,
  side: 'source' | 'translation',
  y: number,
): boolean {
  const key = side === 'source' ? 'sourceY' : 'translationY';
  const sorted = [...pts].sort((a, b) => {
    const d = a[key] - b[key];
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
  const sortedIdx = sorted.findIndex(p => p.id === id);
  if (sortedIdx === -1) return false;
  const prev = sorted[sortedIdx - 1];
  const next = sorted[sortedIdx + 1];
  if (prev && y <= prev[key]) return true;
  if (next && y >= next[key]) return true;
  return false;
}
```

**Step 2: Write tests**

Create `src/utils/lockPointOrder.test.ts`:
```ts
import { describe, it, expect } from 'bun:test';
import { wouldInvertOrder } from './lockPointOrder';
import type { LockingPoint } from '../contexts/EditorSettingsContext';

function lp(id: string, sourceY: number, translationY: number): LockingPoint {
  return { id, sourceY, translationY, colorIndex: 0 };
}

describe('wouldInvertOrder', () => {
  const pts = [lp('a', 0, 0), lp('b', 500, 600), lp('c', 1000, 1200)];

  it('returns false for a valid move within bounds', () => {
    expect(wouldInvertOrder(pts, 'b', 'source', 600)).toBe(false);
  });

  it('returns true when move would cross the next point', () => {
    expect(wouldInvertOrder(pts, 'b', 'source', 1000)).toBe(true);
  });

  it('returns true when move would cross the previous point', () => {
    expect(wouldInvertOrder(pts, 'b', 'source', 0)).toBe(true);
  });

  it('returns false for the first point moving freely downward', () => {
    expect(wouldInvertOrder(pts, 'a', 'source', 400)).toBe(false);
  });

  it('returns false for the last point moving freely upward', () => {
    expect(wouldInvertOrder(pts, 'c', 'source', 600)).toBe(false);
  });

  it('works for translationY side', () => {
    expect(wouldInvertOrder(pts, 'b', 'translation', 1200)).toBe(true);
    expect(wouldInvertOrder(pts, 'b', 'translation', 800)).toBe(false);
  });

  it('returns false for unknown id', () => {
    expect(wouldInvertOrder(pts, 'z', 'source', 999)).toBe(false);
  });
});
```

**Step 3: Run tests**

```bash
bun test src/utils/lockPointOrder.test.ts
```

Expected: all pass.

**Step 4: Replace the inline logic in EditorSettingsContext**

In `src/contexts/EditorSettingsContext.tsx`:

Add import at top:
```ts
import { wouldInvertOrder } from '../utils/lockPointOrder';
```

Replace the body of `updateLockingPoint` (lines 148–176) — the `sorted`/`sortedIdx`/`prev`/`next` block — with:
```ts
  const updateLockingPoint = useCallback((id: string, side: 'source' | 'translation', y: number) => {
    setLockingPoints(pts => {
      const idx = pts.findIndex(p => p.id === id);
      if (idx === -1) return pts;
      if (wouldInvertOrder(pts, id, side, y)) return pts;
      return pts.map((p, i) =>
        i === idx
          ? { ...p, [side === 'source' ? 'sourceY' : 'translationY']: y }
          : p,
      );
    });
  }, []);
```

**Step 5: Run all tests**

```bash
bun test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add src/utils/lockPointOrder.ts src/utils/lockPointOrder.test.ts src/contexts/EditorSettingsContext.tsx
git commit -m "test: extract and test lockPointOrder helper, refactor EditorSettingsContext"
```

---

### Task 4: Create `KeyboardShortcutsContext`

**Files:**
- Create: `src/contexts/KeyboardShortcutsContext.tsx`

**Step 1: Write the context**

Create `src/contexts/KeyboardShortcutsContext.tsx`:
```tsx
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
  return navigator.platform.toUpperCase().includes('MAC');
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
 *  Re-registers whenever chord or callback identity changes. */
export function useShortcut(chord: string, callback: () => void): void {
  const { registerShortcut } = useKeyboardShortcuts();
  useEffect(() => {
    return registerShortcut(chord, callback);
  }, [registerShortcut, chord, callback]);
}
```

**Step 2: Wrap the app in the provider**

In `src/main.tsx`, import and add `KeyboardShortcutsProvider` around the `App`:
```tsx
import { KeyboardShortcutsProvider } from './contexts/KeyboardShortcutsContext';
```

Wrap `<App />` (or the outermost element) with `<KeyboardShortcutsProvider>`.

The current `main.tsx` looks like:
```tsx
// ... existing StrictMode conditional logic
root.render(
  <I18nextProvider i18n={i18n}>
    <KeyboardShortcutsProvider>
      <App />
    </KeyboardShortcutsProvider>
  </I18nextProvider>
);
```

Read `src/main.tsx` before editing to confirm the exact structure.

**Step 3: Commit**

```bash
git add src/contexts/KeyboardShortcutsContext.tsx src/main.tsx
git commit -m "feat: add KeyboardShortcutsContext with ref-based pub/sub registry"
```

---

### Task 5: Register shortcuts in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Step 1: Import and register**

At the top of `App.tsx`, add:
```ts
import { useShortcut, shortcutChord } from './contexts/KeyboardShortcutsContext';
```

Inside `App()`, after all handlers are defined, add (using `useShortcut` for each):
```ts
useShortcut(shortcutChord('s'), handleSaveProject);
useShortcut(shortcutChord('s', true), handleSaveProjectAs);
useShortcut(shortcutChord('o'), handleOpenProject);
useShortcut(shortcutChord('n'), handleNewFile);
useShortcut(shortcutChord('e'), handleExportTranslation);
```

Note: `handleSaveProjectAs` doesn't exist yet — it will be created in Task 7. For now, add a placeholder or skip it and add it in Task 7. Add the other four now.

**Step 2: Verify dev server starts without errors**

```bash
bun run dev
```

Test Ctrl+N in the browser — confirm it doesn't trigger the browser's new-window behavior and instead clears the editor.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: register keyboard shortcuts in App (save, open, new, export)"
```

---

### Task 6: Add shortcut labels to menu items

**Files:**
- Modify: `src/components/MenuBar.tsx`
- Modify: `src/locales/en.yaml`

**Step 1: Add i18n key**

In `src/locales/en.yaml`, under `menu:`, add:
```yaml
  saveProjectAs: Save Project As...
```

**Step 2: Import formatting utilities in MenuBar.tsx**

Add import:
```ts
import { formatShortcut } from '../contexts/KeyboardShortcutsContext';
```

**Step 3: Add a shortcut label helper**

Inside `MenuBar`, add a helper component before the `fileMenu` definition:
```tsx
const ShortcutLabel = ({ label }: { label: string }) => (
  <span style={{ opacity: 0.5, fontSize: '0.85em' }}>{label}</span>
);
```

**Step 4: Update menu items with labels**

Replace the `fileMenu` JSX with:
```tsx
const fileMenu = (
  <Menu>
    <MenuItem
      text={t('menu.newFile')}
      icon="document"
      onClick={onNewFile}
      labelElement={<ShortcutLabel label={formatShortcut('n')} />}
    />
    <MenuDivider />
    <MenuItem
      text={t('menu.openProject')}
      icon="folder-open"
      onClick={onOpenProject}
      labelElement={<ShortcutLabel label={formatShortcut('o')} />}
    />
    <MenuItem text={t('menu.loadText')} icon="document-open" onClick={onLoadText} />
    <MenuDivider />
    <MenuItem
      text={t('menu.saveProject')}
      icon="floppy-disk"
      onClick={onSaveProject}
      labelElement={<ShortcutLabel label={formatShortcut('s')} />}
    />
    <MenuItem
      text={t('menu.saveProjectAs')}
      icon="floppy-disk"
      onClick={onSaveProjectAs}
      labelElement={<ShortcutLabel label={formatShortcut('s', true)} />}
    />
    <MenuItem
      text={t('menu.exportTranslation')}
      icon="export"
      onClick={onExportTranslation}
      labelElement={<ShortcutLabel label={formatShortcut('e')} />}
    />
    {isElectron && (
      <>
        <MenuDivider />
        <MenuItem text={t('menu.exit')} icon="log-out" onClick={handleExit} />
      </>
    )}
  </Menu>
);
```

**Step 5: Update `MenuBarProps` and `MenuBar` signature**

Add `onSaveProjectAs` to the props interface:
```ts
interface MenuBarProps {
  // ...existing...
  onSaveProjectAs: () => void;
}
```

And destructure it in the function signature.

**Step 6: Pass `onSaveProjectAs` from `Layout.tsx` and `App.tsx`**

Read `src/components/Layout.tsx` to see how props are threaded through. Add `onSaveProjectAs` wherever `onSaveProject` is currently passed.

**Step 7: Verify in dev server**

Open the File menu — confirm all items show muted shortcut labels on the right.

**Step 8: Commit**

```bash
git add src/components/MenuBar.tsx src/locales/en.yaml
# also Layout.tsx if modified
git commit -m "feat: add shortcut labels to menu items, add Save Project As... item"
```

---

### Task 7: Add File System Access API functions to `fileIO.ts`

**Files:**
- Modify: `src/utils/fileIO.ts`

**Step 1: Add the three new functions**

Append to `src/utils/fileIO.ts`:

```ts
const MIRROR_PROJECT_ACCEPT: FilePickerAcceptType[] = [
  {
    description: 'Mirror Project',
    accept: { 'application/json': ['.mirror.json'] },
  },
];

/**
 * Opens the OS save picker and writes content to the chosen file.
 * Returns the FileSystemFileHandle on success, or null if cancelled or unsupported.
 * Falls back to downloadFile if the API is unavailable.
 */
export async function saveFileWithPicker(
  suggestedName: string,
  content: string,
  mimeType: string,
): Promise<FileSystemFileHandle | null> {
  if (typeof window.showSaveFilePicker !== 'function') {
    // Fallback: use download
    downloadFile(suggestedName, content, mimeType);
    return null;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: MIRROR_PROJECT_ACCEPT,
    });
    await saveFileToHandle(handle, content);
    return handle;
  } catch (e) {
    // User cancelled — AbortError
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

/**
 * Writes content to an existing FileSystemFileHandle (no picker shown).
 */
export async function saveFileToHandle(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Opens the OS file picker for opening a project file.
 * Returns name, content, and handle, or null if cancelled or unsupported.
 * Falls back to readFileAsText if the API is unavailable.
 */
export async function openFileWithPicker(): Promise<{
  name: string;
  content: string;
  handle: FileSystemFileHandle;
} | null> {
  if (typeof window.showOpenFilePicker !== 'function') {
    // Fallback: use hidden input
    const result = await readFileAsText('.mirror.json');
    if (!result) return null;
    // No handle available in fallback path
    return { name: result.name, content: result.content, handle: null as unknown as FileSystemFileHandle };
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: MIRROR_PROJECT_ACCEPT,
      multiple: false,
    });
    const file = await handle!.getFile();
    const content = await file.text();
    return { name: file.name, content, handle: handle! };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}
```

**Note on TypeScript:** `showSaveFilePicker` and `showOpenFilePicker` are part of the File System Access API. If TypeScript complains about missing types, add `"lib": ["ES2022", "DOM", "DOM.Iterable"]` to `tsconfig.json` (check current value first — it may already be set). If `FileSystemFileHandle` etc. are not found, add `/// <reference lib="dom" />` at the top of the file or install `@types/wicg-file-system-access` via `bun add -d @types/wicg-file-system-access`.

**Step 2: Commit**

```bash
git add src/utils/fileIO.ts
git commit -m "feat: add File System Access API wrappers to fileIO (saveFileWithPicker, openFileWithPicker)"
```

---

### Task 8: Implement Save Project / Save Project As... in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add file handle ref and import new fileIO functions**

At the top of `App.tsx`, add to the import from `./utils/fileIO`:
```ts
import { readFileAsArrayBuffer, saveFileWithPicker, saveFileToHandle, openFileWithPicker, downloadFile } from './utils/fileIO';
```

Remove `readFileAsText` from the import (it's no longer used directly — `openFileWithPicker` handles it internally).

Inside `App()`, add:
```ts
const projectFileHandleRef = useRef<FileSystemFileHandle | null>(null);
```

**Step 2: Replace `handleOpenProject`**

Replace the existing `handleOpenProject` with:
```ts
const handleOpenProject = useCallback(async () => {
  const result = await openFileWithPicker();
  if (!result) return;

  // Store handle for future Save operations (null in fallback path — that's OK)
  projectFileHandleRef.current = result.handle;

  try {
    const project: MirrorProject = JSON.parse(result.content);
    if (project.version !== 1 && project.version !== 2) {
      console.warn('Unknown project version:', project.version);
    }

    const toMarkdown = (content: string) =>
      project.version === 1 ? turndown.turndown(content ?? '') : (content ?? '');

    setSourceContent(toMarkdown(project.sourceContent));
    setTranslationContent(toMarkdown(project.translationContent));
    setSourceLanguage((project.sourceLanguage ?? 'en') as LanguageCode);
    setTranslationLanguage((project.translationLanguage ?? 'it') as LanguageCode);
    if (project.lockingPoints?.length) {
      editorRef.current?.setLockingPoints(project.lockingPoints);
    }
  } catch (e) {
    console.error('Failed to parse project file:', e);
  }
}, []);
```

**Step 3: Add `buildProjectJson` helper and split save handlers**

Add a helper just before the handlers:
```ts
const buildProjectJson = useCallback(() => {
  const lockingPoints = editorRef.current?.getLockingPoints() ?? [
    { id: 'origin', sourceY: 0, translationY: 0 },
  ];
  const project: MirrorProject = {
    version: 2,
    sourceContent,
    translationContent,
    sourceLanguage,
    translationLanguage,
    lockingPoints,
  };
  return JSON.stringify(project, null, 2);
}, [sourceContent, translationContent, sourceLanguage, translationLanguage]);
```

Replace the existing `handleSaveProject` with:
```ts
const handleSaveProjectAs = useCallback(async () => {
  const json = buildProjectJson();
  const handle = await saveFileWithPicker('project.mirror.json', json, 'application/json');
  if (handle) projectFileHandleRef.current = handle;
}, [buildProjectJson]);

const handleSaveProject = useCallback(async () => {
  const handle = projectFileHandleRef.current;
  if (handle) {
    await saveFileToHandle(handle, buildProjectJson());
  } else {
    await handleSaveProjectAs();
  }
}, [buildProjectJson, handleSaveProjectAs]);
```

**Step 4: Wire `handleSaveProjectAs` into shortcut and Layout**

Update the `useShortcut` call for `'s', true` (from Task 5 placeholder) to use `handleSaveProjectAs`.

Pass `onSaveProjectAs={handleSaveProjectAs}` alongside `onSaveProject={handleSaveProject}` in the `<Layout>` usage.

**Step 5: Verify manually**

In the dev server:
1. Open a project — confirm the OS file picker appears
2. Save Project As... — confirm OS picker appears, file is saved, subsequent Save goes to same file without picker
3. Save Project (Ctrl+S / Cmd+S) after Save As — confirm no picker, file is overwritten silently

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: implement Save Project / Save Project As with File System Access API"
```

---

### Task 9: Thread `onSaveProjectAs` through Layout

**Files:**
- Modify: `src/components/Layout.tsx`

**Step 1: Read Layout.tsx**

Read the file to see the current props interface and how `onSaveProject` is threaded to `MenuBar`.

**Step 2: Add `onSaveProjectAs`**

Add `onSaveProjectAs: () => void` to `LayoutProps` and pass it through to `MenuBar` wherever `onSaveProject` is already forwarded.

**Step 3: Run all tests**

```bash
bun test
```

Expected: all tests pass (no new tests needed for Layout threading).

**Step 4: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: thread onSaveProjectAs through Layout to MenuBar"
```

---

### Task 10: Final verification

**Step 1: Run full test suite**

```bash
bun test
```

Expected output: all tests pass, count ≥ 17.

**Step 2: Type-check**

```bash
bun run typecheck
```

Expected: no errors.

**Step 3: Start dev server and do a full smoke test**

```bash
bun run dev
```

Verify:
- [ ] Ctrl+N / Cmd+N clears the editor (no browser new-window)
- [ ] Ctrl+O / Cmd+O opens OS file picker for `.mirror.json`
- [ ] Ctrl+S / Cmd+S on a new project → OS save picker appears; subsequent Ctrl+S saves silently
- [ ] Ctrl+Shift+S / Cmd+Shift+S always shows picker
- [ ] Ctrl+E / Cmd+E exports translation
- [ ] File menu shows muted shortcut labels for all items
- [ ] "Save Project As..." appears in the File menu

**Step 4: Commit if there are any final fixups**

```bash
git add -p
git commit -m "fix: final polish after integration testing"
```
