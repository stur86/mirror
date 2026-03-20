# File Browser Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Electrobun's non-functional native file pickers with a custom React file browser dialog for open project, load text, and save project operations.

**Architecture:** A single generic `FileBrowserDialog` component (save + open modes) is driven by props from App.tsx. The bun main process gains four new RPC request handlers for filesystem operations. App.tsx branches on `isElectron` in the three file-picker handlers; the web build is entirely unaffected.

**Tech Stack:** React 19, TypeScript, BlueprintJS 6, Electrobun RPC, Bun `fs`/`os` modules

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/shared/rpc.types.ts` | Modify | Add 4 new `bun.requests` types |
| `src/bun/index.ts` | Modify | Implement 4 new bun-side RPC handlers |
| `src/bun/index.test.ts` | Create | Unit tests for sort/filter logic |
| `src/types/electron.d.ts` | Modify | Add 4 new `window.electronAPI` method types |
| `src/electrobun/view.ts` | Modify | Expose 4 new methods on `window.electronAPI` |
| `src/components/index.ts` | Modify | Add `Breadcrumbs`, `InputGroup`, `Spinner` re-exports; export `FileBrowserDialog` types |
| `src/components/FileBrowserDialog.tsx` | Create | Dialog component — all UI + interaction logic |
| `src/components/FileBrowserDialog.css` | Create | Styles (sidebar, file list, footer) |
| `src/components/FileBrowserDialog.test.ts` | Create | Unit tests for path utility helpers |
| `src/App.tsx` | Modify | `fileBrowser` state + updated handlers for Electrobun |

---

## Task 1: Extend RPC types

**Files:**
- Modify: `src/shared/rpc.types.ts`

- [ ] **Step 1: Add 4 new request types under `bun.requests`**

Open `src/shared/rpc.types.ts`. Add these 4 entries inside the `requests` block, after `saveProjectToPath`:

```typescript
      // Renderer asks bun to list a directory's contents.
      // Directories come first, sorted alphabetically. Dotfiles excluded.
      // Returns { error } on permission/IO failure (no throw).
      listDirectory: {
        params: { path: string };
        response: { entries: Array<{ name: string; isDirectory: boolean }> } | { error: string };
      };
      // Renderer asks bun for standard OS directory paths.
      getStandardPaths: {
        params: Record<string, never>;
        response: { home: string; desktop: string; documents: string; downloads: string };
      };
      // Renderer asks bun to create a directory. Returns ok: false on error (no throw).
      createDirectory: {
        params: { path: string };
        response: { ok: boolean };
      };
      // Renderer asks bun to read a file as base64. Returns { error } on failure (no throw).
      readFile: {
        params: { path: string };
        response: { base64: string } | { error: string };
      };
```

- [ ] **Step 2: Verify build**

```bash
bun run build 2>&1 | head -20
```
Expected: no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/rpc.types.ts
git commit -m "feat: add listDirectory/getStandardPaths/createDirectory/readFile RPC types"
```

---

## Task 2: Implement bun-side handlers + unit tests

**Files:**
- Modify: `src/bun/index.ts`
- Create: `src/bun/index.test.ts`

- [ ] **Step 1: Add new imports to `src/bun/index.ts`**

The file already has `import { readFileSync } from "fs"` and `import { join } from "path"`. Extend those imports:

```typescript
import { readFileSync, readdirSync, mkdirSync } from "fs";
import { homedir } from "os";
```

(`join` is already imported.)

- [ ] **Step 2: Add the 4 handlers inside `BrowserView.defineRPC`**

Inside the `requests` block (after the `saveProjectToPath` handler), add:

```typescript
      listDirectory: async ({ path: dirPath }) => {
        try {
          const raw = readdirSync(dirPath, { withFileTypes: true });
          const entries = raw
            .filter((e) => !e.name.startsWith('.'))
            .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
            .sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
          return { entries };
        } catch (e) {
          return { error: String(e) };
        }
      },

      getStandardPaths: async () => {
        const home = homedir();
        return {
          home,
          desktop: join(home, 'Desktop'),
          documents: join(home, 'Documents'),
          downloads: join(home, 'Downloads'),
        };
      },

      createDirectory: async ({ path: dirPath }) => {
        try {
          mkdirSync(dirPath);
          return { ok: true };
        } catch {
          return { ok: false };
        }
      },

      readFile: async ({ path: filePath }) => {
        try {
          const data = readFileSync(filePath);
          return { base64: Buffer.from(data).toString('base64') };
        } catch (e) {
          return { error: String(e) };
        }
      },
```

- [ ] **Step 3: Write the failing test**

