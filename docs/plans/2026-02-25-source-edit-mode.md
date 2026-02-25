# Source Edit Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional edit mode to the source pane, toggled by a header button; turning off edit mode auto-detects and updates the source language.

**Architecture:** `sourceEditMode` boolean state lives in `TranslationEditorInner`. A new `onSourceChange` prop threads source content changes up to `App.tsx`. `EditorPane` gains a reactive `editable` effect and a `editor-pane--readonly` CSS class. Language detection fires only when edit mode is toggled off.

**Tech Stack:** React 19, TypeScript, Tiptap (ProseMirror), BlueprintJS 6, franc (language detection).

---

## Context

Key files:
- `src/components/editor/EditorPane.tsx` — single pane; `editable` prop currently hardcoded-false for source
- `src/components/editor/EditorPane.css` — has `.editor-pane--source .ProseMirror { cursor: default }` rule to change
- `src/components/editor/TranslationEditor.tsx` — dual-pane wrapper; holds `sourceHeaderAction`
- `src/App.tsx` — holds `sourceContent` state and all language/content state

No test infrastructure exists in this project — skip TDD; verify with `bun run build` after each task.

---

## Task 1: Make `EditorPane` reactively editable + add readonly CSS class

**Files:**
- Modify: `src/components/editor/EditorPane.tsx`
- Modify: `src/components/editor/EditorPane.css`

### Step 1: Add reactive `editable` effect in `EditorPane.tsx`

After the existing `useEffect` for `lang` (around line 60-66), add:

```ts
// Sync editable prop → tiptap editor at runtime
useEffect(() => {
  if (editor) {
    editor.setEditable(editable ?? true);
  }
}, [editor, editable]);
```

### Step 2: Add `editor-pane--readonly` class to root div

Change the root `<div>` className from:
```tsx
<div className={`editor-pane editor-pane--${side}`}>
```
to:
```tsx
<div className={`editor-pane editor-pane--${side}${!editable ? ' editor-pane--readonly' : ''}`}>
```

### Step 3: Update the CSS cursor rule

In `EditorPane.css`, replace the last block:
```css
/* Source pane (read-only) styling */
.editor-pane--source .editor-pane__content .ProseMirror {
  cursor: default;
}
```
with:
```css
/* Read-only pane styling */
.editor-pane--readonly .editor-pane__content .ProseMirror {
  cursor: default;
}
```

### Step 4: Verify build

```bash
cd /home/gan_hope326/Projects/mirror && bun run build 2>&1 | tail -5
```
Expected: `✓ built in ...` with no TypeScript errors.

### Step 5: Commit

```bash
git add src/components/editor/EditorPane.tsx src/components/editor/EditorPane.css
git commit -m "feat: make EditorPane reactively editable with readonly CSS class"
```

---

## Task 2: Add `sourceEditMode` state, toggle button, and detection to `TranslationEditor`

**Files:**
- Modify: `src/components/editor/TranslationEditor.tsx`

### Step 1: Add imports

At the top of `TranslationEditor.tsx`, add to the existing imports:

```ts
import { Button } from '../index';                               // add Button to the HTMLSelect import line
import { htmlToMarkdown } from '../../utils/markdownConvert';
import { detectLanguage } from '../../utils/detectLanguage';
```

The `HTMLSelect` import line currently is:
```ts
import { HTMLSelect } from '../index';
```
Replace it with:
```ts
import { HTMLSelect, Button } from '../index';
```

### Step 2: Add `onSourceChange` to `TranslationEditorProps` interface

In the `TranslationEditorProps` interface, add:

```ts
  onSourceChange?: (content: string) => void;
```

(Add it after `onTranslationChange`.)

### Step 3: Destructure `onSourceChange` in `TranslationEditorInner`

In the function signature destructuring of `TranslationEditorInner`, add `onSourceChange`:

