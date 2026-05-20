import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import Fuse from 'fuse.js';
import { useUIStore } from '../../store';
import { motion } from 'framer-motion';
import { Search, Folder, BookOpen, FileText, CheckSquare, X } from 'lucide-react';

export function SearchView() {
  const { activeView, setActiveView } = useUIStore();
  const initialQuery = activeView.type === 'search' ? activeView.initialQuery || '' : '';

  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const domains = useLiveQuery(() => db.domains.toArray()) || [];
  const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allDocs = useMemo(() => [
    ...categories.map(c => ({ docType: 'Category' as const, id: c.id, title: c.title, text: c.title, subjectId: null as string | null, icon: 'folder' })),
    ...domains.map(d => ({ docType: 'Domain' as const, id: d.id, title: d.title, text: d.title, subjectId: null as string | null, icon: 'book' })),
    ...subjects.map(s => ({ docType: 'Subject' as const, id: s.id, title: s.title, text: s.title, subjectId: s.id, icon: 'file' })),
    ...tasks.map(t => ({
      docType: (t.type === 'section' ? 'Section' : 'Task') as 'Section' | 'Task',
      id: t.id, title: t.title || '',
      text: `${t.title || ''} ${t.description || ''} ${t.notes || ''}`,
      subjectId: t.subjectId,
      icon: 'check'
    })),
  ], [categories, domains, subjects, tasks]);

  const fuse = useMemo(() => new Fuse(allDocs, {
    keys: ['text'],
    threshold: 0.3,
    includeMatches: true,
  }), [allDocs]);

  const results = query.trim() ? fuse.search(query).slice(0, 20) : [];

  const handleSelect = (item: typeof allDocs[number]) => {
    if (item.docType === 'Category' || item.docType === 'Domain') {
      setActiveView({ type: 'home' });
    } else if (item.subjectId) {
      setActiveView({
        type: 'subject',
        subjectId: item.subjectId,
        highlightId: item.docType === 'Task' || item.docType === 'Section' ? item.id : undefined,
      });
    }
  };

  const getIcon = (docType: string) => {
    switch (docType) {
      case 'Category': return <Folder size={16} className="text-blue-400" />;
      case 'Domain': return <BookOpen size={16} className="text-purple-400" />;
      case 'Subject': return <FileText size={16} className="text-emerald-400" />;
      default: return <CheckSquare size={16} className="text-orange-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col p-6 md:p-12 max-w-4xl mx-auto overflow-y-auto custom-scrollbar">
      {/* Search input */}
      <div className="w-full shrink-0 mb-8 relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workspace..."
          className="w-full bg-transparent border-b-2 border-[hsl(var(--border))] text-3xl font-medium outline-none py-4 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] transition-colors pr-10"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 space-y-2">
        {!query.trim() && (
          <div className="text-[hsl(var(--muted-foreground))] text-center mt-20">
            Start typing to search across categories, domains, subjects, and tasks.
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div className="text-[hsl(var(--muted-foreground))] text-center mt-20">
            <Search size={48} className="mx-auto mb-4 opacity-20" />
            <p>No results found for "{query}"</p>
          </div>
        )}
        {results.map((res) => (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            key={res.item.id + res.item.docType}
            onClick={() => handleSelect(res.item)}
            className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.4)] cursor-pointer transition-all flex items-center gap-4 group"
          >
            <div className="w-9 h-9 rounded-lg bg-[hsl(var(--muted)/0.5)] flex items-center justify-center shrink-0">
              {getIcon(res.item.docType)}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors block truncate">
                {res.item.title || 'Untitled'}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                {res.item.docType}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
