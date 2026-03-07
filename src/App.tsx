import { useState, useEffect, useRef, useCallback } from 'react';
import TurndownService from 'turndown';
import { Layout } from './components/Layout';
import { TranslationEditor } from './components/editor';
import type { TranslationEditorHandle } from './components/editor';
import { LoadTextDialog } from './components/LoadTextDialog';
import type { LanguageCode } from './constants/languages';
import { readFileAsArrayBuffer, readFileAsText, downloadFile } from './utils/fileIO';
import { detectLanguage } from './utils/detectLanguage';
import { docxToMarkdown } from './utils/docxConvert';
import { useShortcut, shortcutChord } from './contexts/KeyboardShortcutsContext';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

interface MirrorProject {
  version: number;
  sourceContent: string;
  translationContent: string;
  sourceLanguage: string;
  translationLanguage: string;
  lockingPoints: Array<{ id: string; sourceY: number; translationY: number }>;
}

export function App() {
  const [isDark, setIsDark] = useState(true);
  const [sourceContent, setSourceContent] = useState('');
  const [translationContent, setTranslationContent] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('en');
  const [translationLanguage, setTranslationLanguage] = useState<LanguageCode>('it');

  const editorRef = useRef<TranslationEditorHandle>(null);

  // Load text dialog state
  const [loadTextDialogOpen, setLoadTextDialogOpen] = useState(false);
  const [pendingTextFile, setPendingTextFile] = useState<{
    name: string;
    markdown: string;
    detected: LanguageCode | null;
  } | null>(null);

  useEffect(() => {
    document.body.classList.toggle('bp6-dark', isDark);
  }, [isDark]);

  const handleThemeToggle = () => setIsDark(!isDark);

  const handleNewFile = useCallback(() => {
    setSourceContent('');
    setTranslationContent('');
    setSourceLanguage('en');
    setTranslationLanguage('it');
    editorRef.current?.setLockingPoints([{ id: 'origin', sourceY: 0, translationY: 0 }]);
  }, []);

  const handleOpenProject = useCallback(async () => {
    const result = await readFileAsText('.mirror.json');
    if (!result) return;

    try {
      const project: MirrorProject = JSON.parse(result.content);
      if (project.version !== 1 && project.version !== 2) {
        console.warn('Unknown project version:', project.version);
      }

      // v1 projects stored HTML — convert to Markdown on open
      const toMarkdown = (content: string) =>
        project.version === 1 ? turndown.turndown(content ?? '') : (content ?? '');

      setSourceContent(toMarkdown(project.sourceContent));
      setTranslationContent(toMarkdown(project.translationContent));
      setSourceLanguage((project.sourceLanguage ?? 'en') as LanguageCode);
      setTranslationLanguage((project.translationLanguage ?? 'it') as LanguageCode);
      if (project.lockingPoints?.length) {
        editorRef.current?.setLockingPoints(project.lockingPoints);
      }
    } catch (e) {
      console.error('Failed to parse project file:', e);
    }
  }, []);

  const handleLoadText = useCallback(async () => {
    const isDocx = (name: string) => name.toLowerCase().endsWith('.docx');
    const result = await readFileAsArrayBuffer('.txt,.md,.text,.markdown,.docx');
    if (!result) return;

    let markdown: string;
    let detected: LanguageCode | null = null;

    if (isDocx(result.name)) {
      try {
        markdown = await docxToMarkdown(result.buffer);
      } catch (e) {
        console.error('Failed to parse DOCX file:', e);
        return;
      }
    } else {
      markdown = new TextDecoder('utf-8').decode(result.buffer);
    }

    detected = detectLanguage(markdown) ?? null;
    setPendingTextFile({ name: result.name, markdown, detected });
    setLoadTextDialogOpen(true);
  }, []);

  const handleLoadTextConfirm = useCallback((side: 'source' | 'translation') => {
    if (!pendingTextFile) return;

    if (side === 'source') {
      setSourceContent(pendingTextFile.markdown);
      if (pendingTextFile.detected) setSourceLanguage(pendingTextFile.detected);
    } else {
      setTranslationContent(pendingTextFile.markdown);
      if (pendingTextFile.detected) setTranslationLanguage(pendingTextFile.detected);
    }

    setLoadTextDialogOpen(false);
    setPendingTextFile(null);
  }, [pendingTextFile]);

  const handleLoadTextClose = useCallback(() => {
    setLoadTextDialogOpen(false);
    setPendingTextFile(null);
  }, []);

  const handleSaveProject = useCallback(() => {
    const lockingPoints = editorRef.current?.getLockingPoints() ?? [
      { id: 'origin', sourceY: 0, translationY: 0 },
    ];

    const project: MirrorProject = {
      version: 2,
      sourceContent,
      translationContent,
      sourceLanguage,
      translationLanguage,
      lockingPoints,
    };

    downloadFile('project.mirror.json', JSON.stringify(project, null, 2), 'application/json');
  }, [sourceContent, translationContent, sourceLanguage, translationLanguage]);

  const handleExportTranslation = useCallback(() => {
    // translationContent is already Markdown — export directly
    downloadFile('translation.md', translationContent, 'text/markdown');
  }, [translationContent]);

  useShortcut(shortcutChord('s'), handleSaveProject);
  useShortcut(shortcutChord('s', true), () => {}); // placeholder — handleSaveProjectAs comes in Task 8
  useShortcut(shortcutChord('o'), handleOpenProject);
  useShortcut(shortcutChord('n'), handleNewFile);
  useShortcut(shortcutChord('e'), handleExportTranslation);

  return (
    <>
      <Layout
        onThemeToggle={handleThemeToggle}
        isDark={isDark}
        onNewFile={handleNewFile}
        onOpenProject={handleOpenProject}
        onLoadText={handleLoadText}
        onSaveProject={handleSaveProject}
        onExportTranslation={handleExportTranslation}
      >
        <TranslationEditor
          ref={editorRef}
          sourceContent={sourceContent}
          translationContent={translationContent}
          onSourceChange={setSourceContent}
          onTranslationChange={setTranslationContent}
          sourceLanguage={sourceLanguage}
          translationLanguage={translationLanguage}
          onSourceLanguageChange={setSourceLanguage}
          onTranslationLanguageChange={setTranslationLanguage}
        />
      </Layout>
      <LoadTextDialog
        isOpen={loadTextDialogOpen}
        fileName={pendingTextFile?.name ?? ''}
        onConfirm={handleLoadTextConfirm}
        onClose={handleLoadTextClose}
      />
    </>
  );
}
