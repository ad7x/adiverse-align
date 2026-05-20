import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import {
  subDays,
  startOfDay,
  format,
  eachDayOfInterval,
  startOfWeek,
  addWeeks,
  getDay,
  differenceInCalendarDays,
  isSameDay,
} from 'date-fns';
import { Calendar, Target, TrendingUp, ChevronDown, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '../../types';

// ─── Heatmap helpers ───────────────────────────────────────────────
type DayData = { date: Date; count: number };

function getIntensityClass(count: number): string {
  if (count === 0) return 'heatmap-empty';
  if (count <= 2) return 'heatmap-low';
  if (count <= 5) return 'heatmap-mid';
  return 'heatmap-high';
}

function buildHeatmapGrid(completedTasks: Task[]): {
  weeks: DayData[][];
  monthLabels: { label: string; col: number }[];
} {
  const today = new Date();
  // Start from 52 weeks ago, on a Sunday
  const gridStart = startOfWeek(subDays(today, 52 * 7), { weekStartsOn: 0 });
  const gridEnd = today;

  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Build a count map: "YYYY-MM-DD" → count
  const countMap = new Map<string, number>();
  for (const t of completedTasks) {
    if (!t.completedAt) continue;
    const key = format(startOfDay(new Date(t.completedAt)), 'yyyy-MM-dd');
    countMap.set(key, (countMap.get(key) || 0) + 1);
  }

  // Group days into weeks (columns)
  const weeks: DayData[][] = [];
  let currentWeek: DayData[] = [];

  for (const day of allDays) {
    const dayOfWeek = getDay(day); // 0=Sun
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    const key = format(day, 'yyyy-MM-dd');
    currentWeek.push({ date: day, count: countMap.get(key) || 0 });
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  // Month labels
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w][0];
    const month = firstDay.date.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ label: format(firstDay.date, 'MMM'), col: w });
      lastMonth = month;
    }
  }

  return { weeks, monthLabels };
}

// ─── Stat Card ─────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  tasks: Task[];
  delay: number;
}

