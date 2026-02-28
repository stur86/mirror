import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { TranslationEditor } from './components/editor';
import type { TranslationEditorHandle } from './components/editor';
import { LoadTextDialog } from './components/LoadTextDialog';
import type { LanguageCode } from './constants/languages';
import { readFileAsArrayBuffer, readFileAsText, downloadFile } from './utils/fileIO';
import { markdownToHtml, htmlToMarkdown } from './utils/markdownConvert';
import { detectLanguage } from './utils/detectLanguage';
import { rtfToHtml } from './utils/rtfConvert';

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
    html: string;
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
      if (project.version !== 1) {
        console.warn('Unknown project version:', project.version);
      }
      setSourceContent(project.sourceContent ?? '');
      setTranslationContent(project.translationContent ?? '');
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
    const isRtf = (name: string) => name.toLowerCase().endsWith('.rtf');
    const result = await readFileAsArrayBuffer('.txt,.md,.text,.markdown,.rtf');
    if (!result) return;

    let html: string;
    let detected: LanguageCode | null = null;

    if (isRtf(result.name)) {
      try {
        html = await rtfToHtml(result.buffer);
      } catch (e) {
        console.error('Failed to parse RTF file:', e);
        return;
      }
    } else {
      const text = new TextDecoder('utf-8').decode(result.buffer);
      html = markdownToHtml(text);
      detected = detectLanguage(text) ?? null;
    }

    setPendingTextFile({ name: result.name, html, detected });
    setLoadTextDialogOpen(true);
  }, []);

  const handleLoadTextConfirm = useCallback((side: 'source' | 'translation') => {
    if (!pendingTextFile) return;

    if (side === 'source') {
      setSourceContent(pendingTextFile.html);
      if (pendingTextFile.detected) setSourceLanguage(pendingTextFile.detected);
    } else {
      setTranslationContent(pendingTextFile.html);
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
      version: 1,
      sourceContent,
      translationContent,
      sourceLanguage,
      translationLanguage,
      lockingPoints,
    };

    downloadFile('project.mirror.json', JSON.stringify(project, null, 2), 'application/json');
  }, [sourceContent, translationContent, sourceLanguage, translationLanguage]);

  const handleExportTranslation = useCallback(() => {
    const md = htmlToMarkdown(translationContent);
    downloadFile('translation.md', md, 'text/markdown');
  }, [translationContent]);

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
