import { describe, it, expect } from 'bun:test';
import { htmlToMarkdown } from './docxConvert';

describe('htmlToMarkdown – headings', () => {
  it('converts h1 to # heading', () => {
    expect(htmlToMarkdown('<h1>A title</h1>')).toBe('# A title');
  });

  it('converts h2 to ## heading', () => {
    expect(htmlToMarkdown('<h2>A subtitle</h2>')).toBe('## A subtitle');
  });

  it('converts h3 to ### heading', () => {
    expect(htmlToMarkdown('<h3>Section</h3>')).toBe('### Section');
  });

  it('strips anchor IDs that mammoth inserts before heading text', () => {
    // mammoth adds <a id="..."> bookmarks inside headings
    expect(htmlToMarkdown('<h1><a id="_abc123"></a>A title</h1>')).toBe('# A title');
  });
});

describe('htmlToMarkdown – inline formatting', () => {
  it('converts strong to **bold**', () => {
    expect(htmlToMarkdown('<p><strong>bold text</strong></p>')).toBe('**bold text**');
  });

  it('converts em to _italic_', () => {
    expect(htmlToMarkdown('<p><em>italic text</em></p>')).toBe('_italic text_');
  });

  it('converts strong>em to **_bold italic_**', () => {
    expect(htmlToMarkdown('<p><strong><em>bold italic</em></strong></p>')).toBe('**_bold italic_**');
  });

  it('converts em>strong to _**bold italic**_', () => {
    expect(htmlToMarkdown('<p><em><strong>bold italic</strong></em></p>')).toBe('_**bold italic**_');
  });

  it('handles mixed inline within a paragraph', () => {
    const html = '<p>Some text, <strong>some bold text</strong>, <em>some italic text</em></p>';
    expect(htmlToMarkdown(html)).toBe('Some text, **some bold text**, _some italic text_');
  });
});

describe('htmlToMarkdown – lists', () => {
  it('converts ul to - bullet list', () => {
    const md = htmlToMarkdown('<ul><li>One</li><li>Two</li></ul>');
    expect(md).toContain('-   One');
    expect(md).toContain('-   Two');
  });

  it('converts ol to numbered list', () => {
    const md = htmlToMarkdown('<ol><li>First</li><li>Second</li></ol>');
    expect(md).toContain('1.  First');
    expect(md).toContain('2.  Second');
  });
});
