# DOCX Import + Markdown Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace broken RTF import with DOCX via mammoth.js, make tiptap-markdown the editor's exchange format, and store Markdown (not HTML) in project files.

**Architecture:** tiptap-markdown is added as a Tiptap extension so the editor natively speaks Markdown — `setContent(md)` in, `editor.storage.markdown.getMarkdown()` out. React state holds Markdown strings. Project JSON is bumped to v2 (Markdown values). DOCX files are converted with mammoth → turndown → Markdown before entering the editor. Old RTF code and the hand-rolled converter are deleted.

**Tech Stack:** tiptap-markdown, mammoth, turndown (@types/turndown), Bun, TypeScript, Vite, React 19

**Design doc:** `docs/plans/2026-03-04-docx-markdown-storage-design.md`

---

## Task 1: Install new dependencies, remove old ones

**Files:**
- Modify: `package.json` (via bun commands)
- Modify: `vite.config.ts`

**Step 1: Add new packages**

```bash
bun add tiptap-markdown mammoth turndown
bun add -d @types/turndown
```

**Step 2: Remove old packages**

```bash
bun remove @iarna/rtf-to-html
```

(`rtf-parser` is a transitive dep of `@iarna/rtf-to-html` and will be removed automatically.)

**Step 3: Remove the node-polyfills Vite plugin**

The polyfills were added solely for `rtf-parser` (which used Node.js streams). Mammoth, turndown, and tiptap-markdown are all browser-native.

In `vite.config.ts`, remove the `nodePolyfills` import and plugin:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
});
```

**Step 4: Verify TypeScript compiles**

```bash
bun run typecheck
```

Expected: no errors (there will be errors from files that still import `rtfConvert`/`markdownConvert` — those are fixed in later tasks).

**Step 5: Commit**

```bash
git add package.json bun.lockb vite.config.ts
git commit -m "chore: swap RTF libs for mammoth/turndown/tiptap-markdown"
```

---

## Task 2: Create `src/utils/docxConvert.ts`

**Files:**
- Create: `src/utils/docxConvert.ts`

This module converts a DOCX `ArrayBuffer` to a Markdown string. It uses mammoth for the HTML step and turndown for the Markdown step.

**Step 1: Create the file**

```typescript
import mammoth from 'mammoth';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',       // # Heading
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

export async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return turndown.turndown(result.value);
}
```

**Step 2: Verify it type-checks**

```bash
bun run typecheck
```

Expected: no new errors from this file. (Ignore errors in App.tsx from the old imports — those are fixed later.)

**Step 3: Commit**

```bash
git add src/utils/docxConvert.ts
git commit -m "feat: add docxToMarkdown converter (mammoth + turndown)"
```

---

## Task 3: Add the Markdown extension to the Tiptap editor

**Files:**
- Modify: `src/hooks/useEditorSetup.ts`

tiptap-markdown extends Tiptap so that:
- `editor.commands.setContent(markdownString)` parses Markdown into ProseMirror
- `editor.storage.markdown.getMarkdown()` serialises ProseMirror back to Markdown

**Step 1: Update `useEditorSetup.ts`**

```typescript
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

interface UseEditorSetupOptions {
  content: string;
  editable?: boolean;
  placeholder?: string;
  lang?: string;
  onUpdate?: (content: string) => void;
}

export function useEditorSetup({
  content,
  editable = true,
  placeholder = '',
  lang,
  onUpdate,
}: UseEditorSetupOptions): Editor | null {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        ...(lang ? { lang } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.storage.markdown.getMarkdown());
    },
  });

  return editor;
}
```

Key changes:
- `Markdown` extension added with `html: false` (no raw HTML pass-through in content)
- `onUpdate` emits `editor.storage.markdown.getMarkdown()` instead of `editor.getHTML()`

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add src/hooks/useEditorSetup.ts
git commit -m "feat: add tiptap-markdown extension to editor setup"
```

---

## Task 4: Update `EditorPane.tsx` to compare and emit Markdown

**Files:**
- Modify: `src/components/editor/EditorPane.tsx`

The `useEffect` that syncs `content` → editor currently compares `content !== editor.getHTML()`. With Markdown as the content format, both sides of the comparison must be Markdown.

**Step 1: Update the sync effect in `EditorPane.tsx`**

Find the effect (around line 96):

```typescript
// Sync content prop → editor when it changes externally
useEffect(() => {
  if (editor && content !== editor.getHTML()) {
    editor.commands.setContent(content, false);
  }
}, [editor, content]);
```

