import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import Fuse from 'fuse.js';
import { useUIStore } from '../../store';
import { motion } from 'framer-motion';
import { Search, Folder, BookOpen, FileText, CheckSquare, X, Tag } from 'lucide-react';
import { extractPlainText } from '../../lib/utils';

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
    ...categories.map(c => ({ docType: 'Category' as const, id: c.id, title: c.title, text: c.title, subjectId: null as string | null, icon: 'folder', tags: [] })),
    ...domains.map(d => ({ docType: 'Domain' as const, id: d.id, title: d.title, text: d.title, subjectId: null as string | null, icon: 'book', tags: [] })),
    ...subjects.map(s => ({ docType: 'Subject' as const, id: s.id, title: s.title, text: s.title, subjectId: s.id, icon: 'file', tags: [] })),
    ...tasks.map(t => ({
      docType: (t.type === 'section' ? 'Section' : 'Task') as 'Section' | 'Task',
      id: t.id, title: t.title || '',
      text: `${t.title || ''} ${t.descriptionMarkdown || ''} ${t.notesRich ? extractPlainText(t.notesRich.content) : ''} ${(t.tags || []).join(' ')}`,
      subjectId: t.subjectId,
      icon: 'check',
      tags: t.tags || []
    })),
  ], [categories, domains, subjects, tasks]);

  // Extract all unique tags
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach(t => {
      if (t.tags) t.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const fuse = useMemo(() => new Fuse(allDocs, {
    keys: ['text'],
    threshold: 0.3,
    includeMatches: true,
  }), [allDocs]);

  // Filtering logic
  const isTagSearch = query.trim().startsWith('#');
  
  let results: any[] = [];
  if (query.trim()) {
    if (isTagSearch) {
      const searchTag = query.trim().substring(1).toLowerCase();
      results = allDocs
        .filter(doc => doc.tags.some(tag => tag.toLowerCase() === searchTag))
        .map(doc => ({ item: doc })); // wrap in item to match fuse format
    } else {
      results = fuse.search(query).slice(0, 20);
    }
  }

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
      <div className="w-full shrink-0 mb-4 relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workspace... (use #tag to filter by tag)"
          className="w-full bg-transparent border-b-2 border-[hsl(var(--border))] text-3xl font-medium outline-none py-4 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] transition-colors pr-10"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Tags Suggestion Row */}
      {uniqueTags.length > 0 && (
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
          <Tag size={16} className="text-[hsl(var(--muted-foreground))] shrink-0" />
          {uniqueTags.map(tag => (
            <button
              key={tag}
              onClick={() => setQuery(`#${tag}`)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                query.trim() === `#${tag}`
                  ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                  : 'bg-[hsl(var(--muted)/0.5)] border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary)/0.5)]'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

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
              <span className="font-medium text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors block truncate flex items-center gap-2">
                {res.item.title || 'Untitled'}
                {isTagSearch && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-medium uppercase tracking-wider">
                    {query.trim()}
                  </span>
                )}
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
