# RTF Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add RTF file import to the Load Text workflow, with full inline formatting (bold, italic, headings) preserved.

**Architecture:** Install `@iarna/rtf-to-html` for RTF→HTML conversion and `vite-plugin-node-polyfills` to polyfill `stream`/`buffer`/`process` in the browser bundle. Add `readFileAsArrayBuffer` alongside `readFileAsText` in `fileIO.ts`, then a new `rtfConvert.ts` utility. Update `App.tsx` to dispatch on file extension: `.rtf` → ArrayBuffer + RTF converter, everything else → existing markdown path. The `LoadTextDialog` (choose source/translation) is untouched.

**Tech Stack:** Bun, Vite 7, React 19, TypeScript, `@iarna/rtf-to-html` 1.1.0, `vite-plugin-node-polyfills`

---

### Task 1: Install dependencies and configure Vite

**Files:**
- Modify: `package.json` (via bun install)
- Modify: `vite.config.ts`

**Step 1: Install runtime dependency**

```bash
cd /home/gan_hope326/Projects/mirror
bun add @iarna/rtf-to-html
```

Expected: package added to `dependencies` in `package.json`.

**Step 2: Install dev dependency**

```bash
bun add -d vite-plugin-node-polyfills
```

Expected: package added to `devDependencies` in `package.json`.

**Step 3: Update vite.config.ts**

Read `vite.config.ts` first, then add the polyfills plugin:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [react(), nodePolyfills()],
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

**Step 4: Verify dev server still starts**

```bash
bun run dev
```

Expected: Vite starts on port 5173, no errors in console. Kill with Ctrl+C.

**Step 5: Check the @iarna/rtf-to-html API**

```bash
cat node_modules/@iarna/rtf-to-html/rtf-to-html.js | head -80
```

This is important: confirm the exact export shape before writing the converter in Task 3. The package either exports a function directly (called as `rtfToHTML(callback)` to get a through-stream) or has named exports like `fromString`/`fromStream`. Note what you see — you'll need it in Task 3.

**Step 6: Commit**

```bash
git add package.json bun.lockb vite.config.ts
git commit -m "feat: add rtf-to-html and node polyfills for RTF import"
```

---

### Task 2: Add readFileAsArrayBuffer to fileIO.ts

**Files:**
- Modify: `src/utils/fileIO.ts`

**Context:** The existing `readFileAsText` uses `FileReader.readAsText`. RTF files use their own internal encoding (Windows-1252 escape sequences), so we must read raw bytes (ArrayBuffer) and let the parser handle encoding.

**Step 1: Read the existing file**

Read `src/utils/fileIO.ts` to understand the current structure before editing.

**Step 2: Add the new function**

Add after the existing `readFileAsText` function:

```typescript
export function readFileAsArrayBuffer(
  accept: string,
): Promise<{ name: string; buffer: ArrayBuffer } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        cleanup();
        resolve({ name: file.name, buffer: reader.result as ArrayBuffer });
      };
      reader.onerror = () => {
        cleanup();
        resolve(null);
      };
      reader.readAsArrayBuffer(file);
    });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });

    function cleanup() {
      document.body.removeChild(input);
    }

    input.click();
  });
}
```

**Step 3: Verify TypeScript compiles**

```bash
bun run typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/utils/fileIO.ts
git commit -m "feat: add readFileAsArrayBuffer utility for binary file loading"
```

---

### Task 3: Create rtfConvert.ts

**Files:**
- Create: `src/utils/rtfConvert.ts`

**Context:** `@iarna/rtf-to-html` is a CJS Transform stream package. With `vite-plugin-node-polyfills` providing `stream` and `buffer`, we can use it in the browser bundle. The RTF HTML output contains standard tags (`<p>`, `<strong>`, `<em>`, `<h1>`–`<h6>`) that tiptap's StarterKit understands. Unsupported tags (e.g. `<u>`, styled `<span>`) are dropped silently by tiptap — acceptable.

