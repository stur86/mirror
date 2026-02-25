import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { HTMLSelect, Button, Popover, Menu, MenuItem } from '../index';
import { EditorSettingsProvider, useEditorSettings, type LockingPoint } from '../../contexts/EditorSettingsContext';
import { htmlToMarkdown } from '../../utils/markdownConvert';
import { detectLanguage } from '../../utils/detectLanguage';
import { useScrollSync } from '../../hooks/useScrollSync';
import { EditorPane, type EditorPaneHandle, type MuteRanges, type EditorContextMenuEvent } from './EditorPane';
import { RulerBar } from './RulerBar';
import { LANGUAGES, type LanguageCode } from '../../constants/languages';
import './TranslationEditor.css';

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

  const toggleSourceEditMode = useCallback(() => {
    if (sourceEditMode) {
      // Turning off: detect language from current source content
      const text = htmlToMarkdown(sourceContent);
      const detected = detectLanguage(text);
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
    <HTMLSelect
      minimal
      options={languageOptions}
      value={translationLanguage}
      onChange={(e) => onTranslationLanguageChange(e.target.value as LanguageCode)}
      title={t('editor.translationLanguage')}
    />
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
              </Menu>
            }
          >
            <span />
          </Popover>
        </div>
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
