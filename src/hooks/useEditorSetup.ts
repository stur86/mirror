import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { Extension, InputRule } from '@tiptap/core';

// Input rules for ***text*** and ___text___ → bold+italic simultaneously.
// Tiptap's built-in Bold/Italic rules use [^*]+ which prevents them from
// matching triple delimiters, so this extension fills the gap.
const BoldItalic = Extension.create({
  name: 'boldItalic',
  addInputRules() {
    const makeRule = (find: RegExp) =>
      new InputRule({
        find,
        handler: ({ state, range, match }) => {
          const captureGroup = match[2];
          const fullMatch = match[0];
          if (!captureGroup) return null;

          const { tr } = state;
          const startSpaces = fullMatch.search(/\S/);
          const textStart = range.from + fullMatch.indexOf(captureGroup);
          const textEnd = textStart + captureGroup.length;

          if (textEnd < range.to) tr.delete(textEnd, range.to);
          if (textStart > range.from) tr.delete(range.from + startSpaces, textStart);

          const markFrom = range.from + startSpaces;
          const markTo = markFrom + captureGroup.length;
          const boldType = state.schema.marks.bold;
          const italicType = state.schema.marks.italic;
          tr.addMark(markFrom, markTo, boldType.create());
          tr.addMark(markFrom, markTo, italicType.create());
          tr.removeStoredMark(boldType);
          tr.removeStoredMark(italicType);
        },
      });

    return [
      makeRule(/(?:^|\s)(\*\*\*((?:[^*]+))\*\*\*)$/),
      makeRule(/(?:^|\s)(___((?:[^_]+))___)$/),
    ];
  },
});

interface UseEditorSetupOptions {
  content: string;
  editable?: boolean;
  placeholder?: string;
  lang?: string;
  onUpdate?: (content: string) => void;
}

export function useEditorSetup({
  content,
  editable = true,
  placeholder = '',
  lang,
  onUpdate,
}: UseEditorSetupOptions): Editor | null {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      BoldItalic,
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        ...(lang ? { lang } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.storage.markdown.getMarkdown());
    },
  });

  return editor;
}