**Step 1: Examine the API from Task 1 Step 5**

Before writing the converter, confirm the API shape you found in Task 1. The most common patterns for this package are:

**Pattern A** — the export IS the through-stream factory (most likely):
```javascript
// module.exports = function(callback) { return TransformStream }
const transformer = rtfToHTML((err, html) => { ... })
readable.pipe(transformer)
```

**Pattern B** — named exports:
```javascript
// module.exports.fromString(str, callback)
// module.exports.fromStream(stream, callback)
```

**Step 2: Write rtfConvert.ts**

```typescript
// @ts-expect-error – @iarna/rtf-to-html has no type declarations
import rtfToHTML from '@iarna/rtf-to-html';
import { Readable } from 'stream';

export function rtfToHtml(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const nodeBuffer = Buffer.from(buffer);
    const readable = new Readable();
    readable.push(nodeBuffer);
    readable.push(null);

    // @iarna/rtf-to-html exports a through-stream factory.
    // Call it with a completion callback to receive the full HTML string.
    const transformer = rtfToHTML((err: Error | null, html: string) => {
      if (err) reject(err);
      else resolve(html);
    });

    readable.pipe(transformer);
  });
}
```

If the API from Step 1 is Pattern B (`fromString`), use this instead:

```typescript
// @ts-expect-error – @iarna/rtf-to-html has no type declarations
import rtfToHTML from '@iarna/rtf-to-html';

export function rtfToHtml(buffer: ArrayBuffer): Promise<string> {
  // Decode as latin1 to preserve all byte values; the parser handles RTF encoding internally
  const text = new TextDecoder('latin1').decode(buffer);
  return new Promise((resolve, reject) => {
    rtfToHTML.fromString(text, (err: Error | null, html: string) => {
      if (err) reject(err);
      else resolve(html);
    });
  });
}
```

**Step 3: Verify TypeScript compiles**

```bash
bun run typecheck
```

Expected: no errors (the `@ts-expect-error` suppresses the missing-types warning).

**Step 4: Manually test RTF conversion**

Create a minimal test RTF file to verify parsing works:

```bash
printf '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs24 Hello {\\b world}!\\par This is a test.\\par}' > /tmp/test.rtf
```

Open the dev server (`bun run dev`), open DevTools console, and run:
```javascript
const resp = await fetch('/tmp/test.rtf') // won't work from browser – instead:
// Temporarily add a console.log in App.tsx handleLoadText to log the rtfToHtml result
// then load the test.rtf file via the UI
```

Alternatively, verify by loading `test.rtf` through the UI (after Task 4), then inspect what the editor shows.

**Step 5: Commit**

```bash
git add src/utils/rtfConvert.ts
git commit -m "feat: add rtfToHtml converter using @iarna/rtf-to-html"
```

---

### Task 4: Update App.tsx to handle RTF in handleLoadText

**Files:**
- Modify: `src/App.tsx:68-74` (handleLoadText), `src/App.tsx:76-92` (handleLoadTextConfirm)

**Context:** `handleLoadText` currently calls `readFileAsText('.txt,.md,.text,.markdown')`. We need to:
1. Expand the accept string to include `.rtf`
2. Split into two paths: RTF files read as ArrayBuffer → `rtfToHtml`; text files read as text → `markdownToHtml`

The `LoadTextDialog` receives a processed HTML string (currently via `markdownToHtml`). We'll move the conversion to happen *before* the dialog opens, so the dialog always receives ready HTML. This requires a small refactor: `pendingTextFile` stores HTML (already converted) rather than raw content.

**Step 1: Read App.tsx**

Read the full `src/App.tsx` before editing.

**Step 2: Add the rtfToHtml import**

Add at the top of App.tsx alongside other imports:

```typescript
import { rtfToHtml } from './utils/rtfConvert';
import { readFileAsArrayBuffer } from './utils/fileIO';
```

