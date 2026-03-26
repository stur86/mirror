# Wiktionary Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click Wiktionary word lookup to both editor panes, with a compact popover that can be pinned to a persistent bottom drawer, plus a global toast notification system.

**Architecture:** A new `ToastContext` provides app-wide toast notifications (BlueprintJS `OverlayToaster`). A `useWiktionary` hook fetches and caches word data from the Wiktionary REST + Action APIs. Two new components — `WordLookupPopover` and `WordLookupDrawer` — render the lookup result; state transitions between them are controlled by `lookupState` in `TranslationEditor`.

**Tech Stack:** React 19, TypeScript, BlueprintJS 6, Bun test runner, i18next (YAML), en.wiktionary.org REST v1 + Action APIs.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/contexts/ToastContext.tsx` | **Create** | Toast provider + `useToast()` hook |
| `src/hooks/useWiktionary.ts` | **Create** | Fetch, parse, cache; `LANGUAGE_WIKTIONARY_MAP`; exported pure fns for testing |
| `src/hooks/useWiktionary.test.ts` | **Create** | Tests for map and pure parsing functions |
| `src/components/editor/WordLookupPopover.tsx` | **Create** | Compact floating lookup result (loading/error/success) |
| `src/components/editor/WordLookupPopover.css` | **Create** | Styles for the popover |
| `src/components/editor/WordLookupDrawer.tsx` | **Create** | Pinned bottom panel with full content |
| `src/components/editor/WordLookupDrawer.css` | **Create** | Styles for the drawer |
| `src/main.tsx` | **Modify** | Add `ToastProvider` wrapper around `App` |
| `src/App.tsx` | **Modify** | Replace 2 silent `console.error` calls with `showToast` |
| `src/components/index.ts` | **Modify** | Add `OverlayToaster`, `Toast2`, `Intent` re-exports |
| `src/components/editor/TranslationEditor.tsx` | **Modify** | Add `lookupState`, "Look up" menu item, render popover/drawer |
| `src/locales/en.yaml` | **Modify** | New i18n strings |

---

## Task 1: Toast System

**Files:**
- Create: `src/contexts/ToastContext.tsx`
- Modify: `src/components/index.ts`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/locales/en.yaml`

- [ ] **Step 1: Add BlueprintJS exports to the component abstraction layer**

In `src/components/index.ts`, add to the existing re-export block:

```ts
export {
  // ... existing exports ...
  OverlayToaster,
  Toast2,
  Intent,
} from '@blueprintjs/core';

export type {
  // ... existing type exports ...
  ToastProps,
} from '@blueprintjs/core';
```

- [ ] **Step 2: Add i18n strings for toast messages**

In `src/locales/en.yaml`, add a new top-level `toast` section at the end of the file:

```yaml
toast:
  copied: "Copied!"
  lookupError: "Could not load dictionary entry"
  projectLoadError: "Failed to open project file"
  docxLoadError: "Failed to read DOCX file"
```

- [ ] **Step 3: Create ToastContext**

Create `src/contexts/ToastContext.tsx`:

```tsx
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { OverlayToaster, Intent } from '../components';
import type { ToastProps } from '../components';

interface ToastContextValue {
  showToast: (message: string, intent?: Intent) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasterRef = useRef<OverlayToaster>(null);

  function showToast(message: string, intent: Intent = Intent.NONE) {
    toasterRef.current?.show({ message, intent, timeout: 2500 } satisfies ToastProps);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <OverlayToaster ref={toasterRef} position="bottom" />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
```

- [ ] **Step 4: Add ToastProvider to main.tsx**

`src/main.tsx` currently wraps with `KeyboardShortcutsProvider`. Add `ToastProvider` around it:

```tsx
import { ToastProvider } from './contexts/ToastContext';

const Root = (
  import.meta.env.DEV
    ? <ToastProvider><KeyboardShortcutsProvider><App /></KeyboardShortcutsProvider></ToastProvider>
    : <StrictMode><ToastProvider><KeyboardShortcutsProvider><App /></KeyboardShortcutsProvider></ToastProvider></StrictMode>
);
```

- [ ] **Step 5: Replace silent errors in App.tsx with showToast**

In `src/App.tsx`, add the import:
```ts
import { useToast } from './contexts/ToastContext';
```

Add inside the `App()` function body (alongside the existing `const { t } = useTranslation();` line):
```ts
const { showToast } = useToast();
```

Replace line ~143 (project file parse error):
```ts
// Before:
console.error('Failed to parse project file:', e);
// After:
console.error('Failed to parse project file:', e);
showToast(t('toast.projectLoadError'), Intent.DANGER);
```

Replace line ~159 (DOCX parse error):
```ts
// Before:
console.error('Failed to parse DOCX file:', e);
return;
// After:
console.error('Failed to parse DOCX file:', e);
showToast(t('toast.docxLoadError'), Intent.DANGER);
return;
```

