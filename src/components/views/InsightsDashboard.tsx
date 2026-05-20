import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { motion, AnimatePresence } from 'framer-motion';
import { startOfDay, startOfWeek, startOfMonth, subDays, format, eachDayOfInterval, getDay } from 'date-fns';
import { CheckCircle, Calendar, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

export function InsightsDashboard() {
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const completedTasks = useMemo(() =>
    tasks.filter(t => t.completed && t.completedAt),
    [tasks]
  );

  const todayTasks = useMemo(() =>
    completedTasks.filter(t => new Date(t.completedAt!) >= todayStart),
    [completedTasks, todayStart]
  );

  const weekTasks = useMemo(() =>
    completedTasks.filter(t => new Date(t.completedAt!) >= weekStart),
    [completedTasks, weekStart]
  );

  const monthTasks = useMemo(() =>
    completedTasks.filter(t => new Date(t.completedAt!) >= monthStart),
    [completedTasks, monthStart]
  );

  // ─── Heatmap data (past 365 days) ─────────────────────────────

  const heatmapData = useMemo(() => {
    const end = startOfDay(now);
    const start = subDays(end, 364);
    const days = eachDayOfInterval({ start, end });

    const countMap = new Map<string, number>();
    for (const t of completedTasks) {
      if (!t.completedAt) continue;
      const key = format(new Date(t.completedAt), 'yyyy-MM-dd');
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    return days.map(d => ({
      date: d,
      dateStr: format(d, 'yyyy-MM-dd'),
      display: format(d, 'MMM d, yyyy'),
      count: countMap.get(format(d, 'yyyy-MM-dd')) || 0,
      dayOfWeek: getDay(d),
    }));
  }, [completedTasks, now]);

  // Group into weeks for grid layout
  const weeks = useMemo(() => {
    const result: typeof heatmapData[number][][] = [];
    let currentWeek: typeof heatmapData[number][] = [];

    // Pad first week with empty slots
    if (heatmapData.length > 0) {
      const firstDow = heatmapData[0].dayOfWeek;
      // Monday-based: adjust so Mon=0
      const adjusted = (firstDow + 6) % 7;
      for (let i = 0; i < adjusted; i++) {
        currentWeek.push(null as any);
      }
    }

    for (const day of heatmapData) {
      const adjDow = (day.dayOfWeek + 6) % 7; // Mon=0
      if (adjDow === 0 && currentWeek.length > 0) {
        result.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) result.push(currentWeek);

    return result;
  }, [heatmapData]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; weekIdx: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, wIdx) => {
      for (const day of week) {
        if (!day) continue;
        const m = day.date.getMonth();
        if (m !== lastMonth) {
          labels.push({ label: format(day.date, 'MMM'), weekIdx: wIdx });
          lastMonth = m;
        }
        break;
      }
    });
    return labels;
  }, [weeks]);

  const getIntensity = (count: number): string => {
    if (count === 0) return 'bg-[hsl(var(--muted)/0.4)]';
    if (count <= 2) return 'bg-[hsl(var(--primary)/0.25)]';
    if (count <= 5) return 'bg-[hsl(var(--primary)/0.5)]';
    return 'bg-[hsl(var(--primary)/0.85)]';
  };

  const [hoverDay, setHoverDay] = useState<{ display: string; count: number; x: number; y: number } | null>(null);

  const statCards = [
    { id: 'today', label: 'Today', count: todayTasks.length, tasks: todayTasks, icon: CheckCircle, color: 'hsl(var(--primary))' },
    { id: 'week', label: 'This Week', count: weekTasks.length, tasks: weekTasks, icon: Calendar, color: 'hsl(152 60% 45%)' },
    { id: 'month', label: 'This Month', count: monthTasks.length, tasks: monthTasks, icon: TrendingUp, color: 'hsl(24 95% 55%)' },
  ];

  return (
    <div className="space-y-8">
      {/* ─── Stat Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card, idx) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-5 cursor-pointer hover:border-[hsl(var(--primary)/0.4)] transition-all group"
            onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${card.color}20` }}>
                  <card.icon size={20} style={{ color: card.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[hsl(var(--foreground))]">{card.count}</div>
                  <div className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{card.label}</div>
                </div>
              </div>
              {expandedCard === card.id ? <ChevronUp size={16} className="text-[hsl(var(--muted-foreground))]" /> : <ChevronDown size={16} className="text-[hsl(var(--muted-foreground))]" />}
            </div>

            <AnimatePresence>
              {expandedCard === card.id && card.tasks.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-4 border-t border-[hsl(var(--border))] pt-3"
                >
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {card.tasks.slice(0, 20).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm">
                        <span className="text-[hsl(var(--foreground))] truncate flex-1 mr-2">{t.title || 'Untitled task'}</span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono shrink-0">
                          {t.completedAt ? format(new Date(t.completedAt), 'HH:mm') : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* ─── GitHub-style Contribution Heatmap ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6"
      >
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-[hsl(var(--primary))]" />
          Activity — Past Year
        </h3>

        <div className="overflow-x-auto custom-scrollbar relative">
          {/* Month labels */}
          <div className="flex gap-[3px] mb-1 pl-8" style={{ minWidth: weeks.length * 15 }}>
            {monthLabels.map((m, i) => (
              <div
                key={i}
                className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium absolute"
                style={{ left: 32 + m.weekIdx * 15 }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <div className="flex gap-[3px] mt-5 relative">
            {/* Day labels */}
            <div className="flex flex-col gap-[3px] pr-1 shrink-0 w-7">
              {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                <div key={i} className="h-[12px] text-[9px] text-[hsl(var(--muted-foreground))] flex items-center justify-end font-medium">
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks grid */}
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const day = week[dayIdx];
                  if (!day) return <div key={dayIdx} className="w-[12px] h-[12px]" />;
                  return (
                    <div
                      key={dayIdx}
                      className={`w-[12px] h-[12px] rounded-[2px] transition-colors ${getIntensity(day.count)} hover:ring-1 hover:ring-[hsl(var(--foreground)/0.3)]`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoverDay({ display: day.display, count: day.count, x: rect.left, y: rect.top });
                      }}
                      onMouseLeave={() => setHoverDay(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span>Less</span>
            <div className="w-[12px] h-[12px] rounded-[2px] bg-[hsl(var(--muted)/0.4)]" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-[hsl(var(--primary)/0.25)]" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-[hsl(var(--primary)/0.5)]" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-[hsl(var(--primary)/0.85)]" />
            <span>More</span>
          </div>
        </div>

        {/* Hover tooltip */}
        {hoverDay && (
          <div
            className="fixed z-50 pointer-events-none bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 shadow-xl text-xs"
            style={{ left: hoverDay.x + 16, top: hoverDay.y - 40 }}
          >
            <div className="font-semibold text-[hsl(var(--foreground))]">{hoverDay.count} task{hoverDay.count !== 1 ? 's' : ''}</div>
            <div className="text-[hsl(var(--muted-foreground))]">{hoverDay.display}</div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
