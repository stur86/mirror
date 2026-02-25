# Context Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the browser's default context menu in both editor panes with a custom one offering Cut, Copy, Paste, and Select All.

**Architecture:** `EditorPane` handles the `contextmenu` DOM event — detecting the word under cursor and active selection, building bound editor-action callbacks, and firing them upward via a new `onEditorContextMenu` prop. `TranslationEditor` holds `contextMenuState` and renders a BlueprintJS `Popover` + `Menu` fixed at the click coordinates.

**Tech Stack:** React 19, TypeScript, Tiptap/ProseMirror (`posAtCoords`, `state.selection`, editor commands), BlueprintJS 6 (`Popover`, `Menu`, `MenuItem` — already in `src/components/index.ts`).

---

## Context

Key files:
- `src/components/editor/EditorPane.tsx` — add event type, word detection, handler
- `src/components/editor/TranslationEditor.tsx` — add state, Popover + Menu rendering
- `src/components/index.ts` — `Popover`, `Menu`, `MenuItem` already exported; no changes needed

No test infrastructure exists — verify with `bun run build` after each task.

---

## Task 1: Add `EditorContextMenuEvent` type and handler to `EditorPane`

**Files:**
- Modify: `src/components/editor/EditorPane.tsx`

### Step 1: Add `useCallback` to the React import

The current import is:
```ts
import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
```
Add `useCallback`:
```ts
import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback } from 'react';
```

### Step 2: Add the `EditorContextMenuEvent` interface

After the `EditorPaneHandle` interface (line 26), add:

```ts
export interface EditorContextMenuEvent {
  x: number;                   // viewport coords for menu placement
  y: number;
  side: 'source' | 'translation';
  editable: boolean;
  word: string | null;         // word under cursor; null on whitespace/punctuation
  wordFrom: number;            // ProseMirror doc position of word start
  wordTo: number;              // ProseMirror doc position of word end
  selection: { text: string; from: number; to: number } | null;
  actions: {
    cut: (() => void) | null;           // null if no selection or not editable
    copy: (() => void) | null;          // null if no selection
    paste: (() => Promise<void>) | null; // null if not editable
    selectAll: () => void;
  };
}
```

### Step 3: Add `onEditorContextMenu` to `EditorPaneProps`

In the `EditorPaneProps` interface, add after `muteRanges`:
```ts
  onEditorContextMenu?: (event: EditorContextMenuEvent) => void;
```

### Step 4: Add the `getWordAtPos` helper before the component

After the interfaces and before the `EditorPane` component, add this module-level function. It uses ProseMirror's resolved position to scan for word boundaries without mutating editor state:

```ts
import type { Editor } from '@tiptap/react';

function getWordAtPos(
  editor: Editor,
  clickPos: number,
): { text: string; from: number; to: number } | null {
  const $pos = editor.state.doc.resolve(clickPos);
  if (!$pos.parent.isTextblock) return null;

  const text = $pos.parent.textContent;
  const offset = $pos.parentOffset;

  // Walk backward to word start
  let start = offset;
  while (start > 0 && /\w/.test(text[start - 1]!)) start--;

  // Walk forward to word end
  let end = offset;
  while (end < text.length && /\w/.test(text[end]!)) end++;

  if (start === end) return null; // clicked on whitespace or punctuation

  const nodeStart = $pos.start();
  return { text: text.slice(start, end), from: nodeStart + start, to: nodeStart + end };
}
```

Note: `import type { Editor }` goes at the top of the file with the other imports.

### Step 5: Destructure `onEditorContextMenu` in the component

The current destructuring on line 30 is:
```ts
{ side, content, editable = true, onChange, onContentChange, headerAction, lang, muteRanges }
```
Add `onEditorContextMenu`:
```ts
{ side, content, editable = true, onChange, onContentChange, headerAction, lang, muteRanges, onEditorContextMenu }
```

### Step 6: Add the `handleContextMenu` callback

After the last `useEffect` (the `onContentChange` one) and before the `label` declaration, add:

```ts
    const handleContextMenu = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault(); // always suppress browser default

        if (!editor || !onEditorContextMenu) return;

        const clickResult = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
        const clickPos = clickResult?.pos ?? null;

        // Detect word under cursor without mutating selection
        const wordResult = clickPos !== null ? getWordAtPos(editor, clickPos) : null;

        // Include selection only if right-click landed inside it
        const sel = editor.state.selection;
        const clickInSelection =
          !sel.empty &&
          clickPos !== null &&
          clickPos >= sel.from &&
          clickPos <= sel.to;
        const selectionCtx = clickInSelection
          ? { text: editor.state.doc.textBetween(sel.from, sel.to), from: sel.from, to: sel.to }
          : null;

        const selText = selectionCtx?.text ?? null;

        onEditorContextMenu({
          x: e.clientX,
          y: e.clientY,
          side,
          editable,
          word: wordResult?.text ?? null,
          wordFrom: wordResult?.from ?? 0,
          wordTo: wordResult?.to ?? 0,
          selection: selectionCtx,
          actions: {
            cut: selText && editable
              ? () => {
                  void navigator.clipboard.writeText(selText);
                  editor.commands.deleteSelection();
                }
              : null,
            copy: selText
              ? () => { void navigator.clipboard.writeText(selText); }
              : null,
            paste: editable
              ? async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) editor.commands.insertContent(text);
                  } catch {
                    // Clipboard access denied — silently ignore
                  }
                }
              : null,
            selectAll: () => editor.commands.selectAll(),
          },
        });
      },
      [editor, side, editable, onEditorContextMenu],
    );
```

