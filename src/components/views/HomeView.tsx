import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useUIStore } from '../../store';
import { OrganicTree } from './OrganicTree';
import { InsightsDashboard } from './InsightsDashboard';
import { Search, ChevronDown } from 'lucide-react';

export function HomeView() {
  const [searchQuery, setSearchQuery] = useState('');
  const { setActiveView } = useUIStore();
  const contentSectionRef = useRef<HTMLElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveView({ type: 'search', initialQuery: searchQuery.trim() });
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar">
      {/* Viewport 1: Fullscreen Tree Hero */}
      <section className="sticky top-0 h-screen w-full z-0 flex flex-col justify-center items-center">
        <OrganicTree />
        
        {/* Floating Down Arrow Button */}
        <button
          onClick={() => contentSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-all group pointer-events-auto cursor-pointer"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Scroll Down</span>
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--card)/0.6)] backdrop-blur-md border border-[hsl(var(--border))] flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:border-[hsl(var(--primary)/0.3)] transition-all animate-bounce">
            <ChevronDown size={20} />
          </div>
        </button>
      </section>

      {/* Viewport 2+: Content below tree */}
      <section ref={contentSectionRef} className="relative z-10 bg-[hsl(var(--background))]">
        {/* Search bar */}
        <div className="max-w-3xl mx-auto px-6 py-12">
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-[hsl(var(--muted-foreground))] group-focus-within:text-[hsl(var(--primary))] transition-colors">
              <Search size={20} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search workspace..."
              className="w-full bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] rounded-2xl pl-14 pr-6 py-4 text-lg text-[hsl(var(--foreground))] outline-none shadow-sm transition-all focus:shadow-lg focus:border-[hsl(var(--primary)/0.5)] placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </form>
        </div>

        {/* Insights Dashboard */}
        <div className="max-w-5xl mx-auto px-6 pb-20">
          <InsightsDashboard />
        </div>
      </section>
    </div>
  );
}
