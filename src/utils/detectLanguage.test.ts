import { describe, it, expect } from 'bun:test';
import { detectLanguage } from './detectLanguage';

describe('detectLanguage', () => {
  it('detects English from a long English passage', () => {
    const text = 'The quick brown fox jumps over the lazy dog. ' +
      'This is a fairly long English sentence to give franc enough signal ' +
      'to detect the language correctly without any ambiguity.';
    expect(detectLanguage(text)).toBe('en');
  });

  it('detects Italian from a long Italian passage', () => {
    const text = 'Il veloce volpe marrone salta sopra il cane pigro. ' +
      'Questa è una frase abbastanza lunga in italiano per dare a franc ' +
      'abbastanza segnale per rilevare correttamente la lingua senza ambiguità.';
    expect(detectLanguage(text)).toBe('it');
  });

  it('returns null for empty string', () => {
    expect(detectLanguage('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(detectLanguage('   \n\t  ')).toBeNull();
  });

  it('returns null for very short text that franc cannot classify', () => {
    // franc returns 'und' for text too short to classify reliably
    expect(detectLanguage('hi')).toBeNull();
  });
});
