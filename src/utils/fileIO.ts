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

export function readFileAsArrayBuffer(
  accept: string,
): Promise<{ name: string; buffer: ArrayBuffer } | null> {
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
        resolve({ name: file.name, buffer: reader.result as ArrayBuffer });
      };
      reader.onerror = () => {
        cleanup();
        resolve(null);
      };
      reader.readAsArrayBuffer(file);
    });

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

const MIRROR_PROJECT_ACCEPT: FilePickerAcceptType[] = [
  {
    description: 'Mirror Project',
    accept: { 'application/json': ['.mirror.json'] },
  },
];

/**
 * Opens the OS save picker and writes content to the chosen file.
 * Returns the FileSystemFileHandle on success, or null if cancelled or unsupported.
 * Falls back to downloadFile if the File System Access API is unavailable.
 */
export async function saveFileWithPicker(
  suggestedName: string,
  content: string,
  mimeType: string,
): Promise<FileSystemFileHandle | null> {
  if (typeof window.showSaveFilePicker !== 'function') {
    downloadFile(suggestedName, content, mimeType);
    return null;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: MIRROR_PROJECT_ACCEPT,
    });
    await saveFileToHandle(handle, content);
    return handle;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

/**
 * Writes content to an existing FileSystemFileHandle (no picker shown).
 */
export async function saveFileToHandle(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Opens the OS file picker for opening a project file.
 * Returns name, content, and handle, or null if cancelled or unsupported.
 * Falls back to readFileAsText if the File System Access API is unavailable.
 */
export async function openFileWithPicker(): Promise<{
  name: string;
  content: string;
  handle: FileSystemFileHandle;
} | null> {
  if (typeof window.showOpenFilePicker !== 'function') {
    const result = await readFileAsText('.mirror.json');
    if (!result) return null;
    return { name: result.name, content: result.content, handle: null as unknown as FileSystemFileHandle };
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: MIRROR_PROJECT_ACCEPT,
      multiple: false,
    });
    const file = await handle!.getFile();
    const content = await file.text();
    return { name: file.name, content, handle: handle! };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}
