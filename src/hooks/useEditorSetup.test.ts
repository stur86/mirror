import { describe, it, expect } from 'bun:test';
import { BOLD_ITALIC_STAR_RE, BOLD_ITALIC_UNDERSCORE_RE } from './useEditorSetup';

describe('BOLD_ITALIC_STAR_RE – ***text***', () => {
  it('matches ***text*** and captures the inner text', () => {
    const m = '***hello***'.match(BOLD_ITALIC_STAR_RE);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('hello');
  });

  it('matches with a leading space', () => {
    const m = ' ***hello***'.match(BOLD_ITALIC_STAR_RE);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('hello');
  });

  it('matches content containing spaces', () => {
    const m = '***bold italic***'.match(BOLD_ITALIC_STAR_RE);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('bold italic');
  });

  it('does not match **text** (bold only)', () => {
    expect('**hello**'.match(BOLD_ITALIC_STAR_RE)).toBeNull();
  });

  it('does not match *text* (italic only)', () => {
    expect('*hello*'.match(BOLD_ITALIC_STAR_RE)).toBeNull();
  });

  it('does not match unclosed ***text', () => {
    expect('***hello'.match(BOLD_ITALIC_STAR_RE)).toBeNull();
  });
});

describe('BOLD_ITALIC_UNDERSCORE_RE – ___text___', () => {
  it('matches ___text___ and captures the inner text', () => {
    const m = '___hello___'.match(BOLD_ITALIC_UNDERSCORE_RE);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('hello');
  });

  it('matches content containing spaces', () => {
    const m = '___bold italic___'.match(BOLD_ITALIC_UNDERSCORE_RE);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('bold italic');
  });

  it('does not match __text__ (bold only)', () => {
    expect('__hello__'.match(BOLD_ITALIC_UNDERSCORE_RE)).toBeNull();
  });

  it('does not match _text_ (italic only)', () => {
    expect('_hello_'.match(BOLD_ITALIC_UNDERSCORE_RE)).toBeNull();
  });
});