### Step 7: Wire `onContextMenu` to the content div

The current content div (line 99) is:
```tsx
        <div ref={containerRef} className="editor-pane__content" lang={lang}>
```
Add the handler:
```tsx
        <div ref={containerRef} className="editor-pane__content" lang={lang} onContextMenu={handleContextMenu}>
```

### Step 8: Verify build

```bash
cd /home/gan_hope326/Projects/mirror && bun run build 2>&1 | tail -5
```
Expected: `✓ built in ...` with no TypeScript errors.

### Step 9: Commit

```bash
git add src/components/editor/EditorPane.tsx
git commit -m "feat: add context menu event detection and word-under-cursor extraction to EditorPane"
```

---

## Task 2: Add context menu state and Popover rendering to `TranslationEditor`

**Files:**
- Modify: `src/components/editor/TranslationEditor.tsx`

### Step 1: Add new imports

Add `Popover`, `Menu`, `MenuItem` to the existing `'../index'` import line. Currently:
```ts
import { HTMLSelect, Button } from '../index';
```
Change to:
```ts
import { HTMLSelect, Button, Popover, Menu, MenuItem } from '../index';
```

Also import the new event type from `EditorPane`:
```ts
import { EditorPane, type EditorPaneHandle, type MuteRanges, type EditorContextMenuEvent } from './EditorPane';
```
(Replace the existing `EditorPane` import line.)

### Step 2: Add `contextMenu` state

After the `sourceEditMode` state declaration, add:

```ts
  const [contextMenu, setContextMenu] = useState<EditorContextMenuEvent | null>(null);
```

### Step 3: Add `handleEditorContextMenu` callback

After `toggleSourceEditMode`, add:

```ts
  const handleEditorContextMenu = useCallback((event: EditorContextMenuEvent) => {
    setContextMenu(event);
  }, []);
```

### Step 4: Wire `onEditorContextMenu` to both `EditorPane` instances

In the source `<EditorPane>`, add:
```tsx
          onEditorContextMenu={handleEditorContextMenu}
```

In the translation `<EditorPane>`, add:
```tsx
          onEditorContextMenu={handleEditorContextMenu}
```

### Step 5: Render the context menu Popover

At the bottom of the `return` statement, just before the closing `</div>` of `.translation-editor`, add:

```tsx
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            width: 0,
            height: 0,
          }}
        >
          <Popover
            isOpen
            minimal
            placement="bottom-start"
            onClose={() => setContextMenu(null)}
            content={
              <Menu>
                <MenuItem
                  text="Cut"
                  disabled={!contextMenu.actions.cut}
                  onClick={() => { contextMenu.actions.cut?.(); setContextMenu(null); }}
                />
                <MenuItem
                  text="Copy"
                  disabled={!contextMenu.actions.copy}
                  onClick={() => { contextMenu.actions.copy?.(); setContextMenu(null); }}
                />
                <MenuItem
                  text="Paste"
                  disabled={!contextMenu.actions.paste}
                  onClick={() => { void contextMenu.actions.paste?.(); setContextMenu(null); }}
                />
                <MenuItem
                  text="Select All"
                  onClick={() => { contextMenu.actions.selectAll(); setContextMenu(null); }}
                />
              </Menu>
            }
          >
            <span />
          </Popover>
        </div>
      )}
```

### Step 6: Verify build

```bash
cd /home/gan_hope326/Projects/mirror && bun run build 2>&1 | tail -5
```
Expected: `✓ built in ...` with no TypeScript errors.

### Step 7: Commit

```bash
git add src/components/editor/TranslationEditor.tsx
git commit -m "feat: add context menu with Cut, Copy, Paste, Select All to both editor panes"
```

---

## Manual Testing Checklist

Run `bun run dev` and verify:

**Basic suppression:**
- Right-click anywhere in either pane → browser default menu does NOT appear; custom menu appears

**Copy:**
- Select some text, right-click within selection → "Copy" enabled; click it → clipboard contains selected text
- Right-click with no selection → "Copy" disabled (greyed out)

**Cut:**
- Select text in translation pane, right-click within selection → "Cut" enabled; click it → text removed from editor, clipboard contains it
- Right-click in source pane (read-only) with selection → "Cut" disabled

**Paste:**
- With clipboard content, right-click in translation pane → "Paste" enabled; click it → clipboard text inserted
- Right-click in source pane (read-only) → "Paste" disabled

**Select All:**
- Right-click anywhere in either pane → "Select All" always enabled; click it → all text in that pane selected

**Dismiss:**
- Open menu, click outside → menu closes
- Open menu, press Escape → menu closes
- Open menu, click a menu item → menu closes after action

**Word detection (for future use):**
- Right-click on a word in the middle of a paragraph → `EditorContextMenuEvent.word` is that word (verify via console.log temporarily if desired)
- Right-click on whitespace → `word` is null
