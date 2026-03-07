# Design: Unit Testing, Keyboard Shortcuts & Save/Save As

Date: 2026-03-07

## 1. Unit Testing Framework

**Goal:** Add `bun test` as the standard test command. No additional libraries — use Bun's built-in test runner exclusively.

**Test script:** add `"test": "bun test"` to `package.json`.

**Test file locations:** colocated with source, `src/**/*.test.ts`.

**Initial test targets (utility functions only — no DOM, no React):**

- `src/utils/detectLanguage.test.ts`
  - Happy path: English, Italian, Spanish detected correctly
  - Short text (< franc's threshold) returns null
  - Empty string returns null

- `src/utils/docxConvert.test.ts`
  - Test the Markdown output shape from a minimal DOCX buffer (mock mammoth if needed)

- `src/utils/scrollSyncMath.test.ts`
  - Extract the formula `targetScrollTop = lp.toY - (lp.fromY - scrollTop)` into a pure exported function in `src/utils/scrollSyncMath.ts`
  - Test multiple lock point / scrollTop combinations including edge cases (scrollTop=0, lock at origin)

- `src/utils/lockPointOrder.test.ts`
  - Extract the sourceY ordering enforcement logic from `EditorSettingsContext` into a pure helper
  - Test that inserting a lock point maintains sorted sourceY order
  - Test that the last lock point is replaced by the origin point when deleted

**Principle:** tests cover the pure logic only; hooks/components added incrementally in future passes.

---

## 2. Keyboard Shortcuts

**Goal:** A pub/sub shortcut registry as a React context, so any component can own a chord.

### `KeyboardShortcutsContext`

Location: `src/contexts/KeyboardShortcutsContext.tsx`

```ts
interface KeyboardShortcutsContextValue {
  registerShortcut(chord: string, callback: () => void): () => void; // returns unregister fn
}
```

**Internals:**
- Maintains `Map<chord, MutableRefObject<() => void>>` — each chord maps to a ref cell holding the latest callback
- One global `keydown` listener on `document` (attached in the provider's `useEffect`), reads chord from the event, calls `ref.current()` if registered
- `registerShortcut` writes the callback into the ref cell (or creates one), returns a cleanup function that removes the entry
- Stale closure safety: because the listener reads from the ref at call time, not at registration time, callbacks always see current state

**Chord format:** `"ctrl+s"`, `"ctrl+shift+s"`, `"meta+s"` etc. — lowercase, `+`-separated.

**Platform detection:** a small utility `isMac()` checks `navigator.platform.includes('Mac')`. The context provider generates the correct chord per platform when consumers call a helper `shortcutChord(key, shift?)`.

### Shortcuts registered in `App.tsx`

| Action | Mac chord | Win/Linux chord |
|---|---|---|
| Save Project | `meta+s` | `ctrl+s` |
| Save Project As... | `meta+shift+s` | `ctrl+shift+s` |
| Open Project | `meta+o` | `ctrl+o` |
| New File | `meta+n` | `ctrl+n` |
| Export Translation | `meta+e` | `ctrl+e` |

All default browser actions for these chords are prevented.

### Menu display

A utility `formatShortcut(key, shift?, alt?)` returns:
- Mac: `⌘S`, `⇧⌘S`, `⌘O`, etc.
- Win/Linux: `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+O`, etc.

`MenuItem` in BlueprintJS accepts a `labelElement` prop. Each menu item gets a `<span style={{ opacity: 0.5 }}>` with the formatted shortcut string.

---

## 3. Save Project / Save Project As...

**Goal:** Replace `downloadFile` with the File System Access API for proper Save vs Save As semantics.

### File handle state

`App.tsx` gains:
```ts
const projectFileHandleRef = useRef<FileSystemFileHandle | null>(null);
```
A ref (not state) — no re-render needed when the handle changes.

### New `fileIO.ts` functions

```ts
// Opens OS save picker, writes content, returns the handle (or null if cancelled/unsupported)
saveFileWithPicker(suggestedName: string, content: string, mimeType: string): Promise<FileSystemFileHandle | null>

// Writes to an existing handle (no picker)
saveFileToHandle(handle: FileSystemFileHandle, content: string): Promise<void>

// Opens OS open picker, returns name + content + handle (or null if cancelled/unsupported)
openFileWithPicker(accept: FilePickerAcceptType[]): Promise<{ name: string; content: string; handle: FileSystemFileHandle } | null>
```

**Fallback:** if `window.showSaveFilePicker` is undefined, `saveFileWithPicker` falls back to existing `downloadFile` behavior and returns null (no handle stored).

### `handleSaveProject` → split into two handlers

**`handleSaveProjectAs`:**
1. Build project JSON
2. Call `saveFileWithPicker('project.mirror.json', json, 'application/json')`
3. If handle returned, store in `projectFileHandleRef.current`

**`handleSaveProject`:**
1. If `projectFileHandleRef.current` exists → call `saveFileToHandle(handle, json)` (no picker)
2. Else → delegate to `handleSaveProjectAs` (first save)

### `handleOpenProject` update

Switch from `readFileAsText` (hidden `<input>`) to `openFileWithPicker`, so the returned handle can be stored in `projectFileHandleRef.current`. This means a subsequent Save goes back to the same file.

### Menu changes

- "Save Project" item → `handleSaveProject`, shortcut label `⌘S` / `Ctrl+S`
- New "Save Project As..." item → `handleSaveProjectAs`, shortcut label `⇧⌘S` / `Ctrl+Shift+S`
- Add `menu.saveProjectAs` key to `src/locales/en.yaml`

---

## Files to Create/Modify

| File | Change |
|---|---|
| `package.json` | Add `"test": "bun test"` script |
| `src/utils/scrollSyncMath.ts` | Extract pure scroll formula |
| `src/utils/lockPointOrder.ts` | Extract locking point ordering logic |
| `src/utils/detectLanguage.test.ts` | New tests |
| `src/utils/scrollSyncMath.test.ts` | New tests |
| `src/utils/lockPointOrder.test.ts` | New tests |
| `src/contexts/KeyboardShortcutsContext.tsx` | New pub/sub shortcut registry |
| `src/utils/fileIO.ts` | Add `saveFileWithPicker`, `saveFileToHandle`, `openFileWithPicker` |
| `src/App.tsx` | Add shortcut registration, split save handlers, update open handler |
| `src/components/MenuBar.tsx` | Add shortcut labels, Save Project As... item |
| `src/locales/en.yaml` | Add `menu.saveProjectAs` |
| `src/hooks/useScrollSync.ts` | Import from `scrollSyncMath.ts` |
| `src/contexts/EditorSettingsContext.tsx` | Import from `lockPointOrder.ts` |
| `src/types/electron.d.ts` | No change needed |
