# Editor Toolbar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a formatting toolbar (paragraph style dropdown + Bold/Italic/BulletList/OrderedList buttons) to each editor pane header.

**Architecture:** A standalone `EditorToolbar` component accepts an `Editor | null` prop and operates on whichever editor is passed to it. `EditorPane` grows an `onEditorReady` callback to expose its editor instance upward. `TranslationEditor` captures both editor instances and passes them to toolbar instances embedded in each pane's `headerAction` slot. The toolbar always shows on the translation pane; on the source pane it only shows when the source is in edit mode.

**Tech Stack:** React 19, Tiptap v3 (`@tiptap/react`), BlueprintJS 6 (via `src/components/index.ts`), i18next, TypeScript

---

## Chunk 1: Heading level restriction + i18n keys

### Task 1: Restrict StarterKit heading levels to 1–5

**Files:**
- Modify: `src/hooks/useEditorSetup.ts`

Background: Tiptap's `StarterKit` includes heading levels 1–6 by default. The toolbar only supports H1–H5. Restricting the schema to H1–H5 means H6 content in existing documents will be converted to paragraphs on load — this is an accepted trade-off per the spec.

- [ ] **Step 1: Open `src/hooks/useEditorSetup.ts` and find the `StarterKit` entry inside the `extensions` array (currently just `StarterKit` with no configuration, around line 67)**

- [ ] **Step 2: Replace the bare `StarterKit` with a configured version**

Change:
```ts
StarterKit,
```
To:
```ts
StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5] } }),
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
bun test src/hooks/useEditorSetup.test.ts
```

Expected: all tests pass (they test regex patterns, not heading levels).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useEditorSetup.ts
git commit -m "feat: restrict editor headings to H1–H5"
```

---

### Task 2: Add toolbar i18n keys

**Files:**
- Modify: `src/locales/en.yaml`

- [ ] **Step 1: Open `src/locales/en.yaml` and append under the existing `editor:` block (after the `contextMenu:` section, currently ending around line 82)**

Add:
```yaml
  toolbar:
    style: "Paragraph style"
    styleNormal: "Normal"
    styleHeading: "Heading {{level}}"
    bold: "Bold"
    italic: "Italic"
    bulletList: "Bullet list"
    orderedList: "Numbered list"
```

Note: `styleHeading` is called as `t('editor.toolbar.styleHeading', { level: n })` for n = 1..5.

- [ ] **Step 2: Commit**

```bash
git add src/locales/en.yaml
git commit -m "feat: add editor toolbar i18n keys"
```

---

## Chunk 2: Expose editor instance from EditorPane

### Task 3: Add `onEditorReady` prop to `EditorPane`

**Files:**
- Modify: `src/components/editor/EditorPane.tsx`

Background: `EditorPane` creates the Tiptap `Editor` internally via `useEditorSetup`. `TranslationEditor` needs that instance to pass to `EditorToolbar`. The `onEditorReady` callback fires once when the editor becomes available, and fires `null` on cleanup/unmount. A ref-based pattern avoids stale closures while keeping only `editor` in the `useEffect` dependency array.

- [ ] **Step 1: Add `onEditorReady` to the `EditorPaneProps` interface**

In `src/components/editor/EditorPane.tsx`, find the `EditorPaneProps` interface (lines 14–24) and add the new prop:

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
  onEditorReady?: (editor: Editor | null) => void;  // NEW
}
```

- [ ] **Step 2: Destructure the new prop in the component function signature**

Find line 73:
```ts
{ side, content, editable = true, onChange, onContentChange, headerAction, lang, muteRanges, onEditorContextMenu },
```

Change to:
```ts
{ side, content, editable = true, onChange, onContentChange, headerAction, lang, muteRanges, onEditorContextMenu, onEditorReady },
```

- [ ] **Step 3: Add the ref-based notification effect**

Add this `useRef` and `useEffect` block after the existing `useEffect` for `editable` sync (around line 116). The ref holds the latest callback; the captured `cb` ensures the same handler that was notified with the editor is also notified with `null` on cleanup:

```ts
const onEditorReadyRef = useRef(onEditorReady);
onEditorReadyRef.current = onEditorReady;

useEffect(() => {
  if (!editor) return;
  const cb = onEditorReadyRef.current;
  cb?.(editor);
  return () => cb?.(null);
}, [editor]);
```

`useRef` is already imported at line 1. No new imports needed.

- [ ] **Step 4: Manually verify the app still starts**

```bash
bun run dev
```

