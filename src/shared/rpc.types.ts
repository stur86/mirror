// RPCSchema is a type helper from Electrobun. Import from electrobun/bun;
// if Vite complains about this import, wrap in `import type` or try `electrobun`.
import type { RPCSchema } from "electrobun/bun";

export type MirrorRPCType = {
  // Handlers that run in the bun (main) process
  bun: RPCSchema<{
    requests: {
      // Renderer asks bun to show a folder picker and write the file there.
      // Returns the full written path, or null if cancelled.
      saveProjectAs: { params: { suggestedName: string; content: string }; response: string | null };
      // Renderer asks bun to write content to a known path (no dialog).
      // Returns true on success.
      saveProjectToPath: { params: { path: string; content: string }; response: boolean };
      // Renderer asks bun to list a directory's contents.
      // Directories come first, sorted alphabetically. Dotfiles excluded.
      // Returns { error } on permission/IO failure (no throw).
      listDirectory: {
        params: { path: string };
        response: { entries: Array<{ name: string; isDirectory: boolean }> } | { error: string };
      };
      // Renderer asks bun for standard OS directory paths.
      getStandardPaths: {
        params: Record<string, never>;
        response: { home: string; desktop: string; documents: string; downloads: string };
      };
      // Renderer asks bun to create a directory. Returns ok: false on error (no throw).
      createDirectory: {
        params: { path: string };
        response: { ok: boolean };
      };
      // Renderer asks bun to read a file as base64. Returns { error } on failure (no throw).
      readFile: {
        params: { path: string };
        response: { base64: string } | { error: string };
      };
    };
    messages: {
      // Renderer tells main: dirty state changed
      setDirty: { dirty: boolean };
      // Renderer confirms it's OK to close (after Save / Discard)
      confirmClose: Record<string, never>;
      // Renderer requests fullscreen toggle
      toggleFullscreen: Record<string, never>;
    };
  }>;
  // Handlers that run in the webview (renderer) process
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      // Main tells renderer: user tried to close with unsaved changes
      closeRequested: Record<string, never>;
      // Main tells renderer: fullscreen state changed
      fullscreenChanged: { isFullscreen: boolean };
    };
  }>;
};
