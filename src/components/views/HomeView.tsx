import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useUIStore } from '../../store';
import { OrganicTree } from './OrganicTree';
import { InsightsDashboard } from './InsightsDashboard';
import { Search } from 'lucide-react';

export function HomeView() {
  const [searchQuery, setSearchQuery] = useState('');
  const { setActiveView } = useUIStore();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveView({ type: 'search', initialQuery: searchQuery.trim() });
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar">
      {/* Viewport 1: Fullscreen Tree Hero */}
      <section className="sticky top-0 h-screen w-full z-0">
        <OrganicTree />
      </section>

      {/* Viewport 2+: Content below tree */}
      <section className="relative z-10 bg-[hsl(var(--background))]">
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