Replace it with:

```typescript
// Sync content prop → editor when it changes externally
useEffect(() => {
  if (editor && content !== editor.storage.markdown.getMarkdown()) {
    editor.commands.setContent(content, false);
  }
}, [editor, content]);
```

`editor.storage.markdown` is available once the Markdown extension is loaded. `editor.commands.setContent` with the Markdown extension active accepts Markdown strings.

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add src/components/editor/EditorPane.tsx
git commit -m "feat: EditorPane compares and syncs Markdown content"
```

---

## Task 5: Update `App.tsx` — state, import, save/load, v1 migration

**Files:**
- Modify: `src/App.tsx`

This is the largest change. React state now holds Markdown strings. DOCX replaces RTF. Project format is v2. A v1 migration path uses turndown to convert stored HTML on open.

**Step 1: Replace the full `App.tsx`**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import TurndownService from 'turndown';
import { Layout } from './components/Layout';
import { TranslationEditor } from './components/editor';
import type { TranslationEditorHandle } from './components/editor';
import { LoadTextDialog } from './components/LoadTextDialog';
import type { LanguageCode } from './constants/languages';
import { readFileAsArrayBuffer, readFileAsText, downloadFile } from './utils/fileIO';
import { detectLanguage } from './utils/detectLanguage';
import { docxToMarkdown } from './utils/docxConvert';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

interface MirrorProject {
  version: number;
  sourceContent: string;
  translationContent: string;
  sourceLanguage: string;
  translationLanguage: string;
  lockingPoints: Array<{ id: string; sourceY: number; translationY: number }>;
}

export function App() {
  const [isDark, setIsDark] = useState(true);
  const [sourceContent, setSourceContent] = useState('');
  const [translationContent, setTranslationContent] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('en');
  const [translationLanguage, setTranslationLanguage] = useState<LanguageCode>('it');

  const editorRef = useRef<TranslationEditorHandle>(null);

  const [loadTextDialogOpen, setLoadTextDialogOpen] = useState(false);
  const [pendingTextFile, setPendingTextFile] = useState<{
    name: string;
    markdown: string;
    detected: LanguageCode | null;
  } | null>(null);

  useEffect(() => {
    document.body.classList.toggle('bp6-dark', isDark);
  }, [isDark]);

  const handleThemeToggle = () => setIsDark(!isDark);

  const handleNewFile = useCallback(() => {
    setSourceContent('');
    setTranslationContent('');
    setSourceLanguage('en');
    setTranslationLanguage('it');
    editorRef.current?.setLockingPoints([{ id: 'origin', sourceY: 0, translationY: 0 }]);
  }, []);

  const handleOpenProject = useCallback(async () => {
    const result = await readFileAsText('.mirror.json');
    if (!result) return;

    try {
      const project: MirrorProject = JSON.parse(result.content);
      if (project.version !== 1 && project.version !== 2) {
        console.warn('Unknown project version:', project.version);
      }

      // v1 projects stored HTML — convert to Markdown on open
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

  const handleLoadText = useCallback(async () => {
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
  }, []);

  const handleLoadTextConfirm = useCallback((side: 'source' | 'translation') => {
    if (!pendingTextFile) return;

    if (side === 'source') {
      setSourceContent(pendingTextFile.markdown);
      if (pendingTextFile.detected) setSourceLanguage(pendingTextFile.detected);
    } else {
      setTranslationContent(pendingTextFile.markdown);
      if (pendingTextFile.detected) setTranslationLanguage(pendingTextFile.detected);
    }

    setLoadTextDialogOpen(false);
    setPendingTextFile(null);
  }, [pendingTextFile]);

  const handleLoadTextClose = useCallback(() => {
    setLoadTextDialogOpen(false);
    setPendingTextFile(null);
  }, []);

  const handleSaveProject = useCallback(() => {
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

    downloadFile('project.mirror.json', JSON.stringify(project, null, 2), 'application/json');
  }, [sourceContent, translationContent, sourceLanguage, translationLanguage]);

  const handleExportTranslation = useCallback(() => {
    // translationContent is already Markdown — export directly
    downloadFile('translation.md', translationContent, 'text/markdown');
  }, [translationContent]);

  return (
    <>
      <Layout
        onThemeToggle={handleThemeToggle}
        isDark={isDark}
        onNewFile={handleNewFile}
        onOpenProject={handleOpenProject}
        onLoadText={handleLoadText}
        onSaveProject={handleSaveProject}
        onExportTranslation={handleExportTranslation}
      >
        <TranslationEditor
          ref={editorRef}
          sourceContent={sourceContent}
          translationContent={translationContent}
          onSourceChange={setSourceContent}
          onTranslationChange={setTranslationContent}
          sourceLanguage={sourceLanguage}
          translationLanguage={translationLanguage}
          onSourceLanguageChange={setSourceLanguage}
          onTranslationLanguageChange={setTranslationLanguage}
        />
      </Layout>
      <LoadTextDialog
        isOpen={loadTextDialogOpen}
        fileName={pendingTextFile?.name ?? ''}
        onConfirm={handleLoadTextConfirm}
        onClose={handleLoadTextClose}
      />
    </>
  );
}
```

