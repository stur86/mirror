// electrobun.config.ts
export default {
  app: {
    name: "Mirror",
    identifier: "com.mirror.app",
    version: "0.1.1-alpha.2",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    // Copy the Vite-built dist/ folder into the views bundle so it's
    // served via views://mirror/index.html in production.
    // Run `bun run build` before `electrobun build` (electrobun:build does both).
    copy: {
      "dist": "views/mirror",
    },
  },
};
