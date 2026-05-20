import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import Fuse from 'fuse.js';
import { useUIStore } from '../../store';
import { motion } from 'framer-motion';

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
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const allDocs = [
    ...categories.map(c => ({ docType: 'Category', ...c, text: c.title })),
    ...domains.map(d => ({ docType: 'Domain', ...d, text: d.title })),
    ...subjects.map(s => ({ docType: 'Subject', ...s, text: s.title })),
    ...tasks.map(t => ({ docType: t.type === 'section' ? 'Section' : 'Task', ...t, text: `${t.title} ${t.description} ${t.notes}` }))
  ];

  const fuse = new Fuse(allDocs, {
    keys: ['text'],
    threshold: 0.3,
    includeMatches: true
  });

  const results = query.trim() ? fuse.search(query).slice(0, 15) : [];

  const handleSelect = (item: any) => {
    let targetSubjectId = null;
    
    if (item.docType === 'Subject') targetSubjectId = item.id;
    else if (item.docType === 'Task' || item.docType === 'Section') {
      targetSubjectId = item.subjectId;
    }

    if (targetSubjectId) {
      setActiveView({ type: 'subject', subjectId: targetSubjectId });
    }
  };

  return (
    <div className="h-full flex flex-col p-8 lg:p-12 max-w-4xl mx-auto overflow-y-auto custom-scrollbar">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0 mb-8">
        <input 
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workspace..."
          className="w-full bg-transparent border-b-2 border-[hsl(var(--border))] text-3xl font-medium outline-none py-4 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] transition-colors"
        />
      </motion.div>

      <div className="flex-1 space-y-2">
        {!query.trim() && (
          <div className="text-[hsl(var(--muted-foreground))] text-center mt-20">
            Start typing to search across categories, domains, subjects, and tasks.
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div className="text-[hsl(var(--muted-foreground))] text-center mt-20">
            No results found for "{query}"
          </div>
        )}
        {results.map((res, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.02 }}
            key={idx}
            onClick={() => handleSelect(res.item)}
            className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors flex flex-col gap-1"
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 rounded">
                {res.item.docType}
              </span>
              <span className="font-medium text-[hsl(var(--foreground))]">{res.item.title}</span>
            </div>
            {(res.item as any).description && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] truncate pl-2 border-l-2 border-[hsl(var(--border))] mt-2">
                {(res.item as any).description}
              </p>
            )}
            {(res.item as any).notes && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] truncate pl-2 border-l-2 border-[hsl(var(--border))] mt-2">
                ...{(res.item as any).notes.substring(0, 80)}...
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
