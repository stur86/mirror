import { useState, useEffect, useRef, useCallback } from 'react';
import TurndownService from 'turndown';
import { Layout } from './components/Layout';
import { TranslationEditor } from './components/editor';
import type { TranslationEditorHandle } from './components/editor';
import { LoadTextDialog } from './components/LoadTextDialog';
import { PreferencesDialog } from './components/PreferencesDialog';
import { Button, Dialog, DialogBody, DialogFooter } from './components';
import { FileBrowserDialog } from './components';
import type { FileFilter, FileBrowserResult } from './components';
import type { LanguageCode } from './constants/languages';
import { readFileAsArrayBuffer, saveFileWithPicker, saveFileToHandle, openFileWithPicker, downloadFile } from './utils/fileIO';
import { detectLanguage } from './utils/detectLanguage';
import { docxToMarkdown } from './utils/docxConvert';
import { useShortcut, shortcutChord } from './contexts/KeyboardShortcutsContext';
import { useTranslation } from 'react-i18next';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

// window.__electrobun is set synchronously by Electrobun before any JS runs.
// window.electronAPI is populated asynchronously (dynamic import in view.ts),
// so it must not be used for this guard — it would always be undefined at module load time.
const isElectron = typeof window !== 'undefined' && !!(window as unknown as { __electrobun?: unknown }).__electrobun;

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
  const projectFileHandleRef = useRef<FileSystemFileHandle | string | null>(null);
  const isFirstRender = useRef(true);

  const [fileBrowser, setFileBrowser] = useState<{
    mode: 'save' | 'open';
    title: string;
    suggestedName?: string;
    filters?: FileFilter[];
  } | null>(null);
  const fileBrowserCallbackRef = useRef<((result: FileBrowserResult) => void) | null>(null);
  const fileBrowserCancelRef = useRef<(() => void) | null>(null);

  const showFileBrowser = useCallback(
    (
      config: { mode: 'save' | 'open'; title: string; suggestedName?: string; filters?: FileFilter[] },
      onResult: (result: FileBrowserResult) => void,
      onCancel?: () => void,
    ) => {
      fileBrowserCallbackRef.current = onResult;
      fileBrowserCancelRef.current = onCancel ?? null;
      setFileBrowser(config);
    },
    [],
  );

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
    if (isElectron) {
      showFileBrowser(
        {
          mode: 'open',
          title: 'Open Project',
          filters: [{ label: 'Mirror Project', extensions: ['.mirror.json'] }],
        },
        (result) => {
          if (!result.buffer) return;
          projectFileHandleRef.current = result.path;
          try {
            const content = new TextDecoder('utf-8').decode(result.buffer);
            const project: MirrorProject = JSON.parse(content);
            if (project.version !== 1 && project.version !== 2) {
              console.warn('Unknown project version:', project.version);
            }
            const toMarkdown = (c: string) =>
              project.version === 1 ? turndown.turndown(c ?? '') : (c ?? '');
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
          }
          // Note: setFileBrowser(null) is handled by the JSX onConfirm wrapper
        },
      );
      return;
    }

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
    }
  }, [showFileBrowser]);

  const handleLoadText = useCallback(async () => {
    if (isElectron) {
      showFileBrowser(
        {
          mode: 'open',
          title: 'Load Text',
          filters: [
            { label: 'Text files', extensions: ['.txt', '.md', '.text', '.markdown', '.docx'] },
          ],
        },
        async (result) => {
          if (!result.buffer) return;
          const name = result.path.split('/').pop() ?? result.path;
          const isDocx = name.toLowerCase().endsWith('.docx');
          let markdown: string;
          if (isDocx) {
            try {
              markdown = await docxToMarkdown(result.buffer);
            } catch (e) {
              console.error('Failed to parse DOCX file:', e);
              return;
            }
          } else {
            markdown = new TextDecoder('utf-8').decode(result.buffer);
          }
          const detected = detectLanguage(markdown) ?? null;
          setPendingTextFile({ name, markdown, detected });
          setLoadTextDialogOpen(true);
        },
      );
      return;
    }

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
  }, [showFileBrowser]);

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
    if (isElectron) {
      return new Promise((resolve) => {
        showFileBrowser(
          { mode: 'save', title: 'Save Project', suggestedName: 'project.mirror.json' },
          async (result) => {
            await saveFileToHandle(result.path, buildProjectJson());
            projectFileHandleRef.current = result.path;
            setHasUnsavedChanges(false);
            setLastSavedAt(new Date());
            resolve(true);
          },
          () => resolve(false),
        );
      });
    }

    const json = buildProjectJson();
    const handle = await saveFileWithPicker('project.mirror.json', json, 'application/json');
    if (handle) {
      projectFileHandleRef.current = handle;
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      return true;
    }
    return false;
  }, [buildProjectJson, showFileBrowser]);

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
    if (isElectron) {
      showFileBrowser(
        { mode: 'save', title: 'Export Translation', suggestedName: 'translation.md' },
        async (result) => {
          await saveFileToHandle(result.path, translationContent);
        },
      );
      return;
    }
    downloadFile('translation.md', translationContent, 'text/markdown');
  }, [translationContent, showFileBrowser]);

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
      <FileBrowserDialog
        isOpen={fileBrowser !== null}
        mode={fileBrowser?.mode ?? 'open'}
        title={fileBrowser?.title ?? ''}
        suggestedName={fileBrowser?.suggestedName}
        filters={fileBrowser?.filters}
        onConfirm={(result) => {
          setFileBrowser(null);
          fileBrowserCallbackRef.current?.(result);
          fileBrowserCallbackRef.current = null;
          fileBrowserCancelRef.current = null;
        }}
        onClose={() => {
          fileBrowserCancelRef.current?.();
          fileBrowserCallbackRef.current = null;
          fileBrowserCancelRef.current = null;
          setFileBrowser(null);
        }}
      />
    </>
  );
}