Open the app. Both panes should render and function normally. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/EditorPane.tsx
git commit -m "feat: expose editor instance via onEditorReady callback"
```

---

## Chunk 3: EditorToolbar component

### Task 4: Create the `EditorToolbar` component

**Files:**
- Create: `src/components/editor/EditorToolbar.tsx`

Background: `EditorToolbar` is self-contained — it receives an `editor: Editor | null` prop, reads active state via Tiptap's `useEditorState` hook (which does deep equality checking and only re-renders when derived values change), and dispatches commands directly to the editor. No unit tests are needed because the component only wraps Tiptap commands with no independent logic.

- [ ] **Step 1: Create `src/components/editor/EditorToolbar.tsx` with the following content**

```tsx
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Button, HTMLSelect } from '../index';

interface EditorToolbarProps {
  editor: Editor | null;
}

const STYLE_OPTIONS_BASE = [1, 2, 3, 4, 5] as const;

function getStyleValue(editor: Editor): string {
  for (const level of STYLE_OPTIONS_BASE) {
    if (editor.isActive('heading', { level })) return `h${level}`;
  }
  return 'p';
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { t } = useTranslation();

  // useEditorState runs a selector and only re-renders when the derived values change.
  // It returns null when editor is null (selector is not invoked in that case).
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

  const disabled = !editor || !state;

  const styleOptions = [
    { value: 'p', label: t('editor.toolbar.styleNormal') },
    ...STYLE_OPTIONS_BASE.map((level) => ({
      value: `h${level}`,
      label: t('editor.toolbar.styleHeading', { level }),
    })),
  ];

  function handleStyleChange(value: string) {
    if (!editor) return;
    if (value === 'p') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value[1]!, 10) as 1 | 2 | 3 | 4 | 5;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  }

  return (
    <div className="editor-toolbar">
      <HTMLSelect
        minimal
        small
        disabled={disabled}
        value={state?.styleValue ?? 'p'}
        options={styleOptions}
        onChange={(e) => handleStyleChange(e.target.value)}
        aria-label={t('editor.toolbar.style')}
      />
      <Button
        minimal
        small
        icon="bold"
        disabled={disabled}
        active={state?.isBold ?? false}
        title={t('editor.toolbar.bold')}
        aria-label={t('editor.toolbar.bold')}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <Button
        minimal
        small
        icon="italic"
        disabled={disabled}
        active={state?.isItalic ?? false}
        title={t('editor.toolbar.italic')}
        aria-label={t('editor.toolbar.italic')}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <Button
        minimal
        small
        icon="unordered-list"
        disabled={disabled}
        active={state?.isBulletList ?? false}
        title={t('editor.toolbar.bulletList')}
        aria-label={t('editor.toolbar.bulletList')}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <Button
        minimal
        small
        icon="numbered-list"
        disabled={disabled}
        active={state?.isOrderedList ?? false}
        title={t('editor.toolbar.orderedList')}
        aria-label={t('editor.toolbar.orderedList')}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
bun run build 2>&1 | head -30
```

Expected: build succeeds with no TypeScript errors. (The component is not yet used anywhere, so it won't appear in the UI yet.)

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/EditorToolbar.tsx
git commit -m "feat: add EditorToolbar component"
```

---

## Chunk 4: Wire up toolbar in TranslationEditor + CSS

### Task 5: Integrate toolbar into TranslationEditor

**Files:**
- Modify: `src/components/editor/TranslationEditor.tsx`
- Modify: `src/components/editor/EditorPane.css`

- [ ] **Step 1: Add the import for `EditorToolbar` at the top of `TranslationEditor.tsx`**

After line 8 (`import { RulerBar } from './RulerBar';`), add:

```ts
import { EditorToolbar } from './EditorToolbar';
```

Also add `Editor` to the existing tiptap type import. Find line 1 which currently does not import from `@tiptap/react`. Add a new import:

```ts
import type { Editor } from '@tiptap/react';
```

(Add this near the top, after the React imports.)

- [ ] **Step 2: Add editor state and stable callbacks inside `TranslationEditorInner`**

After the existing `const [contextMenu, ...]` state declaration (around line 50), add:

```ts
const [sourceEditor, setSourceEditor] = useState<Editor | null>(null);
const [translationEditor, setTranslationEditor] = useState<Editor | null>(null);
const onSourceEditorReady = useCallback((e: Editor | null) => setSourceEditor(e), []);
const onTranslationEditorReady = useCallback((e: Editor | null) => setTranslationEditor(e), []);
```

`useState` and `useCallback` are already imported at line 1.

- [ ] **Step 3: Update `sourceHeaderAction` to include the toolbar**

Find the `sourceHeaderAction` JSX block (lines 143–161):

```tsx
const sourceHeaderAction = (
  <>
    <Button
      minimal
      small
      icon="edit"
      active={sourceEditMode}
      onClick={toggleSourceEditMode}
      title={t('editor.editSource')}
    />
    <HTMLSelect
      minimal
      options={languageOptions}
      value={sourceLanguage}
      onChange={(e) => onSourceLanguageChange(e.target.value as LanguageCode)}
      title={t('editor.sourceLanguage')}
    />
  </>
);
```

Replace with:

```tsx
const sourceHeaderAction = (
  <>
    <Button
      minimal
      small
      icon="edit"
      active={sourceEditMode}
      onClick={toggleSourceEditMode}
      title={t('editor.editSource')}
    />
    {sourceEditMode && <EditorToolbar editor={sourceEditor} />}
    <span className="editor-toolbar__sep" />
    <HTMLSelect
      minimal
      options={languageOptions}
      value={sourceLanguage}
      onChange={(e) => onSourceLanguageChange(e.target.value as LanguageCode)}
      title={t('editor.sourceLanguage')}
    />
  </>
);
```

- [ ] **Step 4: Update `translationHeaderAction` to include the toolbar**

Find the `translationHeaderAction` JSX block (lines 163–171):

```tsx
const translationHeaderAction = (
  <HTMLSelect
    minimal
    options={languageOptions}
    value={translationLanguage}
    onChange={(e) => onTranslationLanguageChange(e.target.value as LanguageCode)}
    title={t('editor.translationLanguage')}
  />
);
```

Replace with:

```tsx
const translationHeaderAction = (
  <>
    <EditorToolbar editor={translationEditor} />
    <span className="editor-toolbar__sep" />
    <HTMLSelect
      minimal
      options={languageOptions}
      value={translationLanguage}
      onChange={(e) => onTranslationLanguageChange(e.target.value as LanguageCode)}
      title={t('editor.translationLanguage')}
    />
  </>
);
```

- [ ] **Step 5: Pass `onEditorReady` to each `EditorPane`**

Find the source `EditorPane` (around line 176):

```tsx
<EditorPane
  ref={sourceRef}
  side="source"
  ...
/>
```

Add `onEditorReady={onSourceEditorReady}` to its props.

Find the translation `EditorPane` (around line 192):

```tsx
<EditorPane
  ref={translationRef}
  side="translation"
  ...
/>
```

Add `onEditorReady={onTranslationEditorReady}` to its props.

- [ ] **Step 6: Add the separator CSS to `EditorPane.css`**

Append to the end of `src/components/editor/EditorPane.css`:

```css
/* Toolbar separator — thin vertical line between toolbar and language selector */
.editor-toolbar__sep {
  display: inline-block;
  width: 1px;
  height: 16px;
  background: var(--pane-border-color);
  margin: 0 4px;
  align-self: center;
  flex-shrink: 0;
}
```

Also add a flex layout rule for `.editor-toolbar` so its buttons sit in a row:

```css
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 0;
}
```

- [ ] **Step 7: Manually test the full feature**

```bash
bun run dev
```

Verify:
1. Translation pane header shows: `[StyleDropdown] [Bold] [Italic] [BulletList] [OrderedList] | [LanguageSelect]`
2. Source pane header shows only: `[EditIcon] | [LanguageSelect]` when read-only
3. Click the edit icon on the source pane → toolbar appears: `[EditIcon] [StyleDropdown] [Bold] [Italic] [BulletList] [OrderedList] | [LanguageSelect]`
4. In the translation editor, type some text, select it, click Bold → text becomes **bold**, Bold button shows as active
5. Click Bold again → text becomes normal, Bold button deactivates
6. Place cursor in a heading → style dropdown shows correct heading level (H1, H2, etc.)
7. Change style dropdown to "Normal" → heading becomes a paragraph
8. Click Bullet List button → list is created; click again → list is removed
9. Toggle source edit mode off and on — toolbar appears/disappears correctly

- [ ] **Step 8: Commit**

```bash
git add src/components/editor/TranslationEditor.tsx src/components/editor/EditorPane.css
git commit -m "feat: wire EditorToolbar into pane headers"
```

---

### Task 6: Version bump

- [ ] **Step 1: Bump the prerelease version**

```bash
bun pm version prerelease --preid=alpha
```

- [ ] **Step 2: Commit the version bump**

```bash
git add package.json
git commit -m "chore: bump version"
```
