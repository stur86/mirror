# DOCX Import + Markdown Storage Design

Date: 2026-03-04

## Problem

- RTF import is broken: the `rtf-parser` library silently drops bold/italic formatting due to a style-propagation bug, and the stylesheet (which defines heading styles) is ignored entirely.
- Project files store HTML, a format coupled to Tiptap's internals. Markdown is the more natural, portable format for a translation editor.
- The hand-rolled `markdownConvert.ts` only handles a small subset of formatting and is fragile.

## Goals

1. Replace RTF import with DOCX import via `mammoth.js`.
2. Store content as Markdown in `.mirror.json` project files.
3. Replace the hand-rolled converters with proper libraries.
4. Keep the runtime editor experience identical.

## Non-Goals

- No per-keystroke Markdown serialisation.
- No support for exotic Markdown (tables, footnotes, custom blocks). Only bold, italic, headings, and paragraphs need to survive the round-trip.
- No changes to the editor UI, scroll sync, or locking-point logic.

## Approach: tiptap-markdown + turndown + mammoth

### Libraries

| Library | Role |
|---|---|
| `tiptap-markdown` | Tiptap extension: Markdown ↔ ProseMirror (replaces HTML as the editor's exchange format) |
| `mammoth` | DOCX → HTML (semantic: `<h1>`, `<strong>`, `<em>`, lists) |
| `turndown` | HTML → Markdown (used only for the DOCX import path) |

`markdownConvert.ts` is deleted. The hand-rolled `rtfConvert.ts` is deleted.

### Data Flow

```
Load project (.mirror.json, Markdown):
  MD string → editor.commands.setContent(md)

Save project:
  editor.storage.markdown.getMarkdown() → MD string → JSON

DOCX import:
  ArrayBuffer → mammoth.convertToHtml() → HTML
  → TurndownService().turndown(html) → MD string
  → editor.commands.setContent(md)

Export translation:
  editor.storage.markdown.getMarkdown() → .md file (no conversion needed)
```

### Project File Format

Version bumped from `1` → `2`. `sourceContent` and `translationContent` fields now store Markdown strings instead of HTML.

Backward compatibility: when opening a v1 project, the HTML content is passed through `TurndownService().turndown(html)` once on load to convert to Markdown, then the project is treated normally.

### EditorPane Changes

The guard that prevents unnecessary `setContent` calls currently compares Markdown content against `editor.getHTML()`. This is replaced with a comparison against `editor.storage.markdown.getMarkdown()`, which round-trips cleanly for the supported formatting subset.

The `onChange` callback emits Markdown (via `editor.storage.markdown.getMarkdown()`) instead of HTML.

### Removed

- `src/utils/rtfConvert.ts` — deleted
- `src/utils/markdownConvert.ts` — deleted
- `@iarna/rtf-to-html` — removed from dependencies
- `rtf-parser` — removed (transitive, gone with above)
- The `.rtf` file extension from the Load Text File dialog

### File Accept String

Load Text File dialog changes from `.txt,.md,.text,.markdown,.rtf` to `.txt,.md,.text,.markdown,.docx`.

## Files Affected

| File | Change |
|---|---|
| `package.json` | Add `tiptap-markdown`, `mammoth`, `turndown`; remove `@iarna/rtf-to-html` |
| `src/utils/rtfConvert.ts` | Delete |
| `src/utils/markdownConvert.ts` | Delete |
| `src/utils/docxConvert.ts` | New: wraps mammoth + turndown |
| `src/hooks/useEditorSetup.ts` | Add `Markdown` extension from `tiptap-markdown` |
| `src/components/editor/EditorPane.tsx` | `onChange` emits MD; guard compares MD |
| `src/App.tsx` | State holds MD; load/save/import logic updated; v1→v2 migration |
| `src/locales/en.yaml` | Update "Load Text File" accept description if needed |
| `CLAUDE.md` | Update known issues section |
