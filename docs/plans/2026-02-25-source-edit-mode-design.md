# Source Edit Mode — Design

**Date:** 2026-02-25

## Goal

Make the source pane optionally editable. Off by default. A toggle button in the source pane header activates edit mode. When edit mode is turned off, language auto-detection runs on the current source content and updates the source language if a confident result is returned.

---

## Approach

`sourceEditMode` boolean state lives in `TranslationEditorInner`. All logic is local to that component; no new state in `App.tsx` beyond wiring the `onSourceChange` callback.

---

## Component Changes

### `EditorPane`

- Add a `useEffect` that calls `editor.setEditable(editable)` whenever the `editable` prop changes (Tiptap's runtime API).
- Add `editor-pane--readonly` CSS class to the root div when `editable === false`. Remove the hardcoded `.editor-pane--source` cursor rule and replace with `.editor-pane--readonly .ProseMirror { cursor: default }`.

### `TranslationEditor`

- Add optional `onSourceChange?: (content: string) => void` to `TranslationEditorProps`.
- Add `sourceEditMode` boolean state (initial value: `false`).
- Add a `toggleSourceEditMode` handler:
  - Flips `sourceEditMode`.
  - When turning **off**: runs `detectLanguage(htmlToMarkdown(sourceContent))` → calls `onSourceLanguageChange(detected)` if a language code is returned.
- `sourceHeaderAction` gains a BlueprintJS `<Button minimal small icon="edit" active={sourceEditMode} onClick={toggleSourceEditMode} />` to the left of the existing language `<HTMLSelect>`.
- Source `EditorPane` receives `editable={sourceEditMode}` and `onChange={onSourceChange}`.

### `App.tsx`

- Add `onSourceChange={setSourceContent}` to `<TranslationEditor>`.

---

## Visual / UX

- Button uses `active` prop for the "dented in" pressed appearance (standard BlueprintJS).
- Layout in source header: `Source` label → [flex spacer] → [edit button] [language selector].
- No visual difference to the pane body while in edit mode — it simply becomes editable.
- `cursor: default` removed from edit mode via CSS class rather than inline style.

---

## Detection Behaviour

- Fires only when edit mode is toggled **off** (never on keypress or blur).
- Uses `detectLanguage(htmlToMarkdown(sourceContent))` — same pipeline used on file load.
- If `null` is returned (too little text or ambiguous), the language selector is left unchanged.
