import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { useUIStore } from '../../store';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Home, Search, Lock, Unlock, Settings, PanelLeftClose, ChevronRight, ChevronDown, Plus, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../lib/utils';

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, activeView, setActiveView } = useUIStore();
  
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray()) || [];
  const domains = useLiveQuery(() => db.domains.orderBy('order').toArray()) || [];
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray()) || [];

  const isLocked = settings?.globalLock || false;

  const toggleLock = async () => {
    if (settings) {
      await db.settings.update('settings', { globalLock: !settings.globalLock });
    }
  };

  const [localCategories, setLocalCategories] = useState<any[]>([]);

  useEffect(() => {
    if (categories) setLocalCategories(categories);
  }, [categories]);

  const handleCategoryReorder = (newOrder: any[]) => {
    if (isLocked) return;
    setLocalCategories(newOrder);
    newOrder.forEach((c, i) => db.categories.update(c.id, { order: i }));
  };

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'category' | 'domain' | 'subject', item: any } | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    type: 'rename' | 'delete' | 'create_category';
    itemType: 'category' | 'domain' | 'subject';
    item: any;
    title?: string;
  } | null>(null);

  const handleModalConfirm = async () => {
    if (!modalConfig) return;
    const { type, itemType, item, title } = modalConfig;

    if (type === 'create_category' && title?.trim()) {
      await db.categories.add({ id: uuidv4(), title: title.trim(), order: categories.length });
    }

    if (type === 'rename' && title?.trim()) {
      const newTitle = title.trim();
      if (itemType === 'category') await db.categories.update(item.id, { title: newTitle });
      if (itemType === 'domain') await db.domains.update(item.id, { title: newTitle });
      if (itemType === 'subject') await db.subjects.update(item.id, { title: newTitle });
    }

    if (type === 'delete') {
      if (itemType === 'category') await db.categories.delete(item.id);
      if (itemType === 'domain') await db.domains.delete(item.id);
      if (itemType === 'subject') {
        await db.subjects.delete(item.id);
        if (activeView.type === 'subject' && activeView.subjectId === item.id) {
          setActiveView({ type: 'home' });
        }
      }
    }
    
    setModalConfig(null);
  };

  const requestRename = (itemType: 'category'|'domain'|'subject', item: any) => {
    setModalConfig({ type: 'rename', itemType, item, title: item.title });
  };

  const requestDelete = (itemType: 'category'|'domain'|'subject', item: any) => {
    setModalConfig({ type: 'delete', itemType, item });
  };

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    document.addEventListener('pointerdown', handleGlobalClick);
    return () => document.removeEventListener('pointerdown', handleGlobalClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, type: 'category' | 'domain' | 'subject', item: any) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, item });
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 260 }}
      className="relative flex flex-col h-full bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))] overflow-hidden shrink-0 select-none"
    >
      {/* Top Header: Gemini Icon & Close */}
      <div className={cn("flex items-center p-4 min-h-[64px] shrink-0 transition-opacity", sidebarCollapsed ? "justify-center" : "justify-between")}>
        {sidebarCollapsed ? (
          <button onClick={() => setSidebarCollapsed(false)} className="hover:opacity-80 transition-opacity p-0.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)]">
            <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" alt="App" className="w-[22px] h-[22px] object-contain" />
          </button>
        ) : (
          <>
            <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" alt="App" className="w-[22px] h-[22px] object-contain ml-1" />
            <button onClick={() => setSidebarCollapsed(true)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 rounded-md transition-colors">
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>

      {/* Main Nav Items */}
      <div className={cn("flex flex-col gap-1 px-3 py-2 shrink-0")}>
        <NavItem 
          icon={<Home size={20} className="stroke-[1.5]" />} 
          label="Home" 
          collapsed={sidebarCollapsed} 
          active={activeView.type === 'home'}
          onClick={() => setActiveView({ type: 'home' })}
        />
        <NavItem 
          icon={<Search size={20} className="stroke-[1.5]" />} 
          label="Search" 
          collapsed={sidebarCollapsed} 
          active={activeView.type === 'search'}
          onClick={() => setActiveView({ type: 'search' })}
        />
      </div>

      {/* Hierarchy Tree (hidden when collapsed) */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
          <Reorder.Group axis="y" values={localCategories} onReorder={handleCategoryReorder} className="flex flex-col">
            {localCategories.map(category => (
              <CategoryNode 
                key={category.id} 
                category={category} 
                domains={domains.filter(d => d.categoryId === category.id)}
                allSubjects={subjects}
                onContextMenu={handleContextMenu}
                isLocked={isLocked}
                requestRename={requestRename}
                requestDelete={requestDelete}
              />
            ))}
          </Reorder.Group>
          {!isLocked && (
            <button 
              onClick={() => {
                setModalConfig({ type: 'create_category', itemType: 'category', item: null, title: 'New Category' });
              }}
              className="mt-2 flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors w-full"
            >
              <Plus size={14} /> Add Category
            </button>
          )}
        </div>
      )}

      {/* Footer Nav */}
      {!sidebarCollapsed && (
        <div className="p-3 border-t border-[hsl(var(--sidebar-border))] flex flex-col gap-1 mt-auto shrink-0">
          <NavItem 
            icon={isLocked ? <Lock size={18} className="stroke-[1.5]" /> : <Unlock size={18} className="stroke-[1.5]" />} 
            label={isLocked ? "Unlock Structure" : "Lock Structure"} 
            collapsed={sidebarCollapsed} 
            onClick={toggleLock}
          />
          <NavItem 
            icon={<Settings size={18} className="stroke-[1.5]" />} 
            label="Settings" 
            collapsed={sidebarCollapsed} 
            active={activeView.type === 'settings'}
            onClick={() => setActiveView({ type: 'settings'})}
          />
        </div>
      )}

      {/* Context Menu Portal */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onPointerDown={e => e.stopPropagation()}
            className="fixed z-50 w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl p-1.5 flex flex-col custom-glass"
          >
            {contextMenu.type === 'category' && (
               <ContextMenuItem label="Add Domain" onClick={async () => {
                 await db.domains.add({ id: uuidv4(), categoryId: contextMenu.item.id, title: 'New Domain', order: domains.length });
                 setContextMenu(null);
               }} />
            )}
            {contextMenu.type === 'domain' && (
               <>
                 <ContextMenuItem label="Add Subject" onClick={async () => {
                   await db.subjects.add({ id: uuidv4(), domainId: contextMenu.item.id, title: 'New Subject', order: subjects.length, isLocked: false });
                   setContextMenu(null);
                 }} />
                 <div className="h-px bg-[hsl(var(--border))] my-1 mx-1"/>
                 <ContextMenuItem label="Rename" onClick={() => {
                   requestRename('domain', contextMenu.item);
                   setContextMenu(null);
                 }} />
                 <ContextMenuItem label="Delete" danger onClick={() => {
                   requestDelete('domain', contextMenu.item);
                   setContextMenu(null);
                 }} />
               </>
            )}
            {contextMenu.type === 'subject' && (
               <>
                 <ContextMenuItem label="Rename" onClick={() => {
                   requestRename('subject', contextMenu.item);
                   setContextMenu(null);
                 }} />
                 <ContextMenuItem label="Delete" danger onClick={() => {
                   requestDelete('subject', contextMenu.item);
                   setContextMenu(null);
                 }} />
               </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[hsl(var(--card))] p-5 rounded-xl shadow-xl border border-[hsl(var(--border))] w-72 flex flex-col gap-4"
            >
              <h3 className="font-semibold text-sm">
                {modalConfig.type === 'rename' ? `Rename ${modalConfig.itemType}` : modalConfig.type === 'create_category' ? 'Add Category' : `Delete ${modalConfig.itemType}`}
              </h3>
              {(modalConfig.type === 'rename' || modalConfig.type === 'create_category') && (
                <input 
                  autoFocus
                  className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]"
                  value={modalConfig.title || ''}
                  onChange={e => setModalConfig({ ...modalConfig, title: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleModalConfirm();
                    if (e.key === 'Escape') setModalConfig(null);
                  }}
                />
              )}
              {modalConfig.type === 'delete' && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Are you sure you want to delete this {modalConfig.itemType}? {modalConfig.itemType !== 'subject' && "All children will be deleted too."}
                </p>
              )}
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => setModalConfig(null)} className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">Cancel</button>
                <button onClick={handleModalConfirm} className={`px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-colors ${modalConfig.type === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/90]'}`}>
                  {(modalConfig.type === 'rename' || modalConfig.type === 'create_category') ? 'Save' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Subcomponents

function NavItem({ icon, label, collapsed, active, onClick }: { icon: React.ReactNode, label: string, collapsed: boolean, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
        active ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
        collapsed ? "justify-center" : "justify-start" // Icon centered when collapsed
      )}
      title={collapsed ? label : undefined}
    >
      <div className={active ? "text-[hsl(var(--foreground))]" : ""}>{icon}</div>
      {!collapsed && <span className="font-medium text-[13px]">{label}</span>}
    </button>
  );
}

function ContextMenuItem({ label, onClick, danger }: { label: string, onClick: () => void, danger?: boolean }) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors",
        danger ? "text-red-500 hover:bg-red-500/10" : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
      )}
    >
      {label}
    </button>
  );
}