Also add `Intent` to the import from `./components`:
```ts
import { Button, Dialog, DialogBody, DialogFooter, Intent } from './components';
```

- [ ] **Step 6: Run the dev server briefly to confirm toasts render**

```bash
bun run dev
```

Open the app, trigger the context menu to confirm nothing is broken. No automated test for the React component — this is a manual smoke test. Stop the dev server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/ToastContext.tsx src/components/index.ts src/main.tsx src/App.tsx src/locales/en.yaml
git commit -m "feat: add global toast notification system via ToastContext"
```

---

## Task 2: useWiktionary Hook

**Files:**
- Create: `src/hooks/useWiktionary.ts`
- Create: `src/hooks/useWiktionary.test.ts`

- [ ] **Step 1: Write failing tests for the language map and parsing logic**

Create `src/hooks/useWiktionary.test.ts`:

```ts
import { describe, it, expect } from 'bun:test';
import {
  LANGUAGE_WIKTIONARY_MAP,
  parseDefinitionsResponse,
  parseTranslationsHtml,
} from './useWiktionary';

describe('LANGUAGE_WIKTIONARY_MAP', () => {
  it('has entries for common languages', () => {
    expect(LANGUAGE_WIKTIONARY_MAP['en']).toBeDefined();
    expect(LANGUAGE_WIKTIONARY_MAP['fr']).toBeDefined();
    expect(LANGUAGE_WIKTIONARY_MAP['de']).toBeDefined();
    expect(LANGUAGE_WIKTIONARY_MAP['es']).toBeDefined();
    expect(LANGUAGE_WIKTIONARY_MAP['it']).toBeDefined();
    expect(LANGUAGE_WIKTIONARY_MAP['ja']).toBeDefined();
    expect(LANGUAGE_WIKTIONARY_MAP['zh']).toBeDefined();
  });

  it('each entry has restKey and translationLabel', () => {
    for (const [, entry] of Object.entries(LANGUAGE_WIKTIONARY_MAP)) {
      expect(typeof entry.restKey).toBe('string');
      expect(typeof entry.translationLabel).toBe('string');
      expect(entry.restKey.length).toBeGreaterThan(0);
      expect(entry.translationLabel.length).toBeGreaterThan(0);
    }
  });

  it('maps fil to tl restKey', () => {
    expect(LANGUAGE_WIKTIONARY_MAP['fil']?.restKey).toBe('tl');
  });

  it('maps nb with Norwegian Bokmål translationLabel', () => {
    expect(LANGUAGE_WIKTIONARY_MAP['nb']?.translationLabel).toBe('Norwegian Bokmål');
  });
});

describe('parseDefinitionsResponse', () => {
  const sampleResponse = {
    fr: [
      {
        partOfSpeech: 'adjective',
        language: 'French',
        definitions: [
          { definition: 'Qui dure très peu de temps.' },
          { definition: 'Transitoire, passager.' },
        ],
      },
    ],
    en: [
      {
        partOfSpeech: 'adjective',
        language: 'English',
        definitions: [{ definition: 'Lasting a very short time.' }],
      },
    ],
  };

  it('extracts entries for the given restKey', () => {
    const result = parseDefinitionsResponse(sampleResponse, 'fr');
    expect(result).toHaveLength(1);
    expect(result[0].partOfSpeech).toBe('adjective');
    expect(result[0].definitions).toHaveLength(2);
  });

  it('returns empty array for unknown restKey', () => {
    const result = parseDefinitionsResponse(sampleResponse, 'xyz');
    expect(result).toEqual([]);
  });

  it('returns empty array for null/undefined response', () => {
    expect(parseDefinitionsResponse(null, 'fr')).toEqual([]);
    expect(parseDefinitionsResponse(undefined, 'fr')).toEqual([]);
  });
});

