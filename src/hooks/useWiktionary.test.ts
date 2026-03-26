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

  it('maps parsedExamples to examples array', () => {
    const response = {
      en: [
        {
          partOfSpeech: 'adjective',
          language: 'English',
          definitions: [
            {
              definition: 'Lasting a very short time.',
              parsedExamples: [
                { example: 'an ephemeral moment' },
                { example: 'ephemeral pleasures' },
              ],
            },
          ],
        },
      ],
    };
    const result = parseDefinitionsResponse(response, 'en');
    expect(result[0].definitions[0].examples).toEqual(['an ephemeral moment', 'ephemeral pleasures']);
  });
});

describe('parseTranslationsHtml', () => {
  // DOMParser is not available in Bun's test runner environment.
  // The implementation guards with `typeof DOMParser === 'undefined'` and returns []
  // gracefully. These tests are skipped so the suite can run headlessly; they are
  // covered by browser/Electron integration testing instead.

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

  it.skip('extracts translations for the target language label (requires DOMParser)', () => {
    const result = parseTranslationsHtml(sampleHtml, 'French');
    expect(result).toContain('éphémère');
    expect(result).toContain('transitoire');
    expect(result).not.toContain('flüchtig');
  });

  it.skip('returns empty array when label is not found (requires DOMParser)', () => {
    const result = parseTranslationsHtml(sampleHtml, 'Japanese');
    expect(result).toEqual([]);
  });

  it.skip('returns empty array for empty html (requires DOMParser)', () => {
    expect(parseTranslationsHtml('', 'French')).toEqual([]);
  });
});
