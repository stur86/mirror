/// <reference types="vite/client" />

// File System Access API — not in lib.dom.d.ts as of TS 5.x
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}
interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}
interface Window {
  showSaveFilePicker?(opts?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  showOpenFilePicker?(opts?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}

declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

declare module '*.yml?raw' {
  const content: string;
  export default content;
}
