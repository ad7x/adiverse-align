import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '../../store';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';

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
    <div className="h-full w-full flex flex-col items-center p-8 bg-[hsl(var(--background))] pt-[25vh]">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-2xl w-full flex flex-col items-center gap-10"
      >
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-[44px] font-medium tracking-tight text-[hsl(var(--foreground))]">
            {userName ? `${getGreeting()}, ${userName}` : 'Where should we start?'}
          </h1>
        </div>

        <form onSubmit={handleSearchSubmit} className="w-full relative group">
          <input
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="Search anything..."
            className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl px-6 py-4 md:py-5 text-lg md:text-xl text-[hsl(var(--foreground))] outline-none shadow-sm transition-all focus:shadow-md focus:border-[hsl(var(--primary)/0.5)] placeholder:text-[hsl(var(--muted-foreground))] custom-glass"
          />
        </form>
      </motion.div>
    </div>
  );
}