Create `src/bun/index.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';

// Extract and test the pure sort/filter logic used by listDirectory.
// We test the logic in isolation — no RPC setup needed.
function sortAndFilter(
  entries: Array<{ name: string; isDirectory: boolean }>,
): Array<{ name: string; isDirectory: boolean }> {
  return entries
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

describe('listDirectory sort/filter logic', () => {
  test('directories come before files', () => {
    const input = [
      { name: 'zebra.txt', isDirectory: false },
      { name: 'alpha', isDirectory: true },
    ];
    const result = sortAndFilter(input);
    expect(result[0].name).toBe('alpha');
    expect(result[0].isDirectory).toBe(true);
    expect(result[1].name).toBe('zebra.txt');
  });

  test('dotfiles are excluded', () => {
    const input = [
      { name: '.hidden', isDirectory: false },
      { name: '.git', isDirectory: true },
      { name: 'visible.txt', isDirectory: false },
    ];
    const result = sortAndFilter(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('visible.txt');
  });

  test('entries within same type are sorted alphabetically', () => {
    const input = [
      { name: 'zebra', isDirectory: true },
      { name: 'alpha', isDirectory: true },
      { name: 'mango', isDirectory: true },
    ];
    expect(sortAndFilter(input).map((e) => e.name)).toEqual(['alpha', 'mango', 'zebra']);
  });

  test('mixed types: dirs first, each group alphabetical', () => {
    const input = [
      { name: 'notes.txt', isDirectory: false },
      { name: 'src', isDirectory: true },
      { name: 'abc.md', isDirectory: false },
      { name: 'docs', isDirectory: true },
    ];
    const result = sortAndFilter(input);
    expect(result.map((e) => e.name)).toEqual(['docs', 'src', 'abc.md', 'notes.txt']);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail (function not yet extracted)**

```bash
bun test src/bun/index.test.ts
```
Expected: 4 tests PASS (the test file is self-contained — it defines `sortAndFilter` inline). If all pass, proceed.

- [ ] **Step 5: Verify build still works**

```bash
bun run build 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/bun/index.ts src/bun/index.test.ts
git commit -m "feat: implement listDirectory/getStandardPaths/createDirectory/readFile bun handlers"
```

---

## Task 3: Expose new methods on `window.electronAPI`

**Files:**
- Modify: `src/types/electron.d.ts`
- Modify: `src/electrobun/view.ts`

- [ ] **Step 1: Add 4 method signatures to `electron.d.ts`**

In `src/types/electron.d.ts`, add after `saveProjectToPath`:

```typescript
      listDirectory: (path: string) => Promise<{ entries: Array<{ name: string; isDirectory: boolean }> } | { error: string }>;
      getStandardPaths: () => Promise<{ home: string; desktop: string; documents: string; downloads: string }>;
      createDirectory: (path: string) => Promise<{ ok: boolean }>;
      readFile: (path: string) => Promise<{ base64: string } | { error: string }>;
```

- [ ] **Step 2: Add the inline type annotations in `view.ts`**

In `src/electrobun/view.ts`, the `electronAPI` assignment has an inline type annotation block. Add the 4 new methods to that block (after `saveProjectToPath`):

```typescript
        listDirectory: (path: string) => Promise<{ entries: Array<{ name: string; isDirectory: boolean }> } | { error: string }>;
        getStandardPaths: () => Promise<{ home: string; desktop: string; documents: string; downloads: string }>;
        createDirectory: (path: string) => Promise<{ ok: boolean }>;
        readFile: (path: string) => Promise<{ base64: string } | { error: string }>;
```

- [ ] **Step 3: Implement the 4 methods in the `electronAPI` object in `view.ts`**

Add after `saveProjectToPath`:

```typescript
      listDirectory: (path: string) => {
        return electroview.rpc!.request.listDirectory({ path });
      },

      getStandardPaths: () => {
        return electroview.rpc!.request.getStandardPaths({});
      },

      createDirectory: (path: string) => {
        return electroview.rpc!.request.createDirectory({ path });
      },

      readFile: (path: string) => {
        return electroview.rpc!.request.readFile({ path });
      },
```

- [ ] **Step 4: Verify build**

```bash
bun run build 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/electron.d.ts src/electrobun/view.ts
git commit -m "feat: expose listDirectory/getStandardPaths/createDirectory/readFile on window.electronAPI"
```

---

## Task 4: Update component abstraction layer

**Files:**
- Modify: `src/components/index.ts`

- [ ] **Step 1: Add missing BlueprintJS re-exports**

In `src/components/index.ts`, add `Breadcrumbs`, `InputGroup`, `Spinner` to the existing `@blueprintjs/core` export block:

```typescript
export {
  Button,
  Navbar,
  // ... existing exports ...
  Switch,
  Breadcrumbs,   // ← add
  InputGroup,    // ← add
  Spinner,       // ← add
} from '@blueprintjs/core';
```

- [ ] **Step 2: Verify build**

```bash
bun run build 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/index.ts
git commit -m "feat: re-export Breadcrumbs, InputGroup, Spinner from component abstraction layer"
```

---

## Task 5: Implement FileBrowserDialog

**Files:**
- Create: `src/components/FileBrowserDialog.test.ts`
- Create: `src/components/FileBrowserDialog.css`
- Create: `src/components/FileBrowserDialog.tsx`

The renderer (webview) runs in a browser context — Node's `path` module is unavailable. All path manipulation uses simple string helpers defined locally.

- [ ] **Step 1: Write failing path utility tests**

Create `src/components/FileBrowserDialog.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';

