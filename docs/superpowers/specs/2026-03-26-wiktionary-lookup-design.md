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
- Two existing silent `console.error` calls in **`src/App.tsx`** are replaced with `showToast` calls:
  - Line ~143: failed to parse project file → `Intent.DANGER`
  - Line ~159: failed to parse DOCX file → `Intent.DANGER`
- New i18n keys added for toast messages.

---

## Wiktionary Lookup Feature

### Trigger
- Works on **both** source and translation panes.
- Triggered via the existing right-click context menu: a **"Look up: [word]"** item appears when `word` is non-null in the `EditorContextMenuEvent` **and** the pane's language is a known Wiktionary-supported code (see Language Codes below). If the pane language has no known Wiktionary entry, the item is suppressed.
- No change to context menu for whitespace/punctuation right-clicks.

### Language behaviour
- Definitions are fetched from **`en.wiktionary.org`** regardless of pane language. The English Wiktionary has multilingual entries and is the only edition that reliably supports the REST v1 definition API. The response is filtered by the pane's language code to show only the relevant language's entry.
- Translations displayed are into the **other pane's language** (e.g. source=French, translation=English → show EN translations).

### Language Codes
The app uses language codes from `src/constants/languages.ts`. These must be mapped to:
1. **Wiktionary REST response keys** — the language codes used as top-level keys in `en.wiktionary.org/api/rest_v1/page/definition/{word}` responses (typically ISO 639-1, e.g. `"fr"` for French).
2. **Wiktionary translation table language labels** — the English language name as it appears in Wiktionary's translation tables (e.g. `"French"`, `"Mandarin"`, `"Norwegian Bokmål"`).

A `LANGUAGE_WIKTIONARY_MAP` constant in `useWiktionary.ts` covers the app's supported languages. Languages absent from the map are treated as unsupported — the context menu item is suppressed for those panes.

### Display: popover → drawer

**`WordLookupPopover`** (compact, floating)
- Fixed-position div anchored to right-click coordinates (same pattern as existing context menu).
- Shows: word + part-of-speech badge, top 1–2 definitions, compact comma-separated translation list for the target language.
- Each translation word is clickable: copies to clipboard, shows "Copied!" toast.
- Loading state: spinner. Error state: inline error message text.
- Top-right controls: **pin** icon button + close button.
- Closes on Escape or click-outside.

**`WordLookupDrawer`** (pinned, persistent)
- Fixed bottom panel (~250px tall).
- Triggered by pressing the pin button in the popover. Popover unmounts; drawer mounts with already-fetched data (no re-fetch).
- Shows: all senses grouped by part of speech, full definitions, example sentences per sense, full translation list for target language (each word clickable to copy).
- Closable via close button; sets `lookupState` to null.
- If the user triggers a new lookup while the drawer is open (right-click → "Look up" on any word), the drawer **replaces its content** with the new lookup result (no new popover appears — since the drawer is already visible and pinned, the new result loads directly into it).

### State
Lookup state lives in `TranslationEditor` as local component state — no new context needed:

```ts
interface LookupState {
  word: string;
  lang: string;          // app language code for the pane (used to filter API response)
  targetLang: string;    // app language code for the other pane (used to filter translations)
  x: number;             // viewport coords for popover placement
  y: number;
  pinned: boolean;
  data: WiktionaryResult | null;
  status: 'loading' | 'error' | 'success';
  error: string | null;  // error message for inline display when status === 'error'
}
```

`targetLang` is derived at trigger time: if the user right-clicked the source pane, `targetLang = translationLanguage`; if the translation pane, `targetLang = sourceLanguage`.

### Data flow

1. User right-clicks word → context menu shows "Look up: [word]" (if language is supported)
2. Click item → `lookupState` set (status: 'loading'), context menu closed
3. If `pinned` was already true (drawer open) — drawer immediately shows spinner for new word
4. If `pinned` was false — `WordLookupPopover` renders at `(x, y)`; shows spinner
5. `useWiktionary` fetches; on success → populate; on error → set `error` string + warning toast
6. Pin → `pinned: true` → swap to `WordLookupDrawer` (same data, no re-fetch)
7. Click translation word → copy to clipboard → "Copied!" toast
8. Close → `lookupState = null`

---

## `useWiktionary` Hook

**Signature:** `useWiktionary(word: string, lang: string, targetLang: string): { status, data, error }`

### Definitions + PoS — REST API
```
GET https://en.wiktionary.org/api/rest_v1/page/definition/{word}
```
Response is a map keyed by ISO 639-1 language code. Pick the entry matching `LANGUAGE_WIKTIONARY_MAP[lang].restKey`. Each entry is an array of `{ partOfSpeech, definitions: [{ definition, parsedExamples }] }`.

### Translations — Action API
The REST v1 API does not include translation tables. Translations are extracted via:

**Step 1** — get section list:
```
GET https://en.wiktionary.org/w/api.php?action=parse&page={word}&prop=sections&format=json&origin=*
```
Find section(s) with `line === "Translations"` (there may be one per PoS). Take the first (or all, grouped by PoS).

**Step 2** — fetch section HTML:
```
GET https://en.wiktionary.org/w/api.php?action=parse&page={word}&prop=text&section={N}&format=json&origin=*
```
In the returned HTML, translation tables contain language label elements followed by `<li>` items for each translation. The exact DOM structure should be verified against a live Wiktionary response before implementation (the `trad-head` class and surrounding markup can vary). Scan for the entry whose label text matches `LANGUAGE_WIKTIONARY_MAP[targetLang].translationLabel` (the English language name Wiktionary uses in translation tables, e.g. `"French"`, `"English"`).

If the section fetch fails or the target language label is not found, return definitions without translations — do not fail the whole request.

**`origin=*`** query parameter is required on Action API calls for CORS (enables CORS response headers from Wikimedia).

### Caching
Module-level `Map<string, WiktionaryResult>` keyed by `"lang:word:targetLang"`. Persists for the session. Using `targetLang` in the key ensures a changed translation pane language gets a fresh fetch rather than stale translations.

### User-Agent
Browsers and Electron renderer processes block overriding the `User-Agent` header (forbidden header name). Do not attempt to set it. The `Api-User-Agent` custom header is accepted by Wikimedia as an alternative and is not restricted:
```
Api-User-Agent: Mirror-App/{version} (translation editor)
```

---

## New / Modified Files

| File | Change |
|---|---|
| `src/contexts/ToastContext.tsx` | New — toast provider + `useToast()` hook |
| `src/components/editor/WordLookupPopover.tsx` | New — compact floating lookup UI |
| `src/components/editor/WordLookupDrawer.tsx` | New — pinned bottom panel UI |
| `src/hooks/useWiktionary.ts` | New — fetch, parse, cache; includes `LANGUAGE_WIKTIONARY_MAP` |
| `src/App.tsx` | Wrap tree in `ToastProvider`; replace two silent `console.error` calls with `showToast` |
| `src/components/index.ts` | Add `OverlayToaster`, `Toast2`, `Intent` |
| `src/components/editor/TranslationEditor.tsx` | Add "Look up" menu item, `lookupState`, render popover/drawer |
| `src/locales/en.yaml` | New strings: menu item, toast messages, error states |

---

## Out of Scope

- Etymology (not shown)
- Click-to-insert translation into editor (deferred; click-to-copy for now)
- Persistent lookup history
- Offline / cached dictionary data
- Drawer resize handle (can be added later)
- Non-English Wiktionary editions (en.wiktionary.org used exclusively for API reliability)
