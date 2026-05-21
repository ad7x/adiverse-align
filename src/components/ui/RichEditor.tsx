import { useEffect, useRef, useState, memo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Heading1, Heading2, Heading3,
  Link as LinkIcon, Undo, Redo, Maximize2, Minimize2, Check
} from 'lucide-react';

// ─── Props ───────────────────────────────────────────────────────────

interface RichEditorProps {
  initialContent?: string;
  onSave: (content: string) => void;
  readOnly?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseContent(raw?: string) {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    // If it's not valid JSON, treat as plain text paragraph
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }] };
  }
}

// ─── Component ───────────────────────────────────────────────────────

export const RichEditor = memo(function RichEditor({ initialContent, onSave, readOnly = false }: RichEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: true, autolink: true }),
      TiptapImage.configure({ inline: false }),
    ],
    content: parseContent(initialContent),
    editable: isEditing && !readOnly,
    onUpdate: ({ editor: ed }) => {
      // Debounced auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave(JSON.stringify(ed.getJSON()));
      }, 500);
    },
    editorProps: {
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return true;

            const mediaId = uuidv4();
            const reader = new FileReader();
            reader.onload = async () => {
              const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
              await db.media.put({
                id: mediaId,
                fileBlob: blob,
                mimeType: file.type,
                name: file.name || 'pasted-image',
                createdAt: new Date().toISOString(),
              });
              const objectUrl = URL.createObjectURL(blob);
              blobUrlsRef.current.push(objectUrl);
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image.create({
                    src: objectUrl,
                    alt: file.name,
                    'data-media-id': mediaId,
                  })
                )
              );
            };
            reader.readAsArrayBuffer(file);
            return true;
          }
        }
        return false;
      },
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[60px] outline-none px-3 py-3 text-[hsl(var(--foreground))]',
      },
    },
  });

  // Sync editable state when isEditing changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing && !readOnly);
      if (isEditing) {
        editor.commands.focus();
      }
    }
  }, [editor, isEditing, readOnly]);

  // Handle click outside to save and close
  useEffect(() => {
    if (!isEditing || isFullscreen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, isFullscreen]);

  if (!editor) return null;

  const hasContent = editor.getJSON().content?.some(
    (node: any) => node.content?.some((c: any) => c.text?.trim()) || node.type === 'image'
  );

  // Read-only view (not editing)
  if (!isEditing) {
    if (!hasContent && readOnly) return null;

    return (
      <div 
        className={`group relative cursor-text rounded-lg border border-transparent hover:bg-[hsl(var(--muted)/0.3)] transition-colors p-1 -mx-1 ${!hasContent ? 'opacity-50' : ''}`}
        onClick={() => {
          if (!readOnly) setIsEditing(true);
        }}
      >
        {!hasContent && !readOnly ? (
          <div className="text-sm italic text-[hsl(var(--muted-foreground))] px-2 py-1 select-none pointer-events-none">
            Add description...
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-[hsl(var(--muted-foreground))] px-1 py-1 pointer-events-none">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
    );
  }

  const ToolbarButton = ({ onClick, active, children, title, className = '' }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title?: string; className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] ' + className
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] ' + className
      }`}
    >
      {children}
    </button>
  );

  const Toolbar = () => (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-[hsl(var(--border))] px-2 py-1.5 bg-[hsl(var(--muted)/0.3)] sticky top-0 z-10 backdrop-blur-md">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough size={15} />
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 size={15} />
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
        <ListOrdered size={15} />
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('Enter URL:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        active={editor.isActive('link')}
        title="Add Link"
      >
        <LinkIcon size={15} />
      </ToolbarButton>
      <div className="flex-1" />
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo" className="hidden sm:block">
        <Undo size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo" className="hidden sm:block">
        <Redo size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
        {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />
      <button 
        onClick={() => {
          setIsEditing(false);
          if (isFullscreen) setIsFullscreen(false);
        }}
        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] transition-colors ml-1"
      >
        <Check size={14} /> Done
      </button>
    </div>
  );

  const EditorBody = () => (
    <div ref={containerRef} className="rounded-xl border border-[hsl(var(--border))] shadow-sm overflow-hidden bg-[hsl(var(--card))] focus-within:border-[hsl(var(--primary)/0.5)] transition-colors">
      <Toolbar />
      <EditorContent editor={editor} className="max-h-[60vh] overflow-y-auto custom-scrollbar" />
    </div>
  );

  // Editing mode
  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-[hsl(var(--background))] flex flex-col p-4 sm:p-8">
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col rounded-2xl border border-[hsl(var(--border))] shadow-2xl overflow-hidden bg-[hsl(var(--card))]">
          <Toolbar />
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
             <EditorContent editor={editor} className="h-full" />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return <EditorBody />;
});
