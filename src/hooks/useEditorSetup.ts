import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

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
