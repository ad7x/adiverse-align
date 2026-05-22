import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { useUIStore } from '../../store';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Home, Search, Lock, Unlock, PanelLeftClose, ChevronRight, ChevronDown,
  Plus, GripVertical, Pencil, Trash2, Settings, User, HelpCircle, Info, History, Tag
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../lib/utils';

// ─── Long Press Hook ─────────────────────────────────────────────────

function useLongPress(
  onLongPress: (e: React.PointerEvent) => void,
  delay = 420
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef({ x: 0, y: 0 });

  const start = useCallback(
    (e: React.PointerEvent) => {
      startPos.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        onLongPress(e);
      }, delay);
    },
    [onLongPress, delay]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const move = useCallback((e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 6 || dy > 6) cancel();
  }, [cancel]);

  return { onPointerDown: start, onPointerUp: cancel, onPointerMove: move, onPointerLeave: cancel };
}

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
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];

  const globalStructureLock = settings?.globalLock || false;

  const toggleLock = async () => {
    if (settings) {
      await db.settings.update('settings', { globalLock: !settings.globalLock });
    }
  };

  // Local reorder state for categories
  const [localCategories, setLocalCategories] = useState<typeof categories>([]);
  useEffect(() => { setLocalCategories(categories); }, [categories]);

  const handleCategoryReorder = (newOrder: typeof categories) => {
    if (globalStructureLock) return;
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

  const handleContextMenu = useCallback((
    e: React.MouseEvent | React.PointerEvent,
    type: 'category' | 'domain' | 'subject',
    item: any
  ) => {
    if (globalStructureLock) return;
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 220);
    setContextMenu({ x, y, type, item });
  }, [globalStructureLock]);

  // Modal for rename/delete/create
  type ModalType = 'rename' | 'delete' | 'create_category' | 'create_domain' | 'create_subject';
  const [modalConfig, setModalConfig] = useState<{
    type: ModalType;
    itemType: 'category' | 'domain' | 'subject';
    item: any;
    title?: string;
    parentId?: string; // categoryId for domain, domainId for subject
  } | null>(null);

  // Cascade delete helper
  const cascadeDelete = async (itemType: string, itemId: string) => {
    if (itemType === 'category') {
      const childDomains = await db.domains.where('categoryId').equals(itemId).toArray();
      for (const d of childDomains) await cascadeDelete('domain', d.id);
      await db.categories.delete(itemId);
    } else if (itemType === 'domain') {
      const childSubjects = await db.subjects.where('domainId').equals(itemId).toArray();
      for (const s of childSubjects) await cascadeDelete('subject', s.id);
      await db.domains.delete(itemId);
    } else if (itemType === 'subject') {
      const instances = await db.subjectInstances.where('subjectId').equals(itemId).toArray();
      for (const inst of instances) await db.subjectInstances.delete(inst.id);
      await db.tasks.where('subjectId').equals(itemId).delete();
      await db.subjects.delete(itemId);
      if (activeView.type === 'subject' && activeView.subjectId === itemId) {
        setActiveView({ type: 'home' });
      }
    }
  };

  const handleModalConfirm = async () => {
    if (!modalConfig) return;
    const { type, itemType, item, title, parentId } = modalConfig;

    if (type === 'create_category' && title?.trim()) {
      await db.categories.add({ id: uuidv4(), title: title.trim(), order: categories.length });
    }

    if (type === 'create_domain' && title?.trim() && parentId) {
      const domainsInCat = domains.filter(d => d.categoryId === parentId);
      const id = uuidv4();
      await db.domains.add({ id, categoryId: parentId, title: title.trim(), order: domainsInCat.length });
      setSidebarNodeExpanded(parentId, true);
    }

    if (type === 'create_subject' && title?.trim() && parentId) {
      const subsInDom = subjects.filter(s => s.domainId === parentId);
      const id = uuidv4();
      await db.subjects.add({ id, domainId: parentId, title: title.trim(), order: subsInDom.length, isLocked: false });
      await db.subjectInstances.add({
        id: uuidv4(), subjectId: id, name: 'Default',
        createdAt: new Date().toISOString(), order: 0
      });
      setSidebarNodeExpanded(parentId, true);
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

  // Collapse sidebar reactively on mobile when activeView changes
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [activeView, isMobile, setSidebarCollapsed]);

  // Modal title
  const modalTitleMap: Record<ModalType, string> = {
    create_category: 'Add Category',
    create_domain: 'Add Domain',
    create_subject: 'Add Subject',
    rename: `Rename ${modalConfig?.itemType || ''}`,
    delete: `Delete ${modalConfig?.itemType || ''}?`,
  };

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
      {/* ─── Branding Header ─────────────────────────────────────── */}
      <div className={cn(
        "flex items-center p-4 min-h-[64px] shrink-0",
        sidebarCollapsed ? "justify-center" : "justify-between"
      )}>
        {sidebarCollapsed ? (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="hover:opacity-80 p-0.5 rounded-lg transition-opacity"
            title="Expand sidebar"
          >
            <img src="/favicon.png" alt="Align" className="w-[22px] h-[22px] object-contain rounded-md" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/favicon.png" alt="Align" className="w-[22px] h-[22px] object-contain rounded-md shrink-0" />
              <span className="font-semibold text-[15px] tracking-tight text-[hsl(var(--foreground))] leading-none">
                Align
              </span>
            </div>
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-all"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </>
        )}
      </div>

      {/* ─── Main Nav ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 px-2 py-1.5 shrink-0">
        <NavItem
          icon={<Home size={18} />} label="Home" collapsed={sidebarCollapsed}
          active={activeView.type === 'home'} onClick={() => { setActiveView({ type: 'home' }); if (isMobile) setSidebarCollapsed(true); }}
        />
        <NavItem
          icon={<Search size={18} />} label="Search" collapsed={sidebarCollapsed}
          active={activeView.type === 'search'} onClick={() => { setActiveView({ type: 'search' }); if (isMobile) setSidebarCollapsed(true); }}
        />
        <NavItem
          icon={<Tag size={18} />} label="Tags" collapsed={sidebarCollapsed}
          active={activeView.type === 'tags'} onClick={() => { setActiveView({ type: 'tags' }); if (isMobile) setSidebarCollapsed(true); }}
        />
      </div>

      {/* ─── Separator ──────────────────────────────────────────── */}
      {!sidebarCollapsed && (
        <div className="h-px bg-[hsl(var(--sidebar-border))] mx-3 my-1 shrink-0" />
      )}

      {/* ─── Hierarchy Tree ─────────────────────────────────────── */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
          <Reorder.Group axis="y" values={localCategories} onReorder={handleCategoryReorder} className="flex flex-col">
            {localCategories.map(category => (
              <CategoryNode
                key={category.id}
                category={category}
                domains={domains.filter(d => d.categoryId === category.id)}
                allSubjects={subjects}
                allTasks={tasks}
                onContextMenu={handleContextMenu}
                globalStructureLock={globalStructureLock}
                isMobile={isMobile}
                onRename={(type: any, item: any) =>
                  setModalConfig({ type: 'rename', itemType: type, item, title: item.title })
                }
                onDelete={(type: any, item: any) =>
                  setModalConfig({ type: 'delete', itemType: type, item })
                }
                onCreateDomain={(categoryId: string) =>
                  setModalConfig({ type: 'create_domain', itemType: 'domain', item: null, title: '', parentId: categoryId })
                }
                onCreateSubject={(domainId: string) =>
                  setModalConfig({ type: 'create_subject', itemType: 'subject', item: null, title: '', parentId: domainId })
                }
              />
            ))}
          </Reorder.Group>
          {!globalStructureLock && (
            <button
              onClick={() => setModalConfig({ type: 'create_category', itemType: 'category', item: null, title: '' })}
              className="mt-2 flex items-center gap-2 text-[12px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors w-full"
            >
              <Plus size={13} /> Add Category
            </button>
          )}
        </div>
      )}

      {/* ─── Footer: Lock + Profile Dock ────────────────────────── */}
      <div className="border-t border-[hsl(var(--sidebar-border))] mt-auto shrink-0">
        {!sidebarCollapsed && (
          <div className="px-2 py-1.5">
            <NavItem
              icon={globalStructureLock ? <Lock size={16} /> : <Unlock size={16} />}
              label={globalStructureLock ? 'Unlock Structure' : 'Lock Structure'}
              collapsed={false}
              onClick={toggleLock}
            />
          </div>
        )}

        {/* Profile dock */}
        <div ref={profileRef} className="relative px-2 py-2">
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={cn(
              "flex items-center gap-2.5 cursor-pointer rounded-xl transition-colors hover:bg-[hsl(var(--muted))] p-2",
              sidebarCollapsed ? "justify-center" : ""
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.6)] flex items-center justify-center text-white font-bold text-[13px] shrink-0">
              {avatarLetter}
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[hsl(var(--foreground))] truncate leading-tight">{userName}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">Free Plan</div>
                </div>
                <Settings size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />
              </>
            )}
          </div>

          {/* Profile popover */}
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                className="absolute bottom-full left-2 right-2 mb-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl p-1.5 z-50"
              >
                <ProfileMenuItem icon={<User size={14} />} label="Profile" onClick={() => { setActiveView({ type: 'settings' }); setShowProfileMenu(false); if (isMobile) setSidebarCollapsed(true); }} />
                <ProfileMenuItem icon={<Settings size={14} />} label="Settings" onClick={() => { setActiveView({ type: 'settings' }); setShowProfileMenu(false); if (isMobile) setSidebarCollapsed(true); }} />
                <ProfileMenuItem icon={<History size={14} />} label="Export History" onClick={() => { setActiveView({ type: 'settings' }); setShowProfileMenu(false); if (isMobile) setSidebarCollapsed(true); }} />
                <div className="h-px bg-[hsl(var(--border))] my-1" />
                <ProfileMenuItem icon={<HelpCircle size={14} />} label="Help" onClick={() => setShowProfileMenu(false)} />
                <ProfileMenuItem icon={<Info size={14} />} label="About" onClick={() => setShowProfileMenu(false)} />
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
            className="fixed z-[200] w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl p-1.5 flex flex-col"
          >
            {contextMenu.type === 'category' && (
              <>
                <ContextMenuItem label="Add Domain" icon={<Plus size={13} />} onClick={() => { setModalConfig({ type: 'create_domain', itemType: 'domain', item: null, title: '', parentId: contextMenu.item.id }); setContextMenu(null); }} />
                <div className="h-px bg-[hsl(var(--border))] my-1" />
                <ContextMenuItem label="Rename" icon={<Pencil size={13} />} onClick={() => { setModalConfig({ type: 'rename', itemType: 'category', item: contextMenu.item, title: contextMenu.item.title }); setContextMenu(null); }} />
                <ContextMenuItem label="Delete" icon={<Trash2 size={13} />} danger onClick={() => { setModalConfig({ type: 'delete', itemType: 'category', item: contextMenu.item }); setContextMenu(null); }} />
              </>
            )}
            {contextMenu.type === 'domain' && (
              <>
                <ContextMenuItem label="Add Subject" icon={<Plus size={13} />} onClick={() => { setModalConfig({ type: 'create_subject', itemType: 'subject', item: null, title: '', parentId: contextMenu.item.id }); setContextMenu(null); }} />
                <div className="h-px bg-[hsl(var(--border))] my-1" />
                <ContextMenuItem label="Rename" icon={<Pencil size={13} />} onClick={() => { setModalConfig({ type: 'rename', itemType: 'domain', item: contextMenu.item, title: contextMenu.item.title }); setContextMenu(null); }} />
                <ContextMenuItem label="Delete" icon={<Trash2 size={13} />} danger onClick={() => { setModalConfig({ type: 'delete', itemType: 'domain', item: contextMenu.item }); setContextMenu(null); }} />
              </>
            )}
            {contextMenu.type === 'subject' && (
              <>
                <ContextMenuItem label="Rename" icon={<Pencil size={13} />} onClick={() => { setModalConfig({ type: 'rename', itemType: 'subject', item: contextMenu.item, title: contextMenu.item.title }); setContextMenu(null); }} />
                <ContextMenuItem label="Delete" icon={<Trash2 size={13} />} danger onClick={() => { setModalConfig({ type: 'delete', itemType: 'subject', item: contextMenu.item }); setContextMenu(null); }} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Create/Rename/Delete Modal ─────────────────────────── */}
      <AnimatePresence>
        {modalConfig && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[300] flex bg-black/50 backdrop-blur-sm",
              isMobile ? "items-start pt-12 px-4" : "items-center justify-center"
            )}
            onClick={() => setModalConfig(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: isMobile ? -8 : 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={cn(
                "bg-[hsl(var(--card))] p-5 rounded-2xl shadow-2xl border border-[hsl(var(--border))] flex flex-col gap-4",
                isMobile ? "w-full" : "w-80"
              )}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-semibold text-[15px] text-[hsl(var(--foreground))]">
                {modalConfig && modalTitleMap[modalConfig.type]}
              </h3>
              {(modalConfig.type === 'rename' || modalConfig.type.startsWith('create')) && (
                <input
                  autoFocus
                  className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--foreground))] w-full transition-colors"
                  value={modalConfig.title || ''}
                  placeholder={
                    modalConfig.type === 'create_category' ? 'Category name...' :
                    modalConfig.type === 'create_domain' ? 'Domain name...' :
                    modalConfig.type === 'create_subject' ? 'Subject name...' :
                    'New name...'
                  }
                  onChange={e => setModalConfig({ ...modalConfig, title: e.target.value })}
                  onFocus={e => { if (modalConfig.type === 'rename') e.target.select(); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleModalConfirm();
                    if (e.key === 'Escape') setModalConfig(null);
                  }}
                />
              )}
              {modalConfig.type === 'delete' && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                  This will permanently delete this <strong>{modalConfig.itemType}</strong> and all its children. This cannot be undone.
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModalConfig(null)}
                  className="px-4 py-2 text-[13px] font-medium rounded-xl hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--foreground))]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalConfirm}
                  disabled={
                    (modalConfig.type !== 'delete') &&
                    !(modalConfig.title?.trim())
                  }
                  className={cn(
                    "px-4 py-2 text-[13px] font-medium rounded-xl text-white transition-all disabled:opacity-40",
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
        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all w-full",
        active
          ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] font-semibold"
          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
        collapsed ? "justify-center" : "justify-start"
      )}
      title={collapsed ? label : undefined}
    >
      <div className="shrink-0">{icon}</div>
      {!collapsed && <span className="font-medium text-[13px] truncate">{label}</span>}
    </button>
  );
}