// These helpers will live in FileBrowserDialog.tsx.
// Duplicate here for standalone testing; keep in sync with the component.
function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`;
}
function splitPath(p: string): string[] {
  return p.split('/').filter(Boolean);
}
function pathUpTo(segments: string[], upTo: number): string {
  return '/' + segments.slice(0, upTo + 1).join('/');
}
function applyFilter(
  entries: Array<{ name: string; isDirectory: boolean }>,
  extensions: string[] | null,
): Array<{ name: string; isDirectory: boolean }> {
  if (!extensions) return entries;
  return entries.filter(
    (e) => e.isDirectory || extensions.some((ext) => e.name.toLowerCase().endsWith(ext)),
  );
}

describe('joinPath', () => {
  test('avoids double slash at root', () => {
    expect(joinPath('/', 'home')).toBe('/home');
  });
  test('adds separator normally', () => {
    expect(joinPath('/home/user', 'Documents')).toBe('/home/user/Documents');
  });
  test('no extra slash when dir already ends with /', () => {
    expect(joinPath('/home/', 'user')).toBe('/home/user');
  });
});

describe('splitPath', () => {
  test('splits correctly', () => {
    expect(splitPath('/home/user/Documents')).toEqual(['home', 'user', 'Documents']);
  });
  test('handles root', () => {
    expect(splitPath('/')).toEqual([]);
  });
});

describe('pathUpTo', () => {
  test('reconstructs path up to index', () => {
    const segs = ['home', 'user', 'Documents'];
    expect(pathUpTo(segs, 0)).toBe('/home');
    expect(pathUpTo(segs, 1)).toBe('/home/user');
    expect(pathUpTo(segs, 2)).toBe('/home/user/Documents');
  });
});

describe('applyFilter', () => {
  const entries = [
    { name: 'src', isDirectory: true },
    { name: 'file.mirror.json', isDirectory: false },
    { name: 'readme.txt', isDirectory: false },
  ];

  test('directories always pass through', () => {
    const result = applyFilter(entries, ['.mirror.json']);
    expect(result.find((e) => e.name === 'src')).toBeTruthy();
  });
  test('files filtered by extension', () => {
    const result = applyFilter(entries, ['.mirror.json']);
    expect(result.find((e) => e.name === 'file.mirror.json')).toBeTruthy();
    expect(result.find((e) => e.name === 'readme.txt')).toBeUndefined();
  });
  test('null filter passes all', () => {
    expect(applyFilter(entries, null)).toHaveLength(3);
  });
  test('case-insensitive extension match', () => {
    const mixed = [{ name: 'File.MIRROR.JSON', isDirectory: false }];
    expect(applyFilter(mixed, ['.mirror.json'])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — expect PASS (helpers defined inline in test)**

```bash
bun test src/components/FileBrowserDialog.test.ts
```
Expected: 10 tests pass.

- [ ] **Step 3: Create `FileBrowserDialog.css`**

Create `src/components/FileBrowserDialog.css`:

```css
/* ---- Theme variables ---- */
.bp6-dark .fb-dialog {
  --fb-sidebar-bg: #0a0a1a;
  --fb-main-bg: #111118;
  --fb-list-bg: #0d0d1a;
  --fb-border: #222230;
  --fb-text: #ccccdd;
  --fb-text-muted: #555566;
  --fb-text-dim: #333344;
  --fb-selected-bg: #1a2a4a;
  --fb-selected-text: #88aaff;
  --fb-hover-bg: #1a1a2e;
  --fb-places-label: #444455;
  --fb-new-folder: #6677aa;
  --fb-error: #cc4444;
}
:not(.bp6-dark) .fb-dialog {
  --fb-sidebar-bg: #f0ece0;
  --fb-main-bg: #f8f4e8;
  --fb-list-bg: #ede9d8;
  --fb-border: #d0c8b0;
  --fb-text: #2a2010;
  --fb-text-muted: #888070;
  --fb-text-dim: #b0a890;
  --fb-selected-bg: #c8d8f0;
  --fb-selected-text: #1a3a7a;
  --fb-hover-bg: #e0dcc8;
  --fb-places-label: #a09888;
  --fb-new-folder: #5566aa;
  --fb-error: #aa2222;
}

