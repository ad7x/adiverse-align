import React, { useEffect, useRef, useState, memo } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Node, mergeAttributes, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Youtube from '@tiptap/extension-youtube';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';
import TextAlign from '@tiptap/extension-text-align';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { NodeSelection } from '@tiptap/pm/state';
import {
  Undo,
  Redo,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Type,
  Palette,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Info,
  Table as TableIcon,
  Columns,
  Youtube as YoutubeIcon,
  Globe,
  Link as LinkIcon,
  Plus,
  Minimize2,
  Maximize2,
  Check,
  Edit3,
  Trash2,
  GripVertical
} from 'lucide-react';


// ─── Props ───────────────────────────────────────────────────────────

interface RichEditorProps {
  initialContent?: string;
  onSave: (content: string) => void;
  readOnly?: boolean;
  mode?: 'markdown' | 'rich';
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseContent(raw?: string, mode?: 'markdown' | 'rich') {
  if (!raw) return undefined;
  if (mode === 'markdown') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // If it's not valid JSON, treat as plain text paragraph
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }] };
  }
}

// ─── Custom Tiptap Extensions ────────────────────────────────────────

// 1. Details (Collapsible Block)
const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,
  draggable: true,
  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: element => element.hasAttribute('open') || element.getAttribute('data-open') === 'true',
        renderHTML: attributes => {
          return attributes.open ? { open: 'true', 'data-open': 'true' } : { 'data-open': 'false' };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'details' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes), 0];
  },
});

const DetailsSummary = Node.create({
  name: 'detailsSummary',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [{ tag: 'summary' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes), 0];
  },
});

const DetailsContent = Node.create({
  name: 'detailsContent',
  content: 'block*',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="details-content"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'details-content' }), 0];
  },
});

// 2. Callout Block
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  draggable: true,
  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-callout-type') || 'info',
        renderHTML: attributes => ({ 'data-callout-type': attributes.type }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0];
  },
});

// 3. Link Preview / Bookmark React NodeView
const LinkPreviewComponent = memo(function LinkPreviewComponent({ node, updateAttributes, selected, editor }: any) {
  const { url, title, description, image } = node.attrs;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDesc, setEditDesc] = useState(description);

  useEffect(() => {
    setEditTitle(title);
    setEditDesc(description);
  }, [title, description]);

  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  const handleDelete = () => {
    // Delete this node by selecting it and running delete
    editor.commands.deleteNode('linkPreview');
  };

  if (isEditing) {
    return (
      <NodeViewWrapper className="my-4 border border-[hsl(var(--border))] rounded-xl p-4 shadow-sm bg-[hsl(var(--card))]">
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Edit Link Bookmark</div>
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Bookmark Title"
            className="bg-transparent border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-xs outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
          />
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            placeholder="Bookmark Description"
            rows={2}
            className="bg-transparent border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-xs outline-none focus:border-[hsl(var(--primary))] resize-none text-[hsl(var(--foreground))]"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 rounded text-xs border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] cursor-pointer">Cancel</button>
            <button onClick={() => {
              updateAttributes({ title: editTitle, description: editDesc });
              setIsEditing(false);
            }} className="px-2.5 py-1 rounded text-xs bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] cursor-pointer">Save</button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className={`my-4 border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-sm bg-[hsl(var(--card))] group relative ${selected ? 'ring-2 ring-[hsl(var(--primary))]' : ''}`}>
      {/* Options Bar */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-md p-1 z-10">
        <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] rounded transition-colors cursor-pointer" title="Edit Bookmark">
          <Edit3 size={14} />
        </button>
        <button onClick={handleDelete} className="p-1 hover:bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] rounded transition-colors cursor-pointer" title="Delete Bookmark">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row min-h-[100px]">
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 p-4 flex flex-col justify-between hover:bg-[hsl(var(--muted)/0.2)] transition-colors text-left no-underline border-none">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] line-clamp-1 m-0">
              {title || url}
            </h4>
            <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 m-0 mt-0.5 leading-relaxed">
              {description || 'No description available.'}
            </p>
          </div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center gap-1.5 mt-3">
            <img 
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
              alt="" 
              className="w-3.5 h-3.5 rounded-sm" 
              onError={e => e.currentTarget.style.display = 'none'} 
            />
            <span className="truncate">{domain}</span>
          </div>
        </a>
        {image && (
          <div className="w-full sm:w-1/3 bg-[hsl(var(--muted)/0.2)] flex items-center justify-center border-t sm:border-t-0 sm:border-l border-[hsl(var(--border))]">
            <img src={image} alt="" className="w-full h-full object-cover max-h-[120px]" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
});

const LinkPreview = Node.create({
  name: 'linkPreview',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      image: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="link-preview"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'link-preview' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewComponent);
  },
});

