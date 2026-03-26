import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { HTMLSelect, Button, Popover, Menu, MenuItem } from '../index';
import { EditorSettingsProvider, useEditorSettings, type LockingPoint } from '../../contexts/EditorSettingsContext';
import { detectLanguage } from '../../utils/detectLanguage';
import { useScrollSync } from '../../hooks/useScrollSync';
import { EditorPane, type EditorPaneHandle, type MuteRanges, type EditorContextMenuEvent } from './EditorPane';
import { RulerBar } from './RulerBar';
import { EditorToolbar } from './EditorToolbar';
import { LANGUAGES, type LanguageCode } from '../../constants/languages';
import './TranslationEditor.css';
import { LANGUAGE_WIKTIONARY_MAP, useWiktionary } from '../../hooks/useWiktionary';
import { WordLookupPopover } from './WordLookupPopover';
import { WordLookupDrawer } from './WordLookupDrawer';
import { MenuDivider, Intent } from '../index';
import { useToast } from '../../contexts/ToastContext';

const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.name }));

export interface TranslationEditorHandle {
  getLockingPoints: () => LockingPoint[];
  setLockingPoints: (points: LockingPoint[]) => void;
}

interface TranslationEditorProps {
  sourceContent: string;
  translationContent: string;
  onTranslationChange: (content: string) => void;
  onSourceChange?: (content: string) => void;
  sourceLanguage: LanguageCode;
  translationLanguage: LanguageCode;
  onSourceLanguageChange: (lang: LanguageCode) => void;
  onTranslationLanguageChange: (lang: LanguageCode) => void;
}

interface LookupState {
  word: string;
  lang: string;
  targetLang: string;
  x: number;
  y: number;
  pinned: boolean;
}

