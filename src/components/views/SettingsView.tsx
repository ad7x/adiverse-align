import React, { useRef, useState, useEffect } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Moon, Sun, Download, Upload, Trash2, UserCircle, Plus, Pencil, GripVertical, Palette, CheckSquare, X, Volume2, Sparkles, Info, Copy } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

import { THEME_COLORS, CHECKMARK_STYLES } from '../../types';
import { exportWorkspaceZip, importWorkspaceZip, exportWorkspaceJSON } from '../../lib/zip';
import { PremiumCheckbox } from '../ui/PremiumCheckbox';

export function SettingsView() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray()) || [];
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [userName, setUserName] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPasteData, setImportPasteData] = useState('');
  const [catOrder, setCatOrder] = useState<any[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    if (settings) setUserName(settings.userName);
  }, [settings]);

  useEffect(() => {
    setCatOrder(categories);
  }, [categories]);

  const saveUserName = () => {
    if (settings && userName.trim()) {
      db.settings.update('settings', { userName: userName.trim() });
    }
    setIsEditingName(false);
  };

  const toggleTheme = async () => {
    const currentSettings = settings || await db.settings.get('settings');
    if (currentSettings) {
      await db.settings.update('settings', { theme: currentSettings.theme === 'dark' ? 'light' : 'dark' });
    } else {
      await db.settings.put({
        id: 'settings',
        theme: 'light',
        userName: '',
        hasCompletedOnboarding: false,
        globalLock: false,
        exportHistory: []
      });
    }
  };

  const [resetChecklistConfirm, setResetChecklistConfirm] = useState('');
  const [deleteWorkspaceConfirm, setDeleteWorkspaceConfirm] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [showExportWarning, setShowExportWarning] = useState<{ action: 'copy' | 'download' } | null>(null);

  const handleExport = async () => {
    try {
      const blob = await exportWorkspaceZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `align-workspace-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      if (settings) {
        const history = settings.exportHistory || [];
        await db.settings.update('settings', { exportHistory: [new Date().toISOString(), ...history].slice(0, 10) });
      }
    } catch(e) {
      alert("Export failed.");
    }
  };

  const processFullImport = async (jsonStr: string) => {
    const confirm = window.confirm("Quick JSON export/import excludes advanced notes, media, and images. Do you want to proceed with import?");
    if (!confirm) return;
    try {
      const data = JSON.parse(jsonStr);
      if (data.categories && data.domains && data.subjects && data.tasks) {
        // Strip notesRich from imported tasks
        const sanitizedTasks = data.tasks.map((t: any) => {
          const { notesRich, ...rest } = t;
          return rest;
        });

        if (importMode === 'replace') {
           await db.transaction('rw', [db.categories, db.domains, db.subjects, db.subjectInstances, db.tasks], async () => {
             await db.categories.clear();
             await db.domains.clear();
             await db.subjects.clear();
             await db.subjectInstances.clear();
             await db.tasks.clear();
             await db.categories.bulkAdd(data.categories);
             await db.domains.bulkAdd(data.domains);
             await db.subjects.bulkAdd(data.subjects);
             if (data.subjectInstances) await db.subjectInstances.bulkAdd(data.subjectInstances);
             await db.tasks.bulkAdd(sanitizedTasks);
           });
        } else {
           await db.transaction('rw', [db.categories, db.domains, db.subjects, db.subjectInstances, db.tasks], async () => {
             await db.categories.bulkPut(data.categories);
             await db.domains.bulkPut(data.domains);
             await db.subjects.bulkPut(data.subjects);
             if (data.subjectInstances) await db.subjectInstances.bulkPut(data.subjectInstances);
             await db.tasks.bulkPut(sanitizedTasks);
           });
        }
        setIsImportOpen(false);
        alert("Workspace imported successfully.");
      } else {
        alert("Invalid workspace format.");
      }
    } catch (e) {
      alert("Invalid JSON format.");
    }
  };

  const handleCopyJSONDirect = async () => {
    const confirm = window.confirm("Quick JSON export/import excludes advanced notes, media, and images. Do you want to proceed with copy?");
    if (!confirm) return;
    try {
      const json = await exportWorkspaceJSON();
      await navigator.clipboard.writeText(json);
      alert('Workspace JSON copied to clipboard');
    } catch (e) {
      alert('Failed to copy JSON to clipboard.');
    }
  };

  const handleDownloadJSONDirect = async () => {
    const confirm = window.confirm("Quick JSON export/import excludes advanced notes, media, and images. Do you want to proceed with download?");
    if (!confirm) return;
    try {
      const json = await exportWorkspaceJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `align-workspace-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to download JSON export.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.name.endsWith('.zip')) {
      try {
        await importWorkspaceZip(file, importMode);
        setIsImportOpen(false);
        alert("Workspace imported from ZIP successfully.");
      } catch(err) {
        alert("Failed to parse ZIP file.");
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => processFullImport(event.target?.result as string);
      reader.readAsText(file);
    }
  };

  const resetWorkspaceChecklist = async () => {
    if (resetChecklistConfirm === 'I agree to reset') {
      const tasksToUpdate = await db.tasks.toArray();
      for(const t of tasksToUpdate) {
         t.completed = false;
         t.completedAt = null;
         if(t.completionCount) t.completionCount = 0;
      }
      await db.tasks.bulkPut(tasksToUpdate);
      setResetChecklistConfirm('');
      alert('Workspace checklist reset completely.');
    }
  };

  const clearCache = async () => {
    if (deleteWorkspaceConfirm === 'I agree to delete all') {
      await db.categories.clear();
      await db.domains.clear();
      await db.subjects.clear();
      await db.subjectInstances.clear();
      await db.tasks.clear();
      await db.media.clear();
      setDeleteWorkspaceConfirm('');
      alert('Entire workspace deleted.');
    }
  };

  const globalStructureLock = settings?.globalLock;

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar text-[hsl(var(--foreground))]">
      <div className="flex flex-col p-4 sm:p-8 lg:p-16 max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-semibold mb-10 tracking-tight">Settings</h1>

        <div className="space-y-12 pb-20">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))] mb-4">Profile</h2>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full shrink-0 flex items-center justify-center">
                  <UserCircle size={24} className="text-[hsl(var(--primary))]" />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditingName ? (
                    <input 
                      value={userName} 
                      onChange={e => setUserName(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveUserName();
                        if (e.key === 'Escape') {
                          if (settings) setUserName(settings.userName);
                          setIsEditingName(false);
                        }
                      }}
                      placeholder="Your Name"
                      autoFocus
                      className="bg-transparent border-b-2 border-[hsl(var(--primary))] outline-none font-bold px-1 py-0.5 w-full text-xl text-[hsl(var(--foreground))] transition-all focus:border-[hsl(var(--primary))]"
                    />
                  ) : (
                    <span 
                      onClick={() => setIsEditingName(true)}
                      className="font-bold text-2xl tracking-tight bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--foreground)/0.75)] bg-clip-text text-transparent px-1 py-0.5 select-none hover:opacity-80 transition-opacity cursor-pointer block truncate"
                    >
                      {userName || 'Set Your Name'}
                    </span>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => {
                  if (isEditingName) {
                    saveUserName();
                  } else {
                    setIsEditingName(true);
                  }
                }}
                title={isEditingName ? "Save Name" : "Edit Name"}
                className={`p-3 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                  isEditingName 
                    ? 'bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] shadow-lg shadow-[hsl(var(--primary)/0.25)]' 
                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))]'
                }`}
              >
                {isEditingName ? <CheckSquare size={20} /> : <Pencil size={20} />}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))] mb-4">Appearance</h2>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm flex flex-col divide-y divide-[hsl(var(--border))]">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full shrink-0">{settings?.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}</div>
                <div>
                  <div className="font-medium text-lg">Theme Mode</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Deep Dark / Elegant Light</div>
                </div>
              </div>
              <button onClick={toggleTheme} className="w-full sm:w-auto px-6 py-2 rounded-xl bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] transition-colors text-sm font-medium whitespace-nowrap self-start sm:self-auto text-center">
                Toggle
              </button>
            </div>
            
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full shrink-0"><Palette size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Theme Color</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Accent color for your workspace</div>
                </div>
              </div>
              <div className="flex bg-[hsl(var(--muted))] p-1 rounded-xl gap-0.5 justify-center self-center sm:self-auto flex-wrap">
                {THEME_COLORS.map(color => (
                  <button 
                    key={color}
                    onClick={() => db.settings.update('settings', { themeColor: color })}
                    className={`w-8 h-8 rounded-lg m-0.5 flex flex-col items-center justify-center transition-all ${settings?.themeColor === color || (!settings?.themeColor && color === 'blue') ? 'ring-2 ring-offset-2 ring-offset-[hsl(var(--card))] scale-110 z-10' : 'opacity-70 hover:opacity-100'}`}
                    style={{ 
                      backgroundColor: 
                        color === 'blue' ? 'hsl(217 91% 60%)' :
                        color === 'purple' ? 'hsl(270 70% 60%)' :
                        color === 'green' ? 'hsl(152 60% 45%)' :
                        color === 'red' ? 'hsl(0 84% 65%)' :
                        color === 'orange' ? 'hsl(24 95% 55%)' :
                        'hsl(240 5% 65%)'
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full shrink-0"><CheckSquare size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Checkbox Style</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Select completion animation and shape</div>
                </div>
              </div>
              
              <div className="flex bg-[hsl(var(--muted))] p-1 rounded-xl items-center gap-0.5 justify-center self-center sm:self-auto flex-wrap">
                {(['modern', 'circle-glow', 'neon', 'minimal', 'gradient'] as const).map(style => (
                  <button 
                    key={style}
                    onClick={() => db.settings.update('settings', { checkmarkStyle: style })}
                    title={style.replace('-', ' ')}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${settings?.checkmarkStyle === style || (!settings?.checkmarkStyle && style === 'modern') ? 'bg-[hsl(var(--card))] border border-[hsl(var(--primary))] shadow-sm scale-110 z-10' : 'opacity-70 hover:opacity-100 hover:bg-[hsl(var(--card)/0.4)]'}`}
                  >
                    <div className="pointer-events-none scale-75">
                      <PremiumCheckbox checked={true} onChange={() => {}} variant={style} size={24} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))] mb-4">Interactions & Feedback</h2>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm flex flex-col divide-y divide-[hsl(var(--border))]">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full shrink-0"><Volume2 size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Chime Sound</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Play a rewarding sound on task completion</div>
                </div>
              </div>
              <button 
                onClick={() => db.settings.update('settings', { soundEnabled: !(settings?.soundEnabled ?? true) })}
                className={`w-full sm:w-auto px-6 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap self-start sm:self-auto text-center ${
                  (settings?.soundEnabled ?? true) 
                    ? 'bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)]' 
                    : 'bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] text-[hsl(var(--foreground))]'
                }`}
              >
                {(settings?.soundEnabled ?? true) ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full shrink-0"><Sparkles size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Celebration Animation</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Show subtle particle burst on completion</div>
                </div>
              </div>
              <button 
                onClick={() => db.settings.update('settings', { celebrationEnabled: !(settings?.celebrationEnabled ?? true) })}
                className={`w-full sm:w-auto px-6 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap self-start sm:self-auto text-center ${
                  (settings?.celebrationEnabled ?? true) 
                    ? 'bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)]' 
                    : 'bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] text-[hsl(var(--foreground))]'
                }`}
              >
                {(settings?.celebrationEnabled ?? true) ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">Category Manager</h2>
            {globalStructureLock && <span className="text-xs text-[hsl(var(--muted-foreground))]">(Locked)</span>}
          </div>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 shadow-sm">
            <Reorder.Group axis="y" values={catOrder} onReorder={(newOrder) => {
              if (globalStructureLock) return;
              setCatOrder(newOrder);
              newOrder.forEach((c, i) => db.categories.update(c.id, { order: i }));
            }} className="flex flex-col gap-2">
              {catOrder.map(cat => (
                <CategoryEditItem key={cat.id} category={cat} globalStructureLock={globalStructureLock} />
              ))}
            </Reorder.Group>
            
            {!globalStructureLock && (
               <button onClick={() => db.categories.add({ id: uuidv4(), title: 'New Category', order: catOrder.length })} className="mt-4 flex items-center gap-2 text-sm text-[hsl(var(--primary))] font-medium px-4 py-2 hover:bg-[hsl(var(--primary)/0.1)] rounded-lg transition-colors">
                 <Plus size={16} /> Add Category
               </button>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))] mb-4">Workspace Data</h2>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm flex flex-col">
            
            <div className="p-6 flex flex-col gap-4 border-b border-[hsl(var(--border))]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-full text-amber-500 shrink-0"><Download size={20} /></div>
                  <div>
                    <div className="font-medium text-lg">Quick JSON Export</div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">Download or copy workspace structure and tasks</div>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => setShowExportWarning({ action: 'copy' })} className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] text-sm font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap">
                    <Copy size={16} /> Copy JSON
                  </button>
                  <button onClick={() => setShowExportWarning({ action: 'download' })} className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap">
                    <Download size={16} /> Export JSON
                  </button>
                </div>
              </div>
              
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex gap-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>Quick JSON export excludes advanced notes, images, and media. Use <strong>Export ZIP</strong> for a full backup.</span>
              </div>
            </div>

            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[hsl(var(--border))]">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-500 shrink-0"><Upload size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Full App Import</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Restore everything from JSON</div>
                </div>
              </div>
              <button onClick={() => setIsImportOpen(true)} className="w-full sm:w-auto px-6 py-2 rounded-xl bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] transition-colors text-sm font-medium whitespace-nowrap self-start sm:self-auto text-center">Open Importer</button>
            </div>

            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[hsl(var(--border))]">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-orange-500/10 text-orange-500 rounded-full shrink-0"><Trash2 size={20} /></div>
                <div>
                  <div className="font-medium text-lg text-orange-500">Reset Workspace Checklist</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Resets all task progress globally, preserves structure</div>
                </div>
              </div>
              <button onClick={() => setShowResetModal(true)} className="w-full sm:w-auto px-6 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm transition-colors whitespace-nowrap self-start sm:self-auto text-center">Reset Progress</button>
            </div>

            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[hsl(var(--border))]">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-full shrink-0"><Trash2 size={20} /></div>
                <div>
                  <div className="font-medium text-lg text-red-500">Delete Entire Workspace</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Permanently deletes all data and uploads</div>
                </div>
              </div>
              <button onClick={() => setShowDeleteModal(true)} className="w-full sm:w-auto px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors whitespace-nowrap self-start sm:self-auto text-center">Delete Entire Workspace</button>
            </div>
          </div>
        </section>


      </div>

      <AnimatePresence>
        {isImportOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsImportOpen(false)} onKeyDown={e => { if (e.key === 'Escape') setIsImportOpen(false); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden flex flex-col p-6 relative" onClick={e => e.stopPropagation()}>
               <button onClick={() => setIsImportOpen(false)} className="absolute top-4 right-4 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1"><X size={18} /></button>
               <h2 className="text-2xl font-semibold mb-6 text-[hsl(var(--foreground))]">Import Workspace</h2>
               
               <div className="flex flex-col gap-4">
                 
                 <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 text-xs flex gap-2">
                   <Info size={16} className="shrink-0 mt-0.5" />
                   <span><strong>Warning:</strong> Quick JSON import/export excludes advanced notes, media, and images. Use ZIP import/export for a full backup.</span>
                 </div>

                 <div className="flex bg-[hsl(var(--background))] p-1 rounded-xl mb-2">
                    <button onClick={() => setImportMode('replace')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${importMode === 'replace' ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))]'}`}>Replace Workspace</button>
                    <button onClick={() => setImportMode('merge')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${importMode === 'merge' ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))]'}`}>Merge Workspace</button>
                 </div>

                 <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                   <Upload size={20} /> Upload JSON or ZIP File
                 </button>
                 <input type="file" accept=".json,.zip" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                 
                 <div className="relative flex items-center py-2">
                   <div className="flex-grow border-t border-[hsl(var(--border))]"></div>
                   <span className="flex-shrink-0 mx-4 text-[hsl(var(--muted-foreground))] text-xs font-semibold uppercase tracking-widest">or paste JSON</span>
                   <div className="flex-grow border-t border-[hsl(var(--border))]"></div>
                 </div>

                 <textarea 
                   value={importPasteData} onChange={e => setImportPasteData(e.target.value)} 
                   placeholder="Paste workspace JSON here..."
                   className="w-full h-32 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm font-mono focus:border-[hsl(var(--primary))] outline-none resize-none text-[hsl(var(--foreground))]"
                 />
               </div>

               <div className="flex gap-3 justify-end mt-6">
                 <button onClick={() => setIsImportOpen(false)} className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium transition-colors text-[hsl(var(--foreground))]">Cancel</button>
                 <button onClick={() => processFullImport(importPasteData)} className="px-5 py-2 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-medium transition-colors">Import Data</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Warning Modal */}
      <AnimatePresence>
        {showExportWarning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowExportWarning(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-semibold mb-2 text-amber-500 flex items-center gap-2">
                <Info className="text-amber-500" /> Export Warning
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                Quick JSON export excludes advanced notes, images, and media. To keep all content, use the <strong>Export ZIP</strong> option instead.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowExportWarning(null)} className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium text-[hsl(var(--foreground))]">Cancel</button>
                <button 
                  onClick={() => {
                    if (showExportWarning.action === 'copy') {
                      handleCopyJSONDirect();
                    } else {
                      handleDownloadJSONDirect();
                    }
                    setShowExportWarning(null);
                  }} 
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium"
                >
                  Proceed with JSON Export
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset progress Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" 
            onClick={() => { setShowResetModal(false); setResetChecklistConfirm(''); }}
          >
            <motion.div 
              initial={{ scale: 0.95 }} 
              animate={{ scale: 1 }} 
              exit={{ scale: 0.95 }} 
              className="w-full max-w-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl p-6 relative" 
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => { setShowResetModal(false); setResetChecklistConfirm(''); }} 
                className="absolute top-4 right-4 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 transition-colors"
              >
                <X size={18} />
              </button>
              
              <div className="flex items-center gap-3 text-orange-500 mb-4">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Trash2 size={24} />
                </div>
                <h2 className="text-xl font-semibold">Reset Checklist Progress</h2>
              </div>
              
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6 leading-relaxed">
                This will reset all task completion progress globally across your entire workspace, while preserving your categories, subjects, and tasks. This action cannot be undone.
              </p>
              
              <div className="flex flex-col gap-2 mb-6">
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Type <span className="text-[hsl(var(--foreground))] font-bold select-all">I agree to reset</span> to confirm
                </label>
                <input 
                  type="text"
                  value={resetChecklistConfirm} 
                  onChange={e => setResetChecklistConfirm(e.target.value)} 
                  placeholder="I agree to reset" 
                  className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 text-[hsl(var(--foreground))]"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => { setShowResetModal(false); setResetChecklistConfirm(''); }} 
                  className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium transition-colors text-[hsl(var(--foreground))]"
                >
                  Cancel
                </button>
                <button 
                  disabled={resetChecklistConfirm !== 'I agree to reset'} 
                  onClick={() => {
                    resetWorkspaceChecklist();
                    setShowResetModal(false);
                  }} 
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 text-white text-sm font-medium transition-all"
                >
                  Reset Progress
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete entire workspace Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" 
            onClick={() => { setShowDeleteModal(false); setDeleteWorkspaceConfirm(''); }}
          >
            <motion.div 
              initial={{ scale: 0.95 }} 
              animate={{ scale: 1 }} 
              exit={{ scale: 0.95 }} 
              className="w-full max-w-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl p-6 relative" 
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => { setShowDeleteModal(false); setDeleteWorkspaceConfirm(''); }} 
                className="absolute top-4 right-4 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 transition-colors"
              >
                <X size={18} />
              </button>
              
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Trash2 size={24} />
                </div>
                <h2 className="text-xl font-semibold">Delete Entire Workspace</h2>
              </div>
              
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6 leading-relaxed">
                This will permanently delete all categories, subjects, tasks, domains, and uploaded media. <strong>All your work will be permanently lost</strong>. This action cannot be undone.
              </p>
              
              <div className="flex flex-col gap-2 mb-6">
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Type <span className="text-[hsl(var(--foreground))] font-bold select-all">I agree to delete all</span> to confirm
                </label>
                <input 
                  type="text"
                  value={deleteWorkspaceConfirm} 
                  onChange={e => setDeleteWorkspaceConfirm(e.target.value)} 
                  placeholder="I agree to delete all" 
                  className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 text-[hsl(var(--foreground))]"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => { setShowDeleteModal(false); setDeleteWorkspaceConfirm(''); }} 
                  className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium transition-colors text-[hsl(var(--foreground))]"
                >
                  Cancel
                </button>
                <button 
                  disabled={deleteWorkspaceConfirm !== 'I agree to delete all'} 
                  onClick={() => {
                    clearCache();
                    setShowDeleteModal(false);
                  }} 
                  className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-red-500 text-white text-sm font-medium transition-all"
                >
                  Delete Entire Workspace
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
}

function CategoryEditItem({ category, globalStructureLock }: any) {
  const [title, setTitle] = useState(category.title);
  return (
    <Reorder.Item value={category} dragListener={!globalStructureLock} className="flex items-center gap-3 p-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl group">
      {!globalStructureLock && <div className="cursor-grab text-[hsl(var(--muted-foreground))] opacity-50 group-hover:opacity-100 transition-opacity"><GripVertical size={16}/></div>}
      <input 
        value={title} onChange={e => setTitle(e.target.value)} onBlur={() => db.categories.update(category.id, { title })} readOnly={globalStructureLock}
        className="bg-transparent border-none outline-none font-medium text-[hsl(var(--foreground))] flex-1"
      />
      {!globalStructureLock && <button onClick={() => confirm("Delete category and ALL its domains/subjects/tasks?") && db.categories.delete(category.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1"><Trash2 size={16}/></button>}
    </Reorder.Item>
  );
}
