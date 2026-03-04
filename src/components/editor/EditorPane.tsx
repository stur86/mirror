import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback } from 'react';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
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
  onEditorContextMenu?: (event: EditorContextMenuEvent) => void;
}

export interface EditorPaneHandle {
  getContainer: () => HTMLElement | null;
}

export interface EditorContextMenuEvent {
  x: number;                   // viewport coords for menu placement
  y: number;
  side: 'source' | 'translation';
  editable: boolean;
  word: string | null;         // word under cursor; null on whitespace/punctuation
  wordFrom: number;            // ProseMirror doc position of word start
  wordTo: number;              // ProseMirror doc position of word end
  selection: { text: string; from: number; to: number } | null;
  actions: {
    cut: (() => void) | null;           // null if no selection or not editable
    copy: (() => void) | null;          // null if no selection
    paste: (() => Promise<void>) | null; // null if not editable
    selectAll: () => void;
  };
}

function getWordAtPos(
  editor: Editor,
  clickPos: number,
): { text: string; from: number; to: number } | null {
  const $pos = editor.state.doc.resolve(clickPos);
  if (!$pos.parent.isTextblock) return null;

  const text = $pos.parent.textContent;
  const offset = $pos.parentOffset;

  // Walk backward to word start
  let start = offset;
  while (start > 0 && /\w/.test(text[start - 1]!)) start--;

  // Walk forward to word end
  let end = offset;
  while (end < text.length && /\w/.test(text[end]!)) end++;

  if (start === end) return null; // clicked on whitespace or punctuation

  const nodeStart = $pos.start();
  return { text: text.slice(start, end), from: nodeStart + start, to: nodeStart + end };
}

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane(
    { side, content, editable = true, onChange, onContentChange, headerAction, lang, muteRanges, onEditorContextMenu },
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
      if (editor && content !== editor.storage.markdown.getMarkdown()) {
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

    // Sync editable prop → tiptap editor at runtime
    useEffect(() => {
      if (editor) {
        editor.setEditable(editable);
      }
    }, [editor, editable]);

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

    const handleContextMenu = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault(); // always suppress browser default

        if (!editor || !onEditorContextMenu) return;

        const clickResult = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
        const clickPos = clickResult?.pos ?? null;

        // Detect word under cursor without mutating selection
        const wordResult = clickPos !== null ? getWordAtPos(editor, clickPos) : null;

        // Include selection only if right-click landed inside it
        const sel = editor.state.selection;
        const clickInSelection =
          !sel.empty &&
          clickPos !== null &&
          clickPos >= sel.from &&
          clickPos <= sel.to;
        const selectionCtx = clickInSelection
          ? { text: editor.state.doc.textBetween(sel.from, sel.to), from: sel.from, to: sel.to }
          : null;

        const selText = selectionCtx?.text ?? null;

        onEditorContextMenu({
          x: e.clientX,
          y: e.clientY,
          side,
          editable,
          word: wordResult?.text ?? null,
          wordFrom: wordResult?.from ?? -1,
          wordTo: wordResult?.to ?? -1,
          selection: selectionCtx,
          actions: {
            cut: selText && editable
              ? () => {
                  void (async () => {
                    await navigator.clipboard.writeText(selText);
                    editor.commands.deleteSelection();
                  })();
                }
              : null,
            copy: selText
              ? () => { void navigator.clipboard.writeText(selText); }
              : null,
            paste: editable
              ? async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) editor.commands.insertContent(text);
                  } catch {
                    // Clipboard access denied — silently ignore
                  }
                }
              : null,
            selectAll: () => editor.commands.selectAll(),
          },
        });
      },
      [editor, side, editable, onEditorContextMenu],
    );

    const label = side === 'source' ? t('editor.source') : t('editor.translation');

    return (
      <div className={`editor-pane editor-pane--${side}${!editable ? ' editor-pane--readonly' : ''}`}>
        <div className="editor-pane__header">
          <span className="editor-pane__label">{label}</span>
          {headerAction && <div className="editor-pane__header-action">{headerAction}</div>}
        </div>
        <div ref={containerRef} className="editor-pane__content" lang={lang} onContextMenu={handleContextMenu}>
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
