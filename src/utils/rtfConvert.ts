// @ts-expect-error – @iarna/rtf-to-html has no type declarations
import rtfToHTML from '@iarna/rtf-to-html';

export function rtfToHtml(buffer: ArrayBuffer): Promise<string> {
  // Decode as latin1 to preserve all byte values; RTF uses its own escape encoding
  const text = new TextDecoder('latin1').decode(buffer);
  return new Promise((resolve, reject) => {
    rtfToHTML.fromString(text, (err: Error | null, html: string) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(html);
    });
  });
}
