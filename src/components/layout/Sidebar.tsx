import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { useUIStore } from '../../store';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Home, Search, Lock, Unlock, PanelLeftClose, ChevronRight, ChevronDown,
  Plus, GripVertical, Pencil, Trash2, Settings, User, HelpCircle, Info, History
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../lib/utils';

// ─── Main Sidebar Component ─────────────────────────────────────────

export function Sidebar() {
  const {
    sidebarCollapsed, setSidebarCollapsed, activeView, setActiveView,
    expandedSidebarNodes, toggleSidebarNode, setSidebarNodeExpanded
  } = useUIStore();

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

  // Local reorder state for categories
  const [localCategories, setLocalCategories] = useState<typeof categories>([]);
  useEffect(() => { setLocalCategories(categories); }, [categories]);

  const handleCategoryReorder = (newOrder: typeof categories) => {
    if (isLocked) return;
    setLocalCategories(newOrder);
    newOrder.forEach((c, i) => db.categories.update(c.id, { order: i }));
  };

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: 'category' | 'domain' | 'subject'; item: any;
  } | null>(null);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, type: 'category' | 'domain' | 'subject', item: any) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    // Clamp position so menu doesn't overflow
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y, type, item });
  };

  // Modal for rename/delete/create
  const [modalConfig, setModalConfig] = useState<{
    type: 'rename' | 'delete' | 'create_category';
    itemType: 'category' | 'domain' | 'subject';
    item: any;
    title?: string;
  } | null>(null);

  // Ref for newly created item that needs auto-focus rename
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);

  // Cascade delete helper
  const cascadeDelete = async (itemType: string, itemId: string) => {
    if (itemType === 'category') {
      const childDomains = await db.domains.where('categoryId').equals(itemId).toArray();
      for (const d of childDomains) {
        await cascadeDelete('domain', d.id);
      }
      await db.categories.delete(itemId);
    } else if (itemType === 'domain') {
      const childSubjects = await db.subjects.where('domainId').equals(itemId).toArray();
      for (const s of childSubjects) {
        await cascadeDelete('subject', s.id);
      }
      await db.domains.delete(itemId);
    } else if (itemType === 'subject') {
      // Delete all instances and tasks for this subject
      const instances = await db.subjectInstances.where('subjectId').equals(itemId).toArray();
      for (const inst of instances) {
        await db.subjectInstances.delete(inst.id);
      }
      await db.tasks.where('subjectId').equals(itemId).delete();
      await db.subjects.delete(itemId);
      if (activeView.type === 'subject' && activeView.subjectId === itemId) {
        setActiveView({ type: 'home' });
      }
    }
  };

  const handleModalConfirm = async () => {
    if (!modalConfig) return;
    const { type, itemType, item, title } = modalConfig;

    if (type === 'create_category' && title?.trim()) {
      const id = uuidv4();
      await db.categories.add({ id, title: title.trim(), order: categories.length });
      setPendingRenameId(id);
    }

    if (type === 'rename' && title?.trim()) {
      if (itemType === 'category') await db.categories.update(item.id, { title: title.trim() });
      if (itemType === 'domain') await db.domains.update(item.id, { title: title.trim() });
      if (itemType === 'subject') await db.subjects.update(item.id, { title: title.trim() });
    }

    if (type === 'delete') {
      await cascadeDelete(itemType, item.id);
    }

    setModalConfig(null);
  };

  // Quick create helpers (immediate rename)
  const quickCreateDomain = async (categoryId: string) => {
    const domainsInCat = domains.filter(d => d.categoryId === categoryId);
    const id = uuidv4();
    await db.domains.add({ id, categoryId, title: 'New Domain', order: domainsInCat.length });
    setSidebarNodeExpanded(categoryId, true);
    setPendingRenameId(id);
  };

  const quickCreateSubject = async (domainId: string) => {
    const subsInDom = subjects.filter(s => s.domainId === domainId);
    const id = uuidv4();
    await db.subjects.add({ id, domainId, title: 'New Subject', order: subsInDom.length, isLocked: false });
    // Also create a default instance
    await db.subjectInstances.add({
      id: uuidv4(), subjectId: id, name: 'Default',
      createdAt: new Date().toISOString(), order: 0
    });
    setSidebarNodeExpanded(domainId, true);
    setPendingRenameId(id);
  };

  // Profile dock
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const userName = settings?.userName || 'User';
  const avatarLetter = userName.charAt(0).toUpperCase();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{
        width: isMobile 
          ? (sidebarCollapsed ? 0 : 260) 
          : (sidebarCollapsed ? 64 : 260)
      }}
      className={cn(
        "flex flex-col h-full bg-[hsl(var(--sidebar))] border-[hsl(var(--sidebar-border))] overflow-hidden shrink-0 select-none",
        isMobile ? "fixed inset-y-0 left-0 z-50 shadow-2xl" : "relative",
        (isMobile && sidebarCollapsed) ? "border-r-0" : "border-r"
      )}
    >
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className={cn("flex items-center p-4 min-h-[64px] shrink-0", sidebarCollapsed ? "justify-center" : "justify-between")}>
        {sidebarCollapsed ? (
          <button onClick={() => setSidebarCollapsed(false)} className="hover:opacity-80 p-0.5 rounded-lg">
            <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" alt="App" className="w-[22px] h-[22px]" />
          </button>
        ) : (
          <>
            <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" alt="App" className="w-[22px] h-[22px] ml-1" />
            <button onClick={() => setSidebarCollapsed(true)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 rounded-md">
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>

      {/* ─── Main Nav ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-3 py-2 shrink-0">
        <NavItem icon={<Home size={20} />} label="Home" collapsed={sidebarCollapsed}
          active={activeView.type === 'home'} onClick={() => setActiveView({ type: 'home' })} />
        <NavItem icon={<Search size={20} />} label="Search" collapsed={sidebarCollapsed}
          active={activeView.type === 'search'} onClick={() => setActiveView({ type: 'search' })} />
      </div>

      {/* ─── Hierarchy Tree ─────────────────────────────────────── */}
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
                onRename={(type: any, item: any) => setModalConfig({ type: 'rename', itemType: type, item, title: item.title })}
                onDelete={(type: any, item: any) => setModalConfig({ type: 'delete', itemType: type, item })}
                onCreateDomain={quickCreateDomain}
                onCreateSubject={quickCreateSubject}
                pendingRenameId={pendingRenameId}
                onRenameDone={() => setPendingRenameId(null)}
              />
            ))}
          </Reorder.Group>
          {!isLocked && (
            <button
              onClick={() => setModalConfig({ type: 'create_category', itemType: 'category', item: null, title: 'New Category' })}
              className="mt-2 flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors w-full"
            >
              <Plus size={14} /> Add Category
            </button>
          )}
        </div>
      )}

      {/* ─── Footer: Lock + Profile Dock ────────────────────────── */}
      <div className="border-t border-[hsl(var(--sidebar-border))] mt-auto shrink-0">
        {!sidebarCollapsed && (
          <div className="px-3 py-2">
            <NavItem
              icon={isLocked ? <Lock size={18} /> : <Unlock size={18} />}
              label={isLocked ? "Unlock Structure" : "Lock Structure"}
              collapsed={false}
              onClick={toggleLock}
            />
          </div>
        )}

        {/* Profile dock */}
        <div ref={profileRef} className="relative px-3 py-3">
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={cn(
              "flex items-center gap-3 cursor-pointer rounded-xl transition-colors hover:bg-[hsl(var(--muted))] p-2",
              sidebarCollapsed ? "justify-center" : ""
            )}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.6)] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {avatarLetter}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{userName}</div>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">Free Plan</div>
              </div>
            )}
            {!sidebarCollapsed && (
              <Settings size={16} className="text-[hsl(var(--muted-foreground))] shrink-0" />
            )}
          </div>

          {/* Profile popover menu */}
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-full left-3 right-3 mb-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl p-1.5 z-50"
              >
                <ProfileMenuItem icon={<User size={15} />} label="Profile" onClick={() => { setActiveView({ type: 'settings' }); setShowProfileMenu(false); }} />
                <ProfileMenuItem icon={<Settings size={15} />} label="Settings" onClick={() => { setActiveView({ type: 'settings' }); setShowProfileMenu(false); }} />
                <ProfileMenuItem icon={<History size={15} />} label="Export History" onClick={() => { setActiveView({ type: 'settings' }); setShowProfileMenu(false); }} />
                <div className="h-px bg-[hsl(var(--border))] my-1" />
                <ProfileMenuItem icon={<HelpCircle size={15} />} label="Help" onClick={() => setShowProfileMenu(false)} />
                <ProfileMenuItem icon={<Info size={15} />} label="About" onClick={() => setShowProfileMenu(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Context Menu ───────────────────────────────────────── */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onPointerDown={e => e.stopPropagation()}
            className="fixed z-50 w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl p-1.5 flex flex-col"
          >
            {contextMenu.type === 'category' && (
              <>
                <ContextMenuItem label="Add Domain" onClick={() => { quickCreateDomain(contextMenu.item.id); setContextMenu(null); }} />
                <div className="h-px bg-[hsl(var(--border))] my-1" />
                <ContextMenuItem label="Rename" onClick={() => { setModalConfig({ type: 'rename', itemType: 'category', item: contextMenu.item, title: contextMenu.item.title }); setContextMenu(null); }} />
                <ContextMenuItem label="Delete" danger onClick={() => { setModalConfig({ type: 'delete', itemType: 'category', item: contextMenu.item }); setContextMenu(null); }} />
              </>
            )}
            {contextMenu.type === 'domain' && (
              <>
                <ContextMenuItem label="Add Subject" onClick={() => { quickCreateSubject(contextMenu.item.id); setContextMenu(null); }} />
                <div className="h-px bg-[hsl(var(--border))] my-1" />
                <ContextMenuItem label="Rename" onClick={() => { setModalConfig({ type: 'rename', itemType: 'domain', item: contextMenu.item, title: contextMenu.item.title }); setContextMenu(null); }} />
                <ContextMenuItem label="Delete" danger onClick={() => { setModalConfig({ type: 'delete', itemType: 'domain', item: contextMenu.item }); setContextMenu(null); }} />
              </>
            )}
            {contextMenu.type === 'subject' && (
              <>
                <ContextMenuItem label="Rename" onClick={() => { setModalConfig({ type: 'rename', itemType: 'subject', item: contextMenu.item, title: contextMenu.item.title }); setContextMenu(null); }} />
                <ContextMenuItem label="Delete" danger onClick={() => { setModalConfig({ type: 'delete', itemType: 'subject', item: contextMenu.item }); setContextMenu(null); }} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Rename/Delete/Create Modal ─────────────────────────── */}
      <AnimatePresence>
        {modalConfig && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
            onClick={() => setModalConfig(null)}
            onKeyDown={e => { if (e.key === 'Escape') setModalConfig(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[hsl(var(--card))] p-5 rounded-xl shadow-xl border border-[hsl(var(--border))] w-80 flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-semibold text-sm text-[hsl(var(--foreground))]">
                {modalConfig.type === 'rename' ? `Rename ${modalConfig.itemType}` :
                 modalConfig.type === 'create_category' ? 'Add Category' :
                 `Delete ${modalConfig.itemType}?`}
              </h3>
              {(modalConfig.type === 'rename' || modalConfig.type === 'create_category') && (
                <input
                  autoFocus
                  className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                  value={modalConfig.title || ''}
                  onChange={e => setModalConfig({ ...modalConfig, title: e.target.value })}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleModalConfirm();
                    if (e.key === 'Escape') setModalConfig(null);
                  }}
                />
              )}
              {modalConfig.type === 'delete' && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  This will permanently delete this {modalConfig.itemType} and all its children. This cannot be undone.
                </p>
              )}
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={() => setModalConfig(null)} className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--foreground))]">Cancel</button>
                <button
                  onClick={handleModalConfirm}
                  className={cn(
                    "px-4 py-1.5 text-xs font-medium rounded-lg text-white transition-colors",
                    modalConfig.type === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-[hsl(var(--primary))] hover:brightness-110'
                  )}
                >
                  {modalConfig.type === 'delete' ? 'Delete' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── NavItem ─────────────────────────────────────────────────────────

function NavItem({ icon, label, collapsed, active, onClick }: {
  icon: React.ReactNode; label: string; collapsed: boolean; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
        active ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
        collapsed ? "justify-center" : "justify-start"
      )}
      title={collapsed ? label : undefined}
    >
      <div>{icon}</div>
      {!collapsed && <span className="font-medium text-[13px]">{label}</span>}
    </button>
  );
}

