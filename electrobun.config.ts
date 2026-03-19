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
  },
};