// ─── ContextMenuItem ─────────────────────────────────────────────────

function ContextMenuItem({ label, onClick, danger, icon }: {
  label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 text-left w-full px-3 py-2 text-[13px] font-medium rounded-lg transition-colors",
        danger ? "text-red-500 hover:bg-red-500/10" : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
      )}
    >
      {icon && <span className="opacity-70">{icon}</span>}
      {label}
    </button>
  );
}

// ─── ProfileMenuItem ─────────────────────────────────────────────────

function ProfileMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] font-medium rounded-lg text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
    >
      <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>
      {label}
    </button>
  );
}

// ─── MiniProgressBar ─────────────────────────────────────────────────

function MiniProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn("h-1 rounded-full bg-[hsl(var(--muted))] overflow-hidden", className)}>
      <motion.div
        className="h-full rounded-full bg-[hsl(var(--primary)/0.7)]"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}

// ─── CategoryNode ────────────────────────────────────────────────────

function CategoryNode({ category, domains, allSubjects, allTasks, onContextMenu, globalStructureLock, isMobile, onRename, onDelete, onCreateDomain, onCreateSubject }: any) {
  const dragControls = useDragControls();
  const [localDomains, setLocalDomains] = useState<any[]>([]);
  const { expandedSidebarNodes, toggleSidebarNode } = useUIStore();

  useEffect(() => { setLocalDomains(domains); }, [domains]);

  const handleDomainReorder = (newOrder: any[]) => {
    if (globalStructureLock) return;
    setLocalDomains(newOrder);
    newOrder.forEach((d, i) => db.domains.update(d.id, { order: i }));
  };

  const longPress = useLongPress((e) => {
    onContextMenu(e, 'category', category);
  });

  return (
    <Reorder.Item value={category} dragListener={false} dragControls={dragControls} className="mb-3 mt-1 list-none">
      <div
        className="px-1 mb-1 flex items-center gap-1 group cursor-default"
        onContextMenu={e => onContextMenu(e, 'category', category)}
        {...(isMobile ? longPress : {})}
      >
        {!globalStructureLock && !isMobile && (
          <div
            onPointerDown={e => dragControls.start(e)}
            className="text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab mr-0.5 shrink-0"
          >
            <GripVertical size={11} />
          </div>
        )}
        <h3 className="text-[10.5px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.1em] truncate flex-1">
          {category.title}
        </h3>
        {!globalStructureLock && (
          <div
            className={cn(
              "flex items-center gap-0.5 shrink-0 transition-opacity",
              isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => onRename('category', category)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 rounded-md hover:bg-[hsl(var(--muted))]" title="Rename"><Pencil size={11} /></button>
            <button onClick={() => onDelete('category', category)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 p-1 rounded-md hover:bg-red-500/10" title="Delete"><Trash2 size={11} /></button>
            <button onClick={() => onCreateDomain(category.id)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 rounded-md hover:bg-[hsl(var(--muted))]" title="Add Domain"><Plus size={13} /></button>
          </div>
        )}
      </div>

      <Reorder.Group axis="y" values={localDomains} onReorder={handleDomainReorder} className="flex flex-col gap-0.5">
        {localDomains.map((domain: any) => (
          <DomainNode
            key={domain.id}
            domain={domain}
            subjects={allSubjects.filter((s: any) => s.domainId === domain.id)}
            allTasks={allTasks}
            onContextMenu={onContextMenu}
            globalStructureLock={globalStructureLock}
            isMobile={isMobile}
            onRename={onRename}
            onDelete={onDelete}
            onCreateSubject={onCreateSubject}
          />
        ))}
      </Reorder.Group>
    </Reorder.Item>
  );
}

// ─── DomainNode ──────────────────────────────────────────────────────

function DomainNode({ domain, subjects, allTasks, onContextMenu, globalStructureLock, isMobile, onRename, onDelete, onCreateSubject }: any) {
  const dragControls = useDragControls();
  const { expandedSidebarNodes, toggleSidebarNode } = useUIStore();
  const expanded = expandedSidebarNodes[domain.id] !== false;

  const [localSubjects, setLocalSubjects] = useState<any[]>([]);
  useEffect(() => { setLocalSubjects(subjects); }, [subjects]);

  const handleSubjectReorder = (newOrder: any[]) => {
    if (globalStructureLock) return;
    setLocalSubjects(newOrder);
    newOrder.forEach((s, i) => db.subjects.update(s.id, { order: i }));
  };

  // Aggregated progress for this domain
  const { total, completed, pct } = useMemo(() => {
    const subjectIds = subjects.map((s: any) => s.id);
    const domainTasks = allTasks.filter((t: any) =>
      subjectIds.includes(t.subjectId) && t.type === 'task'
    );
    const total = domainTasks.length;
    const completed = domainTasks.filter((t: any) => t.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [subjects, allTasks]);

  const longPress = useLongPress((e) => {
    onContextMenu(e, 'domain', domain);
  });

  return (
    <Reorder.Item value={domain} dragListener={false} dragControls={dragControls} className="list-none">
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors text-[hsl(var(--foreground))] group relative"
        onClick={() => toggleSidebarNode(domain.id)}
        onContextMenu={e => onContextMenu(e, 'domain', domain)}
        {...(isMobile ? longPress : {})}
      >
        {!globalStructureLock && !isMobile && (
          <div
            onPointerDown={e => { e.stopPropagation(); dragControls.start(e); }}
            className="absolute left-[-12px] text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab p-1 hidden sm:block"
          >
            <GripVertical size={12} />
          </div>
        )}

        {/* Expand chevron — always visible on mobile */}
        <div className={cn(
          "text-[hsl(var(--muted-foreground))] shrink-0 transition-opacity",
          isMobile ? "opacity-60" : "opacity-60"
        )}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </div>

        <span className="font-medium text-[13px] truncate flex-1">{domain.title}</span>

        {/* Right side: progress OR actions — in same space */}
        <div className="shrink-0 flex items-center relative" style={{ minWidth: 56 }}>
          {/* Progress — visible by default, fades on desktop hover */}
          {total > 0 && (
            <div className={cn(
              "flex items-center gap-1.5 transition-opacity duration-150",
              globalStructureLock
                ? "opacity-100"
                : isMobile
                  ? "opacity-100"
                  : "opacity-100 group-hover:opacity-0 pointer-events-none group-hover:pointer-events-none absolute inset-y-0 right-0 flex items-center"
            )}>
              <MiniProgressBar pct={pct} className="w-8" />
            </div>
          )}

          {/* Actions — hidden by default, visible on desktop hover, hidden when locked */}
          {!globalStructureLock && !isMobile && (
            <div
              className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity duration-150"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => onRename('domain', domain)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 rounded-md hover:bg-[hsl(var(--muted))]" title="Rename"><Pencil size={11} /></button>
              <button onClick={() => onDelete('domain', domain)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 p-1 rounded-md hover:bg-red-500/10" title="Delete"><Trash2 size={11} /></button>
              <button onClick={() => onCreateSubject(domain.id)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 rounded-md hover:bg-[hsl(var(--muted))]" title="Add Subject"><Plus size={13} /></button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="pl-[10px] overflow-hidden ml-3 mt-0.5 border-l border-[hsl(var(--border)/0.5)] flex flex-col gap-0.5"
          >
            <Reorder.Group axis="y" values={localSubjects} onReorder={handleSubjectReorder} className="flex flex-col gap-0.5">
              {localSubjects.map((subject: any) => (
                <SubjectNode
                  key={subject.id}
                  subject={subject}
                  allTasks={allTasks}
                  onContextMenu={onContextMenu}
                  globalStructureLock={globalStructureLock}
                  isMobile={isMobile}
                  onRename={onRename}
                  onDelete={onDelete}
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

function SubjectNode({ subject, allTasks, onContextMenu, globalStructureLock, isMobile, onRename, onDelete }: any) {
  const dragControls = useDragControls();
  const { activeView, setActiveView, setSidebarCollapsed } = useUIStore();
  const isActive = activeView.type === 'subject' && activeView.subjectId === subject.id;

  // Subject progress
  const { total, completed, pct } = useMemo(() => {
    const subjectTasks = allTasks.filter((t: any) => t.subjectId === subject.id && t.type === 'task');
    const total = subjectTasks.length;
    const completed = subjectTasks.filter((t: any) => t.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [allTasks, subject.id]);

  const longPress = useLongPress((e) => {
    onContextMenu(e, 'subject', subject);
  });

  return (
    <Reorder.Item value={subject} dragListener={false} dragControls={dragControls} className="list-none group relative">
      {!globalStructureLock && !isMobile && (
        <div
          onPointerDown={e => { e.stopPropagation(); dragControls.start(e); }}
          className="absolute left-[-10px] top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab z-10 p-1"
        >
          <GripVertical size={11} />
        </div>
      )}
      <div
        onClick={() => { setActiveView({ type: 'subject', subjectId: subject.id }); if (isMobile) setSidebarCollapsed(true); }}
        onContextMenu={e => onContextMenu(e, 'subject', subject)}
        {...(isMobile ? longPress : {})}
        className={cn(
          "text-[13px] text-left py-1.5 pl-3 pr-1 transition-colors w-full rounded-lg flex items-center cursor-pointer gap-1.5",
          isActive
            ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-medium"
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)]"
        )}
      >
        <div className="truncate flex-1">{subject.title}</div>

        {/* Right side: progress OR actions */}
        <div className="shrink-0 flex items-center relative" style={{ minWidth: 44 }}>
          {/* Progress */}
          {total > 0 && (
            <div className={cn(
              "flex items-center gap-1 transition-opacity duration-150",
              globalStructureLock
                ? "opacity-100"
                : isMobile
                  ? "opacity-100"
                  : "opacity-100 group-hover:opacity-0 pointer-events-none group-hover:pointer-events-none absolute inset-y-0 right-0 flex items-center"
            )}>
              <MiniProgressBar pct={pct} className="w-6" />
            </div>
          )}

          {/* Actions */}
          {!globalStructureLock && !isMobile && (
            <div
              className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity duration-150"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => onRename('subject', subject)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 rounded-md hover:bg-[hsl(var(--muted))]" title="Rename"><Pencil size={11} /></button>
              <button onClick={() => onDelete('subject', subject)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 p-1 rounded-md hover:bg-red-500/10" title="Delete"><Trash2 size={11} /></button>
            </div>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}
