/**
 * Simple markdown ↔ HTML conversion utilities.
 * Handles headings, paragraphs, bold, and italic.
 */

export function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const htmlParts: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      const text = paragraphLines.join(' ');
      htmlParts.push(`<p>${inlineToHtml(text)}</p>`);
      paragraphLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${inlineToHtml(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Accumulate paragraph lines
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  return htmlParts.join('\n');
}

function inlineToHtml(text: string): string {
  // Bold: **text** or __text__
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic: *text* or _text_ (but not inside bold markers)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
  return result;
}

export function htmlToMarkdown(html: string): string {
  let md = html;

  // Replace headings
  for (let i = 1; i <= 6; i++) {
    const prefix = '#'.repeat(i);
    md = md.replace(new RegExp(`<h${i}[^>]*>(.*?)</h${i}>`, 'gi'), `${prefix} $1`);
  }

  // Replace strong/b with **
  md = md.replace(/<(?:strong|b)>(.*?)<\/(?:strong|b)>/gi, '**$1**');

  // Replace em/i with *
  md = md.replace(/<(?:em|i)>(.*?)<\/(?:em|i)>/gi, '*$1*');

  // Replace <br> with newline
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Replace <p> blocks with content + double newline
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

  // Strip any remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // Clean up excessive blank lines
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim() + '\n';
}
