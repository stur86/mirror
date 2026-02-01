import { useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../index';
import { EditorSettingsProvider, useEditorSettings } from '../../contexts/EditorSettingsContext';
import { useScrollSync } from '../../hooks/useScrollSync';
import { EditorPane, type EditorPaneHandle } from './EditorPane';
import './TranslationEditor.css';

interface TranslationEditorProps {
  sourceContent: string;
  translationContent: string;
  onTranslationChange: (content: string) => void;
}

function TranslationEditorInner({
  sourceContent,
  translationContent,
  onTranslationChange,
}: TranslationEditorProps) {
  const { t } = useTranslation();
  const { scrollSyncEnabled, toggleScrollSync } = useEditorSettings();

  const sourceRef = useRef<EditorPaneHandle>(null);
  const translationRef = useRef<EditorPaneHandle>(null);

  // Track content for dependency updates
  const [sourceVersion, setSourceVersion] = useState(0);
  const [translationVersion, setTranslationVersion] = useState(0);

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
    [sourceVersion, sourceContent],
    [translationVersion, translationContent]
  );

  const handleSourceContentChange = useCallback(() => {
    updateContainerRefs();
    setSourceVersion((v) => v + 1);
  }, [updateContainerRefs]);

  const handleTranslationContentChange = useCallback(() => {
    updateContainerRefs();
    setTranslationVersion((v) => v + 1);
  }, [updateContainerRefs]);

  // Wrap scroll handlers to update refs first
  const onSourceScroll = useCallback(() => {
    updateContainerRefs();
    handleSourceScroll();
  }, [updateContainerRefs, handleSourceScroll]);

  const onTranslationScroll = useCallback(() => {
    updateContainerRefs();
    handleTranslationScroll();
  }, [updateContainerRefs, handleTranslationScroll]);

  const scrollSyncButton = (
    <Button
      minimal
      small
      icon={scrollSyncEnabled ? 'link' : 'unlink'}
      onClick={toggleScrollSync}
      title={scrollSyncEnabled ? t('editor.scrollSyncOn') : t('editor.scrollSyncOff')}
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
          onContentChange={handleSourceContentChange}
          headerAction={scrollSyncButton}
        />
        <div className="translation-editor__divider" />
        <EditorPane
          ref={translationRef}
          side="translation"
          content={translationContent}
          editable={true}
          onChange={onTranslationChange}
          onScroll={onTranslationScroll}
          onContentChange={handleTranslationContentChange}
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