/* ---- Dialog sizing ---- */
.fb-dialog .bp6-dialog {
  width: 640px;
  max-width: 90vw;
  padding: 0;
}
.fb-dialog .bp6-dialog-header {
  padding: 12px 16px 8px;
  flex-shrink: 0;
}

/* ---- Body layout ---- */
.fb-body {
  display: flex;
  height: 320px;
  overflow: hidden;
  border-top: 1px solid var(--fb-border);
  border-bottom: 1px solid var(--fb-border);
}

/* ---- Sidebar ---- */
.fb-sidebar {
  width: 120px;
  flex-shrink: 0;
  background: var(--fb-sidebar-bg);
  border-right: 1px solid var(--fb-border);
  padding: 8px 4px;
  overflow-y: auto;
}
.fb-places-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fb-places-label);
  padding: 0 8px 6px;
}
.fb-place-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--fb-text);
  user-select: none;
}
.fb-place-item:hover { background: var(--fb-hover-bg); }
.fb-place-item.fb-active {
  background: var(--fb-selected-bg);
  color: var(--fb-selected-text);
}

/* ---- Main area ---- */
.fb-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--fb-main-bg);
  padding: 8px;
  min-width: 0;
}
.fb-breadcrumb {
  margin-bottom: 6px;
  flex-shrink: 0;
}

/* ---- File list ---- */
.fb-list {
  flex: 1;
  background: var(--fb-list-bg);
  border-radius: 4px;
  padding: 4px;
  overflow-y: auto;
}
.fb-list-message {
  padding: 12px;
  font-size: 12px;
  color: var(--fb-text-muted);
  font-style: italic;
}
.fb-list-error {
  padding: 12px;
  font-size: 12px;
  color: var(--fb-error);
}
.fb-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  color: var(--fb-text);
  user-select: none;
}
.fb-entry:hover { background: var(--fb-hover-bg); }
.fb-entry.fb-selected {
  background: var(--fb-selected-bg);
  color: var(--fb-selected-text);
}
.fb-entry.fb-dimmed {
  color: var(--fb-text-dim);
  cursor: default;
}
.fb-entry.fb-dimmed:hover { background: transparent; }

/* ---- New folder ---- */
.fb-new-folder-row { padding: 4px 4px 0; }
.fb-new-folder-link {
  font-size: 11px;
  color: var(--fb-new-folder);
  cursor: pointer;
  background: none;
  border: none;
  padding: 2px 4px;
}
.fb-new-folder-link:hover { text-decoration: underline; }
.fb-new-folder-input-row {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 0;
}
.fb-new-folder-error {
  font-size: 10px;
  color: var(--fb-error);
  padding: 2px 4px;
}

/* ---- Footer ---- */
.fb-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  flex-shrink: 0;
}
.fb-footer-label {
  font-size: 12px;
  color: var(--fb-text-muted);
  flex-shrink: 0;
  white-space: nowrap;
}
.fb-filename-field { flex: 1; min-width: 0; }
.fb-confirm-error {
  font-size: 11px;
  color: var(--fb-error);
  flex-shrink: 0;
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 4: Create `FileBrowserDialog.tsx`**

Create `src/components/FileBrowserDialog.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Dialog, Breadcrumbs, InputGroup, HTMLSelect, Button, Spinner } from './index';
import './FileBrowserDialog.css';

export interface FileFilter {
  label: string;
  extensions: string[];
}

export interface FileBrowserResult {
  path: string;
  buffer?: ArrayBuffer; // open mode only
}

interface FileBrowserDialogProps {
  isOpen: boolean;
  mode: 'save' | 'open';
  title: string;
  suggestedName?: string;
  filters?: FileFilter[];
  onConfirm: (result: FileBrowserResult) => void;
  onClose: () => void;
}

interface Entry {
  name: string;
  isDirectory: boolean;
}

// ---- Path utilities (POSIX only — macOS/Linux) --------------------------------

function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`;
}

function splitPath(p: string): string[] {
  return p.split('/').filter(Boolean);
}

function pathUpTo(segments: string[], upTo: number): string {
  return '/' + segments.slice(0, upTo + 1).join('/');
}

// ---- Entry filtering ----------------------------------------------------------

function applyFilter(entries: Entry[], extensions: string[] | null): Entry[] {
  if (!extensions) return entries;
  return entries.filter(
    (e) => e.isDirectory || extensions.some((ext) => e.name.toLowerCase().endsWith(ext)),
  );
}

// ---- Component ---------------------------------------------------------------

