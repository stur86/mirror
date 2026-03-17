# Editor Toolbar Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

Add a formatting toolbar to each editor pane in the translation editor. The toolbar provides: a paragraph style dropdown (Normal, H1–H5) and buttons for Bold, Italic, Bullet List, and Numbered List.

## Scope

- Toolbar appears **always** on the translation pane
- Toolbar appears on the source pane **only when the source pane is in edit mode**
- Toolbar is placed in the existing pane header row alongside the existing controls

## Heading Levels

The style dropdown offers Normal and H1–H5 (not H6). `useEditorSetup` will restrict StarterKit heading levels:

```ts
StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5] } })
```

H6 is not supported by the toolbar. Existing documents with H6 content will have those headings converted to paragraphs on load (ProseMirror cannot parse heading levels not present in the schema). This is an accepted trade-off. No existing unit tests exercise H6, so `useEditorSetup.test.ts` is unaffected.

## Component: `EditorToolbar`

A decoupled component that accepts `editor: Editor | null` and operates on whichever editor instance is passed. Switching to a shared toolbar later requires no changes to this component.

**File:** `src/components/editor/EditorToolbar.tsx`

Not re-exported from `src/components/index.ts` (consistent with `EditorPane`, `TranslationEditor`, `RulerBar`). Imports `Button` and `HTMLSelect` from the abstraction layer (`import { Button, HTMLSelect } from '../index'`).

**Props:**
```ts
interface EditorToolbarProps {
  editor: Editor | null;
}
```

**Controls:**
- `HTMLSelect` — paragraph style: Normal, Heading 1–5
- `Button` — Bold (icon: `bold`)
- `Button` — Italic (icon: `italic`)
- `Button` — Bullet List (icon: `unordered-list`)
- `Button` — Numbered List (icon: `numbered-list`)

All controls are disabled when `editor` is null. Buttons use `minimal` and `small` props. Active state uses the BlueprintJS `active` prop.

**Active state detection:**

Use `useEditorState` (Tiptap v3) to derive active state with a selector. This runs deep equality on the result and only re-renders the toolbar when the derived values actually change — avoiding a re-render on every transaction (cursor moves, internal undo states, etc.):

```ts
import { useEditorState } from '@tiptap/react';

function getStyleValue(editor: Editor): string {
  for (let level = 1; level <= 5; level++) {
    if (editor.isActive('heading', { level })) return `h${level}`;
  }
  return 'p';
}

const state = useEditorState({
  editor,
  selector: ({ editor: e }) => ({
    isBold: e.isActive('bold'),
    isItalic: e.isActive('italic'),
    isBulletList: e.isActive('bulletList'),
    isOrderedList: e.isActive('orderedList'),
    styleValue: getStyleValue(e),
  }),
});
// Tiptap v3 guarantees the selector is not invoked when editor is null — it short-circuits and
// returns null instead. state === null when editor is null → disable all controls.
```

HTMLSelect options:
```ts
[
  { value: 'p',  label: t('editor.toolbar.styleNormal') },
  { value: 'h1', label: t('editor.toolbar.styleHeading', { level: 1 }) },
  { value: 'h2', label: t('editor.toolbar.styleHeading', { level: 2 }) },
  { value: 'h3', label: t('editor.toolbar.styleHeading', { level: 3 }) },
  { value: 'h4', label: t('editor.toolbar.styleHeading', { level: 4 }) },
  { value: 'h5', label: t('editor.toolbar.styleHeading', { level: 5 }) },
]
```

**Command dispatch:**
- `editor.chain().focus().toggleBold().run()`
- `editor.chain().focus().toggleItalic().run()`
- `editor.chain().focus().toggleBulletList().run()`
- `editor.chain().focus().toggleOrderedList().run()`
- `editor.chain().focus().toggleHeading({ level: N }).run()` for H1–H5
- `editor.chain().focus().setParagraph().run()` for Normal

## Changes to `EditorPane`

Add `onEditorReady?: (editor: Editor | null) => void` to `EditorPaneProps`:

