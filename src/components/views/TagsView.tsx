import React, { useState, useMemo, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useUIStore } from '../../store';
import {
  Tag, Heart, Search, ChevronDown, ChevronUp, SlidersHorizontal,
  CheckCircle2, Circle, X, ArrowUpDown
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────

interface TagData {
  tag: string;
  tasks: TaskWithMeta[];
  total: number;
  completed: number;
  pct: number;
  recentActivity: number;
}

interface TaskWithMeta {
  id: string;
  subjectId: string;
  parentId: string | null;
  title: string;
  completed: boolean;
  updatedAt?: string;
  completedAt?: string | null;
  tags?: string[];
  // Resolved
  subjectTitle: string;
  sectionTitle?: string;
}

type SortKey = 'most-tasks' | 'most-completed' | 'recent-activity' | 'alphabetical';
type FilterKey = 'all' | 'incomplete' | 'completed';

// ─── Main TagsView ────────────────────────────────────────────────────

export function TagsView() {
  const { setActiveView } = useUIStore();

  // Data
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const subjects = useLiveQuery(() => db.subjects.toArray()) || [];

  // Filter / sort state
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('most-tasks');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Favorites
  const [favTags, setFavTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('align-fav-tags') || '[]'); }
    catch { return []; }
  });

  const toggleFav = useCallback((tag: string) => {
    setFavTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag];
      localStorage.setItem('align-fav-tags', JSON.stringify(next));
      return next;
    });
  }, []);

  // Active chip for jump navigation
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chipBarRef = useRef<HTMLDivElement>(null);

  // Build subject lookup
  const subjectMap = useMemo(() => {
    const m: Record<string, string> = {};
    subjects.forEach(s => { m[s.id] = s.title; });
    return m;
  }, [subjects]);

  // Build section lookup (parentId → section title)
  const sectionMap = useMemo(() => {
    const m: Record<string, string> = {};
    tasks.filter(t => t.type === 'section').forEach(t => { m[t.id] = t.title; });
    return m;
  }, [tasks]);

  // Build tag data
  const allTagData = useMemo((): TagData[] => {
    // Collect only tasks (not sections), with at least one tag
    const taggedTasks = tasks.filter(t => t.type === 'task' && t.tags && t.tags.length > 0);

    // Collect all unique tags
    const tagSet = new Set<string>();
    taggedTasks.forEach(t => t.tags!.forEach(tag => tagSet.add(tag)));

    const tagDataMap: Record<string, TagData> = {};
    tagSet.forEach(tag => {
      tagDataMap[tag] = { tag, tasks: [], total: 0, completed: 0, pct: 0, recentActivity: 0 };
    });

    // 7 days ago for "recent activity"
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    taggedTasks.forEach(t => {
      if (!t.tags) return;
      t.tags.forEach(tag => {
        if (!tagDataMap[tag]) return;
        const td = tagDataMap[tag];
        td.total++;
        if (t.completed) td.completed++;

        const updTime = t.updatedAt ? new Date(t.updatedAt).getTime() :
                        t.completedAt ? new Date(t.completedAt).getTime() : 0;
        if (updTime > sevenDaysAgo) td.recentActivity++;

        td.tasks.push({
          id: t.id,
          subjectId: t.subjectId,
          parentId: t.parentId,
          title: t.title,
          completed: t.completed,
          updatedAt: t.updatedAt,
          completedAt: t.completedAt,
          tags: t.tags,
          subjectTitle: subjectMap[t.subjectId] || 'Unknown',
          sectionTitle: t.parentId ? sectionMap[t.parentId] : undefined,
        });
      });
    });

    Object.values(tagDataMap).forEach(td => {
      td.pct = td.total > 0 ? Math.round((td.completed / td.total) * 100) : 0;
      // Sort tasks: incomplete first
      td.tasks.sort((a, b) => Number(a.completed) - Number(b.completed));
    });

    return Object.values(tagDataMap);
  }, [tasks, subjectMap, sectionMap]);

  // Filtered + sorted tag data
  const filteredTagData = useMemo((): TagData[] => {
    let data = allTagData;

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(td =>
        td.tag.toLowerCase().includes(q) ||
        td.tasks.some(t => t.title.toLowerCase().includes(q))
      );
    }

    // Apply task filter within each tag
    if (filter !== 'all') {
      data = data.map(td => ({
        ...td,
        tasks: td.tasks.filter(t => filter === 'incomplete' ? !t.completed : t.completed)
      })).filter(td => td.tasks.length > 0);
    }

    // Sort
    data = [...data].sort((a, b) => {
      if (sort === 'most-tasks') return b.total - a.total;
      if (sort === 'most-completed') return b.completed - a.completed;
      if (sort === 'recent-activity') return b.recentActivity - a.recentActivity;
      if (sort === 'alphabetical') return a.tag.localeCompare(b.tag);
      return 0;
    });

    // Favorites first
    return data.sort((a, b) => {
      const af = favTags.includes(a.tag) ? 0 : 1;
      const bf = favTags.includes(b.tag) ? 0 : 1;
      return af - bf;
    });
  }, [allTagData, search, sort, filter, favTags]);

  // All unique tags for chip bar (sorted: favs first, then by total)
  const chipTags = useMemo(() => {
    return filteredTagData.map(td => td.tag);
  }, [filteredTagData]);

  // Scroll chip to center when selected
  const scrollChipIntoView = useCallback((tag: string) => {
    const bar = chipBarRef.current;
    const chip = bar?.querySelector(`[data-chip="${CSS.escape(tag)}"]`) as HTMLElement | null;
    if (chip && bar) {
      const offset = chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2;
      bar.scrollTo({ left: offset, behavior: 'smooth' });
    }
  }, []);

  const handleChipClick = useCallback((tag: string) => {
    setActiveChip(tag);
    scrollChipIntoView(tag);
    const card = cardRefs.current[tag];
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollChipIntoView]);

  const hasData = allTagData.length > 0;

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar text-[hsl(var(--foreground))] bg-[hsl(var(--background))]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">

        {/* ─── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5">
              <Tag size={22} className="text-[hsl(var(--primary))]" />
              Tags
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {allTagData.length} tag{allTagData.length !== 1 ? 's' : ''} across your workspace
            </p>
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
              showFilters
                ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>

        {/* ─── Filter Controls ─────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search tags or tasks..."
                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2 shrink-0">
                  <ArrowUpDown size={13} className="text-[hsl(var(--muted-foreground))]" />
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value as SortKey)}
                    className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--foreground))] cursor-pointer"
                  >
                    <option value="most-tasks">Most Tasks</option>
                    <option value="most-completed">Most Completed</option>
                    <option value="recent-activity">Recent Activity</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                </div>

                {/* Filter pills */}
                <div className="flex gap-1.5 shrink-0">
                  {(['all', 'incomplete', 'completed'] as FilterKey[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                        filter === f
                          ? "bg-[hsl(var(--primary))] text-white"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      )}
                    >
                      {f === 'all' ? 'All' : f === 'incomplete' ? 'Incomplete' : 'Completed'}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!hasData ? (
          <EmptyTagsState />
        ) : (
          <>
            {/* ─── Chip Navigation Bar ─────────────────────────── */}
            {chipTags.length > 0 && (
              <div
                ref={chipBarRef}
                className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-6"
              >
                {chipTags.map(tag => (
                  <button
                    key={tag}
                    data-chip={tag}
                    onClick={() => handleChipClick(tag)}
                    className={cn(
                      "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
                      activeChip === tag
                        ? "bg-[hsl(var(--primary))] text-white shadow-md shadow-[hsl(var(--primary)/0.3)]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))]"
                    )}
                  >
                    {favTags.includes(tag) && <Heart size={10} className="fill-current" />}
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* ─── Tag Cards Grid ──────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTagData.map(td => (
                <TagCard
                  key={td.tag}
                  data={td}
                  isFav={favTags.includes(td.tag)}
                  onToggleFav={toggleFav}
                  searchQuery={search}
                  filterKey={filter}
                  cardRef={el => { cardRefs.current[td.tag] = el; }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── EmptyTagsState ───────────────────────────────────────────────────

function EmptyTagsState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
        <Tag size={28} className="text-[hsl(var(--muted-foreground))]" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No tags yet</h3>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xs">
        Add tags to your tasks to organize and track them here. Tags help you view related tasks across subjects.
      </p>
    </div>
  );
}

// ─── TagCard ──────────────────────────────────────────────────────────

const TagCard = memo(function TagCard({ data, isFav, onToggleFav, searchQuery, filterKey, cardRef }: {
  data: TagData;
  isFav: boolean;
  onToggleFav: (tag: string) => void;
  searchQuery: string;
  filterKey: FilterKey;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const { setActiveView, setSidebarNodeExpanded } = useUIStore();
  const [expanded, setExpanded] = useState(false);
  const SHOW_LIMIT = 5;

  // Filter tasks within card by search
  const visibleTasks = useMemo(() => {
    let tasks = data.tasks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q));
    }
    return tasks;
  }, [data.tasks, searchQuery]);

  const shown = expanded ? visibleTasks : visibleTasks.slice(0, SHOW_LIMIT);
  const remaining = visibleTasks.length - SHOW_LIMIT;

  const handleTaskClick = useCallback(async (task: TaskWithMeta) => {
    // Find domain for subject to expand sidebar node
    const subject = await db.subjects.get(task.subjectId);
    if (subject) {
      setSidebarNodeExpanded(subject.domainId, true);
    }
    setActiveView({ type: 'subject', subjectId: task.subjectId, highlightId: task.id });
  }, [setActiveView, setSidebarNodeExpanded]);

  const handleTaskToggle = useCallback(async (task: TaskWithMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.tasks.update(task.id, {
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  return (
    <div
      ref={cardRef}
      className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Card Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary)/0.7)] shrink-0 mt-0.5" />
            <h3 className="font-semibold text-[15px] truncate">{data.tag}</h3>
          </div>
          <button
            onClick={() => onToggleFav(data.tag)}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            className={cn(
              "shrink-0 p-1.5 rounded-lg transition-all",
              isFav
                ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                : "text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10"
            )}
          >
            <Heart size={14} className={isFav ? "fill-current" : ""} />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))] mb-2.5">
          <span className="font-medium text-[hsl(var(--foreground))]">{data.total}</span> total
          <span className="w-1 h-1 rounded-full bg-[hsl(var(--border))]" />
          <span className="font-medium text-[hsl(var(--primary))]">{data.completed}</span> done
          <span className="w-1 h-1 rounded-full bg-[hsl(var(--border))]" />
          <span className="font-semibold text-[hsl(var(--foreground))]">{data.pct}%</span>
          {data.recentActivity > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-[hsl(var(--border))]" />
              <span className="text-emerald-500 font-medium">+{data.recentActivity} recent</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.7)]"
            initial={{ width: 0 }}
            animate={{ width: `${data.pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </div>

      {/* Task list */}
      {visibleTasks.length > 0 && (
        <div className="border-t border-[hsl(var(--border)/0.5)]">
          {shown.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onClick={() => handleTaskClick(task)}
              onToggle={(e) => handleTaskToggle(task, e)}
            />
          ))}

          {visibleTasks.length > SHOW_LIMIT && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[12px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] transition-colors font-medium"
            >
              {expanded ? (
                <><ChevronUp size={13} /> Show less</>
              ) : (
                <><ChevronDown size={13} /> Show {remaining} more</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ─── TaskRow ──────────────────────────────────────────────────────────

const TaskRow = memo(function TaskRow({ task, onClick, onToggle }: {
  task: TaskWithMeta;
  onClick: () => void;
  onToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.5)] transition-colors cursor-pointer border-t border-[hsl(var(--border)/0.3)] first:border-t-0 group"
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 mt-0.5 w-4 h-4 rounded-full border transition-all flex items-center justify-center",
          task.completed
            ? "bg-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary)/0.5)]"
            : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)]"
        )}
      >
        {task.completed && (
          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))]" />
        )}
      </button>

      {/* Title + breadcrumb */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-[13px] font-medium leading-snug truncate",
          task.completed
            ? "line-through text-[hsl(var(--muted-foreground))]"
            : "text-[hsl(var(--foreground))]"
        )}>
          {task.title}
        </div>
        <div className="text-[11px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
          {task.sectionTitle
            ? `${task.subjectTitle} › ${task.sectionTitle}`
            : task.subjectTitle
          }
        </div>
      </div>
    </div>
  );
});