Notable changes:
- `pendingTextFile` renamed field `html` → `markdown`
- `handleLoadText` calls `docxToMarkdown` instead of `rtfToHtml`; plain text files go straight through (already Markdown)
- `handleOpenProject` converts v1 HTML to Markdown via turndown; v2 is used as-is
- `handleSaveProject` writes `version: 2`
- `handleExportTranslation` downloads `translationContent` directly (it's already Markdown)
- Imports of `rtfConvert` and `markdownConvert` removed

**Step 2: Verify**

```bash
bun run typecheck
```

Expected: errors about `rtfConvert` and `markdownConvert` being missing — those are deleted in the next task.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App uses Markdown state, DOCX import, v2 project format"
```

---

## Task 6: Delete old conversion utilities

**Files:**
- Delete: `src/utils/rtfConvert.ts`
- Delete: `src/utils/markdownConvert.ts`

**Step 1: Delete the files**

```bash
rm src/utils/rtfConvert.ts
rm src/utils/markdownConvert.ts
```

**Step 2: Verify no remaining imports**

```bash
grep -r "rtfConvert\|markdownConvert" src/
```

Expected: no output.

**Step 3: Full typecheck**

```bash
bun run typecheck
```

Expected: clean — zero errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove rtfConvert and markdownConvert utilities"
```

---

## Task 7: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Remove the RTF known issue**

In the `## Known Issues` section, remove:

```
- **RTF parse failures are silent**: When `handleLoadText` fails to parse an RTF file, it logs to `console.error` and returns silently (no user-facing feedback). A future improvement would show a BlueprintJS `Toaster` notification. This is consistent with how `.mirror.json` project-open errors are currently handled.
```

**Step 2: Update the project structure section**

In `## Project Structure`, under `src/utils/`, update the utility files listed to remove `rtfConvert.ts` and `markdownConvert.ts`, and add `docxConvert.ts`.

**Step 3: Note the project file format version**

In `## Known Issues` (or a new `## Notes` section if appropriate), add:

```
- **Project file format**: `.mirror.json` uses `version: 2`. Version 1 files (HTML content) are automatically migrated to Markdown on open.
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for DOCX import and Markdown storage"
```

---

## Task 8: Smoke test

No automated test framework is currently set up. Verify manually:

**Step 1: Start the dev server**

```bash
bun run dev
```

**Step 2: Test plain text / Markdown loading**
- File → Load Text File → select a `.md` or `.txt` file
- Confirm bold (`**word**`) and italic (`*word*`) render correctly in the editor
- Heading lines (`# Heading`) should appear as headings

**Step 3: Test DOCX loading**
- File → Load Text File → select a `.docx` file with headings, bold, and italic
- Verify headings render as headings, bold as bold, italic as italic

**Step 4: Test save and re-open**
- Type some formatted text, save project
- Open the saved `.mirror.json` — confirm `version: 2` and content is Markdown (not HTML)
- Re-open the project in the app — content should render correctly

**Step 5: Test v1 migration**
- Open a v1 `.mirror.json` (HTML content, `"version": 1`)
- Content should display correctly after the turndown migration

**Step 6: Test export**
- Type some text in the translation pane, export
- Confirm the `.md` file contains clean Markdown with proper `**bold**` and `*italic*` syntax

**Step 7: Final typecheck and build**

```bash
bun run typecheck
bun run build
```

Expected: clean compile and build.

**Step 8: Commit**

If any small fixes were needed during smoke testing, commit them here. Otherwise:

```bash
git log --oneline -8
```

Confirm all tasks are committed cleanly.