**Step 3: Refactor pendingTextFile state**

Change the state type to store pre-converted HTML and detected language:

```typescript
const [pendingTextFile, setPendingTextFile] = useState<{
  name: string;
  html: string;
  detected: LanguageCode | null;
} | null>(null);
```

**Step 4: Replace handleLoadText**

```typescript
const handleLoadText = useCallback(async () => {
  const ext = await promptForFileExtension();  // we inline the logic below
  // Ask for any supported text file including RTF
  const isRtf = (name: string) => name.toLowerCase().endsWith('.rtf');

  // Try RTF first if user picks an RTF file, else text
  // We use a single file picker accepting all formats
  const allAccept = '.txt,.md,.text,.markdown,.rtf';

  // readFileAsText is fine for text formats; for RTF we need ArrayBuffer.
  // Use a two-step: read as text first, detect extension, re-read if RTF.
  // Simpler: read as ArrayBuffer always, TextDecoder for text files.
  // Simplest: separate pickers. But that's two clicks.
  //
  // Best approach: read as ArrayBuffer for all, then decode text files via TextDecoder.

  const result = await readFileAsArrayBuffer(allAccept);
  if (!result) return;

  let html: string;
  let detected: LanguageCode | null = null;

  if (isRtf(result.name)) {
    try {
      html = await rtfToHtml(result.buffer);
    } catch (e) {
      console.error('Failed to parse RTF file:', e);
      return;
    }
  } else {
    const text = new TextDecoder('utf-8').decode(result.buffer);
    html = markdownToHtml(text);
    detected = detectLanguage(text) ?? null;
  }

  setPendingTextFile({ name: result.name, html, detected });
  setLoadTextDialogOpen(true);
}, []);
```

**Step 5: Update handleLoadTextConfirm**

The confirm handler now receives pre-converted HTML:

```typescript
const handleLoadTextConfirm = useCallback((side: 'source' | 'translation') => {
  if (!pendingTextFile) return;

  if (side === 'source') {
    setSourceContent(pendingTextFile.html);
    if (pendingTextFile.detected) setSourceLanguage(pendingTextFile.detected);
  } else {
    setTranslationContent(pendingTextFile.html);
    if (pendingTextFile.detected) setTranslationLanguage(pendingTextFile.detected);
  }

  setLoadTextDialogOpen(false);
  setPendingTextFile(null);
}, [pendingTextFile]);
```

**Step 6: Update LoadTextDialog fileName prop**

The `fileName` prop passed to `LoadTextDialog` was `pendingTextFile?.name`. Since `pendingTextFile` now has a `name` field, this still works unchanged.

**Step 7: Verify TypeScript compiles**

```bash
bun run typecheck
```

Expected: no errors.

**Step 8: Manual integration test**

1. Run `bun run dev`, open the app at `http://localhost:5173`
2. File → Load Text File → pick `test.rtf` from earlier
3. Dialog should appear with the filename
4. Choose "Load as source text" → click Confirm
5. Expected: source pane shows "Hello **world**! This is a test." as two paragraphs

Also test with a `.md` file to confirm the existing path still works.

**Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: support RTF file loading via Load Text File menu item"
```

---

### Task 5: Final verification and cleanup

**Step 1: Full typecheck**

```bash
bun run typecheck
```

Expected: zero errors.

**Step 2: Build**

```bash
bun run build
```

Expected: build succeeds. Chunk size warnings are pre-existing and acceptable; the polyfills will add some bundle size.

**Step 3: Smoke test the web build**

```bash
bun run preview
```

Open `http://localhost:4173`, load an RTF file, confirm it works in the production bundle (polyfills are active).

**Step 4: Commit**

If any fixes were needed in steps 1–3, commit them:

```bash
git add -p
git commit -m "fix: address typecheck/build issues in RTF import"
```
