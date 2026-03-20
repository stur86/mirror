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
