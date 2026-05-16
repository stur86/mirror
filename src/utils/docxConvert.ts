import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

export async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const { default: mammoth } = await import('mammoth');
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
    },
  );
  return htmlToMarkdown(result.value);
}
