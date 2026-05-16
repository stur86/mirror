import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

// Strip query strings from font url() references in CSS.
// Electrobun's views:// scheme handler (CEF/Linux) does a literal filesystem lookup
// and does not strip query strings, so Blueprint's ?hash cache-busters cause
// "File not found" errors. Vite already adds content hashes to font filenames,
// making the query strings redundant.
const stripFontQueryStrings: Plugin = {
  name: 'strip-font-query-strings',
  // Dev: transform CSS modules as they're served
  transform(code, id) {
    if (!id.endsWith('.css')) return;
    return code.replace(
      /(url\(["']?[^"')]+\.(?:ttf|woff2?|eot|otf))\?[^"')#]*/g,
      '$1',
    );
  },
  // Production: patch already-emitted CSS chunks
  generateBundle(_, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === 'asset' && typeof file.source === 'string' && file.fileName.endsWith('.css')) {
        file.source = file.source.replace(
          /(url\(["']?[^"')]+\.(?:ttf|woff2?|eot|otf))\?[^"')#]*/g,
          '$1',
        );
      }
    }
  },
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), stripFontQueryStrings],
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@blueprintjs')) return 'vendor-blueprint';
          if (id.includes('@tiptap') || id.includes('tiptap-markdown')) return 'vendor-tiptap';
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
        },
      },
    },
  },
  server: {
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
});