const TranslationEditorInner = forwardRef<TranslationEditorHandle, TranslationEditorProps>(
  function TranslationEditorInner({
  sourceContent,
  translationContent,
  onTranslationChange,
  onSourceChange,
  sourceLanguage,
  translationLanguage,
  onSourceLanguageChange,
  onTranslationLanguageChange,
}, ref) {
  const { t } = useTranslation();
  const { lockingPoints, setLockingPoints, activeLockIndex, scrollSyncEnabled } = useEditorSettings();

  useImperativeHandle(ref, () => ({
    getLockingPoints: () => lockingPoints,
    setLockingPoints,
  }), [lockingPoints, setLockingPoints]);

  const [sourceEditMode, setSourceEditMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<EditorContextMenuEvent | null>(null);

  const { showToast } = useToast();
  const [lookupState, setLookupState] = useState<LookupState | null>(null);

  const wiktionary = useWiktionary(
    lookupState?.word ?? null,
    lookupState?.lang ?? null,
    lookupState?.targetLang ?? null,
  );

  // Show a toast when a lookup fails
  const prevStatusRef = useRef<string>('idle');
  useEffect(() => {
    if (wiktionary.status === 'error' && prevStatusRef.current !== 'error') {
      showToast(t('toast.lookupError'), Intent.WARNING);
    }
    prevStatusRef.current = wiktionary.status;
  }, [wiktionary.status, showToast, t]);

  const handleLookupClose = useCallback(() => setLookupState(null), []);

  const [sourceEditor, setSourceEditor] = useState<Editor | null>(null);
  const [translationEditor, setTranslationEditor] = useState<Editor | null>(null);
  const onSourceEditorReady = useCallback((e: Editor | null) => setSourceEditor(e), []);
  const onTranslationEditorReady = useCallback((e: Editor | null) => setTranslationEditor(e), []);

  const toggleSourceEditMode = useCallback(() => {
    if (sourceEditMode) {
      // Turning off: detect language from current source content
      const detected = detectLanguage(sourceContent);
      if (detected) onSourceLanguageChange(detected);
    }
    setSourceEditMode(prev => !prev);
  }, [sourceEditMode, sourceContent, onSourceLanguageChange]);

  const handleEditorContextMenu = useCallback((event: EditorContextMenuEvent) => {
    setContextMenu(event);
  }, []);

  const sourceRef = useRef<EditorPaneHandle>(null);
  const translationRef = useRef<EditorPaneHandle>(null);

  // Get the actual container elements
  const getSourceContainer = useCallback(
    () => sourceRef.current?.getContainer() ?? null,
    []
  );
  const getTranslationContainer = useCallback(
    () => translationRef.current?.getContainer() ?? null,
    []
  );

  // Create refs that return the containers
  const sourceContainerRef = useRef({ current: null as HTMLElement | null });
  const translationContainerRef = useRef({ current: null as HTMLElement | null });

  // Update container refs
  const updateContainerRefs = useCallback(() => {
    sourceContainerRef.current.current = getSourceContainer();
    translationContainerRef.current.current = getTranslationContainer();
  }, [getSourceContainer, getTranslationContainer]);

  // useScrollSync now attaches its own listeners — returns void
  useScrollSync(
    sourceContainerRef.current,
    translationContainerRef.current,
  );

  // Mute ranges state
  const [sourceMuteRanges, setSourceMuteRanges] = useState<MuteRanges | null>(null);
  const [translationMuteRanges, setTranslationMuteRanges] = useState<MuteRanges | null>(null);

  // Compute mute ranges based on active lock point and scroll sync state
  const computeMuteRanges = useCallback(() => {
    if (!scrollSyncEnabled) {
      setSourceMuteRanges(null);
      setTranslationMuteRanges(null);
      return;
    }

    const sourceEl = sourceContainerRef.current.current;
    const translationEl = translationContainerRef.current.current;
    if (!sourceEl || !translationEl) return;

    const lp = lockingPoints[activeLockIndex];
    if (!lp) return;

    const nextLp = lockingPoints[activeLockIndex + 1];

    // Source mute ranges
    const sourceContentHeight = sourceEl.scrollHeight;
    const sourceSegStart = lp.sourceY;
    const sourceSegEnd = nextLp ? nextLp.sourceY : sourceContentHeight;

    setSourceMuteRanges({
      above: sourceSegStart,
      below: sourceSegEnd,
      contentHeight: sourceContentHeight,
    });

    // Translation mute ranges
    const translationContentHeight = translationEl.scrollHeight;
    const translationSegStart = lp.translationY;
    const translationSegEnd = nextLp ? nextLp.translationY : translationContentHeight;

    setTranslationMuteRanges({
      above: translationSegStart,
      below: translationSegEnd,
      contentHeight: translationContentHeight,
    });
  }, [scrollSyncEnabled, lockingPoints, activeLockIndex]);

  // Recompute mute ranges when relevant state changes
  useEffect(() => {
    computeMuteRanges();
  }, [computeMuteRanges]);

  const sourceHeaderAction = (
    <>
      {sourceEditMode && (
        <>
          <EditorToolbar editor={sourceEditor} />
          <span className="editor-toolbar__sep" />
        </>
      )}
      <Button
        minimal
        small
        icon="edit"
        active={sourceEditMode}
        onClick={toggleSourceEditMode}
        title={t('editor.editSource')}
      />
      <HTMLSelect
        minimal
        options={languageOptions}
        value={sourceLanguage}
        onChange={(e) => onSourceLanguageChange(e.target.value as LanguageCode)}
        title={t('editor.sourceLanguage')}
      />
    </>
  );

  const translationHeaderAction = (
    <>
      <EditorToolbar editor={translationEditor} />
      <span className="editor-toolbar__sep" />
      <HTMLSelect
        minimal
        options={languageOptions}
        value={translationLanguage}
        onChange={(e) => onTranslationLanguageChange(e.target.value as LanguageCode)}
        title={t('editor.translationLanguage')}
      />
    </>
  );

  return (
    <div className="translation-editor">
      <div className="translation-editor__panes">
        <EditorPane
          ref={sourceRef}
          side="source"
          content={sourceContent}
          editable={sourceEditMode}
          onChange={sourceEditMode ? onSourceChange : undefined}
          onContentChange={updateContainerRefs}
          headerAction={sourceHeaderAction}
          lang={sourceLanguage}
          muteRanges={sourceMuteRanges}
          onEditorContextMenu={handleEditorContextMenu}
          onEditorReady={onSourceEditorReady}
        />
        <RulerBar
          sourceContainerRef={sourceContainerRef.current}
          translationContainerRef={translationContainerRef.current}
        />
        <EditorPane
          ref={translationRef}
          side="translation"
          content={translationContent}
          editable={true}
          onChange={onTranslationChange}
          onContentChange={updateContainerRefs}
          headerAction={translationHeaderAction}
          lang={translationLanguage}
          muteRanges={translationMuteRanges}
          onEditorContextMenu={handleEditorContextMenu}
          onEditorReady={onTranslationEditorReady}
        />
      </div>
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            width: 0,
            height: 0,
          }}
        >
          <Popover
            isOpen
            minimal
            placement="bottom-start"
            onClose={() => setContextMenu(null)}
            onInteraction={(nextOpen) => { if (!nextOpen) setContextMenu(null); }}
            content={
              <Menu>
                <MenuItem
                  text={t('editor.contextMenu.cut')}
                  disabled={!contextMenu.actions.cut}
                  onClick={() => { contextMenu.actions.cut?.(); setContextMenu(null); }}
                />
                <MenuItem
                  text={t('editor.contextMenu.copy')}
                  disabled={!contextMenu.actions.copy}
                  onClick={() => { contextMenu.actions.copy?.(); setContextMenu(null); }}
                />
                <MenuItem
                  text={t('editor.contextMenu.paste')}
                  disabled={!contextMenu.actions.paste}
                  onClick={() => { void contextMenu.actions.paste?.(); setContextMenu(null); }}
                />
                <MenuItem
                  text={t('editor.contextMenu.selectAll')}
                  onClick={() => { contextMenu.actions.selectAll(); setContextMenu(null); }}
                />
                {contextMenu.word && LANGUAGE_WIKTIONARY_MAP[
                  contextMenu.side === 'source' ? sourceLanguage : translationLanguage
                ] && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      text={t('lookup.menuItem', { word: contextMenu.word })}
                      icon="book"
                      onClick={() => {
                        const pane = contextMenu.side === 'source' ? sourceLanguage : translationLanguage;
                        const other = contextMenu.side === 'source' ? translationLanguage : sourceLanguage;
                        if (lookupState?.pinned) {
                          setLookupState({
                            word: contextMenu.word!,
                            lang: pane,
                            targetLang: other,
                            x: contextMenu.x,
                            y: contextMenu.y,
                            pinned: true,
                          });
                        } else {
                          setLookupState({
                            word: contextMenu.word!,
                            lang: pane,
                            targetLang: other,
                            x: contextMenu.x,
                            y: contextMenu.y,
                            pinned: false,
                          });
                        }
                        setContextMenu(null);
                      }}
                    />
                  </>
                )}
              </Menu>
            }
          >
            <span />
          </Popover>
        </div>
      )}
      {lookupState && !lookupState.pinned && (
        <WordLookupPopover
          word={lookupState.word}
          x={lookupState.x}
          y={lookupState.y}
          wiktionary={wiktionary}
          targetLangLabel={
            LANGUAGES.find(l => l.code === lookupState.targetLang)?.name ?? lookupState.targetLang
          }
          onPin={() => setLookupState(s => s ? { ...s, pinned: true } : null)}
          onClose={handleLookupClose}
        />
      )}
      {lookupState?.pinned && (
        <WordLookupDrawer
          word={lookupState.word}
          wiktionary={wiktionary}
          targetLangLabel={
            LANGUAGES.find(l => l.code === lookupState.targetLang)?.name ?? lookupState.targetLang
          }
          onClose={handleLookupClose}
        />
      )}
    </div>
  );
});

export const TranslationEditor = forwardRef<TranslationEditorHandle, TranslationEditorProps>(
  function TranslationEditor(props, ref) {
    return (
      <EditorSettingsProvider>
        <TranslationEditorInner ref={ref} {...props} />
      </EditorSettingsProvider>
    );
  }
);
