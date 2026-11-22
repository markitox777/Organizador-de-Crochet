import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';

type Props = {
  elementId: string;
  content: string;
  onChange: (html: string) => void;
  onEditorReady: (id: string, editor: Editor | null) => void;
  onEditorStateChange: () => void;
};

function prepareContent(value: string): string {
  // Mantiene HTML enriquecido y convierte texto antiguo en párrafos seguros.
  if (/^\s*<(p|h[1-6]|ul|ol|blockquote|div|pre)\b/i.test(value)) {
    return value;
  }
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');
}

export default function RichTextEditor({
  elementId,
  content,
  onChange,
  onEditorReady,
  onEditorStateChange
}: Props) {
  const onChangeRef = useRef(onChange);
  const onStateRef = useRef(onEditorStateChange);
  const lastEmittedRef = useRef<string | null>(null);
  onChangeRef.current = onChange;
  onStateRef.current = onEditorStateChange;

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, FontFamily],
    content: prepareContent(content),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedRef.current = html;
      onChangeRef.current(html);
    },
    onSelectionUpdate: () => onStateRef.current(),
    onTransaction: () => onStateRef.current(),
    editorProps: {
      attributes: {
        class: 'kuro-rich-text-content',
        spellcheck: 'true'
      }
    }
  });

  useEffect(() => {
    if (!editor) return;
    onEditorReady(elementId, editor);
    return () => onEditorReady(elementId, null);
  }, [editor, elementId, onEditorReady]);

  useEffect(() => {
    if (!editor || content === lastEmittedRef.current) return;
    const prepared = prepareContent(content);
    if (editor.getHTML() !== prepared) {
      editor.commands.setContent(prepared, { emitUpdate: false });
    }
  }, [editor, content]);

  return (
    <div className="kuro-rich-text-editor">
      <EditorContent editor={editor} />
    </div>
  );
}
