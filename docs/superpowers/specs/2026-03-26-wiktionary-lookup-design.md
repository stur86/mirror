# Wiktionary Word Lookup — Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Overview

Add right-click Wiktionary lookup to both editor panes. Right-clicking a word opens a compact floating popover with its definition and translations. A pin button promotes this to a persistent bottom drawer with fuller content. Also introduces a global toast notification system, leveraged for copy confirmations and file-load errors.

---

## Toast Notification System

### Motivation
Currently, errors (e.g. DOCX parse failures) are silent. The Wiktionary feature also needs lightweight feedback ("Copied!"). A shared toast system serves both.

### Design
- **`src/contexts/ToastContext.tsx`** — `ToastProvider` component holding a BlueprintJS `OverlayToaster` ref, plus a `useToast()` hook exposing `showToast(message: string, intent?: Intent)`.
- `ToastProvider` wraps the app in `src/App.tsx`.
- `OverlayToaster` and `Toast2` added to the component abstraction layer (`src/components/index.ts`).
- Existing silent `console.error` in `src/utils/fileIO.ts` (DOCX parse failure) is replaced with a `showToast` call using `Intent.DANGER`.
- New i18n keys added for toast messages.

---

## Wiktionary Lookup Feature

### Trigger
- Works on **both** source and translation panes.
- Triggered via the existing right-click context menu: a **"Look up: [word]"** item appears when `word` is non-null in the `EditorContextMenuEvent`.
- No change to context menu for whitespace/punctuation right-clicks.

### Language behaviour
- Definitions are fetched from the **pane's language** Wiktionary edition (e.g. right-clicking the French source pane fetches from `fr.wiktionary.org`).
- Translations displayed are into the **other pane's language** (e.g. source=French, translation=English → show EN translations).

### Display: popover → drawer

**`WordLookupPopover`** (compact, floating)
- Fixed-position div anchored to right-click coordinates (same pattern as existing context menu).
- Shows: word + part-of-speech badge, top 1–2 definitions, compact comma-separated translation list for the target language.
- Each translation word is clickable: copies to clipboard, shows "Copied!" toast.
- Loading state: spinner. Error state: inline error message.
- Top-right controls: **pin** icon button + close button.
- Closes on Escape or click-outside.

**`WordLookupDrawer`** (pinned, persistent)
- Fixed bottom panel (~250px tall).
- Triggered by pressing the pin button in the popover. Popover unmounts; drawer mounts with already-fetched data (no re-fetch).
- Shows: all senses grouped by part of speech, full definitions, example sentences per sense, full translation list for target language (each word clickable to copy).
- Closable via close button; sets `lookupState` to null.

### State
Lookup state lives in `TranslationEditor` as local component state — no new context needed:

```ts
interface LookupState {
  word: string;
  lang: string;       // Wiktionary edition language code
  targetLang: string; // language to show translations for
  x: number;          // viewport coords for popover placement
  y: number;
  pinned: boolean;
  result: WiktionaryResult | null;
  status: 'loading' | 'error' | 'success';
}
```

`targetLang` is derived at trigger time: if the user right-clicked the source pane, `targetLang = translationLanguage`; if the translation pane, `targetLang = sourceLanguage`.

### Data flow

1. User right-clicks word → context menu shows "Look up: [word]"
2. Click item → `lookupState` set, context menu closed
3. `WordLookupPopover` renders at `(x, y)`; `useWiktionary` begins fetch
4. On success → popover populates; on error → inline error + warning toast
5. Pin → `pinned: true` → swap to `WordLookupDrawer` (same data, no re-fetch)
6. Click translation word → copy to clipboard → "Copied!" toast
7. Close → `lookupState = null`

---

## `useWiktionary` Hook

**Signature:** `useWiktionary(word: string, lang: string, targetLang: string): { status, data }`

**Definitions + PoS** — REST API:
```
GET https://{lang}.wiktionary.org/api/rest_v1/page/definition/{word}
```
Response: map keyed by language code. Pick entry matching `lang`. Each entry: `{ partOfSpeech, definitions: [{ definition, examples }] }`.

**Translations** — Action API (REST API doesn't include translation tables):
```
GET https://{lang}.wiktionary.org/w/api.php?action=parse&page={word}&prop=sections&format=json
```
Then fetch the "Translations" section HTML and scan for `targetLang` language entries. Failures degrade gracefully — show definitions without translations rather than failing entirely.

**Caching:** Module-level `Map<string, WiktionaryResult>` keyed by `"lang:word"`. Persists for the session; prevents duplicate fetches for repeated lookups.

**CORS:** Wiktionary allows cross-origin requests — works from browser and Electron directly, no proxy needed.

**User-Agent:** `Mirror-App/{version} (translation editor)` sent with every request as Wiktionary requests descriptive user agents.

---

## New / Modified Files

| File | Change |
|---|---|
| `src/contexts/ToastContext.tsx` | New — toast provider + `useToast()` hook |
| `src/components/editor/WordLookupPopover.tsx` | New — compact floating lookup UI |
| `src/components/editor/WordLookupDrawer.tsx` | New — pinned bottom panel UI |
| `src/hooks/useWiktionary.ts` | New — fetch, parse, cache |
| `src/App.tsx` | Wrap tree in `ToastProvider` |
| `src/components/index.ts` | Add `OverlayToaster`, `Toast2` |
| `src/components/editor/TranslationEditor.tsx` | Add "Look up" menu item, `lookupState`, render popover/drawer |
| `src/utils/fileIO.ts` | Replace silent error with `showToast` |
| `src/locales/en.yaml` | New strings: menu item, toast messages, error states |

---

## Out of Scope

- Etymology (not shown)
- Click-to-insert translation into editor (deferred; click-to-copy for now)
- Persistent lookup history
- Offline / cached dictionary data
- Drawer resize handle (can be added later)
