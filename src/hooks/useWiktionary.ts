import { useState, useEffect } from 'react';
import pkgJson from '../../package.json';

const APP_VERSION: string = (pkgJson as { version?: string }).version ?? '0.0.0';

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
  entries: WiktionaryEntry[];
  translations: string[];
}

interface WiktionaryMapEntry {
  restKey: string;
  translationLabel: string;
}

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return langEntries.map((entry: any) => ({
    partOfSpeech: entry.partOfSpeech ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    definitions: (entry.definitions ?? []).map((d: any) => ({
      definition: d.definition ?? '',
      examples: (d.parsedExamples ?? []).map((ex: any) => ex.example ?? '').filter(Boolean),
    })),
  }));
}

export function parseTranslationsHtml(html: string, translationLabel: string): string[] {
  if (!html) return [];
  if (typeof DOMParser === 'undefined') return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

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
      // Collect translation mention spans
      const mentions = el.querySelectorAll('.t\\+mention, .tMention, [class*="mention"]');
      for (const m of mentions) {
        const word = m.textContent?.trim();
        if (word) results.push(word);
      }
      // Fallback: bare links
      if (mentions.length === 0) {
        const links = el.querySelectorAll('a[title]');
        for (const a of links) {
          const word = a.textContent?.trim();
          if (word) results.push(word);
        }
      }
      if (results.length > 0) break;
    }
  }

  return [...new Set(results)];
}

// --- Cache ---

const cache = new Map<string, WiktionaryResult>();

async function fetchWiktionary(
  word: string,
  lang: string,
  targetLang: string,
): Promise<WiktionaryResult> {
  const cacheKey = `${lang}:${word}:${targetLang}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const langEntry = LANGUAGE_WIKTIONARY_MAP[lang];
  const targetEntry = LANGUAGE_WIKTIONARY_MAP[targetLang];
  if (!langEntry) throw new Error(`Unsupported language: ${lang}`);
  const normalizedWord = word.trim().toLowerCase();
  if (!normalizedWord) throw new Error('Empty word');

  const headers: Record<string, string> = {
    'Api-User-Agent': `Mirror-App/${APP_VERSION} (translation editor)`,
  };

  // 1. Fetch definitions via REST API
  const defResponse = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(normalizedWord)}`,
    { headers },
  );
  if (!defResponse.ok) throw new Error(`Definition fetch failed: ${defResponse.status}`);
  const defJson = await defResponse.json();
  const entries = parseDefinitionsResponse(defJson, langEntry.restKey);

  // 2. Fetch translations via Action API (best-effort, non-fatal)
  let translations: string[] = [];
  if (targetEntry) {
    try {
      const sectionsResp = await fetch(
        `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(normalizedWord)}&prop=sections&format=json&origin=*`,
        { headers },
      );
      if (sectionsResp.ok) {
        const sectionsJson = await sectionsResp.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sections: any[] = sectionsJson.parse?.sections ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const translationSections = sections.filter((s: any) => s.line === 'Translations');
        for (const section of translationSections) {
          const htmlResp = await fetch(
            `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(normalizedWord)}&prop=text&section=${section.index}&format=json&origin=*`,
            { headers },
          );
          if (!htmlResp.ok) continue;
          const htmlJson = await htmlResp.json();
          const html: string = htmlJson.parse?.text?.['*'] ?? '';
          const found = parseTranslationsHtml(html, targetEntry.translationLabel);
          translations = [...translations, ...found];
          if (translations.length > 0) break;
        }
      }
    } catch {
      // Non-fatal: return definitions without translations
    }
  }

  const result: WiktionaryResult = {
    word: normalizedWord,
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

    return () => {
      cancelled = true;
    };
  }, [word, lang, targetLang]);

  return state;
}