// 4. Iframe Embed React NodeView
const IframeComponent = memo(function IframeComponent({ node, updateAttributes, selected, editor }: any) {
  const { src } = node.attrs;
  const [isEditing, setIsEditing] = useState(!src);
  const [urlInput, setUrlInput] = useState(src);

  const handleSave = () => {
    updateAttributes({ src: urlInput });
    setIsEditing(false);
  };

  const handleDelete = () => {
    editor.commands.deleteNode('iframe');
  };

  return (
    <NodeViewWrapper className={`my-4 border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-sm bg-[hsl(var(--card))] group relative ${selected ? 'ring-2 ring-[hsl(var(--primary))]' : ''}`}>
      {/* Options Bar */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-md p-1 z-10">
        <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] rounded transition-colors cursor-pointer" title="Edit Embed URL">
          <Edit3 size={14} />
        </button>
        <button onClick={handleDelete} className="p-1 hover:bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] rounded transition-colors cursor-pointer" title="Delete Embed">
          <Trash2 size={14} />
        </button>
      </div>

      {isEditing ? (
        <div className="p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Embed Iframe Link</div>
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://example.com"
            className="bg-transparent border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-xs outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 rounded text-xs border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] cursor-pointer">Cancel</button>
            <button onClick={handleSave} className="px-2.5 py-1 rounded text-xs bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] cursor-pointer">Embed</button>
          </div>
        </div>
      ) : (
        <div className="relative w-full" style={{ height: '350px' }}>
          <iframe
            src={src}
            className="w-full h-full border-none bg-white"
            allowFullScreen
            title="Embedded Web Content"
          />
        </div>
      )}
    </NodeViewWrapper>
  );
});

