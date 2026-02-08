import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { EditorContent } from '@tiptap/react';
import { useEditorSetup } from '../../hooks/useEditorSetup';
import { useTranslation } from 'react-i18next';
import './EditorPane.css';

export interface MuteRanges {
  above: number;       // Y of segment start (top of active segment)
  below: number;       // Y of segment end (bottom of active segment)
  contentHeight: number;
}

export interface EditorPaneProps {
  side: 'source' | 'translation';
  content: string;
  editable?: boolean;
  onChange?: (content: string) => void;
  onContentChange?: () => void;
  headerAction?: React.ReactNode;
  lang?: string;
  muteRanges?: MuteRanges | null;
}

export interface EditorPaneHandle {
  getContainer: () => HTMLElement | null;
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane(
    { side, content, editable = true, onChange, onContentChange, headerAction, lang, muteRanges },
    ref
  ) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);

    const placeholder =
      side === 'source'
        ? t('editor.sourcePlaceholder')
        : t('editor.translationPlaceholder');

    const editor = useEditorSetup({
      content,
      editable,
      placeholder,
      lang,
      onUpdate: (newContent) => {
        onChange?.(newContent);
        onContentChange?.();
      },
    });

    // Sync content prop → editor when it changes externally
    useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        editor.commands.setContent(content, false);
      }
    }, [editor, content]);

    // Update lang attribute on the contenteditable element when it changes
    useEffect(() => {
      if (editor && lang) {
        editor.setOptions({
          editorProps: { attributes: { lang } },
        });
      }
    }, [editor, lang]);

    // Expose the container element via ref
    useImperativeHandle(
      ref,
      () => ({
        getContainer: () => containerRef.current,
      }),
      []
    );

    // Notify when content changes for position recalculation
    useEffect(() => {
      if (editor) {
        onContentChange?.();
      }
    }, [editor, onContentChange]);

    const label = side === 'source' ? t('editor.source') : t('editor.translation');

    return (
      <div className={`editor-pane editor-pane--${side}`}>
        <div className="editor-pane__header">
          <span className="editor-pane__label">{label}</span>
          {headerAction && <div className="editor-pane__header-action">{headerAction}</div>}
        </div>
        <div ref={containerRef} className="editor-pane__content" lang={lang}>
          <EditorContent editor={editor} />
          {muteRanges && (
            <div className="editor-pane__mute-container" style={{ height: muteRanges.contentHeight }}>
              {muteRanges.above > 0 && (
                <div
                  className="editor-pane__mute-overlay"
                  style={{ top: 0, height: muteRanges.above }}
                />
              )}
              {muteRanges.below < muteRanges.contentHeight && (
                <div
                  className="editor-pane__mute-overlay"
                  style={{ top: muteRanges.below, height: muteRanges.contentHeight - muteRanges.below }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);
