# RTF Import Design

**Date:** 2026-02-28
**Status:** Approved

## Problem

The app currently loads only plain text and Markdown files. Users want to load RTF documents as source or translation text. Apple .pages format was also considered but has no viable npm parser (modern .pages uses closed binary protobuf); skipped for now.

## Decision

Add RTF import using `@iarna/rtf-to-html` with `vite-plugin-node-polyfills` to enable browser-compatible parsing with full inline formatting (bold, italic, headings).

Alternative approaches considered:
- Electron IPC for RTF + text-only web fallback — rejected: inconsistent behavior across builds
- Custom minimal RTF parser — rejected: brittle and incomplete

## Architecture

### New dependencies

- `@iarna/rtf-to-html` (runtime) — RTF → HTML, preserves bold/italic/headings
- `vite-plugin-node-polyfills` (devDep) — polyfills `stream`, `buffer`, `process` in the browser bundle

### Changes

**`vite.config.ts`**
Add `nodePolyfills()` plugin.

**`src/utils/fileIO.ts`**
Add `readFileAsArrayBuffer(accept: string): Promise<{ name: string; buffer: ArrayBuffer } | null>` using `FileReader.readAsArrayBuffer`.

**`src/utils/rtfConvert.ts`** (new)
Export `async rtfToHtml(buffer: ArrayBuffer): Promise<string>`.
Wraps `@iarna/rtf-to-html` in a promise using the stream API polyfilled by `vite-plugin-node-polyfills`.
Unsupported tiptap tags (e.g. `<u>`, styled `<span>`) pass through; tiptap drops their formatting silently — acceptable.

**`src/App.tsx`**
- Expand `handleLoadText` `accept` to include `.rtf`
- Detect extension after file selection: `.rtf` → `readFileAsArrayBuffer` + `rtfToHtml`; other extensions → existing `markdownToHtml` path
- RTF parsing is completed before `LoadTextDialog` opens, so the dialog receives ready HTML
- On RTF parse error: `console.error` and bail (same pattern as project open)

### No locale changes

Existing "Load Text" menu item covers RTF. No new UI strings needed.

## Out of scope

- Apple .pages format (no viable npm package; modern format is closed binary)
- DOCX / ODT support
- Export to RTF