describe('parseTranslationsHtml', () => {
  const sampleHtml = `
    <div>
      <table class="translations">
        <tr>
          <td><span class="mw-pt-translate-header">French</span></td>
        </tr>
        <tr><td><ul>
          <li><span class="t+mention">éphémère</span></li>
          <li><span class="t+mention">transitoire</span></li>
        </ul></td></tr>
        <tr>
          <td><span class="mw-pt-translate-header">German</span></td>
        </tr>
        <tr><td><ul>
          <li><span class="t+mention">flüchtig</span></li>
        </ul></td></tr>
      </table>
    </div>
  `;

  it('extracts translations for the target language label', () => {
    const result = parseTranslationsHtml(sampleHtml, 'French');
    expect(result).toContain('éphémère');
    expect(result).toContain('transitoire');
    expect(result).not.toContain('flüchtig');
  });

  it('returns empty array when label is not found', () => {
    const result = parseTranslationsHtml(sampleHtml, 'Japanese');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty html', () => {
    expect(parseTranslationsHtml('', 'French')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test src/hooks/useWiktionary.test.ts
```

Expected: FAIL — `useWiktionary` module does not exist yet.

- [ ] **Step 3: Create useWiktionary.ts with map and pure functions**

Create `src/hooks/useWiktionary.ts`:

```ts
import { useState, useEffect } from 'react';

// --- Types ---

export interface WiktionaryDefinition {
  definition: string;
  examples: string[];
}

export interface WiktionaryEntry {
  partOfSpeech: string;
  definitions: WiktionaryDefinition[];
}

export interface WiktionaryResult {
  word: string;
  entries: WiktionaryEntry[];       // grouped by part of speech
  translations: string[];           // for the targetLang
}

interface WiktionaryMapEntry {
  restKey: string;          // key in REST API response (ISO 639-1 or variant)
  translationLabel: string; // English language name in Wiktionary translation tables
}

// --- Language map ---
// Only languages where Wiktionary has sufficient coverage.
// App language codes not in this map will suppress the "Look up" menu item.

export const LANGUAGE_WIKTIONARY_MAP: Partial<Record<string, WiktionaryMapEntry>> = {
  af: { restKey: 'af', translationLabel: 'Afrikaans' },
  ar: { restKey: 'ar', translationLabel: 'Arabic' },
  bg: { restKey: 'bg', translationLabel: 'Bulgarian' },
  bn: { restKey: 'bn', translationLabel: 'Bengali' },
  ca: { restKey: 'ca', translationLabel: 'Catalan' },
  cs: { restKey: 'cs', translationLabel: 'Czech' },
  cy: { restKey: 'cy', translationLabel: 'Welsh' },
  da: { restKey: 'da', translationLabel: 'Danish' },
  de: { restKey: 'de', translationLabel: 'German' },
  el: { restKey: 'el', translationLabel: 'Greek' },
  en: { restKey: 'en', translationLabel: 'English' },
  eo: { restKey: 'eo', translationLabel: 'Esperanto' },
  es: { restKey: 'es', translationLabel: 'Spanish' },
  et: { restKey: 'et', translationLabel: 'Estonian' },
  eu: { restKey: 'eu', translationLabel: 'Basque' },
  fa: { restKey: 'fa', translationLabel: 'Persian' },
  fi: { restKey: 'fi', translationLabel: 'Finnish' },
  fil: { restKey: 'tl', translationLabel: 'Tagalog' },
  fr: { restKey: 'fr', translationLabel: 'French' },
  ga: { restKey: 'ga', translationLabel: 'Irish' },
  gl: { restKey: 'gl', translationLabel: 'Galician' },
  gu: { restKey: 'gu', translationLabel: 'Gujarati' },
  he: { restKey: 'he', translationLabel: 'Hebrew' },
  hi: { restKey: 'hi', translationLabel: 'Hindi' },
  hr: { restKey: 'hr', translationLabel: 'Croatian' },
  hu: { restKey: 'hu', translationLabel: 'Hungarian' },
  hy: { restKey: 'hy', translationLabel: 'Armenian' },
  id: { restKey: 'id', translationLabel: 'Indonesian' },
  is: { restKey: 'is', translationLabel: 'Icelandic' },
  it: { restKey: 'it', translationLabel: 'Italian' },
  ja: { restKey: 'ja', translationLabel: 'Japanese' },
  ka: { restKey: 'ka', translationLabel: 'Georgian' },
  kk: { restKey: 'kk', translationLabel: 'Kazakh' },
  km: { restKey: 'km', translationLabel: 'Khmer' },
  kn: { restKey: 'kn', translationLabel: 'Kannada' },
  ko: { restKey: 'ko', translationLabel: 'Korean' },
  la: { restKey: 'la', translationLabel: 'Latin' },
  lt: { restKey: 'lt', translationLabel: 'Lithuanian' },
  lv: { restKey: 'lv', translationLabel: 'Latvian' },
  mk: { restKey: 'mk', translationLabel: 'Macedonian' },
  ml: { restKey: 'ml', translationLabel: 'Malayalam' },
  mn: { restKey: 'mn', translationLabel: 'Mongolian' },
  mr: { restKey: 'mr', translationLabel: 'Marathi' },
  ms: { restKey: 'ms', translationLabel: 'Malay' },
  mt: { restKey: 'mt', translationLabel: 'Maltese' },
  my: { restKey: 'my', translationLabel: 'Burmese' },
  nb: { restKey: 'nb', translationLabel: 'Norwegian Bokmål' },
  ne: { restKey: 'ne', translationLabel: 'Nepali' },
  nl: { restKey: 'nl', translationLabel: 'Dutch' },
  nn: { restKey: 'nn', translationLabel: 'Norwegian Nynorsk' },
  no: { restKey: 'no', translationLabel: 'Norwegian' },
  oc: { restKey: 'oc', translationLabel: 'Occitan' },
  pa: { restKey: 'pa', translationLabel: 'Punjabi' },
  pl: { restKey: 'pl', translationLabel: 'Polish' },
  pt: { restKey: 'pt', translationLabel: 'Portuguese' },
  ro: { restKey: 'ro', translationLabel: 'Romanian' },
  ru: { restKey: 'ru', translationLabel: 'Russian' },
  sk: { restKey: 'sk', translationLabel: 'Slovak' },
  sl: { restKey: 'sl', translationLabel: 'Slovenian' },
  sq: { restKey: 'sq', translationLabel: 'Albanian' },
  sr: { restKey: 'sr', translationLabel: 'Serbian' },
  sv: { restKey: 'sv', translationLabel: 'Swedish' },
  sw: { restKey: 'sw', translationLabel: 'Swahili' },
  ta: { restKey: 'ta', translationLabel: 'Tamil' },
  te: { restKey: 'te', translationLabel: 'Telugu' },
  th: { restKey: 'th', translationLabel: 'Thai' },
  tl: { restKey: 'tl', translationLabel: 'Tagalog' },
  tr: { restKey: 'tr', translationLabel: 'Turkish' },
  uk: { restKey: 'uk', translationLabel: 'Ukrainian' },
  ur: { restKey: 'ur', translationLabel: 'Urdu' },
  uz: { restKey: 'uz', translationLabel: 'Uzbek' },
  vi: { restKey: 'vi', translationLabel: 'Vietnamese' },
  yi: { restKey: 'yi', translationLabel: 'Yiddish' },
  zh: { restKey: 'zh', translationLabel: 'Chinese' },
  zu: { restKey: 'zu', translationLabel: 'Zulu' },
};

// --- Pure parsing functions (exported for testing) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDefinitionsResponse(response: any, restKey: string): WiktionaryEntry[] {
  if (!response || typeof response !== 'object') return [];
  const langEntries = response[restKey];
  if (!Array.isArray(langEntries)) return [];

  return langEntries.map((entry: any) => ({
    partOfSpeech: entry.partOfSpeech ?? '',
    definitions: (entry.definitions ?? []).map((d: any) => ({
      definition: d.definition ?? '',
      examples: (d.parsedExamples ?? []).map((ex: any) => ex.example ?? '').filter(Boolean),
    })),
  }));
}

export function parseTranslationsHtml(html: string, translationLabel: string): string[] {
  if (!html) return [];

  // Parse in a detached DOM — works in both browser and Electron renderer
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find all elements whose text content exactly matches the translationLabel
  // Wiktionary uses <td> with a language header span, or bare text in table cells.
  // We walk the entire document looking for a text node matching the label,
  // then collect <span class="t+mention"> (or <a> with mention class) in the
  // following sibling rows.
  const allElements = Array.from(doc.querySelectorAll('td, th, span'));
  let found = false;
  const results: string[] = [];

  for (const el of allElements) {
    const text = el.textContent?.trim() ?? '';
    if (!found && text === translationLabel) {
      found = true;
      continue;
    }
    if (found) {
      // Collect mention spans in this element and its children
      const mentions = el.querySelectorAll('.t\\+mention, .tMention, [class*="mention"]');
      for (const m of mentions) {
        const word = m.textContent?.trim();
        if (word) results.push(word);
      }
      // Also try bare <a> elements if no mention spans found yet
      if (mentions.length === 0) {
        const links = el.querySelectorAll('a[title]');
        for (const a of links) {
          const word = a.textContent?.trim();
          if (word) results.push(word);
        }
      }
      // Stop after collecting from a couple of elements past the header
      // (the next header for a different language will end the block)
      const nextLabelCandidate = allElements.find(
        (e) => e !== el && e.textContent?.trim().length > 0 && allElements.indexOf(e) > allElements.indexOf(el)
      );
      if (nextLabelCandidate && results.length > 0) break;
    }
  }

  return [...new Set(results)]; // deduplicate
}

// --- Cache ---

const cache = new Map<string, WiktionaryResult>();

async function fetchWiktionary(
  word: string,
  lang: string,
  targetLang: string,
): Promise<WiktionaryResult> {
  const cacheKey = `${lang}:${word}:${targetLang}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const langEntry = LANGUAGE_WIKTIONARY_MAP[lang];
  const targetEntry = LANGUAGE_WIKTIONARY_MAP[targetLang];
  if (!langEntry) throw new Error(`Unsupported language: ${lang}`);

  const version = (await import('../../package.json')).default.version;
  const headers: Record<string, string> = {
    'Api-User-Agent': `Mirror-App/${version} (translation editor)`,
  };

  // 1. Fetch definitions
  const defResponse = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
    { headers },
  );
  if (!defResponse.ok) throw new Error(`Definition fetch failed: ${defResponse.status}`);
  const defJson = await defResponse.json();
  const entries = parseDefinitionsResponse(defJson, langEntry.restKey);

  // 2. Fetch translations (best-effort; failures are non-fatal)
  let translations: string[] = [];
  if (targetEntry) {
    try {
      const sectionsResp = await fetch(
        `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=sections&format=json&origin=*`,
        { headers },
      );
      if (sectionsResp.ok) {
        const sectionsJson = await sectionsResp.json();
        const sections: any[] = sectionsJson.parse?.sections ?? [];
        const translationSections = sections.filter((s: any) => s.line === 'Translations');
        for (const section of translationSections) {
          const htmlResp = await fetch(
            `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=text&section=${section.index}&format=json&origin=*`,
            { headers },
          );
          if (!htmlResp.ok) continue;
          const htmlJson = await htmlResp.json();
          const html: string = htmlJson.parse?.text?.['*'] ?? '';
          const found = parseTranslationsHtml(html, targetEntry.translationLabel);
          translations = [...translations, ...found];
          if (translations.length > 0) break; // stop after first section with results
        }
      }
    } catch {
      // Translations are non-fatal — continue without them
    }
  }

  const result: WiktionaryResult = {
    word,
    entries,
    translations: [...new Set(translations)],
  };
  cache.set(cacheKey, result);
  return result;
}

// --- Hook ---

export interface WiktionaryState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: WiktionaryResult | null;
  error: string | null;
}

export function useWiktionary(
  word: string | null,
  lang: string | null,
  targetLang: string | null,
): WiktionaryState {
  const [state, setState] = useState<WiktionaryState>({
    status: 'idle',
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!word || !lang || !targetLang) {
      setState({ status: 'idle', data: null, error: null });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });

    fetchWiktionary(word, lang, targetLang)
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          setState({ status: 'error', data: null, error: msg });
        }
      });

    return () => { cancelled = true; };
  }, [word, lang, targetLang]);

  return state;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test src/hooks/useWiktionary.test.ts
```

Expected: PASS — all map and parsing tests green.

> Note: `parseTranslationsHtml` tests use `DOMParser`, which requires a browser/jsdom environment. If Bun's test runner doesn't provide `DOMParser` by default, these tests will need to be marked as skipped or moved to a browser test suite. If they fail with "DOMParser is not defined", add `--preload` setup or skip those tests for now; the parsing logic will still be exercised through manual testing.

- [ ] **Step 5: Run all tests to confirm no regressions**

```bash
bun run test
```

Expected: all pre-existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useWiktionary.ts src/hooks/useWiktionary.test.ts
git commit -m "feat: add useWiktionary hook with language map, fetch, parse, and cache"
```

---

## Task 3: WordLookupPopover Component

**Files:**
- Create: `src/components/editor/WordLookupPopover.tsx`
- Create: `src/components/editor/WordLookupPopover.css`

- [ ] **Step 1: Create the CSS**

Create `src/components/editor/WordLookupPopover.css`:

```css
.word-lookup-popover {
  position: fixed;
  z-index: 50;
  width: 280px;
  background: var(--bp6-dark-bg2, #252a31);
  border: 1px solid var(--bp6-dark-divider, #404854);
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  font-size: 13px;
  color: var(--bp6-dark-text, #f5f8fa);
}

.word-lookup-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 6px;
  border-bottom: 1px solid var(--bp6-dark-divider, #404854);
  gap: 6px;
}

.word-lookup-popover__word {
  font-weight: 600;
  font-size: 14px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.word-lookup-popover__pos {
  font-size: 11px;
  font-style: italic;
  color: var(--bp6-dark-text-muted, #8f99a8);
  margin-left: 4px;
}

.word-lookup-popover__controls {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.word-lookup-popover__body {
  padding: 8px 10px;
}

.word-lookup-popover__defs {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}

.word-lookup-popover__defs li {
  padding: 2px 0;
  line-height: 1.4;
  color: var(--bp6-dark-text, #f5f8fa);
}

.word-lookup-popover__defs li + li {
  margin-top: 4px;
}

.word-lookup-popover__defs li::before {
  content: attr(data-n) ". ";
  color: var(--bp6-dark-text-muted, #8f99a8);
}

.word-lookup-popover__translations {
  border-top: 1px solid var(--bp6-dark-divider, #404854);
  padding-top: 6px;
  font-size: 12px;
}

.word-lookup-popover__translations-label {
  color: var(--bp6-dark-text-muted, #8f99a8);
  font-size: 11px;
  margin-bottom: 4px;
}

.word-lookup-popover__translation-word {
  display: inline-block;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 2px;
  color: var(--bp6-intent-primary, #4c90f0);
}

.word-lookup-popover__translation-word:hover {
  background: rgba(76, 144, 240, 0.15);
}

.word-lookup-popover__status {
  padding: 12px 10px;
  text-align: center;
  color: var(--bp6-dark-text-muted, #8f99a8);
  font-size: 12px;
}

.word-lookup-popover__error {
  padding: 8px 10px;
  color: var(--bp6-intent-danger, #e76565);
  font-size: 12px;
}
```

- [ ] **Step 2: Create the component**

Create `src/components/editor/WordLookupPopover.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../index';
import { useToast } from '../../contexts/ToastContext';
import { Intent } from '../index';
import type { WiktionaryState } from '../../hooks/useWiktionary';
import './WordLookupPopover.css';

interface WordLookupPopoverProps {
  word: string;
  x: number;
  y: number;
  wiktionary: WiktionaryState;
  targetLangLabel: string;  // human-readable name of the translation language
  onPin: () => void;
  onClose: () => void;
}

export function WordLookupPopover({
  word, x, y, wiktionary, targetLangLabel, onPin, onClose,
}: WordLookupPopoverProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Adjust position to keep popover in viewport
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 300),
    top: Math.min(y, window.innerHeight - 300),
  };

  function handleCopyTranslation(word: string) {
    navigator.clipboard.writeText(word).then(() => {
      showToast(t('toast.copied'), Intent.SUCCESS);
    });
  }

  const firstEntry = wiktionary.data?.entries[0];

  return (
    <div className="word-lookup-popover" style={style} ref={ref}>
      <div className="word-lookup-popover__header">
        <span className="word-lookup-popover__word">
          {word}
          {firstEntry && (
            <span className="word-lookup-popover__pos">{firstEntry.partOfSpeech}</span>
          )}
        </span>
        <div className="word-lookup-popover__controls">
          <Button minimal small icon="pin" title={t('lookup.pin')} onClick={onPin} />
          <Button minimal small icon="cross" title={t('actions.close')} onClick={onClose} />
        </div>
      </div>

      {wiktionary.status === 'loading' && (
        <div className="word-lookup-popover__status">{t('lookup.loading')}</div>
      )}

      {wiktionary.status === 'error' && (
        <div className="word-lookup-popover__error">{wiktionary.error ?? t('toast.lookupError')}</div>
      )}

      {wiktionary.status === 'success' && firstEntry && (
        <div className="word-lookup-popover__body">
          <ol className="word-lookup-popover__defs">
            {firstEntry.definitions.slice(0, 2).map((def, i) => (
              <li key={i} data-n={i + 1}
                dangerouslySetInnerHTML={{ __html: def.definition }}
              />
            ))}
          </ol>

          {wiktionary.data!.translations.length > 0 && (
            <div className="word-lookup-popover__translations">
              <div className="word-lookup-popover__translations-label">
                {targetLangLabel}:
              </div>
              <div>
                {wiktionary.data!.translations.slice(0, 8).map((w, i) => (
                  <span key={i}>
                    <span
                      className="word-lookup-popover__translation-word"
                      onClick={() => handleCopyTranslation(w)}
                      title={t('lookup.clickToCopy')}
                    >
                      {w}
                    </span>
                    {i < Math.min(7, wiktionary.data!.translations.length - 1) && ', '}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add lookup i18n strings to en.yaml**

In `src/locales/en.yaml`, add a `lookup` section:

```yaml
lookup:
  menuItem: "Look up: {{word}}"
  loading: "Loading..."
  pin: "Pin to drawer"
  clickToCopy: "Click to copy"
  noEntry: "No entry found"
  translations: "Translations"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/WordLookupPopover.tsx src/components/editor/WordLookupPopover.css src/locales/en.yaml
git commit -m "feat: add WordLookupPopover component"
```

---

## Task 4: WordLookupDrawer Component

**Files:**
- Create: `src/components/editor/WordLookupDrawer.tsx`
- Create: `src/components/editor/WordLookupDrawer.css`

- [ ] **Step 1: Create the CSS**

Create `src/components/editor/WordLookupDrawer.css`:

```css
.word-lookup-drawer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 250px;
  background: var(--bp6-dark-bg2, #252a31);
  border-top: 2px solid var(--bp6-intent-primary, #4c90f0);
  z-index: 40;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: var(--bp6-dark-text, #f5f8fa);
}

.word-lookup-drawer__header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid var(--bp6-dark-divider, #404854);
  gap: 8px;
  flex-shrink: 0;
}

.word-lookup-drawer__word {
  font-weight: 600;
  font-size: 15px;
}

.word-lookup-drawer__source {
  font-size: 11px;
  color: var(--bp6-dark-text-muted, #8f99a8);
}

.word-lookup-drawer__close {
  margin-left: auto;
}

.word-lookup-drawer__body {
  overflow-y: auto;
  flex: 1;
  padding: 8px 12px 12px;
  display: flex;
  gap: 24px;
}

.word-lookup-drawer__entries {
  flex: 2;
  min-width: 0;
}

.word-lookup-drawer__entry {
  margin-bottom: 12px;
}

.word-lookup-drawer__pos {
  font-size: 11px;
  font-style: italic;
  color: var(--bp6-dark-text-muted, #8f99a8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.word-lookup-drawer__defs {
  margin: 0;
  padding: 0;
  list-style: none;
}

.word-lookup-drawer__defs li {
  padding: 3px 0;
  line-height: 1.4;
}

.word-lookup-drawer__defs li + li {
  margin-top: 4px;
}

.word-lookup-drawer__example {
  font-style: italic;
  font-size: 12px;
  color: var(--bp6-dark-text-muted, #8f99a8);
  margin-top: 2px;
  padding-left: 12px;
  border-left: 2px solid var(--bp6-dark-divider, #404854);
}

.word-lookup-drawer__translations {
  flex: 1;
  min-width: 120px;
  border-left: 1px solid var(--bp6-dark-divider, #404854);
  padding-left: 16px;
}

.word-lookup-drawer__translations-label {
  font-size: 11px;
  color: var(--bp6-dark-text-muted, #8f99a8);
  margin-bottom: 6px;
}

.word-lookup-drawer__translation-word {
  display: block;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
  color: var(--bp6-intent-primary, #4c90f0);
  line-height: 1.6;
}

.word-lookup-drawer__translation-word:hover {
  background: rgba(76, 144, 240, 0.15);
}

.word-lookup-drawer__status {
  padding: 24px;
  text-align: center;
  color: var(--bp6-dark-text-muted, #8f99a8);
}

.word-lookup-drawer__error {
  padding: 12px;
  color: var(--bp6-intent-danger, #e76565);
}
```

- [ ] **Step 2: Create the component**

Create `src/components/editor/WordLookupDrawer.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Button, Intent } from '../index';
import { useToast } from '../../contexts/ToastContext';
import type { WiktionaryState } from '../../hooks/useWiktionary';
import './WordLookupDrawer.css';

interface WordLookupDrawerProps {
  word: string;
  wiktionary: WiktionaryState;
  targetLangLabel: string;
  onClose: () => void;
}

export function WordLookupDrawer({ word, wiktionary, targetLangLabel, onClose }: WordLookupDrawerProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  function handleCopyTranslation(w: string) {
    navigator.clipboard.writeText(w).then(() => {
      showToast(t('toast.copied'), Intent.SUCCESS);
    });
  }

  return (
    <div className="word-lookup-drawer">
      <div className="word-lookup-drawer__header">
        <span className="word-lookup-drawer__word">{word}</span>
        <span className="word-lookup-drawer__source">en.wiktionary.org</span>
        <Button
          className="word-lookup-drawer__close"
          minimal small icon="cross"
          title={t('actions.close')}
          onClick={onClose}
        />
      </div>

      {wiktionary.status === 'loading' && (
        <div className="word-lookup-drawer__status">{t('lookup.loading')}</div>
      )}

      {wiktionary.status === 'error' && (
        <div className="word-lookup-drawer__error">{wiktionary.error ?? t('toast.lookupError')}</div>
      )}

      {wiktionary.status === 'success' && wiktionary.data && (
        <div className="word-lookup-drawer__body">
          <div className="word-lookup-drawer__entries">
            {wiktionary.data.entries.length === 0 && (
              <p style={{ color: 'var(--bp6-dark-text-muted, #8f99a8)' }}>{t('lookup.noEntry')}</p>
            )}
            {wiktionary.data.entries.map((entry, ei) => (
              <div key={ei} className="word-lookup-drawer__entry">
                <div className="word-lookup-drawer__pos">{entry.partOfSpeech}</div>
                <ol className="word-lookup-drawer__defs">
                  {entry.definitions.map((def, di) => (
                    <li key={di}>
                      <span dangerouslySetInnerHTML={{ __html: def.definition }} />
                      {def.examples.map((ex, xi) => (
                        <div key={xi} className="word-lookup-drawer__example"
                          dangerouslySetInnerHTML={{ __html: ex }}
                        />
                      ))}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {wiktionary.data.translations.length > 0 && (
            <div className="word-lookup-drawer__translations">
              <div className="word-lookup-drawer__translations-label">
                {targetLangLabel}
              </div>
              {wiktionary.data.translations.map((w, i) => (
                <span
                  key={i}
                  className="word-lookup-drawer__translation-word"
                  onClick={() => handleCopyTranslation(w)}
                  title={t('lookup.clickToCopy')}
                >
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/WordLookupDrawer.tsx src/components/editor/WordLookupDrawer.css
git commit -m "feat: add WordLookupDrawer component"
```

---

## Task 5: Wire up in TranslationEditor

**Files:**
- Modify: `src/components/editor/TranslationEditor.tsx`

- [ ] **Step 1: Add imports and LookupState interface to TranslationEditor.tsx**

At the top of `src/components/editor/TranslationEditor.tsx`, add imports:

```tsx
import { LANGUAGE_WIKTIONARY_MAP, useWiktionary } from '../../hooks/useWiktionary';
import { WordLookupPopover } from './WordLookupPopover';
import { WordLookupDrawer } from './WordLookupDrawer';
import { LANGUAGES } from '../../constants/languages';
import { MenuDivider, Intent } from '../index';
import { useToast } from '../../contexts/ToastContext';
```

Add the `LookupState` interface before `TranslationEditorInner`:

```tsx
interface LookupState {
  word: string;
  lang: string;
  targetLang: string;
  x: number;
  y: number;
  pinned: boolean;
}
```

- [ ] **Step 2: Add lookupState and wiring inside TranslationEditorInner**

Inside `TranslationEditorInner`, alongside the existing `const [contextMenu, ...]` state, add:

```tsx
const { showToast } = useToast();
const [lookupState, setLookupState] = useState<LookupState | null>(null);

const wiktionary = useWiktionary(
  lookupState?.word ?? null,
  lookupState?.lang ?? null,
  lookupState?.targetLang ?? null,
);

// Show a toast when a lookup fails
const prevStatusRef = useRef<string>('idle');
useEffect(() => {
  if (wiktionary.status === 'error' && prevStatusRef.current !== 'error') {
    showToast(t('toast.lookupError'), Intent.WARNING);
  }
  prevStatusRef.current = wiktionary.status;
}, [wiktionary.status, showToast, t]);
```

- [ ] **Step 3: Add the "Look up" menu item to the context menu**

In `TranslationEditor.tsx`, inside the `<Menu>` block in the JSX (after the existing `MenuItem` items), add:

```tsx
{contextMenu.word && LANGUAGE_WIKTIONARY_MAP[
  contextMenu.side === 'source' ? sourceLanguage : translationLanguage
] && (
  <>
    <MenuDivider />
    <MenuItem
      text={t('lookup.menuItem', { word: contextMenu.word })}
      icon="book"
      onClick={() => {
        const pane = contextMenu.side === 'source' ? sourceLanguage : translationLanguage;
        const other = contextMenu.side === 'source' ? translationLanguage : sourceLanguage;
        if (lookupState?.pinned) {
          // Replace drawer content with new lookup
          setLookupState({
            word: contextMenu.word!,
            lang: pane,
            targetLang: other,
            x: contextMenu.x,
            y: contextMenu.y,
            pinned: true,
          });
        } else {
          setLookupState({
            word: contextMenu.word!,
            lang: pane,
            targetLang: other,
            x: contextMenu.x,
            y: contextMenu.y,
            pinned: false,
          });
        }
        setContextMenu(null);
      }}
    />
  </>
)}
```

- [ ] **Step 4: Render WordLookupPopover and WordLookupDrawer**

In `TranslationEditorInner`'s return JSX, after the existing context menu `{contextMenu && (...)}` block, add:

```tsx
{lookupState && !lookupState.pinned && (
  <WordLookupPopover
    word={lookupState.word}
    x={lookupState.x}
    y={lookupState.y}
    wiktionary={wiktionary}
    targetLangLabel={
      LANGUAGES.find(l => l.code === lookupState.targetLang)?.name ?? lookupState.targetLang
    }
    onPin={() => setLookupState(s => s ? { ...s, pinned: true } : null)}
    onClose={() => setLookupState(null)}
  />
)}
{lookupState?.pinned && (
  <WordLookupDrawer
    word={lookupState.word}
    wiktionary={wiktionary}
    targetLangLabel={
      LANGUAGES.find(l => l.code === lookupState.targetLang)?.name ?? lookupState.targetLang
    }
    onClose={() => setLookupState(null)}
  />
)}
```

- [ ] **Step 5: Run the dev server and smoke test the full feature**

```bash
bun run dev
```

1. Open the app with some source text (e.g. a French passage)
2. Right-click a French word — confirm "Look up: [word]" appears in menu
3. Click it — confirm popover appears with loading state, then definition + translations
4. Click the pin icon — confirm popover becomes a bottom drawer
5. Right-click another word while drawer is open — confirm drawer content updates
6. Click a translation word — confirm "Copied!" toast appears
7. Close the drawer — confirm it disappears
8. Right-click a word on the translation pane — confirm it works in both directions

Stop the dev server with Ctrl+C.

- [ ] **Step 6: Run all tests to confirm no regressions**

```bash
bun run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/TranslationEditor.tsx
git commit -m "feat: wire up Wiktionary lookup in TranslationEditor context menu"
```

---

## Task 6: Version Bump

- [ ] **Step 1: Bump prerelease version**

```bash
bun pm version prerelease --preid=alpha
```

Expected output: version is incremented (e.g. `0.1.1-alpha.N → 0.1.1-alpha.N+1`).

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version"
```
