# Mirror - AI-assisted Translation Editor

An Electron app with dual-build support (Electron desktop + pure web).

## Development

```sh
bun run dev           # Start web dev server (Vite)
bun run electron:dev  # Start Electron app in dev mode
bun run build         # Build for web
bun run electron:build # Build Electron app for distribution
```

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
│   └── AboutDialog.tsx  # About dialog
├── i18n/
│   └── index.ts         # i18next configuration
├── locales/
│   └── en.yaml          # English translations (add more locales here)
├── types/
│   └── electron.d.ts    # Electron API type declarations
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

## Guidelines

- Use `bun` instead of npm/yarn
- Frontend code in `src/` must work in both web and Electron contexts
- Check `window.electronAPI?.isElectron` to detect Electron environment
- All backend/AI calls will be made directly from the frontend (no server in this repo)
- Add new UI components to the abstraction layer in `src/components/index.ts`
- Add new translatable strings to locale YAML files
