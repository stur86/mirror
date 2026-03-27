// electrobun.config.ts
// electrobun.config.ts is loaded as a real ESM module by Bun, so we can import package.json
// directly. This keeps the version in sync with `bun pm version prerelease` automatically.
import pkg from "./package.json" with { type: "json" };

export default {
  app: {
    name: "Mirror",
    identifier: "com.mirror.app",
    version: pkg.version,
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
    mac: {
      // .iconset folder converted to .icns by iconutil during build (macOS only)
      icons: "assets/icon.iconset",
    },
    linux: {
      icon: "assets/icon256.png",
    },
    win: {
      icon: "assets/icon.ico",
    },
  },
};