function CategoryNode({ category, domains, allSubjects, onContextMenu, isLocked, requestRename, requestDelete }: any) {
  const dragControls = useDragControls();
  const [localDomains, setLocalDomains] = useState<any[]>([]);

  useEffect(() => {
    setLocalDomains(domains);
  }, [domains]);

  const handleDomainReorder = (newOrder: any[]) => {
    if (isLocked) return;
    setLocalDomains(newOrder);
    newOrder.forEach((d, i) => db.domains.update(d.id, { order: i }));
  };

  return (
    <Reorder.Item value={category} dragListener={false} dragControls={dragControls} className="mb-5 mt-1 list-none">
      <div 
        className="px-2 mb-1.5 cursor-context-menu flex items-center group"
        onContextMenu={(e) => onContextMenu(e, 'category', category)}
      >
        {!isLocked && <div onPointerDown={e => dragControls.start(e)} className="text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab mr-1"><GripVertical size={12}/></div>}
        <h3 className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.08em] truncate flex-1">{category.title}</h3>
        {!isLocked && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                requestRename('category', category);
              }}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-opacity p-1"
              title="Rename Category"
            >
              <Pencil size={12} />
            </button>
            <button 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                requestDelete('category', category);
              }}
              className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-opacity p-1"
              title="Delete Category"
            >
              <Trash2 size={12} />
            </button>
            <button 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await db.domains.add({ id: uuidv4(), categoryId: category.id, title: 'New Domain', order: domains.length });
              }}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-opacity p-1"
              title="Add Domain"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      <Reorder.Group axis="y" values={localDomains} onReorder={handleDomainReorder} className="flex flex-col gap-0.5">
        {localDomains.map((domain: any) => (
          <DomainNode 
            key={domain.id} 
            domain={domain} 
            subjects={allSubjects.filter((s:any) => s.domainId === domain.id)}
            onContextMenu={onContextMenu}
            isLocked={isLocked}
            requestRename={requestRename}
            requestDelete={requestDelete}
          />
        ))}
      </Reorder.Group>
    </Reorder.Item>
  );
}

