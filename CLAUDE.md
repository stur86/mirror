# Mirror - AI-assisted Translation Editor

An Electron app with dual-build support (Electron desktop + pure web).

## Development

```sh
bun run dev           # Start web dev server (Vite)
bun run electron:dev  # Start Electron app in dev mode
bun run build         # Build for web
bun run electron:build # Build Electron app for distribution
bun run test          # Run unit tests (Bun test runner)
```

## Versioning

This app is deployed to real users. After any significant change set, bump the version:

```sh
bun pm version prerelease --preid=alpha   # e.g. 0.1.0 → 0.1.1-alpha.0, or 0.1.1-alpha.0 → 0.1.1-alpha.1
```

We stay on prerelease (`-alpha.N`) until we decide to cut a stable release. Commit the version bump separately after the feature commits.

## Project Structure

```
src/
├── components/          # UI components
│   ├── index.ts         # Component abstraction layer (re-exports from BlueprintJS)
│   ├── styles.ts        # Imports theme styles
│   ├── Layout.tsx       # Main app layout (menu bar + main + footer)
│   ├── Layout.css
│   ├── MenuBar.tsx      # Top menu bar with File/Help menus
│   ├── Footer.tsx       # Bottom status bar
│   ├── AboutDialog.tsx  # About dialog
│   └── editor/
│       ├── EditorPane.tsx       # Single editor pane (source or translation)
│       ├── EditorPane.css
│       ├── TranslationEditor.tsx # Dual-pane editor with ruler bar
│       ├── TranslationEditor.css
│       ├── RulerBar.tsx         # Ruler bar with locking point UI
│       └── RulerBar.css
├── constants/
│   └── languages.ts     # Supported language definitions
├── contexts/
│   └── EditorSettingsContext.tsx  # Scroll sync & locking points state
├── hooks/
│   ├── useEditorSetup.ts        # Tiptap editor initialization (includes tiptap-markdown)
│   ├── useScrollSync.ts         # Lock-point-based scroll synchronization
│   └── useParagraphPositions.ts # Paragraph position utilities
├── i18n/
│   └── index.ts         # i18next configuration
├── locales/
│   └── en.yaml          # English translations (add more locales here)
├── types/
│   └── electron.d.ts    # Electron API type declarations
├── utils/
│   ├── docxConvert.ts   # DOCX → Markdown (mammoth + turndown)
│   ├── fileIO.ts        # File read/download utilities
│   ├── detectLanguage.ts # Language detection via franc
├── App.tsx              # Root app component
├── main.tsx             # Entry point
├── style.css            # Global styles
└── theme.scss           # Theme definitions (colors, component overrides)

electron/
├── main.ts              # Electron main process
└── preload.ts           # Preload script (exposes electronAPI)

dist/                    # Vite build output (web)
electron-dist/           # Compiled Electron code
release/                 # Electron-builder output
```

## Tech Stack

- **Bun** - Package management and Electron compilation
- **Vite** - Frontend bundling with React plugin
- **Electron** - Desktop builds
- **React 19** - UI framework
- **TypeScript** - Throughout
- **BlueprintJS 6** - Component library (accessed via abstraction layer)
- **i18next** - Internationalization with YAML locale files
- **Sass** - Theming and style overrides
- **tiptap-markdown** - Markdown as the editor's native exchange format
- **mammoth** - DOCX → HTML conversion for file import
- **turndown** - HTML → Markdown (used for DOCX import path and v1 project migration)

## UI Component Abstraction

All BlueprintJS components are re-exported through `src/components/index.ts`. Import from there:

```tsx
import { Button, Menu, MenuItem } from './components';
```

To add new components, add them to the re-exports in `index.ts`. If switching frameworks, only this file needs changes.

## Theming

Theme is defined in `src/theme.scss` with two modes:

- **Dark mode**: Purple/violet palette (`bp6-dark` class on body)
- **Light mode**: Cream/old paper palette

Key color variables are defined at the top of the file. BlueprintJS uses `bp6-` class prefix.

