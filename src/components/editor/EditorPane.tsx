import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { EditorContent } from '@tiptap/react';
import { useEditorSetup } from '../../hooks/useEditorSetup';
import { useTranslation } from 'react-i18next';
import './EditorPane.css';

export interface EditorPaneProps {
  side: 'source' | 'translation';
  content: string;
  editable?: boolean;
  onChange?: (content: string) => void;
  onScroll?: () => void;
  onContentChange?: () => void;
  headerAction?: React.ReactNode;
}

export interface EditorPaneHandle {
  getContainer: () => HTMLElement | null;
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane(
    { side, content, editable = true, onChange, onScroll, onContentChange, headerAction },
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
      onUpdate: (newContent) => {
        onChange?.(newContent);
        onContentChange?.();
      },
    });

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

    // Handle scroll events
    useEffect(() => {
      const container = containerRef.current;
      if (!container || !onScroll) return;

      container.addEventListener('scroll', onScroll, { passive: true });
      return () => container.removeEventListener('scroll', onScroll);
    }, [onScroll]);

    const label = side === 'source' ? t('editor.source') : t('editor.translation');

    return (
      <div className={`editor-pane editor-pane--${side}`}>
        <div className="editor-pane__header">
          <span className="editor-pane__label">{label}</span>
          {headerAction && <div className="editor-pane__header-action">{headerAction}</div>}
        </div>
        <div ref={containerRef} className="editor-pane__content">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }
);