function StatCard({ icon, label, count, tasks, delay }: StatCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden cursor-pointer select-none"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))] mb-3">
            {icon}
            <h3 className="font-medium text-xs tracking-widest uppercase">{label}</h3>
          </div>
          <div className="text-4xl font-bold text-[hsl(var(--foreground))] tabular-nums">{count}</div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1.5">
            {count === 1 ? 'task completed' : 'tasks completed'}
          </p>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[hsl(var(--muted-foreground))] mt-1"
        >
          <ChevronDown size={18} />
        </motion.div>
      </div>

      <AnimatePresence>
        {expanded && tasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[hsl(var(--border))] px-6 py-3 max-h-52 overflow-y-auto space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 py-1.5">
                  <span className="text-sm text-[hsl(var(--foreground))] truncate flex-1">
                    {t.title}
                  </span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {t.completedAt
                      ? format(new Date(t.completedAt), 'MMM d, h:mm a')
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {expanded && tasks.length === 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[hsl(var(--border))] px-6 py-4 text-sm text-[hsl(var(--muted-foreground))]">
              No completions in this period.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Heatmap Tooltip ───────────────────────────────────────────────
function HeatmapCell({ day }: { day: DayData }) {
  const [hovered, setHovered] = useState(false);
  const intensityClass = getIntensityClass(day.count);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`w-[13px] h-[13px] rounded-[3px] transition-colors duration-150 ${intensityClass}`}
      />
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none"
          >
            <div className="bg-[hsl(var(--foreground))] text-[hsl(var(--background))] text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
              <span className="font-semibold">{day.count} {day.count === 1 ? 'task' : 'tasks'}</span>
              <span className="opacity-75 ml-1">on {format(day.date, 'MMM d, yyyy')}</span>
            </div>
            <div className="w-2 h-2 bg-[hsl(var(--foreground))] rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export function InsightsDashboard() {
  const tasks = useLiveQuery(() => db.tasks.toArray());

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = subDays(now, 7);
  const monthStart = subDays(now, 30);

  const completedTasks = useMemo(
    () => (tasks?.filter((t) => t.completed && t.completedAt) || []),
    [tasks]
  );

  const todayTasks = useMemo(
    () =>
      completedTasks
        .filter((t) => new Date(t.completedAt!) >= todayStart)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()),
    [completedTasks, todayStart]
  );

  const weekTasks = useMemo(
    () =>
      completedTasks
        .filter((t) => new Date(t.completedAt!) >= weekStart)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()),
    [completedTasks, weekStart]
  );

  const monthTasks = useMemo(
    () =>
      completedTasks
        .filter((t) => new Date(t.completedAt!) >= monthStart)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()),
    [completedTasks, monthStart]
  );

  const { weeks, monthLabels } = useMemo(
    () => buildHeatmapGrid(completedTasks),
    [completedTasks]
  );

  // Streak calculation
  const streak = useMemo(() => {
    let count = 0;
    let checkDate = todayStart;
    const countMap = new Map<string, number>();
    for (const t of completedTasks) {
      if (!t.completedAt) continue;
      const key = format(startOfDay(new Date(t.completedAt)), 'yyyy-MM-dd');
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    // Check today first; if no tasks today, start from yesterday
    const todayKey = format(todayStart, 'yyyy-MM-dd');
    if (!countMap.has(todayKey)) {
      checkDate = subDays(todayStart, 1);
    }

    while (true) {
      const key = format(checkDate, 'yyyy-MM-dd');
      if (countMap.has(key)) {
        count++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
    return count;
  }, [completedTasks, todayStart]);

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div className="w-full flex flex-col gap-6 mt-12 mb-20 z-10 relative">
      {/* Inline styles for heatmap cells — uses CSS custom properties */}
      <style>{`
        .heatmap-empty {
          background-color: hsl(var(--muted) / 0.4);
        }
        .heatmap-low {
          background-color: hsl(var(--primary) / 0.3);
        }
        .heatmap-mid {
          background-color: hsl(var(--primary) / 0.6);
        }
        .heatmap-high {
          background-color: hsl(var(--primary) / 0.95);
        }
      `}</style>

      {/* ─── Stat Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          icon={<Target size={18} />}
          label="Today"
          count={todayTasks.length}
          tasks={todayTasks}
          delay={0}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="This Week"
          count={weekTasks.length}
          tasks={weekTasks}
          delay={0.08}
        />
        <StatCard
          icon={<Calendar size={18} />}
          label="This Month"
          count={monthTasks.length}
          tasks={monthTasks}
          delay={0.16}
        />
      </div>

      {/* ─── Streak Banner ──────────────────────────────────────── */}
      {streak > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)]"
        >
          <Flame size={20} className="text-[hsl(var(--primary))]" />
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            <span className="text-[hsl(var(--primary))] font-bold">{streak}-day streak!</span>
            <span className="text-[hsl(var(--muted-foreground))] ml-1.5">Keep it going.</span>
          </span>
        </motion.div>
      )}

      {/* ─── Contribution Heatmap ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.24 }}
        className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
            <Calendar size={18} />
            <h3 className="font-medium text-xs tracking-widest uppercase">Contributions</h3>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span>Less</span>
            <div className="flex gap-[3px]">
              <div className="w-[11px] h-[11px] rounded-[2px] heatmap-empty" />
              <div className="w-[11px] h-[11px] rounded-[2px] heatmap-low" />
              <div className="w-[11px] h-[11px] rounded-[2px] heatmap-mid" />
              <div className="w-[11px] h-[11px] rounded-[2px] heatmap-high" />
            </div>
            <span>More</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex gap-0">
            {/* Day labels column */}
            <div className="flex flex-col gap-[3px] mr-2 pt-[22px]">
              {dayLabels.map((label, i) => (
                <div
                  key={i}
                  className="h-[13px] flex items-center text-[10px] text-[hsl(var(--muted-foreground))] leading-none"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="relative">
              {/* Month labels */}
              <div className="flex h-[18px] mb-1">
                {monthLabels.map((m, i) => (
                  <div
                    key={i}
                    className="absolute text-[10px] text-[hsl(var(--muted-foreground))] leading-none"
                    style={{ left: `${m.col * 16}px` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div className="flex gap-[3px]">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {/* Pad the first week if it doesn't start on Sunday */}
                    {wi === 0 &&
                      Array.from({ length: getDay(week[0].date) }).map((_, pi) => (
                        <div key={`pad-${pi}`} className="w-[13px] h-[13px]" />
                      ))}
                    {week.map((day, di) => (
                      <HeatmapCell key={di} day={day} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Total summary */}
        <div className="mt-4 pt-3 border-t border-[hsl(var(--border))]">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-medium text-[hsl(var(--foreground))]">{completedTasks.length}</span>
            {' '}total completions in the last year
          </p>
        </div>
      </motion.div>
    </div>
  );
}
