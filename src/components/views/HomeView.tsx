import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '../../store';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { OrganicTree } from './OrganicTree';
import { InsightsDashboard } from './InsightsDashboard';
import { Search } from 'lucide-react';

export function HomeView() {
  const { setActiveView } = useUIStore();
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const userName = settings?.userName || '';
  
  const [searchValue, setSearchValue] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      setActiveView({ type: 'search', initialQuery: searchValue.trim() });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="h-full w-full bg-[hsl(var(--background))] overflow-y-auto custom-scrollbar relative scroll-smooth">
      
      {/* Viewport 1: Fullscreen Execution Tree Hero */}
      <section className="w-full h-screen sticky top-0">
        <OrganicTree />
      </section>

      {/* Viewport 2: Content (Search & Insights) */}
      <section className="relative z-10 w-full min-h-screen bg-[hsl(var(--background))] border-t border-[hsl(var(--border))]">
        <div className="max-w-6xl w-full mx-auto p-6 md:p-12 flex flex-col gap-10 mt-10">
          
          {/* Premium Global Search */}
          <form onSubmit={handleSearchSubmit} className="w-full relative group">
            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-[hsl(var(--muted-foreground))] group-focus-within:text-[hsl(var(--primary))] transition-colors">
              <Search size={22} />
            </div>
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder="Search categories, subjects, tasks, tags..."
              className="w-full bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] rounded-2xl pl-16 pr-6 py-5 text-xl text-[hsl(var(--foreground))] outline-none shadow-sm transition-all focus:shadow-xl focus:border-[hsl(var(--primary)/0.6)] placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </form>

          {/* Insights Dashboard */}
          <InsightsDashboard />

        </div>
      </section>
    </div>
  );
}
