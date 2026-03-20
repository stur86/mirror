# File Browser Dialog — Design Spec

**Date:** 2026-03-20
**Branch:** electrobun-experimental
**Status:** Approved

## Context

Electrobun's webview does not support `showSaveFilePicker` or `showOpenFilePicker`. The current workaround (folder picker via `Utils.openFileDialog` + silent download fallback) gives no control over save location. This spec describes a custom React file browser dialog that replaces native file pickers in the Electrobun build for all three file operations: open project, load text, and save project.

The web build is unaffected — all existing `fileIO.ts` paths remain unchanged.

## Goals

- Replace all three Electrobun file picker paths with a single generic dialog component
- Match Mirror's existing dark-theme BlueprintJS aesthetic
- Keep the web build completely unchanged

## Non-Goals

- Multi-file selection (no use case)
- Drag-and-drop reordering or file management beyond "New Folder"
- File rename or delete
- Favourites/bookmarks beyond the four standard Places

---

## Component Interface

**File:** `src/components/FileBrowserDialog.tsx`

```typescript
export interface FileFilter {
  label: string;
  extensions: string[];  // e.g. ['.mirror.json'] or ['.txt', '.md', '.docx']
}

export interface FileBrowserResult {
  path: string;
  buffer?: ArrayBuffer;  // populated in open mode only
}

interface FileBrowserDialogProps {
  isOpen: boolean;
  mode: 'save' | 'open';
  title: string;
  suggestedName?: string;   // save mode: pre-filled filename
  filters?: FileFilter[];   // open mode: shown as dropdown; omit = no filter UI
  onConfirm: (result: FileBrowserResult) => void;
  onClose: () => void;
}
```

The component is fully data-driven. The three use cases are distinct prop combinations — no specialised subclasses.

---

## Layout

A BlueprintJS `Dialog` containing:

```
┌─ Dialog title ──────────────────────────────────────────┐
│  ┌──────────┬──────────────────────────────────────────┐ │
│  │ PLACES   │ breadcrumb: 🏠 / Documents / mirror      │ │
│  │          │                                          │ │
│  │ 🏠 Home  │  📁 src/                                 │ │
│  │ 🖥 Desktop│  📁 docs/                                │ │
│  │ 📄 Docs  │  📄 package.json  (dimmed in save mode)  │ │
│  │ ⬇ Downloads│                                        │ │
│  │          │  + New Folder  (save mode only)          │ │
│  └──────────┴──────────────────────────────────────────┘ │
│  [label] [filename field ──────────] [filter ▾] [OK] [✕] │
└─────────────────────────────────────────────────────────-┘
```

**Footer row (single row):**
- `Save as:` / `Open:` label
- Filename field: editable in save mode; read-only display of selected filename in open mode
- Filter dropdown: shown only when `filters` prop is provided; options are each filter's `label` plus "All files"
- Action button: "Save" or "Open" depending on mode; disabled when filename is empty
- Cancel button

**Save mode specifics:**
- Non-directory entries are shown but dimmed and non-clickable
- `+ New Folder` link appears below the file list
- No filter dropdown

**Open mode specifics:**
- Entries not matching the active filter are hidden
- Single-click a file → fills the filename field
- Double-click a file → fills filename and confirms immediately
- `+ New Folder` is not shown

---

## RPC Layer

Four new request types added to `src/shared/rpc.types.ts`:

```typescript
listDirectory: {
  params: { path: string };
  response: { entries: Array<{ name: string; isDirectory: boolean }> };
};
getStandardPaths: {
  params: Record<string, never>;
  response: { home: string; desktop: string; documents: string; downloads: string };
};
createDirectory: {
  params: { path: string };
  response: { ok: boolean };
};
readFile: {
  params: { path: string };
  response: { base64: string };
};
```

**Bun-side implementations** (`src/bun/index.ts`):

- `listDirectory`: `readdirSync(path, { withFileTypes: true })` — directories first, then alphabetical; dotfiles excluded
- `getStandardPaths`: `os.homedir()` + `path.join(home, 'Desktop' | 'Documents' | 'Downloads')`
- `createDirectory`: `mkdirSync(path)` in try/catch; returns `{ ok: false }` on error
- `readFile`: `readFileSync(path)` → `Buffer.from(data).toString('base64')`

All four are exposed on `window.electronAPI` via `src/electrobun/view.ts` and typed in `src/types/electron.d.ts`.

---

## Component Internal State

```typescript
currentPath: string          // directory currently displayed
entries: Entry[]             // fetched from listDirectory on each navigation
standardPaths: StandardPaths // fetched once on dialog open
filename: string             // editable (save) or set by file selection (open)
selectedFilter: FileFilter | null  // null = All files
isCreatingFolder: boolean
newFolderName: string
isLoading: boolean           // RPC in flight
error: string | null         // listDirectory failure
```

**Behaviour:**
- On open: `getStandardPaths` and `listDirectory(home)` fetched in parallel; dialog starts at home
- Navigation (directory click, breadcrumb click, sidebar click): calls `listDirectory(newPath)`, updates `currentPath`; breadcrumb is derived by splitting `currentPath` on the path separator
- Filter change: re-filters the already-fetched `entries` client-side (no new RPC)
- New folder: inline input on `+ New Folder` click; Enter calls `createDirectory` then refreshes listing; Escape cancels
- Confirm (open): calls `readFile(currentPath + '/' + filename)`, decodes base64 to `ArrayBuffer`, calls `onConfirm({ path, buffer })`
- Confirm (save): calls `onConfirm({ path: currentPath + '/' + filename })` directly
- OK disabled when `filename` is empty

**BlueprintJS components used:** `Dialog`, `Breadcrumbs`, `InputGroup`, `HTMLSelect`, `Button`, `Spinner`

---

## Integration with App.tsx

A single dialog state block drives all three use cases:

```typescript
const [fileBrowser, setFileBrowser] = useState<{
  mode: 'save' | 'open';
  title: string;
  suggestedName?: string;
  filters?: FileFilter[];
} | null>(null);
const fileBrowserCallbackRef = useRef<((result: FileBrowserResult) => void) | null>(null);
```

Each handler checks `isElectron` and branches:

| Handler | Electrobun path | Web path |
|---|---|---|
| `handleOpenProject` | `FileBrowserDialog` open mode, `.mirror.json` filter | `openFileWithPicker` (unchanged) |
| `handleLoadText` | `FileBrowserDialog` open mode, text filter | `readFileAsArrayBuffer` (unchanged) |
| `handleSaveProjectAs` | `FileBrowserDialog` save mode, `suggestedName='project.mirror.json'` | `showSaveFilePicker` (unchanged) |

`FileBrowserDialog` is rendered once in App.tsx's JSX alongside the other dialogs, with `isOpen={fileBrowser !== null}`.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/FileBrowserDialog.tsx` | **New** — dialog component |
| `src/components/FileBrowserDialog.css` | **New** — styles |
| `src/shared/rpc.types.ts` | 4 new bun request types |
| `src/bun/index.ts` | 4 new request handlers |
| `src/electrobun/view.ts` | 4 new `window.electronAPI` methods |
| `src/types/electron.d.ts` | Type the 4 new API methods |
| `src/components/index.ts` | Export `FileBrowserDialog`, `FileFilter`, `FileBrowserResult` |
| `src/App.tsx` | `fileBrowser` state + updated Electrobun-path handlers |

**Unchanged:** `src/utils/fileIO.ts` and all other components.
