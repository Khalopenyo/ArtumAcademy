'use client';

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useState } from 'react';
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

/**
 * Визуальный редактор контента урока (TipTap). Выдаёт HTML через onChange.
 * Грузится lazy (ssr:false) из места использования. Картинки загружаются
 * на /api/admin/lesson-images и вставляются по публичному URL.
 */
interface LessonContentEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function LessonContentEditor({ value, onChange }: LessonContentEditorProps) {
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit, // bold/italic/headings/lists/link/blockquote/code и т.д.
      Image.configure({ inline: false, HTMLAttributes: { class: 'rounded-lg' } }),
      Placeholder.configure({
        placeholder: 'Текст урока: заголовки, абзацы, списки, картинки…',
      }),
    ],
    content: value || '',
    immediatelyRender: false, // Next SSR — не рендерим на сервере
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none min-h-[260px] px-4 py-3 focus:outline-none prose-img:rounded-lg',
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  if (!editor) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
        Загрузка редактора…
      </div>
    );
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/lesson-images', { method: 'POST', body: fd });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; url?: string; error?: string }
        | null;
      if (json?.ok && json.url) {
        editor!.chain().focus().setImage({ src: json.url }).run();
      } else {
        toast.error(json?.error ?? 'Не удалось загрузить картинку');
      }
    } catch {
      toast.error('Сеть прервалась при загрузке картинки');
    } finally {
      setUploading(false);
    }
  }

  function pickImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void uploadImage(file);
    };
    input.click();
  }

  function setLink() {
    const prev = editor!.getAttributes('link').href as string | undefined;
    const url = window.prompt('Ссылка (URL):', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card/40 p-1.5">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Жирный">
          <Bold className="size-4" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Курсив">
          <Italic className="size-4" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="Заголовок 2">
          <Heading2 className="size-4" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="Заголовок 3">
          <Heading3 className="size-4" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Список">
          <List className="size-4" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="Нумерованный список">
          <ListOrdered className="size-4" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn onClick={setLink} active={editor.isActive('link')} label="Ссылка">
          <Link2 className="size-4" aria-hidden />
        </ToolbarBtn>
        <ToolbarBtn onClick={pickImage} active={false} label="Картинка" disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  onClick,
  active,
  label,
  disabled = false,
  children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-50',
        active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export type { Editor };
