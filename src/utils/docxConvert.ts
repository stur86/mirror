import mammoth from 'mammoth';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

export async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
    },
  );
  return turndown.turndown(result.value);
}
