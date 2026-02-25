# Context Menu Design

**Date:** 2026-02-25

## Goal

Replace the browser's default context menu in both editor panes with a custom one. Provides Cut, Copy, Paste, and Select All initially; designed to host future actions (Wiktionary lookup, Ollama translation) without structural changes.

---

## Interaction Model

Two independent inputs are derived on every right-click:

- **Word under cursor** — always computed silently via `posAtCoords` + word boundary scan; never mutates editor selection state; `null` if cursor is on whitespace or punctuation
- **Current selection** — included only if the right-click position falls within the existing `selection.from…selection.to` range; `null` otherwise

Both inputs are available to every menu action. Future actions (Wiktionary, Ollama) will consume them independently.

---

## Architecture

`EditorPane` handles the raw `contextmenu` DOM event:
1. Calls `e.preventDefault()` to suppress the browser default
2. Computes word under cursor via `editor.view.posAtCoords` + `$pos` textContent scan
3. Determines selection context (click within selection or not)
4. Fires a new `onEditorContextMenu` prop with the full context

`TranslationEditor` holds `contextMenuState` and renders the menu UI. This keeps `EditorPane` thin and allows future actions (which need parent-level state like API clients) to be wired in one place.

---

## Context Event Shape

```ts
interface EditorContextMenuEvent {
  x: number;                   // viewport coords for menu placement
  y: number;
  side: 'source' | 'translation';
  editable: boolean;
  word: string | null;         // word under cursor; null on whitespace/punctuation
  wordFrom: number;            // ProseMirror doc position of word start
  wordTo: number;              // ProseMirror doc position of word end
  selection: { text: string; from: number; to: number } | null;
}
```

---

## Word Detection

On `contextmenu`:
1. `editor.view.posAtCoords({ left: e.clientX, top: e.clientY })` → `clickPos`
2. `$pos = editor.state.doc.resolve(clickPos)`
3. Scan `$pos.parent.textContent` left/right from `$pos.parentOffset` stopping at `/\W/`
4. Word positions: `from = $pos.start() + scanStart`, `to = $pos.start() + scanEnd`
5. Return `null` if `scanStart === scanEnd` (whitespace/punctuation click)

Selection included only if `clickPos >= editor.state.selection.from && clickPos <= editor.state.selection.to`.

---

## Menu Rendering

A `position: fixed` zero-size `<div>` at `{x, y}` containing a BlueprintJS `<Popover isOpen minimal placement="bottom-start" onClose={...}>` wrapping a `<Menu>`. Rendered inside `TranslationEditor`'s JSX, outside both pane DOMs to avoid z-index/overflow issues. Popover provides outside-click and Escape dismissal via `onClose`.

---

## Initial Menu Items

| Item | Enabled when | Action |
|------|-------------|--------|
| Cut | selection exists AND pane is editable | `navigator.clipboard.writeText(selection.text)` + `editor.commands.deleteSelection()` |
| Copy | selection exists | `navigator.clipboard.writeText(selection.text)` |
| Paste | pane is editable | `navigator.clipboard.readText()` → `editor.commands.insertContent(text)` |
| Select All | always | `editor.commands.selectAll()` |

No dividers for four items. Disabled items are rendered greyed-out (BlueprintJS `disabled` prop on `MenuItem`), not hidden.

---

## Pane Awareness

Both panes get the context menu. Actions that require editability (Cut, Paste) are disabled when `editable` is false (source pane in read-only mode). This follows the "symmetric but aware" principle — same structure in both panes, capability gated by editability.

---

## Future Extension Points

The `EditorContextMenuEvent` already carries `word`, `wordFrom/To`, and `selection` — the inputs needed by Wiktionary and Ollama. Adding those actions requires only new `<MenuItem>` entries in `TranslationEditor`'s menu render and the corresponding handler callbacks. No structural changes needed.
