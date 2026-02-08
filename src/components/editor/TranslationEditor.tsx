import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HTMLSelect } from '../index';
import { EditorSettingsProvider } from '../../contexts/EditorSettingsContext';
import { useScrollSync } from '../../hooks/useScrollSync';
import { EditorPane, type EditorPaneHandle } from './EditorPane';
import { RulerBar } from './RulerBar';
import { LANGUAGES, type LanguageCode } from '../../constants/languages';
import './TranslationEditor.css';

const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.name }));

interface TranslationEditorProps {
  sourceContent: string;
  translationContent: string;
  onTranslationChange: (content: string) => void;
  sourceLanguage: LanguageCode;
  translationLanguage: LanguageCode;
  onSourceLanguageChange: (lang: LanguageCode) => void;
  onTranslationLanguageChange: (lang: LanguageCode) => void;
}

function TranslationEditorInner({
  sourceContent,
  translationContent,
  onTranslationChange,
  sourceLanguage,
  translationLanguage,
  onSourceLanguageChange,
  onTranslationLanguageChange,
}: TranslationEditorProps) {
  const { t } = useTranslation();

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

  const { handleSourceScroll, handleTranslationScroll } = useScrollSync(
    sourceContainerRef.current,
    translationContainerRef.current,
  );

  // Wrap scroll handlers to update refs first
  const onSourceScroll = useCallback(() => {
    updateContainerRefs();
    handleSourceScroll();
  }, [updateContainerRefs, handleSourceScroll]);

  const onTranslationScroll = useCallback(() => {
    updateContainerRefs();
    handleTranslationScroll();
  }, [updateContainerRefs, handleTranslationScroll]);

  const sourceHeaderAction = (
    <HTMLSelect
      minimal
      options={languageOptions}
      value={sourceLanguage}
      onChange={(e) => onSourceLanguageChange(e.target.value as LanguageCode)}
      title={t('editor.sourceLanguage')}
    />
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
          editable={false}
          onScroll={onSourceScroll}
          onContentChange={updateContainerRefs}
          headerAction={sourceHeaderAction}
          lang={sourceLanguage}
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
          onScroll={onTranslationScroll}
          onContentChange={updateContainerRefs}
          headerAction={translationHeaderAction}
          lang={translationLanguage}
        />
      </div>
    </div>
  );
}

export function TranslationEditor(props: TranslationEditorProps) {
  return (
    <EditorSettingsProvider>
      <TranslationEditorInner {...props} />
    </EditorSettingsProvider>
  );
}