Intent colors (primary, success, warning, danger) are customized per theme to harmonize with the palette.

## Internationalization

Translations are in YAML files under `src/locales/`. To add a language:

1. Create `src/locales/{lang}.yaml`
2. Import and add to resources in `src/i18n/index.ts`

Usage in components:
```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// t('menu.file'), t('app.name'), etc.
```

## Editor Features

The main editor uses tiptap (ProseMirror-based) for rich text editing and has two split panes, the left for source text and the right for translation.

### Ruler Bar & Locking Points

Between the two editor panes sits a **ruler bar** (`RulerBar.tsx` + `RulerBar.css`) — a 48px-wide column with two back-to-back ruler canvases (24px each). Above it is a header with a centered lock/unlink button for toggling scroll sync.

**Visual design:**
- Black/near-black background (no hue), white tick marks at line-height intervals
- Source ruler ticks extend from right edge inward; translation ruler ticks from left edge inward
- Major ticks every 5 lines (longer), minor ticks every line (shorter)
- Locking point markers are thick 5-sided arrow polygons (`=>` on source, `<=` on translation)

**Locking points** define scroll correspondence between panes. State is managed in `EditorSettingsContext`:
- `LockingPoint { id, sourceY, translationY, colorIndex }` — a pair of content-Y positions; `colorIndex` (0–7) cycles through the lock point colour palette
- Always at least one lock point; initialized with `(0, 0)` at the origin
- Deleting the last lock point recreates the default origin point

**Scroll sync algorithm** (`useScrollSync.ts`):
- The user scrolls freely on whichever pane the mouse hovers
- On each scroll event, the **active lock point** is the topmost lock point still visible in the scrolling pane's viewport (content-Y ≥ scrollTop and ≤ scrollTop + viewportH). If all lock points are above the viewport, the nearest one above is used
- The other pane is scrolled so its lock coordinate matches: `targetScrollTop = lp.toY - (lp.fromY - scrollTop)`
- When the active lock changes (different lock becomes topmost), a 120ms smoothstep animation bridges the discontinuity on the synced pane; any new scroll event cancels it immediately
- Toggle sync on/off with the lock button in the ruler header

**Creating lock points:**
- Click on either ruler canvas to create a pair instantly
- The clicked side's Y = click position in content
- The other side's Y = whatever content is at the same visual level on the other pane at that moment

**Removing lock points:**
- Right-click near a lock point marker on either ruler to remove it

**Key files:**
- `src/contexts/EditorSettingsContext.tsx` — lock point state, scroll sync toggle
- `src/components/editor/RulerBar.tsx` — ruler bar component with canvas rendering and click handling
- `src/components/editor/RulerBar.css` — ruler styles and theme variables
- `src/hooks/useScrollSync.ts` — scroll sync logic using active lock point
- `src/hooks/useParagraphPositions.ts` — paragraph position utilities (currently unused, retained for future use)

## Known Issues

- **React StrictMode + Floating UI**: StrictMode's double-mounting in development interferes with BlueprintJS Popover positioning (Floating UI). Popovers may appear at (0,0) instead of near their trigger. StrictMode is conditionally disabled in dev hot reload builds to avoid this. If similar positioning issues occur with other components, StrictMode interaction is a likely cause.
- **DOCX parse failures are silent**: When `handleLoadText` fails to parse a DOCX file, it logs to `console.error` and returns silently (no user-facing feedback). A future improvement would show a BlueprintJS `Toaster` notification.
- **Project file format**: `.mirror.json` uses `version: 2` with Markdown content. Version 1 files (HTML content) are automatically migrated to Markdown on open via turndown.

## Guidelines

- Use `bun` instead of npm/yarn
- Frontend code in `src/` must work in both web and Electron contexts
- Check `window.electronAPI?.isElectron` to detect Electron environment
- All backend/AI calls will be made directly from the frontend (no server in this repo)
- Add new UI components to the abstraction layer in `src/components/index.ts`
- Add new translatable strings to locale YAML files
