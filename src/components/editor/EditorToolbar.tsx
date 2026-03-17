import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Button, HTMLSelect } from '../index';

interface EditorToolbarProps {
  editor: Editor | null;
}

const STYLE_OPTIONS_BASE = [1, 2, 3, 4, 5] as const;

function getStyleValue(editor: Editor): string {
  for (const level of STYLE_OPTIONS_BASE) {
    if (editor.isActive('heading', { level })) return `h${level}`;
  }
  return 'p';
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { t } = useTranslation();

  // useEditorState runs a selector and only re-renders when the derived values change.
  // Guard against null e — in some Tiptap v3 builds the selector is called with null.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
        isBold: e.isActive('bold'),
        isItalic: e.isActive('italic'),
        isBulletList: e.isActive('bulletList'),
        isOrderedList: e.isActive('orderedList'),
        styleValue: getStyleValue(e),
      };
    },
  });

  const disabled = !editor || !state;

  const styleOptions = [
    { value: 'p', label: t('editor.toolbar.styleNormal') },
    ...STYLE_OPTIONS_BASE.map((level) => ({
      value: `h${level}`,
      label: t('editor.toolbar.styleHeading', { level }),
    })),
  ];

  function handleStyleChange(value: string) {
    if (!editor) return;
    if (value === 'p') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value[1]!, 10) as 1 | 2 | 3 | 4 | 5;
      editor.chain().focus().setHeading({ level }).run();
    }
  }

  return (
    <div className="editor-toolbar">
      <HTMLSelect
        minimal
        small
        disabled={disabled}
        value={state?.styleValue ?? 'p'}
        options={styleOptions}
        onChange={(e) => handleStyleChange(e.target.value)}
        aria-label={t('editor.toolbar.style')}
      />
      <Button
        variant="minimal"
        icon="bold"
        disabled={disabled}
        active={state?.isBold ?? false}
        title={t('editor.toolbar.bold')}
        aria-label={t('editor.toolbar.bold')}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <Button
        variant="minimal"
        icon="italic"
        disabled={disabled}
        active={state?.isItalic ?? false}
        title={t('editor.toolbar.italic')}
        aria-label={t('editor.toolbar.italic')}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <Button
        variant="minimal"
        icon="properties"  // There is no "bullet-list" icon in Blueprint, but "properties" looks close enough.
        disabled={disabled}
        active={state?.isBulletList ?? false}
        title={t('editor.toolbar.bulletList')}
        aria-label={t('editor.toolbar.bulletList')}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <Button
        variant="minimal"
        icon="numbered-list"
        disabled={disabled}
        active={state?.isOrderedList ?? false}
        title={t('editor.toolbar.orderedList')}
        aria-label={t('editor.toolbar.orderedList')}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
    </div>
  );
}
