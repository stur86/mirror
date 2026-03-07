declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      setDirty: (isDirty: boolean) => void;
      onCloseRequested: (cb: () => void) => () => void;
      confirmClose: () => void;
      toggleFullscreen: () => void;
      onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void;
    };
  }
}

export {};
