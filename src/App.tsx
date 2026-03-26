import { useState, useEffect, useRef, useCallback } from 'react';
import TurndownService from 'turndown';
import { Layout } from './components/Layout';
import { TranslationEditor } from './components/editor';
import type { TranslationEditorHandle } from './components/editor';
import { LoadTextDialog } from './components/LoadTextDialog';
import { PreferencesDialog } from './components/PreferencesDialog';
import { Button, Dialog, DialogBody, DialogFooter, Intent } from './components';
import type { LanguageCode } from './constants/languages';
import { readFileAsArrayBuffer, saveFileWithPicker, saveFileToHandle, openFileWithPicker, downloadFile } from './utils/fileIO';
import { detectLanguage } from './utils/detectLanguage';
import { docxToMarkdown } from './utils/docxConvert';
import { useShortcut, shortcutChord } from './contexts/KeyboardShortcutsContext';
import { useTranslation } from 'react-i18next';
import { useToast } from './contexts/ToastContext';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

interface MirrorProject {
  version: number;
  sourceContent: string;
  translationContent: string;
  sourceLanguage: string;
  translationLanguage: string;
  lockingPoints: Array<{ id: string; sourceY: number; translationY: number }>;
}

export function App() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isDark, setIsDark] = useState(true);
  const [sourceContent, setSourceContent] = useState('');
  const [translationContent, setTranslationContent] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('en');
  const [translationLanguage, setTranslationLanguage] = useState<LanguageCode>('it');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Autosave preferences — persisted to localStorage
  const [autosaveEnabled, setAutosaveEnabled] = useState(
    () => localStorage.getItem('mirror.autosaveEnabled') !== 'false',
  );
  const [autosaveIntervalMinutes, setAutosaveIntervalMinutes] = useState(
    () => parseInt(localStorage.getItem('mirror.autosaveIntervalMinutes') ?? '5', 10),
  );

  const editorRef = useRef<TranslationEditorHandle>(null);
  const projectFileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const isFirstRender = useRef(true);

  // Refs so the autosave interval always sees the latest values without restarting
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

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

  // Persist autosave preferences
  useEffect(() => {
    localStorage.setItem('mirror.autosaveEnabled', String(autosaveEnabled));
  }, [autosaveEnabled]);
  useEffect(() => {
    localStorage.setItem('mirror.autosaveIntervalMinutes', String(autosaveIntervalMinutes));
  }, [autosaveIntervalMinutes]);

  // Mark dirty on any content/language change, but skip the initial render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [sourceContent, translationContent, sourceLanguage, translationLanguage]);

  // Keep Electron main process in sync with dirty state
  useEffect(() => {
    window.electronAPI?.setDirty(hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  // Web: show browser's native "unsaved changes" prompt on tab close / navigation
  useEffect(() => {
    if (isElectron) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Electron: listen for close-requested from main (fired when dirty + user closes window)
  useEffect(() => {
    if (!isElectron) return;
    const unsub = window.electronAPI!.onCloseRequested(() => setCloseDialogOpen(true));
    return unsub;
  }, []);

  const handleThemeToggle = () => setIsDark(!isDark);

  const handleNewFile = useCallback(() => {
    setSourceContent('');
    setTranslationContent('');
    setSourceLanguage('en');
    setTranslationLanguage('it');
    editorRef.current?.setLockingPoints([{ id: 'origin', sourceY: 0, translationY: 0, colorIndex: 0 }]);
    setHasUnsavedChanges(false);
  }, []);

  const handleOpenProject = useCallback(async () => {
    const result = await openFileWithPicker();
    if (!result) return;

    projectFileHandleRef.current = result.handle;

    try {
      const project: MirrorProject = JSON.parse(result.content);
      if (project.version !== 1 && project.version !== 2) {
        console.warn('Unknown project version:', project.version);
      }

      const toMarkdown = (content: string) =>
        project.version === 1 ? turndown.turndown(content ?? '') : (content ?? '');

      setSourceContent(toMarkdown(project.sourceContent));
      setTranslationContent(toMarkdown(project.translationContent));
      setSourceLanguage((project.sourceLanguage ?? 'en') as LanguageCode);
      setTranslationLanguage((project.translationLanguage ?? 'it') as LanguageCode);
      if (project.lockingPoints?.length) {
        editorRef.current?.setLockingPoints(project.lockingPoints);
      }
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error('Failed to parse project file:', e);
      showToast(t('toast.projectLoadError'), Intent.DANGER);
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
        showToast(t('toast.docxLoadError'), Intent.DANGER);
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

  const buildProjectJson = useCallback(() => {
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
    return JSON.stringify(project, null, 2);
  }, [sourceContent, translationContent, sourceLanguage, translationLanguage]);

  const handleSaveProjectAs = useCallback(async (): Promise<boolean> => {
    const json = buildProjectJson();
    const handle = await saveFileWithPicker('project.mirror.json', json, 'application/json');
    if (handle) {
      projectFileHandleRef.current = handle;
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      return true;
    }
    return false;
  }, [buildProjectJson]);

  const handleSaveProject = useCallback(async (): Promise<boolean> => {
    const handle = projectFileHandleRef.current;
    if (handle) {
      await saveFileToHandle(handle, buildProjectJson());
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      return true;
    }
    return handleSaveProjectAs();
  }, [buildProjectJson, handleSaveProjectAs]);

  // Keep a ref so the autosave interval always calls the latest version without restarting
  const handleSaveProjectRef = useRef(handleSaveProject);
  handleSaveProjectRef.current = handleSaveProject;

  const handleExportTranslation = useCallback(() => {
    downloadFile('translation.md', translationContent, 'text/markdown');
  }, [translationContent]);

  // Autosave interval — only fires when there's a file handle (no surprise pickers)
  useEffect(() => {
    if (!autosaveEnabled) return;
    const id = setInterval(async () => {
      if (hasUnsavedChangesRef.current && projectFileHandleRef.current) {
        await handleSaveProjectRef.current();
      }
    }, autosaveIntervalMinutes * 60_000);
    return () => clearInterval(id);
  }, [autosaveEnabled, autosaveIntervalMinutes]);

  // Close dialog handlers (Electron only)
  const handleCloseDialogSave = useCallback(async () => {
    const saved = await handleSaveProject();
    if (saved) {
      setCloseDialogOpen(false);
      window.electronAPI?.confirmClose();
    }
  }, [handleSaveProject]);

  const handleCloseDialogDiscard = useCallback(() => {
    setCloseDialogOpen(false);
    window.electronAPI?.confirmClose();
  }, []);

  const handlePreferencesChange = useCallback(
    (prefs: { autosaveEnabled: boolean; autosaveIntervalMinutes: number }) => {
      setAutosaveEnabled(prefs.autosaveEnabled);
      setAutosaveIntervalMinutes(prefs.autosaveIntervalMinutes);
    },
    [],
  );

  useShortcut(shortcutChord('s'), handleSaveProject);
  useShortcut(shortcutChord('s', true), handleSaveProjectAs);
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
        onSaveProjectAs={handleSaveProjectAs}
        onExportTranslation={handleExportTranslation}
        onPreferences={() => setPreferencesOpen(true)}
        autosaveEnabled={autosaveEnabled}
        lastSavedAt={lastSavedAt}
        onToggleAutosave={() => setAutosaveEnabled((v) => !v)}
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
      <PreferencesDialog
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        autosaveEnabled={autosaveEnabled}
        autosaveIntervalMinutes={autosaveIntervalMinutes}
        onChange={handlePreferencesChange}
      />
      <Dialog
        isOpen={closeDialogOpen}
        title={t('dialog.unsavedChanges.title')}
        onClose={() => setCloseDialogOpen(false)}
        canOutsideClickClose={false}
      >
        <DialogBody>
          <p>{t('dialog.unsavedChanges.message')}</p>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button intent="primary" onClick={handleCloseDialogSave}>
                {t('actions.save')}
              </Button>
              <Button intent="danger" onClick={handleCloseDialogDiscard}>
                {t('actions.discard')}
              </Button>
              <Button onClick={() => setCloseDialogOpen(false)}>
                {t('actions.cancel')}
              </Button>
            </>
          }
        />
      </Dialog>
    </>
  );
}