// ─── ContextMenuItem ─────────────────────────────────────────────────

function ContextMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
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

// ─── ProfileMenuItem ─────────────────────────────────────────────────

function ProfileMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium rounded-lg text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
    >
      <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>
      {label}
    </button>
  );
}

// ─── CategoryNode ────────────────────────────────────────────────────

function CategoryNode({ category, domains, allSubjects, onContextMenu, isLocked, onRename, onDelete, onCreateDomain, onCreateSubject, pendingRenameId, onRenameDone }: any) {
  const dragControls = useDragControls();
  const [localDomains, setLocalDomains] = useState<any[]>([]);
  const { expandedSidebarNodes, toggleSidebarNode } = useUIStore();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalDomains(domains); }, [domains]);

  // Auto-focus rename for newly created items
  useEffect(() => {
    if (pendingRenameId === category.id && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
      onRenameDone();
    }
  }, [pendingRenameId, category.id, onRenameDone]);

  const handleDomainReorder = (newOrder: any[]) => {
    if (isLocked) return;
    setLocalDomains(newOrder);
    newOrder.forEach((d, i) => db.domains.update(d.id, { order: i }));
  };

  return (
    <Reorder.Item value={category} dragListener={false} dragControls={dragControls} className="mb-4 mt-1 list-none">
      <div
        className="px-2 mb-1.5 flex items-center group cursor-default"
        onContextMenu={e => onContextMenu(e, 'category', category)}
      >
        {!isLocked && (
          <div onPointerDown={e => dragControls.start(e)} className="text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab mr-1">
            <GripVertical size={12} />
          </div>
        )}
        <h3 className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.08em] truncate flex-1">
          {category.title}
        </h3>
        {!isLocked && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => onRename('category', category)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1" title="Rename"><Pencil size={12} /></button>
            <button onClick={() => onDelete('category', category)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 p-1" title="Delete"><Trash2 size={12} /></button>
            <button onClick={() => onCreateDomain(category.id)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1" title="Add Domain"><Plus size={14} /></button>
          </div>
        )}
      </div>

      <Reorder.Group axis="y" values={localDomains} onReorder={handleDomainReorder} className="flex flex-col gap-0.5">
        {localDomains.map((domain: any) => (
          <DomainNode
            key={domain.id}
            domain={domain}
            subjects={allSubjects.filter((s: any) => s.domainId === domain.id)}
            onContextMenu={onContextMenu}
            isLocked={isLocked}
            onRename={onRename}
            onDelete={onDelete}
            onCreateSubject={onCreateSubject}
            pendingRenameId={pendingRenameId}
            onRenameDone={onRenameDone}
          />
        ))}
      </Reorder.Group>
    </Reorder.Item>
  );
}

