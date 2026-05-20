---
layout: base.njk
title: Mirror
permalink: /
hero:
  tagline: A modern text editor for translation
  description: A dual-pane translation editor with intelligent scroll sync and locking points. Available for Linux, macOS and Windows.
footer:
  author:
    name: Simone Sturniolo
    url: https://github.com/stur86
    url_label: github.com/stur86
  credits:
    - name: Tauri
      url: https://tauri.app
    - name: React
      url: https://react.dev
    - name: Tiptap
      url: https://tiptap.dev
    - name: BlueprintJS
      url: https://blueprintjs.com
    - name: Vite
      url: https://vitejs.dev
    - name: i18next
      url: https://www.i18next.com
    - name: mammoth.js
      url: https://github.com/mwilliamson/mammoth.js
    - name: tiptap-markdown
      url: https://github.com/aguingand/tiptap-markdown
  license:
    name: MIT License
    url: https://github.com/stur86/mirror/blob/main/LICENSE
---

## What is Mirror?

Mirror is an open-source desktop app for translators working with long-form texts. It puts source and translation side by side in a dual-pane editor with intelligent scroll synchronisation — so the passage you're working on stays in view on both sides.

## Features

- **Dual-pane editor** — source and translation open side by side with full rich-text support
- **Locking points** — anchor pairs of paragraphs together to define how the two panes scroll in sync; add as many as the text needs
- **Word lookup** — select any word to look it up in Wiktionary without leaving the editor
- **DOCX import** — open `.docx` files directly; Mirror converts them to Markdown automatically
- **Autosave** — work is saved continuously to a `.mirror.json` project file
- **Source editing** — toggle the source pane into edit mode to clean up the original text

## Web version

Mirror also runs as a pure web app — no installation needed. The web version has the same editor features but without native file-system dialogs.