```ts
function TranslationEditorInner({
  sourceContent,
  translationContent,
  onTranslationChange,
  onSourceChange,          // add this
  sourceLanguage,
  ...
```

### Step 4: Add `sourceEditMode` state and `toggleSourceEditMode` handler

After the existing `useImperativeHandle` call, add:

```ts
  const [sourceEditMode, setSourceEditMode] = useState(false);

  const toggleSourceEditMode = useCallback(() => {
    setSourceEditMode(prev => {
      if (prev) {
        // Turning off: detect language from current source content
        const text = htmlToMarkdown(sourceContent);
        const detected = detectLanguage(text);
        if (detected) onSourceLanguageChange(detected);
      }
      return !prev;
    });
  }, [sourceContent, onSourceLanguageChange]);
```

Also add `useState` to the React import at the top of the file. The current import is:
```ts
import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
```
`useState` is already imported — no change needed there.

### Step 5: Update `sourceHeaderAction` to include the edit toggle button

Replace the existing `sourceHeaderAction` definition:

```tsx
  const sourceHeaderAction = (
    <HTMLSelect
      minimal
      options={languageOptions}
      value={sourceLanguage}
      onChange={(e) => onSourceLanguageChange(e.target.value as LanguageCode)}
      title={t('editor.sourceLanguage')}
    />
  );
```

with:

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

### Step 6: Pass `editable` and `onChange` to the source `EditorPane`

Find the source `<EditorPane>` in the JSX (currently has `editable={false}`). Change it to:

```tsx
        <EditorPane
          ref={sourceRef}
          side="source"
          content={sourceContent}
          editable={sourceEditMode}
          onChange={onSourceChange}
          onContentChange={updateContainerRefs}
          headerAction={sourceHeaderAction}
          lang={sourceLanguage}
          muteRanges={sourceMuteRanges}
        />
```

### Step 7: Add the new i18n key

In `src/locales/en.yaml`, find the `editor:` section and add:

```yaml
    editSource: "Edit source"
```

(Place it near the other `editor.*` keys.)

### Step 8: Verify build

```bash
cd /home/gan_hope326/Projects/mirror && bun run build 2>&1 | tail -5
```
Expected: `✓ built in ...` with no TypeScript errors.

### Step 9: Commit

```bash
git add src/components/editor/TranslationEditor.tsx src/locales/en.yaml
git commit -m "feat: add source edit mode toggle with language re-detection on exit"
```

---

## Task 3: Wire `onSourceChange` in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

### Step 1: Add `onSourceChange` prop to `<TranslationEditor>`

In `App.tsx`, find the `<TranslationEditor>` JSX block and add the prop:

```tsx
        <TranslationEditor
          ref={editorRef}
          sourceContent={sourceContent}
          translationContent={translationContent}
          onSourceChange={setSourceContent}       // add this line
          onTranslationChange={setTranslationContent}
          sourceLanguage={sourceLanguage}
          translationLanguage={translationLanguage}
          onSourceLanguageChange={setSourceLanguage}
          onTranslationLanguageChange={setTranslationLanguage}
        />
```

### Step 2: Verify build

```bash
cd /home/gan_hope326/Projects/mirror && bun run build 2>&1 | tail -5
```
Expected: `✓ built in ...` with no TypeScript errors.

### Step 3: Commit

```bash
git add src/App.tsx
git commit -m "feat: wire onSourceChange so source edits persist in app state"
```

---

## Manual Testing Checklist

Run `bun run dev` and verify:

- Source pane shows pencil icon button in header, left of language selector
- Button is not pressed by default; source pane is read-only (`cursor: default` when hovering text)
- Clicking button → button appears dented/pressed; source pane becomes editable (cursor is text cursor)
- Editing source text → translation content unaffected
- Clicking button again → edit mode exits; source pane returns to read-only
- After exiting edit mode, language selector reflects auto-detected language (if detection succeeded)
- If source content is too short to detect, language selector is unchanged
- Saving project after editing source → saved file contains updated source content