function DomainNode({ domain, subjects, onContextMenu, isLocked, requestRename, requestDelete }: any) {
  const dragControls = useDragControls();
  const [expanded, setExpanded] = useState(true);
  const tasks = useLiveQuery(() => 
    db.tasks
      .where('type').equals('task')
      .and(t => subjects.some((s:any) => s.id === t.subjectId))
      .toArray(), 
    [subjects]
  ) || [];

  const [localSubjects, setLocalSubjects] = useState<any[]>([]);

  useEffect(() => {
    setLocalSubjects(subjects);
  }, [subjects]);

  const handleSubjectReorder = (newOrder: any[]) => {
    if (isLocked) return;
    setLocalSubjects(newOrder);
    newOrder.forEach((s, i) => db.subjects.update(s.id, { order: i }));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Reorder.Item value={domain} dragListener={false} dragControls={dragControls} className="list-none">
      <div 
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors text-[hsl(var(--foreground))] group relative"
        onClick={() => setExpanded(!expanded)}
        onContextMenu={(e) => onContextMenu(e, 'domain', domain)}
      >
        {!isLocked && <div onPointerDown={e => dragControls.start(e)} className="absolute left-[-16px] text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab shrink-0 hidden sm:block p-1"><GripVertical size={14}/></div>}
        <div className="text-[hsl(var(--muted-foreground))] opacity-60">
          {expanded ? <ChevronDown size={14} className="stroke-[2.5]" /> : <ChevronRight size={14} className="stroke-[2.5]" />}
        </div>
        <span className="font-medium text-[13px] truncate flex-1">{domain.title}</span>
        
        {!isLocked && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                requestRename('domain', domain);
              }}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1"
              title="Rename Domain"
            >
              <Pencil size={12} />
            </button>
            <button 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                requestDelete('domain', domain);
              }}
              className="text-[hsl(var(--muted-foreground))] hover:text-red-500 p-1"
              title="Delete Domain"
            >
              <Trash2 size={12} />
            </button>
            <button 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await db.subjects.add({ id: uuidv4(), domainId: domain.id, title: 'New Subject', order: subjects.length, isLocked: false });
                if (!expanded) setExpanded(true);
              }}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1"
              title="Add Subject"
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {totalCount > 0 && isLocked && (
          <div className="w-8 h-1 bg-[hsl(var(--border))] rounded-full overflow-hidden ml-1 shrink-0 flex items-center">
            <div className="bg-[hsl(var(--primary))] h-full" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="pl-[11px] overflow-hidden ml-3 mt-0.5 border-l border-[hsl(var(--border))]/60 flex flex-col gap-0.5"
          >
            <Reorder.Group axis="y" values={localSubjects} onReorder={handleSubjectReorder} className="flex flex-col gap-0.5">
              {localSubjects.map((subject: any) => (
                <SubjectNode key={subject.id} subject={subject} onContextMenu={onContextMenu} isLocked={isLocked} requestRename={requestRename} requestDelete={requestDelete} />
              ))}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

function SubjectNode({ subject, onContextMenu, isLocked, requestRename, requestDelete }: any) {
  const dragControls = useDragControls();
  const { activeView, setActiveView } = useUIStore();
  const isActive = activeView.type === 'subject' && activeView.subjectId === subject.id;

  const tasks = useLiveQuery(() => 
    db.tasks
      .where('type').equals('task')
      .and(t => t.subjectId === subject.id)
      .toArray(), 
    [subject.id]
  ) || [];

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Reorder.Item value={subject} dragListener={false} dragControls={dragControls} className="list-none group relative">
      {!isLocked && <div onPointerDown={e => dragControls.start(e)} className="absolute left-[-10px] top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab z-10 p-1"><GripVertical size={12}/></div>}
      <div
        onClick={() => setActiveView({ type: 'subject', subjectId: subject.id })}
        onContextMenu={(e) => onContextMenu(e, 'subject', subject)}
        className={cn(
          "text-[13px] text-left py-1.5 transition-colors w-full rounded-lg flex items-center cursor-pointer",
          !isLocked ? "pl-5 pr-1" : "px-3",
          isActive 
            ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-medium" 
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50"
        )}
      >
        <div className="truncate flex-1">{subject.title}</div>
        
        {totalCount > 0 && isLocked && (
          <div className="w-6 h-1 bg-[hsl(var(--border))] rounded-full overflow-hidden ml-1 shrink-0 flex items-center">
            <div className="bg-[hsl(var(--primary))] h-full" style={{ width: `${progressPercent}%` }} />
          </div>
        )}

        {!isLocked && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                requestRename('subject', subject);
              }}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1"
              title="Rename Subject"
            >
              <Pencil size={12} />
            </button>
            <button 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                requestDelete('subject', subject);
              }}
              className="text-[hsl(var(--muted-foreground))] hover:text-red-500 p-1 mr-1"
              title="Delete Subject"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
}