// ─── DomainNode ──────────────────────────────────────────────────────

function DomainNode({ domain, subjects, onContextMenu, isLocked, onRename, onDelete, onCreateSubject, pendingRenameId, onRenameDone }: any) {
  const dragControls = useDragControls();
  const { expandedSidebarNodes, toggleSidebarNode } = useUIStore();
  const expanded = expandedSidebarNodes[domain.id] !== false; // Default expanded
  const nameRef = useRef<HTMLInputElement>(null);

  const [localSubjects, setLocalSubjects] = useState<any[]>([]);
  useEffect(() => { setLocalSubjects(subjects); }, [subjects]);

  // Auto-focus rename for newly created items
  useEffect(() => {
    if (pendingRenameId === domain.id && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
      onRenameDone();
    }
  }, [pendingRenameId, domain.id, onRenameDone]);

  const handleSubjectReorder = (newOrder: any[]) => {
    if (isLocked) return;
    setLocalSubjects(newOrder);
    newOrder.forEach((s, i) => db.subjects.update(s.id, { order: i }));
  };

  return (
    <Reorder.Item value={domain} dragListener={false} dragControls={dragControls} className="list-none">
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors text-[hsl(var(--foreground))] group relative"
        onClick={() => toggleSidebarNode(domain.id)}
        onContextMenu={e => onContextMenu(e, 'domain', domain)}
      >
        {!isLocked && (
          <div onPointerDown={e => { e.stopPropagation(); dragControls.start(e); }} className="absolute left-[-14px] text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab p-1 hidden sm:block">
            <GripVertical size={14} />
          </div>
        )}
        <div className="text-[hsl(var(--muted-foreground))] opacity-60">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <span className="font-medium text-[13px] truncate flex-1">{domain.title}</span>

        {!isLocked && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => onRename('domain', domain)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1" title="Rename"><Pencil size={12} /></button>
            <button onClick={() => onDelete('domain', domain)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 p-1" title="Delete"><Trash2 size={12} /></button>
            <button onClick={() => onCreateSubject(domain.id)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1" title="Add Subject"><Plus size={14} /></button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="pl-[11px] overflow-hidden ml-3 mt-0.5 border-l border-[hsl(var(--border)/0.6)] flex flex-col gap-0.5"
          >
            <Reorder.Group axis="y" values={localSubjects} onReorder={handleSubjectReorder} className="flex flex-col gap-0.5">
              {localSubjects.map((subject: any) => (
                <SubjectNode
                  key={subject.id}
                  subject={subject}
                  onContextMenu={onContextMenu}
                  isLocked={isLocked}
                  onRename={onRename}
                  onDelete={onDelete}
                  pendingRenameId={pendingRenameId}
                  onRenameDone={onRenameDone}
                />
              ))}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

// ─── SubjectNode ─────────────────────────────────────────────────────

function SubjectNode({ subject, onContextMenu, isLocked, onRename, onDelete, pendingRenameId, onRenameDone }: any) {
  const dragControls = useDragControls();
  const { activeView, setActiveView } = useUIStore();
  const isActive = activeView.type === 'subject' && activeView.subjectId === subject.id;
  const nameRef = useRef<HTMLInputElement>(null);
  const [isInlineRename, setIsInlineRename] = useState(false);
  const [renameValue, setRenameValue] = useState(subject.title);

  // Auto-focus rename for newly created items
  useEffect(() => {
    if (pendingRenameId === subject.id) {
      setIsInlineRename(true);
      setRenameValue(subject.title);
      onRenameDone();
    }
  }, [pendingRenameId, subject.id, onRenameDone]);

  useEffect(() => {
    if (isInlineRename && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [isInlineRename]);

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== subject.title) {
      await db.subjects.update(subject.id, { title: trimmed });
    }
    setIsInlineRename(false);
  };

  return (
    <Reorder.Item value={subject} dragListener={false} dragControls={dragControls} className="list-none group relative">
      {!isLocked && (
        <div onPointerDown={e => { e.stopPropagation(); dragControls.start(e); }} className="absolute left-[-10px] top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab z-10 p-1">
          <GripVertical size={12} />
        </div>
      )}
      <div
        onClick={() => !isInlineRename && setActiveView({ type: 'subject', subjectId: subject.id })}
        onContextMenu={e => onContextMenu(e, 'subject', subject)}
        className={cn(
          "text-[13px] text-left py-1.5 transition-colors w-full rounded-lg flex items-center cursor-pointer",
          !isLocked ? "pl-5 pr-1" : "px-3",
          isActive
            ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-medium"
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)]"
        )}
      >
        {isInlineRename ? (
          <input
            ref={nameRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsInlineRename(false);
            }}
            className="bg-transparent outline-none border-b border-[hsl(var(--primary))] text-[13px] w-full text-[hsl(var(--foreground))]"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div className="truncate flex-1">{subject.title}</div>
        )}

        {!isLocked && !isInlineRename && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setIsInlineRename(true); setRenameValue(subject.title); }} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1" title="Rename"><Pencil size={12} /></button>
            <button onClick={() => onDelete('subject', subject)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 p-1 mr-1" title="Delete"><Trash2 size={12} /></button>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
}
