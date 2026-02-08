/**
 * File I/O utilities using browser APIs.
 * Works in both web and Electron contexts.
 */

export function readFileAsText(
  accept: string,
): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        cleanup();
        resolve({ name: file.name, content: reader.result as string });
      };
      reader.onerror = () => {
        cleanup();
        resolve(null);
      };
      reader.readAsText(file);
    });

    // Handle cancel (user closes file dialog without selecting)
    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });

    function cleanup() {
      document.body.removeChild(input);
    }

    input.click();
  });
}

export function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