const Iframe = Node.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      width: { default: '100%' },
      height: { default: '350px' },
    };
  },
  parseHTML() {
    return [{ tag: 'iframe' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['iframe', mergeAttributes(HTMLAttributes, { frameBorder: '0', allowFullScreen: 'true' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(IframeComponent);
  },
});

// ─── Toolbar Button ──────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

const ToolbarButton = memo(function ToolbarButton({ onClick, active, children, title, className = '' }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
        active
          ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] ' + className
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] ' + className
      }`}
    >
      {children}
    </button>
  );
});

// ─── Component ───────────────────────────────────────────────────────

export const RichEditor = memo(function RichEditor({ 
  initialContent, 
  onSave, 
  readOnly = false,
  mode = 'rich'
}: RichEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tick, setTick] = useState(0);

  // Sync refs for stale closures
  const editorRef = useRef<any>(null);
  const isEditingRef = useRef(isEditing);
  const modeRef = useRef(mode);
  const onSaveRef = useRef(onSave);
  const executeCommandRef = useRef<any>(null);
  const hasUnsavedChangesRef = useRef(false);
  const lastSavedContentRef = useRef<string | null>(null);
  const lastSetInitialContentRef = useRef<string | undefined>(initialContent);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Pickers state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showAlignPicker, setShowAlignPicker] = useState(false);

  // Slash commands menu state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashCoords, setSlashCoords] = useState<{ top: number; left: number } | null>(null);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);

  // Paste handler overlay state
  const [showPasteOptions, setShowPasteOptions] = useState(false);
  const [pastedUrl, setPastedUrl] = useState('');
  const [pastedUrlCoords, setPastedUrlCoords] = useState<{ top: number; left: number } | null>(null);

  // Drag handle states
  const [hoveredBlockEl, setHoveredBlockEl] = useState<HTMLElement | null>(null);
  const [dragHandleY, setDragHandleY] = useState<number | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Force render helper
  const forceUpdate = () => setTick(t => t + 1);

  const runToolbarAction = (action: () => void) => {
    action();
    forceUpdate();
  };

  // Revoke blob URLs on unmount and flush pending saves
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (hasUnsavedChangesRef.current) {
        hasUnsavedChangesRef.current = false;
        if (editorRef.current) {
          const ed = editorRef.current;
          const savedVal = modeRef.current === 'markdown' && typeof ed.getMarkdown === 'function'
            ? ed.getMarkdown()
            : JSON.stringify(ed.getJSON());
          lastSavedContentRef.current = savedVal;
          lastSetInitialContentRef.current = savedVal;
          onSaveRef.current(savedVal);
        }
      }
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const editor = useEditor({
    extensions: mode === 'markdown' ? [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: true, autolink: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, linkify: true } as any),
    ] : [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: true, autolink: true }),
      TiptapImage.configure({ inline: false }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ width: 640, height: 360, autoplay: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Details,
      DetailsSummary,
      DetailsContent,
      Callout,
      LinkPreview,
      Iframe,
    ],
    content: parseContent(initialContent, mode),
    editable: isEditing && !readOnly,
     onSelectionUpdate: () => {
      forceUpdate();
    },
    onTransaction: () => {
      forceUpdate();
    },
    onUpdate: ({ editor: ed }) => {
      forceUpdate();
      hasUnsavedChangesRef.current = true;
      
      // Debounced auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        hasUnsavedChangesRef.current = false;
        const savedVal = modeRef.current === 'markdown' && typeof ed.getMarkdown === 'function'
          ? ed.getMarkdown()
          : JSON.stringify(ed.getJSON());
        lastSavedContentRef.current = savedVal;
        lastSetInitialContentRef.current = savedVal;
        onSaveRef.current(savedVal);
      }, 500);

      // Check for slash menu
      const { selection } = ed.state;
      const $anchor = selection.$anchor;
      const textBefore = $anchor.parent.textBetween(0, $anchor.parentOffset);
      const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);

      if (match && isEditingRef.current) {
        setShowSlashMenu(true);
        setSlashQuery(match[1]);
        try {
          const coords = ed.view.coordsAtPos(selection.from);
          setSlashCoords({ top: coords.bottom, left: coords.left });
        } catch (e) {
          setShowSlashMenu(false);
        }
      } else {
        setShowSlashMenu(false);
      }
    },
    onBlur: ({ editor: ed }) => {
      if (isEditingRef.current) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        if (hasUnsavedChangesRef.current) {
          hasUnsavedChangesRef.current = false;
          const savedVal = modeRef.current === 'markdown' && typeof ed.getMarkdown === 'function'
            ? ed.getMarkdown()
            : JSON.stringify(ed.getJSON());
          lastSavedContentRef.current = savedVal;
          lastSetInitialContentRef.current = savedVal;
          onSaveRef.current(savedVal);
        }
      }
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (showSlashMenuRef.current) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveCommandIndex(prev => (prev + 1) % filteredCommandsRef.current.length);
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveCommandIndex(prev => (prev - 1 + filteredCommandsRef.current.length) % filteredCommandsRef.current.length);
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            const cmd = filteredCommandsRef.current[activeCommandIndexRef.current];
            if (cmd && executeCommandRef.current) {
              executeCommandRef.current(cmd);
            }
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setShowSlashMenu(false);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        const activeEditor = editorRef.current || editor;
        if (text && /^(https?:\/\/[^\s]+)$/.test(text.trim()) && isEditingRef.current) {
          event.preventDefault();
          const { selection } = view.state;
          
          if (!selection.empty) {
            activeEditor?.chain().focus().setLink({ href: text.trim() }).run();
            forceUpdate();
            return true;
          }

          if (modeRef.current === 'markdown') {
            activeEditor?.chain().focus().insertContent(`<a href="${text.trim()}">${text.trim()}</a>`).run();
            forceUpdate();
            return true;
          }

          setPastedUrl(text.trim());
          try {
            const coords = view.coordsAtPos(selection.from);
            setPastedUrlCoords({ top: coords.bottom, left: coords.left });
            setShowPasteOptions(true);
          } catch (e) {
            // fallback
            const linkMark = view.state.schema.marks.link.create({ href: text.trim() });
            const textNode = view.state.schema.text(text.trim(), [linkMark]);
            view.dispatch(view.state.tr.replaceSelectionWith(textNode));
          }
          return true;
        }

        // Image upload pasting
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            if (modeRef.current === 'markdown') {
              return true;
            }
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
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[80px] outline-none px-3 py-3 text-[hsl(var(--foreground))]',
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync editable state and save changes when isEditing transitions to false
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing && !readOnly);
      if (isEditing) {
        editor.commands.focus();
      } else {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        if (hasUnsavedChangesRef.current) {
          hasUnsavedChangesRef.current = false;
          const savedVal = modeRef.current === 'markdown' && typeof editor.getMarkdown === 'function'
            ? editor.getMarkdown()
            : JSON.stringify(editor.getJSON());
          lastSavedContentRef.current = savedVal;
          lastSetInitialContentRef.current = savedVal;
          onSaveRef.current(savedVal);
        }
      }
    }
  }, [editor, isEditing, readOnly]);

  // Sync content when initialContent changes asynchronously and editor is not focused/editing
  useEffect(() => {
    if (editor && !isEditingRef.current) {
      const target = initialContent || '';
      if (target === lastSetInitialContentRef.current) {
        return;
      }
      lastSetInitialContentRef.current = target;
      
      if (mode === 'markdown') {
        editor.commands.setContent(target);
      } else {
        const parsed = parseContent(target, mode);
        editor.commands.setContent(parsed || '');
      }
    }
  }, [editor, initialContent, mode]);

  // Handle click outside to save and close
  useEffect(() => {
    if (!isEditing || isFullscreen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !document.body.contains(target)) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Don't close if clicking options portals (fixed overlays)
        if (target.closest('[data-rich-editor-portal="true"]')) return;
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, isFullscreen]);

  // Close pickers on click outside
  useEffect(() => {
    if (!showColorPicker && !showHighlightPicker && !showAlignPicker) return;
    const handleClosePickers = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      if (!target.closest('.picker-container')) {
        setShowColorPicker(false);
        setShowHighlightPicker(false);
        setShowAlignPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClosePickers);
    return () => document.removeEventListener('mousedown', handleClosePickers);
  }, [showColorPicker, showHighlightPicker, showAlignPicker]);

  // Color lists
  const colors = [
    { name: 'Default', value: 'var(--foreground)' },
    { name: 'Blue', value: 'hsl(217, 91%, 60%)' },
    { name: 'Purple', value: 'hsl(270, 70%, 60%)' },
    { name: 'Green', value: 'hsl(152, 60%, 45%)' },
    { name: 'Red', value: 'hsl(0, 84%, 65%)' },
    { name: 'Orange', value: 'hsl(24, 95%, 55%)' },
  ];

  const highlights = [
    { name: 'None', value: 'transparent' },
    { name: 'Yellow Highlight', value: '#fef08a' },
    { name: 'Green Highlight', value: '#bbf7d0' },
    { name: 'Pink Highlight', value: '#fbcfe8' },
    { name: 'Blue Highlight', value: '#bfdbfe' },
  ];

  // Slash commands list
  const commands = [
    {
      id: 'text',
      title: 'Text',
      description: 'Start writing plain text',
      icon: <Type size={15} />,
      keywords: ['text', 'paragraph', 'p'],
      action: () => (editorRef.current || editor).chain().focus().setParagraph().run(),
    },
    {
      id: 'h1',
      title: 'Heading 1',
      description: 'Large heading block',
      icon: <Heading1 size={15} />,
      keywords: ['h1', 'heading', 'large'],
      action: () => (editorRef.current || editor).chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      title: 'Heading 2',
      description: 'Medium heading block',
      icon: <Heading2 size={15} />,
      keywords: ['h2', 'heading', 'medium'],
      action: () => (editorRef.current || editor).chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      title: 'Heading 3',
      description: 'Small heading block',
      icon: <Heading3 size={15} />,
      keywords: ['h3', 'heading', 'small'],
      action: () => (editorRef.current || editor).chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: 'bulletList',
      title: 'Bullet List',
      description: 'Create a simple bulleted list',
      icon: <List size={15} />,
      keywords: ['bullet', 'list', 'ul'],
      action: () => (editorRef.current || editor).chain().focus().toggleBulletList().run(),
    },
    {
      id: 'orderedList',
      title: 'Numbered List',
      description: 'Create a list with numbering',
      icon: <ListOrdered size={15} />,
      keywords: ['ordered', 'list', 'ol', 'numbered'],
      action: () => (editorRef.current || editor).chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'todoList',
      title: 'To-do List',
      description: 'List with checkbox tasks',
      icon: <CheckSquare size={15} />,
      keywords: ['todo', 'task', 'checklist', 'checkbox'],
      action: () => (editorRef.current || editor).chain().focus().toggleTaskList().run(),
    },
    {
      id: 'toggleList',
      title: 'Toggle Block',
      description: 'Collapsible blocks toggle container',
      icon: <ChevronRight size={15} />,
      keywords: ['toggle', 'collapse', 'details', 'summary'],
      action: () => {
        (editorRef.current || editor).chain().focus().insertContent([
          {
            type: 'details',
            content: [
              { type: 'detailsSummary', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Toggle Title' }] }] },
              { type: 'detailsContent', content: [{ type: 'paragraph' }] }
            ]
          }
        ]).run();
      },
    },
    {
      id: 'quote',
      title: 'Quote',
      description: 'Capture a citation or quote',
      icon: <Quote size={15} />,
      keywords: ['quote', 'blockquote', 'cite'],
      action: () => (editorRef.current || editor).chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'codeBlock',
      title: 'Code Block',
      description: 'Code container with formatting',
      icon: <Code size={15} className="scale-x-110" />,
      keywords: ['code', 'block', 'pre'],
      action: () => (editorRef.current || editor).chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'alignLeft',
      title: 'Align Left',
      description: 'Left align current block',
      icon: <AlignLeft size={15} />,
      keywords: ['align', 'left', 'justify-left'],
      action: () => (editorRef.current || editor).chain().focus().setTextAlign('left').run(),
    },
    {
      id: 'alignCenter',
      title: 'Align Center',
      description: 'Center align current block',
      icon: <AlignCenter size={15} />,
      keywords: ['align', 'center', 'justify-center'],
      action: () => (editorRef.current || editor).chain().focus().setTextAlign('center').run(),
    },
    {
      id: 'alignRight',
      title: 'Align Right',
      description: 'Right align current block',
      icon: <AlignRight size={15} />,
      keywords: ['align', 'right', 'justify-right'],
      action: () => (editorRef.current || editor).chain().focus().setTextAlign('right').run(),
    },
    {
      id: 'alignJustify',
      title: 'Align Justify',
      description: 'Justify current block text',
      icon: <AlignJustify size={15} />,
      keywords: ['align', 'justify', 'justify-all'],
      action: () => (editorRef.current || editor).chain().focus().setTextAlign('justify').run(),
    },
    {
      id: 'divider',
      title: 'Divider',
      description: 'Horizontal separator line',
      icon: <Minus size={15} />,
      keywords: ['divider', 'hr', 'line'],
      action: () => (editorRef.current || editor).chain().focus().setHorizontalRule().run(),
    },
    {
      id: 'callout',
      title: 'Callout Box',
      description: 'Alert message block container',
      icon: <Info size={15} />,
      keywords: ['callout', 'info', 'warning', 'alert', 'box'],
      action: () => {
        (editorRef.current || editor).chain().focus().insertContent({
          type: 'callout',
          attrs: { type: 'info' },
          content: [{ type: 'paragraph' }]
        }).run();
      },
    },
    {
      id: 'table',
      title: 'Table',
      description: 'Standard grid layout table',
      icon: <TableIcon size={15} />,
      keywords: ['table', 'grid', 'cells'],
      action: () => (editorRef.current || editor).chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'columns',
      title: 'Columns Layout',
      description: 'Side-by-side columns container',
      icon: <Columns size={15} />,
      keywords: ['columns', 'layout', 'grid', 'multi-column'],
      action: () => {
        (editorRef.current || editor).chain().focus().insertContent({
          type: 'table',
          attrs: { 'data-columns-layout': 'true' },
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph' }] },
                { type: 'tableCell', content: [{ type: 'paragraph' }] }
              ]
            }
          ]
        }).run();
      },
    },
    {
      id: 'youtube',
      title: 'YouTube Video',
      description: 'Embed standard YouTube videos',
      icon: <YoutubeIcon size={15} />,
      keywords: ['youtube', 'video', 'embed'],
      action: () => {
        const url = window.prompt('Enter YouTube URL:');
        if (url) {
          (editorRef.current || editor).chain().focus().setYoutubeVideo({ src: url }).run();
        }
      },
    },
    {
      id: 'linkPreview',
      title: 'Link Bookmark',
      description: 'Visual website preview card',
      icon: <Globe size={15} />,
      keywords: ['bookmark', 'preview', 'link', 'embed'],
      action: () => {
        const url = window.prompt('Enter Web URL:');
        if (url) {
          try {
            const domain = new URL(url).hostname;
            (editorRef.current || editor).chain().focus().insertContent({
              type: 'linkPreview',
              attrs: { url, title: domain, description: 'Visual bookmark for ' + url }
            }).run();
          } catch {
            (editorRef.current || editor).chain().focus().insertContent({
              type: 'linkPreview',
              attrs: { url, title: 'Bookmark Link', description: 'Visual bookmark for ' + url }
            }).run();
          }
        }
      },
    },
    {
      id: 'iframe',
      title: 'Iframe Embed',
      description: 'Embed webpage iframe element',
      icon: <LinkIcon size={15} />,
      keywords: ['iframe', 'embed', 'page'],
      action: () => {
        const url = window.prompt('Enter Embed URL:');
        if (url) {
          (editorRef.current || editor).chain().focus().insertContent({
            type: 'iframe',
            attrs: { src: url }
          }).run();
        }
      },
    }
  ];

  // Slash commands filtering
  const filteredCommands = commands.filter(
    cmd => {
      if (mode === 'markdown') {
        const allowedMarkdownCommands = ['text', 'h1', 'h2', 'h3', 'bulletList', 'orderedList', 'todoList', 'quote', 'codeBlock', 'divider', 'table'];
        if (!allowedMarkdownCommands.includes(cmd.id)) {
          return false;
        }
      }
      return (
        cmd.title.toLowerCase().includes(slashQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(slashQuery.toLowerCase()) ||
        cmd.keywords.some(kw => kw.includes(slashQuery.toLowerCase()))
      );
    }
  );

  // Sync refs for handleKeyDown callback
  const showSlashMenuRef = useRef(showSlashMenu);
  const activeCommandIndexRef = useRef(activeCommandIndex);
  const filteredCommandsRef = useRef(filteredCommands);
  
  useEffect(() => { showSlashMenuRef.current = showSlashMenu; }, [showSlashMenu]);
  useEffect(() => { activeCommandIndexRef.current = activeCommandIndex; }, [activeCommandIndex]);
  useEffect(() => { filteredCommandsRef.current = filteredCommands; }, [filteredCommands]);

  const executeCommand = (cmd: typeof commands[0]) => {
    const activeEditor = editorRef.current || editor;
    if (!activeEditor) return;
    
    // Delete slash text
    const { selection } = activeEditor.state;
    const $anchor = selection.$anchor;
    const textBefore = $anchor.parent.textBetween(0, $anchor.parentOffset);
    const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);

    if (match) {
      const matchIndex = textBefore.lastIndexOf('/');
      const startPos = $anchor.start() + matchIndex;
      const endPos = selection.from;
      activeEditor.chain().focus().deleteRange({ from: startPos, to: endPos }).run();
    }

    cmd.action();
    setShowSlashMenu(false);
    setActiveCommandIndex(0);
  };

  useEffect(() => {
    executeCommandRef.current = executeCommand;
  });

  // Drag-and-drop handles logic
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!editor || !isEditing) return;
    const target = e.target as HTMLElement;
    const editorDom = editor.view.dom;

    // Find block child of editor dom
    let el: HTMLElement | null = target;
    while (el && el.parentElement !== editorDom) {
      el = el.parentElement;
    }

    if (el && el.parentElement === editorDom) {
      setHoveredBlockEl(el);
      const containerRect = containerRef.current?.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      if (containerRect) {
        setDragHandleY(elRect.top - containerRect.top + containerRef.current!.scrollTop);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredBlockEl(null);
    setDragHandleY(null);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!editor || !hoveredBlockEl) return;
    try {
      const pos = editor.view.posAtDOM(hoveredBlockEl, 0);
      const { state, dispatch } = editor.view;
      const $pos = state.doc.resolve(pos);

      let resolvedPos = pos;
      if ($pos.depth > 0) {
        resolvedPos = $pos.before(1);
      } else {
        resolvedPos = 0;
      }

      const nodeSel = NodeSelection.create(state.doc, resolvedPos);
      dispatch(state.tr.setSelection(nodeSel));

      hoveredBlockEl.setAttribute('draggable', 'true');
      (e.target as any)._draggedEl = hoveredBlockEl;
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = (e.target as any)._draggedEl;
    if (el) {
      el.removeAttribute('draggable');
      delete (e.target as any)._draggedEl;
    }
    setHoveredBlockEl(null);
    setDragHandleY(null);
  };

  if (!editor) return null;

  const hasContent = editor.getJSON().content?.some(
    (node: any) => node.content?.some((c: any) => c.text?.trim()) || ['image', 'linkPreview', 'youtube', 'iframe', 'table', 'details', 'callout'].includes(node.type)
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
            Add description... (supports markdown, '/' commands)
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-[hsl(var(--muted-foreground))] px-1 py-1 pointer-events-none">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
    );
  }

  const renderToolbar = () => (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-[hsl(var(--border))] px-2 py-1.5 bg-[hsl(var(--muted)/0.3)] sticky top-0 z-10 backdrop-blur-md select-none">
      {/* Undo/Redo */}
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().undo().run())} title="Undo">
        <Undo size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().redo().run())} title="Redo">
        <Redo size={14} />
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />

      {/* Formatting */}
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleBold().run())} active={editor.isActive('bold')} title="Bold">
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleItalic().run())} active={editor.isActive('italic')} title="Italic">
        <Italic size={14} />
      </ToolbarButton>
      {mode !== 'markdown' && (
        <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleUnderline().run())} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon size={14} />
        </ToolbarButton>
      )}
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleStrike().run())} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleCode().run())} active={editor.isActive('code')} title="Inline Code">
        <Code size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().clearNodes().unsetAllMarks().run())} title="Clear Formatting">
        <Type size={14} className="opacity-70" />
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />

      {/* Text Color Picker */}
      {mode !== 'markdown' && (
        <>
          <div className="relative picker-container">
            <ToolbarButton onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); setShowAlignPicker(false); }} title="Text Color">
              <Palette size={14} />
            </ToolbarButton>
            {showColorPicker && (
              <div className="absolute top-8 left-0 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl p-1 z-20 flex flex-col gap-0.5 w-28 text-left" data-rich-editor-portal="true">
                {colors.map(col => (
                  <button
                    key={col.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (col.name === 'Default') {
                        runToolbarAction(() => editor.chain().focus().unsetColor().run());
                      } else {
                        runToolbarAction(() => editor.chain().focus().setColor(col.value).run());
                      }
                      setShowColorPicker(false);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-[hsl(var(--muted))] text-[10px] rounded text-left w-full text-[hsl(var(--foreground))] cursor-pointer font-medium"
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: col.value }} />
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Highlight Picker */}
          <div className="relative picker-container">
            <ToolbarButton onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); setShowAlignPicker(false); }} title="Text Highlight">
              <Highlighter size={14} />
            </ToolbarButton>
            {showHighlightPicker && (
              <div className="absolute top-8 left-0 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl p-1 z-20 flex flex-col gap-0.5 w-36 text-left" data-rich-editor-portal="true">
                {highlights.map(hl => (
                  <button
                    key={hl.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (hl.name === 'None') {
                        runToolbarAction(() => editor.chain().focus().unsetHighlight().run());
                      } else {
                        runToolbarAction(() => editor.chain().focus().setHighlight({ color: hl.value }).run());
                      }
                      setShowHighlightPicker(false);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-[hsl(var(--muted))] text-[10px] rounded text-left w-full text-[hsl(var(--foreground))] cursor-pointer font-medium"
                  >
                    <span className="w-2.5 h-2.5 rounded border border-black/10" style={{ backgroundColor: hl.value }} />
                    {hl.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />
        </>
      )}

      {/* Headings */}
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleHeading({ level: 1 }).run())} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 size={14} />
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />

      {/* Lists */}
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleBulletList().run())} active={editor.isActive('bulletList')} title="Bullet List">
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleOrderedList().run())} active={editor.isActive('orderedList')} title="Ordered List">
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleTaskList().run())} active={editor.isActive('taskList')} title="Task List">
        <CheckSquare size={14} />
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />

      {/* Alignment Dropdown */}
      {mode !== 'markdown' && (
        <>
          <div className="relative picker-container">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowAlignPicker(!showAlignPicker);
                setShowColorPicker(false);
                setShowHighlightPicker(false);
              }}
              title={
                editor.isActive({ textAlign: 'center' }) ? 'Align Center' :
                editor.isActive({ textAlign: 'right' }) ? 'Align Right' :
                editor.isActive({ textAlign: 'justify' }) ? 'Align Justify' :
                'Align Left'
              }
              className={`p-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-0.5 ${
                showAlignPicker || editor.isActive({ textAlign: 'center' }) || editor.isActive({ textAlign: 'right' }) || editor.isActive({ textAlign: 'justify' })
                  ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {editor.isActive({ textAlign: 'center' }) ? <AlignCenter size={14} /> :
               editor.isActive({ textAlign: 'right' }) ? <AlignRight size={14} /> :
               editor.isActive({ textAlign: 'justify' }) ? <AlignJustify size={14} /> :
               <AlignLeft size={14} />}
              <ChevronDown size={11} className="opacity-60" />
            </button>
            {showAlignPicker && (
              <div className="absolute top-8 left-0 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl p-1 z-20 flex flex-col gap-0.5 w-32 text-left" data-rich-editor-portal="true">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    runToolbarAction(() => editor.chain().focus().setTextAlign('left').run());
                    setShowAlignPicker(false);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-[hsl(var(--muted))] text-[10px] rounded text-left w-full text-[hsl(var(--foreground))] cursor-pointer font-medium ${
                    editor.isActive({ textAlign: 'left' }) || (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' }))
                      ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-semibold'
                      : ''
                  }`}
                >
                  <AlignLeft size={13} />
                  Align Left
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    runToolbarAction(() => editor.chain().focus().setTextAlign('center').run());
                    setShowAlignPicker(false);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-[hsl(var(--muted))] text-[10px] rounded text-left w-full text-[hsl(var(--foreground))] cursor-pointer font-medium ${
                    editor.isActive({ textAlign: 'center' }) ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-semibold' : ''
                  }`}
                >
                  <AlignCenter size={13} />
                  Align Center
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    runToolbarAction(() => editor.chain().focus().setTextAlign('right').run());
                    setShowAlignPicker(false);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-[hsl(var(--muted))] text-[10px] rounded text-left w-full text-[hsl(var(--foreground))] cursor-pointer font-medium ${
                    editor.isActive({ textAlign: 'right' }) ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-semibold' : ''
                  }`}
                >
                  <AlignRight size={13} />
                  Align Right
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    runToolbarAction(() => editor.chain().focus().setTextAlign('justify').run());
                    setShowAlignPicker(false);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-[hsl(var(--muted))] text-[10px] rounded text-left w-full text-[hsl(var(--foreground))] cursor-pointer font-medium ${
                    editor.isActive({ textAlign: 'justify' }) ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-semibold' : ''
                  }`}
                >
                  <AlignJustify size={13} />
                  Align Justify
                </button>
              </div>
            )}
          </div>
          <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />
        </>
      )}

      {/* Block Types */}
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleBlockquote().run())} active={editor.isActive('blockquote')} title="Blockquote">
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().toggleCodeBlock().run())} active={editor.isActive('codeBlock')} title="Code Block">
        <Code size={14} className="scale-x-110" />
      </ToolbarButton>
      <ToolbarButton onClick={() => runToolbarAction(() => editor.chain().focus().setHorizontalRule().run())} title="Divider Line">
        <Minus size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('Enter URL:');
          if (url) runToolbarAction(() => editor.chain().focus().setLink({ href: url }).run());
        }}
        active={editor.isActive('link')}
        title="Add Link"
      >
        <LinkIcon size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          runToolbarAction(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run());
        }}
        active={editor.isActive('table')}
        title="Insert Grid Table"
      >
        <TableIcon size={14} />
      </ToolbarButton>

      {/* Add New Custom Elements Directly */}
      {mode !== 'markdown' && (
        <>
          <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />
          <ToolbarButton
            onClick={() => {
              runToolbarAction(() => editor.chain().focus().insertContent({
                type: 'callout',
                attrs: { type: 'info' },
                content: [{ type: 'paragraph' }]
              }).run());
            }}
            title="Insert Callout Info Box"
          >
            <Plus size={14} className="text-[hsl(var(--primary))]" />
          </ToolbarButton>
        </>
      )}

      <div className="flex-1" />
      {/* Fullscreen */}
      <ToolbarButton onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </ToolbarButton>
      <div className="w-px h-5 bg-[hsl(var(--border))] mx-1" />

      {/* Done Button */}
      <button 
        onClick={() => {
          setIsEditing(false);
          if (isFullscreen) setIsFullscreen(false);
        }}
        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] transition-colors ml-1 cursor-pointer"
      >
        <Check size={13} /> Done
      </button>
    </div>
  );

  const renderEditorBody = () => (
    <div 
      className="relative flex-1"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left Block Drag Handle Gutter */}
      {hoveredBlockEl && dragHandleY !== null && (
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{
            position: 'absolute',
            top: `${dragHandleY + 6}px`,
            left: '4px',
            zIndex: 30,
          }}
          className="flex items-center justify-center w-5 h-5 rounded cursor-grab hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors border border-transparent hover:border-[hsl(var(--border))]"
        >
          <GripVertical size={13} />
        </div>
      )}

      {/* Actual Tiptap Document Container */}
      <EditorContent editor={editor} className="h-full pl-6 pr-3 max-h-[60vh] overflow-y-auto custom-scrollbar" />

      {/* Table Editing Auxiliary Controls (Rendered when cursor inside cells) */}
      {editor.isActive('table') && (
        <div className="flex items-center gap-1 border-t border-[hsl(var(--border))] px-3 py-1.5 bg-[hsl(var(--muted)/0.255)] text-xs text-[hsl(var(--muted-foreground))] flex-wrap" data-rich-editor-portal="true">
          <span className="font-semibold text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mr-2">Table:</span>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().addRowAfter().run()} 
            className="px-2 py-1 rounded bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] cursor-pointer text-[10px]"
          >
            + Row
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().deleteRow().run()} 
            className="px-2 py-1 rounded bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] cursor-pointer text-[10px]"
          >
            Delete Row
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().addColumnAfter().run()} 
            className="px-2 py-1 rounded bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] cursor-pointer text-[10px]"
          >
            + Column
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().deleteColumn().run()} 
            className="px-2 py-1 rounded bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] cursor-pointer text-[10px]"
          >
            Delete Column
          </button>
          <div className="w-px h-4 bg-[hsl(var(--border))]" />
          <button 
            type="button" 
            onClick={() => editor.chain().focus().deleteTable().run()} 
            className="px-2 py-1 rounded bg-[hsl(var(--destructive)/0.05)] border border-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] cursor-pointer text-[10px] font-semibold"
          >
            Delete Grid
          </button>
        </div>
      )}

      {/* Floating Slash menu overlay */}
      {showSlashMenu && slashCoords && (
        <div
          data-rich-editor-portal="true"
          style={{
            position: 'fixed',
            top: `${slashCoords.top + 8}px`,
            left: `${Math.min(slashCoords.left, window.innerWidth - 272)}px`,
            zIndex: 9999,
          }}
          className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl p-1.5 w-64 max-h-72 overflow-y-auto flex flex-col custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="text-[9px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider px-2.5 py-1 mb-1 border-b border-[hsl(var(--border))]">
            Insert blocks
          </div>
          {filteredCommands.map((cmd, idx) => (
            <button
              key={cmd.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand(cmd)}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors w-full cursor-pointer ${
                idx === activeCommandIndex
                  ? 'bg-[hsl(var(--primary))] text-white font-medium'
                  : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              <span className={idx === activeCommandIndex ? 'text-white' : 'text-[hsl(var(--muted-foreground))]'}>
                {cmd.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{cmd.title}</div>
                <div className={`text-[9px] truncate ${idx === activeCommandIndex ? 'text-white/80' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  {cmd.description}
                </div>
              </div>
            </button>
          ))}
          {filteredCommands.length === 0 && (
            <div className="text-xs text-[hsl(var(--muted-foreground))] p-3 text-center italic">
              No matching commands
            </div>
          )}
        </div>
      )}

      {/* Floating Link paste overlay options */}
      {showPasteOptions && pastedUrl && pastedUrlCoords && (
        <div
          data-rich-editor-portal="true"
          style={{
            position: 'fixed',
            top: `${pastedUrlCoords.top + 8}px`,
            left: `${Math.min(pastedUrlCoords.left, window.innerWidth - 256)}px`,
            zIndex: 9999,
          }}
          className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl p-1.5 w-60 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="text-[9px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider px-2.5 py-1.5 border-b border-[hsl(var(--border))]">
            URL Paste Options
          </div>
          
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().setLink({ href: pastedUrl }).run();
              setShowPasteOptions(false);
              setPastedUrl('');
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            <LinkIcon size={14} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold truncate">Plain URL Link</div>
              <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">Standard clickable hyperlink</div>
            </div>
          </button>
          
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              try {
                const domain = new URL(pastedUrl).hostname;
                editor.chain().focus().insertContent({
                  type: 'linkPreview',
                  attrs: { url: pastedUrl, title: domain, description: 'Visual bookmark for ' + pastedUrl }
                }).run();
              } catch {
                editor.chain().focus().insertContent({
                  type: 'linkPreview',
                  attrs: { url: pastedUrl, title: 'Web Link', description: 'Visual bookmark for ' + pastedUrl }
                }).run();
              }
              setShowPasteOptions(false);
              setPastedUrl('');
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            <Globe size={14} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold truncate">Bookmark Card</div>
              <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">Rich preview block card</div>
            </div>
          </button>
          
          {(pastedUrl.includes('youtube.com') || pastedUrl.includes('youtu.be')) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().setYoutubeVideo({ src: pastedUrl }).run();
                setShowPasteOptions(false);
                setPastedUrl('');
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
            >
              <YoutubeIcon size={14} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold truncate">YouTube Embed</div>
                <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">Embedded video player</div>
              </div>
            </button>
          )}
          
          <div className="border-t border-[hsl(var(--border))] mt-1 pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowPasteOptions(false);
                setPastedUrl('');
              }}
              className="px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Fullscreen container portal
  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-[hsl(var(--background))] flex flex-col p-4 sm:p-8" data-rich-editor-portal="true">
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col rounded-2xl border border-[hsl(var(--border))] shadow-2xl overflow-hidden bg-[hsl(var(--card))]">
          {renderToolbar()}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 relative flex flex-col">
            {renderEditorBody()}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div ref={containerRef} className="rounded-xl border border-[hsl(var(--border))] shadow-sm overflow-hidden bg-[hsl(var(--card))] focus-within:border-[hsl(var(--primary)/0.5)] transition-colors flex flex-col">
      {renderToolbar()}
      <div className="p-2 relative">
        {renderEditorBody()}
      </div>
    </div>
  );
});