```ts
export interface EditorPaneProps {
  side: 'source' | 'translation';
  content: string;
  editable?: boolean;
  onChange?: (content: string) => void;
  onContentChange?: () => void;
  headerAction?: React.ReactNode;
  lang?: string;
  muteRanges?: MuteRanges | null;
  onEditorContextMenu?: (event: EditorContextMenuEvent) => void;
  onEditorReady?: (editor: Editor | null) => void;   // NEW
}
```

Call it via a ref-based pattern to avoid stale closure issues while keeping `editor` as the sole dependency:

```ts
const onEditorReadyRef = useRef(onEditorReady);
onEditorReadyRef.current = onEditorReady;

useEffect(() => {
  if (!editor) return;
  const cb = onEditorReadyRef.current;  // capture at setup time
  cb?.(editor);
  return () => cb?.(null);
}, [editor]);
```

Capturing `cb` at setup time ensures the cleanup notifies the same handler that received the editor. In practice, `onSourceEditorReady` and `onTranslationEditorReady` are stable `useCallback` references that never change, so the distinction is moot — but the pattern is correct.

## Changes to `TranslationEditor`

Add state and stable callbacks:

```ts
const [sourceEditor, setSourceEditor] = useState<Editor | null>(null);
const [translationEditor, setTranslationEditor] = useState<Editor | null>(null);
const onSourceEditorReady = useCallback((e: Editor | null) => setSourceEditor(e), []);
const onTranslationEditorReady = useCallback((e: Editor | null) => setTranslationEditor(e), []);
```

Compose `headerAction` for each pane. A `<span className="editor-toolbar__sep" />` provides the visual separator between toolbar and language selector (avoids `Divider` which renders as a horizontal `<hr>` and requires extra CSS to function as a vertical separator in a flex row):

**Source pane:**
```tsx
const sourceHeaderAction = (
  <>
    <Button minimal small icon="edit" active={sourceEditMode}
      onClick={toggleSourceEditMode} title={t('editor.editSource')} />
    {sourceEditMode && <EditorToolbar editor={sourceEditor} />}
    <span className="editor-toolbar__sep" />
    <HTMLSelect minimal options={languageOptions} value={sourceLanguage}
      onChange={(e) => onSourceLanguageChange(e.target.value as LanguageCode)}
      title={t('editor.sourceLanguage')} />
  </>
);
```

**Translation pane:**
```tsx
const translationHeaderAction = (
  <>
    <EditorToolbar editor={translationEditor} />
    <span className="editor-toolbar__sep" />
    <HTMLSelect minimal options={languageOptions} value={translationLanguage}
      onChange={(e) => onTranslationLanguageChange(e.target.value as LanguageCode)}
      title={t('editor.translationLanguage')} />
  </>
);
```

Pass `onEditorReady` to each pane:
```tsx
<EditorPane ... onEditorReady={onSourceEditorReady} />
<EditorPane ... onEditorReady={onTranslationEditorReady} />
```

## Styling

Add `.editor-toolbar__sep` to `EditorPane.css` (or a new `EditorToolbar.css`):

```css
.editor-toolbar__sep {
  display: inline-block;
  width: 1px;
  height: 16px;
  background: var(--pane-border-color);
  margin: 0 4px;
  align-self: center;
}
```

If the header is cramped, update `height: 36px` on `.editor-pane__header` in `EditorPane.css`.

## i18n

Add to `src/locales/en.yaml` under `editor.toolbar`:

```yaml
editor:
  toolbar:
    style: "Paragraph style"              # aria-label on the HTMLSelect
    styleNormal: "Normal"
    styleHeading: "Heading {{level}}"     # t('editor.toolbar.styleHeading', { level: n })
    bold: "Bold"                          # title + aria-label on button
    italic: "Italic"
    bulletList: "Bullet list"
    orderedList: "Numbered list"
```

## Testing

- No new unit tests for `EditorToolbar` (wraps Tiptap commands with no independent logic)
- Existing unit tests for `useEditorSetup` and `docxConvert` remain unaffected