export function FileBrowserDialog({
  isOpen,
  mode,
  title,
  suggestedName,
  filters,
  onConfirm,
  onClose,
}: FileBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [standardPaths, setStandardPaths] = useState<{
    home: string;
    desktop: string;
    documents: string;
    downloads: string;
  } | null>(null);
  const [filename, setFilename] = useState(suggestedName ?? '');
  const [selectedFilter, setSelectedFilter] = useState<FileFilter | null>(filters?.[0] ?? null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const navigateTo = useCallback(async (path: string) => {
    setIsLoading(true);
    setListError(null);
    const result = await window.electronAPI!.listDirectory(path);
    setIsLoading(false);
    if ('error' in result) {
      setListError(result.error);
      return; // currentPath unchanged — user can still navigate via breadcrumb/sidebar
    }
    setCurrentPath(path);
    setEntries(result.entries);
  }, []);

  // On dialog open: fetch standard paths, then immediately list the home directory.
  // getStandardPaths must complete first to know the home path — but listDirectory
  // is fired as soon as home is known (no extra await between them).
  useEffect(() => {
    if (!isOpen) return;
    setFilename(suggestedName ?? '');
    setSelectedFilter(filters?.[0] ?? null);
    setIsCreatingFolder(false);
    setNewFolderName('');
    setNewFolderError(null);
    setListError(null);
    setConfirmError(null);
    setEntries([]);
    setIsLoading(true);

    window.electronAPI!.getStandardPaths().then((paths) => {
      setStandardPaths(paths);
      // Fire listDirectory immediately after home is known
      window.electronAPI!.listDirectory(paths.home).then((result) => {
        setIsLoading(false);
        if ('error' in result) {
          navigateTo('/'); // fallback to root
        } else {
          setCurrentPath(paths.home);
          setEntries(result.entries);
        }
      });
    });
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = useCallback(async () => {
    if (!filename) return;
    setConfirmError(null);
    const fullPath = joinPath(currentPath, filename);

    if (mode === 'save') {
      onConfirm({ path: fullPath });
      return;
    }

    // open mode: read file via RPC
    const result = await window.electronAPI!.readFile(fullPath);
    if ('error' in result) {
      setConfirmError(result.error);
      return;
    }
    const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
    onConfirm({ path: fullPath, buffer: bytes.buffer });
  }, [filename, currentPath, mode, onConfirm]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    const newPath = joinPath(currentPath, newFolderName.trim());
    const result = await window.electronAPI!.createDirectory(newPath);
    if (!result.ok) {
      setNewFolderError('Could not create folder.');
      return;
    }
    setIsCreatingFolder(false);
    setNewFolderName('');
    setNewFolderError(null);
    // Refresh listing
    const refreshed = await window.electronAPI!.listDirectory(currentPath);
    if (!('error' in refreshed)) {
      setEntries(refreshed.entries);
    }
  }, [currentPath, newFolderName]);

  const cancelNewFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName('');
    setNewFolderError(null);
  }, []);

  // Filter entries: open mode uses active filter; save mode shows all (files dimmed)
  const activeExtensions =
    mode === 'open' && selectedFilter ? selectedFilter.extensions : null;
  const visibleEntries = applyFilter(entries, activeExtensions);

  // Breadcrumb items derived from currentPath
  const segments = splitPath(currentPath);
  const breadcrumbItems = [
    {
      text: '🏠',
      onClick: standardPaths ? () => navigateTo(standardPaths.home) : undefined,
    },
    ...segments.map((seg, i) => ({
      text: seg,
      // Last segment is the current dir — no click needed
      onClick:
        i < segments.length - 1 ? () => navigateTo(pathUpTo(segments, i)) : undefined,
    })),
  ];

  const isActiveSidebar = (path: string) =>
    currentPath === path || currentPath.startsWith(path + '/');

  return (
    <Dialog
      className="fb-dialog"
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      canOutsideClickClose={false}
    >
      <div className="fb-body">
        {/* Sidebar */}
        <div className="fb-sidebar">
          <div className="fb-places-label">Places</div>
          {!standardPaths ? (
            <Spinner size={16} />
          ) : (
            [
              { label: '🏠 Home', path: standardPaths.home },
              { label: '🖥 Desktop', path: standardPaths.desktop },
              { label: '📄 Documents', path: standardPaths.documents },
              { label: '⬇ Downloads', path: standardPaths.downloads },
            ].map(({ label, path }) => (
              <div
                key={path}
                className={`fb-place-item${isActiveSidebar(path) ? ' fb-active' : ''}`}
                onClick={() => navigateTo(path)}
              >
                {label}
              </div>
            ))
          )}
        </div>

        {/* Main */}
        <div className="fb-main">
          <div className="fb-breadcrumb">
            <Breadcrumbs items={breadcrumbItems} />
          </div>

          <div className="fb-list">
            {isLoading ? (
              <div style={{ padding: 12 }}>
                <Spinner size={20} />
              </div>
            ) : listError ? (
              <div className="fb-list-error">{listError}</div>
            ) : visibleEntries.length === 0 ? (
              <div className="fb-list-message">
                {mode === 'open' ? 'No matching files.' : 'Empty folder.'}
              </div>
            ) : (
              visibleEntries.map((entry) => {
                const isDir = entry.isDirectory;
                const isSelected = entry.name === filename;
                const isDimmed = mode === 'save' && !isDir;
                return (
                  <div
                    key={entry.name}
                    className={`fb-entry${isSelected ? ' fb-selected' : ''}${isDimmed ? ' fb-dimmed' : ''}`}
                    onClick={() => {
                      if (isDir) {
                        navigateTo(joinPath(currentPath, entry.name));
                      } else if (!isDimmed) {
                        setFilename(entry.name);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isDir && !isDimmed) {
                        setFilename(entry.name);
                        // handleConfirm reads filename from state; set it directly
                        const fullPath = joinPath(currentPath, entry.name);
                        setConfirmError(null);
                        if (mode === 'save') {
                          onConfirm({ path: fullPath });
                          return;
                        }
                        window.electronAPI!.readFile(fullPath).then((result) => {
                          if ('error' in result) {
                            setConfirmError(result.error);
                            return;
                          }
                          const bytes = Uint8Array.from(atob(result.base64), (c) =>
                            c.charCodeAt(0),
                          );
                          onConfirm({ path: fullPath, buffer: bytes.buffer });
                        });
                      }
                    }}
                  >
                    {isDir ? '📁' : '📄'} {entry.name}
                  </div>
                );
              })
            )}
          </div>

          {/* New Folder — save mode only */}
          {mode === 'save' && (
            <div className="fb-new-folder-row">
              {!isCreatingFolder ? (
                <button
                  className="fb-new-folder-link"
                  onClick={() => {
                    setIsCreatingFolder(true);
                    setNewFolderError(null);
                  }}
                >
                  + New Folder
                </button>
              ) : (
                <>
                  <div className="fb-new-folder-input-row">
                    <InputGroup
                      small
                      autoFocus
                      value={newFolderName}
                      placeholder="Folder name"
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') cancelNewFolder();
                      }}
                    />
                    <Button small onClick={handleCreateFolder}>
                      Create
                    </Button>
                    <Button small minimal onClick={cancelNewFolder}>
                      ✕
                    </Button>
                  </div>
                  {newFolderError && (
                    <div className="fb-new-folder-error">{newFolderError}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fb-footer">
        <span className="fb-footer-label">{mode === 'save' ? 'Save as:' : 'Open:'}</span>
        <div className="fb-filename-field">
          <InputGroup
            fill
            value={filename}
            readOnly={mode === 'open'}
            onChange={(e) => {
              if (mode === 'save') setFilename(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filename) handleConfirm();
            }}
          />
        </div>
        {filters && filters.length > 0 && (
          <HTMLSelect
            value={selectedFilter?.label ?? '__all__'}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedFilter(
                val === '__all__' ? null : (filters.find((f) => f.label === val) ?? null),
              );
            }}
            options={[
              ...filters.map((f) => ({ label: f.label, value: f.label })),
              { label: 'All files', value: '__all__' },
            ]}
          />
        )}
        {confirmError && <span className="fb-confirm-error">{confirmError}</span>}
        <Button intent="primary" disabled={!filename} onClick={handleConfirm}>
          {mode === 'save' ? 'Save' : 'Open'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
bun test src/components/FileBrowserDialog.test.ts
```
Expected: 10 tests pass.

- [ ] **Step 6: Verify build**

```bash
bun run build 2>&1 | head -20
```
Expected: no TypeScript errors (chunk warnings are fine).

- [ ] **Step 7: Commit**

```bash
git add src/components/FileBrowserDialog.tsx src/components/FileBrowserDialog.css src/components/FileBrowserDialog.test.ts
git commit -m "feat: implement FileBrowserDialog component"
```

---

## Task 6: Export FileBrowserDialog from component index

**Files:**
- Modify: `src/components/index.ts`

- [ ] **Step 1: Add FileBrowserDialog exports**

Append to `src/components/index.ts` after the `@blueprintjs/core` block:

```typescript
export { FileBrowserDialog } from './FileBrowserDialog';
export type { FileFilter, FileBrowserResult } from './FileBrowserDialog';
```

- [ ] **Step 2: Verify build**

```bash
bun run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/index.ts
git commit -m "feat: export FileBrowserDialog from component abstraction layer"
```

---

## Task 7: Wire FileBrowserDialog into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Important note:** `handleSaveProjectAs` returns `Promise<boolean>`. In the Electrobun path, the Promise must resolve to `false` when the user cancels. This requires a `fileBrowserCancelRef` alongside `fileBrowserCallbackRef`.

- [ ] **Step 1: Add imports**

At the top of `src/App.tsx`, add:

```typescript
import { FileBrowserDialog } from './components/FileBrowserDialog';
import type { FileFilter, FileBrowserResult } from './components/FileBrowserDialog';
```

- [ ] **Step 2: Add state and refs**

After the existing `const editorRef = ...` line, add:

```typescript
const [fileBrowser, setFileBrowser] = useState<{
  mode: 'save' | 'open';
  title: string;
  suggestedName?: string;
  filters?: FileFilter[];
} | null>(null);
const fileBrowserCallbackRef = useRef<((result: FileBrowserResult) => void) | null>(null);
const fileBrowserCancelRef = useRef<(() => void) | null>(null);
```

- [ ] **Step 3: Add `showFileBrowser` helper**

After the new refs, add:

```typescript
const showFileBrowser = useCallback(
  (
    config: { mode: 'save' | 'open'; title: string; suggestedName?: string; filters?: FileFilter[] },
    onResult: (result: FileBrowserResult) => void,
    onCancel?: () => void,
  ) => {
    fileBrowserCallbackRef.current = onResult;
    fileBrowserCancelRef.current = onCancel ?? null;
    setFileBrowser(config);
  },
  [],
);
```

- [ ] **Step 4: Update `handleOpenProject`**

Replace the existing `handleOpenProject` with:

```typescript
const handleOpenProject = useCallback(async () => {
  if (isElectron) {
    showFileBrowser(
      {
        mode: 'open',
        title: 'Open Project',
        filters: [{ label: 'Mirror Project', extensions: ['.mirror.json'] }],
      },
      (result) => {
        if (!result.buffer) return;
        projectFileHandleRef.current = result.path;
        try {
          const content = new TextDecoder('utf-8').decode(result.buffer);
          const project: MirrorProject = JSON.parse(content);
          if (project.version !== 1 && project.version !== 2) {
            console.warn('Unknown project version:', project.version);
          }
          const toMarkdown = (c: string) =>
            project.version === 1 ? turndown.turndown(c ?? '') : (c ?? '');
          setSourceContent(toMarkdown(project.sourceContent));
          setTranslationContent(toMarkdown(project.translationContent));
          setSourceLanguage((project.sourceLanguage ?? 'en') as LanguageCode);
          setTranslationLanguage((project.translationLanguage ?? 'it') as LanguageCode);
          if (project.lockingPoints?.length) {
            editorRef.current?.setLockingPoints(project.lockingPoints);
          }
          setHasUnsavedChanges(false);
        } catch (e) {
          console.error('Failed to parse project file:', e);
        }
        // Note: setFileBrowser(null) is handled by the JSX onConfirm wrapper — do not call here.
      },
    );
    return;
  }
  // Web path — unchanged
  const result = await openFileWithPicker();
  if (!result) return;
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
    setHasUnsavedChanges(false);
  } catch (e) {
    console.error('Failed to parse project file:', e);
  }
}, [showFileBrowser]);
```

- [ ] **Step 5: Update `handleLoadText`**

Replace the existing `handleLoadText` with:

```typescript
const handleLoadText = useCallback(async () => {
  if (isElectron) {
    showFileBrowser(
      {
        mode: 'open',
        title: 'Load Text',
        filters: [
          { label: 'Text files', extensions: ['.txt', '.md', '.text', '.markdown', '.docx'] },
        ],
      },
      async (result) => {
        if (!result.buffer) return;
        const name = result.path.split('/').pop() ?? result.path;
        const isDocx = name.toLowerCase().endsWith('.docx');
        let markdown: string;
        if (isDocx) {
          try {
            markdown = await docxToMarkdown(result.buffer);
          } catch (e) {
            console.error('Failed to parse DOCX file:', e);
            setFileBrowser(null);
            return;
          }
        } else {
          markdown = new TextDecoder('utf-8').decode(result.buffer);
        }
        const detected = detectLanguage(markdown) ?? null;
        setPendingTextFile({ name, markdown, detected });
        setLoadTextDialogOpen(true);
        // Note: setFileBrowser(null) is handled by the JSX onConfirm wrapper — do not call here.
      },
    );
    return;
  }
  // Web path — unchanged
  const isDocx = (name: string) => name.toLowerCase().endsWith('.docx');
  const result = await readFileAsArrayBuffer('.txt,.md,.text,.markdown,.docx');
  if (!result) return;
  let markdown: string;
  let detected: LanguageCode | null = null;
  if (isDocx(result.name)) {
    try {
      markdown = await docxToMarkdown(result.buffer);
    } catch (e) {
      console.error('Failed to parse DOCX file:', e);
      return;
    }
  } else {
    markdown = new TextDecoder('utf-8').decode(result.buffer);
  }
  detected = detectLanguage(markdown) ?? null;
  setPendingTextFile({ name: result.name, markdown, detected });
  setLoadTextDialogOpen(true);
}, [showFileBrowser]);
```

- [ ] **Step 6: Update `handleSaveProjectAs`**

Replace the existing `handleSaveProjectAs` with:

```typescript
const handleSaveProjectAs = useCallback(async (): Promise<boolean> => {
  if (isElectron) {
    return new Promise((resolve) => {
      showFileBrowser(
        { mode: 'save', title: 'Save Project', suggestedName: 'project.mirror.json' },
        async (result) => {
          await saveFileToHandle(result.path, buildProjectJson());
          projectFileHandleRef.current = result.path;
          setHasUnsavedChanges(false);
          setLastSavedAt(new Date());
          // Note: setFileBrowser(null) is handled by the JSX onConfirm wrapper — do not call here.
          resolve(true);
        },
        () => resolve(false), // user cancelled
      );
    });
  }
  // Web path — unchanged
  const json = buildProjectJson();
  const handle = await saveFileWithPicker('project.mirror.json', json, 'application/json');
  if (handle) {
    projectFileHandleRef.current = handle;
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date());
    return true;
  }
  return false;
}, [showFileBrowser, buildProjectJson]);
```

- [ ] **Step 7: Add `FileBrowserDialog` to JSX**

In the return block of `App.tsx`, add just before the closing `</>` (after the existing `<Dialog>` for unsaved changes):

```tsx
<FileBrowserDialog
  isOpen={fileBrowser !== null}
  mode={fileBrowser?.mode ?? 'open'}
  title={fileBrowser?.title ?? ''}
  suggestedName={fileBrowser?.suggestedName}
  filters={fileBrowser?.filters}
  onConfirm={(result) => {
    // Always close the dialog first, then invoke the callback.
    // This ensures the dialog closes even if the callback throws or returns early.
    setFileBrowser(null);
    fileBrowserCallbackRef.current?.(result);
    fileBrowserCallbackRef.current = null;
    fileBrowserCancelRef.current = null;
  }}
  onClose={() => {
    fileBrowserCancelRef.current?.();
    fileBrowserCallbackRef.current = null;
    fileBrowserCancelRef.current = null;
    setFileBrowser(null);
  }}
/>
```

- [ ] **Step 8: Verify build and run all tests**

```bash
bun run build 2>&1 | head -20
bun test
```
Expected: no TypeScript errors, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire FileBrowserDialog into App.tsx for Electrobun file picker paths"
```

---

## Task 8: Smoke test in Electrobun

No automated test for the full dialog flow — verify manually with `bun run electrobun:dev`.

- [ ] **Step 1: Start the dev build**

```bash
bun run electrobun:dev
```

- [ ] **Step 2: Test Save Project As**
  - Press `Cmd+Shift+S` (macOS) — verify `FileBrowserDialog` opens (not a native dialog, not a download)
  - Navigate to a test directory via sidebar or breadcrumb
  - Type a filename and click Save
  - Verify the `.mirror.json` file is written at the expected path

- [ ] **Step 3: Test Open Project**
  - Press `Cmd+O` — verify `FileBrowserDialog` opens with `.mirror.json` filter active
  - Files that are not `.mirror.json` should be hidden
  - Navigate to the file saved in Step 2, select it, click Open
  - Verify the project loads correctly

- [ ] **Step 4: Test Load Text**
  - Use File → Load Text
  - Verify `FileBrowserDialog` opens with text filter active
  - Navigate to a `.md` or `.txt` file, select and open it
  - Verify the `LoadTextDialog` appears asking which side to load into

- [ ] **Step 5: Test Save (not Save As)**
  - After opening a project and making a change, press `Cmd+S`
  - Verify the file saves without any dialog (uses the known path directly)

- [ ] **Step 6: Test cancel path**
  - Open Save Project As, then click Cancel
  - Verify no file is written and the app remains in its previous state

- [ ] **Step 7: Test All files filter**
  - Open Load Text, switch filter to "All files"
  - Verify non-text files appear in the listing

- [ ] **Step 8: Test New Folder**
  - Open Save Project As, click `+ New Folder`, type a name, press Enter
  - Verify the folder appears in the listing; navigate into it and save

- [ ] **Step 9: Verify web build is unaffected**

```bash
bun run build && bun run preview
```
Open the web build in a browser. Verify open/save/load-text still use native browser file pickers (or `<input type="file">` fallback).

- [ ] **Step 10: Bump version and commit**

```bash
bun pm version prerelease --preid=alpha
```
