/// <reference types="vite/client" />

// Make the Vite-defined replacement `__APP_VERSION__` visible to the
// TypeScript project used for Electron compilation/typechecking.
declare const __APP_VERSION__: string;
