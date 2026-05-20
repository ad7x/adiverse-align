import React, { useRef, useState, useEffect } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Moon, Sun, Download, Upload, Trash2, UserCircle, Plus, Pencil, GripVertical, Palette, CheckSquare, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

import { THEME_COLORS, CHECKMARK_STYLES } from '../../types';
import { exportWorkspaceZip, importWorkspaceZip } from '../../lib/zip';
import { PremiumCheckbox } from '../ui/PremiumCheckbox';

export function SettingsView() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray()) || [];
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [userName, setUserName] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPasteData, setImportPasteData] = useState('');
  const [catOrder, setCatOrder] = useState<any[]>([]);

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
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  const handleExport = async () => {
    try {
      const blob = await exportWorkspaceZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adiverse-workspace-${new Date().toISOString().split('T')[0]}.zip`;
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
    try {
      const data = JSON.parse(jsonStr);
      if (data.categories && data.domains && data.subjects && data.tasks) {
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
             await db.tasks.bulkAdd(data.tasks);
           });
        } else {
           await db.transaction('rw', [db.categories, db.domains, db.subjects, db.subjectInstances, db.tasks], async () => {
             await db.categories.bulkPut(data.categories);
             await db.domains.bulkPut(data.domains);
             await db.subjects.bulkPut(data.subjects);
             if (data.subjectInstances) await db.subjectInstances.bulkPut(data.subjectInstances);
             await db.tasks.bulkPut(data.tasks);
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

  const isLocked = settings?.globalLock;

  return (
    <div className="h-full w-full flex flex-col p-8 lg:p-16 max-w-4xl mx-auto overflow-y-auto custom-scrollbar">
      <h1 className="text-3xl font-semibold mb-10 tracking-tight">Settings</h1>

      <div className="space-y-12 pb-20">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))] mb-4">Profile</h2>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <UserCircle size={28} className="text-[hsl(var(--muted-foreground))]" />
              <div className="flex-1 flex gap-4">
                <input 
                  value={userName} onChange={e => setUserName(e.target.value)} placeholder="Your Name"
                  className="bg-transparent border-b border-[hsl(var(--border))] outline-none font-medium px-2 py-1 flex-1 text-lg"
                />
                <button onClick={saveUserName} className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg font-medium text-sm">Save</button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))] mb-4">Appearance</h2>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm flex flex-col divide-y divide-[hsl(var(--border))]">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full">{settings?.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}</div>
                <div>
                  <div className="font-medium text-lg">Theme Mode</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Deep Dark / Elegant Light</div>
                </div>
              </div>
              <button onClick={toggleTheme} className="px-6 py-2 rounded-xl bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] transition-colors text-sm font-medium">
                Toggle
              </button>
            </div>
            
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full"><Palette size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Theme Color</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Accent color for your workspace</div>
                </div>
              </div>
              <div className="flex bg-[hsl(var(--muted))] p-1 rounded-xl">
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

            <div className="p-6 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[hsl(var(--muted))] rounded-full"><CheckSquare size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Checkbox Style</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Select your preferred completion animation and shape</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(['modern', 'circle-glow', 'neon', 'minimal', 'gradient'] as const).map(style => (
                  <button 
                    key={style}
                    onClick={() => db.settings.update('settings', { checkmarkStyle: style })}
                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${settings?.checkmarkStyle === style || (!settings?.checkmarkStyle && style === 'modern') ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] shadow-lg' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--muted)/0.3)]'}`}
                  >
                    <div className="pointer-events-none scale-125 mb-1">
                      <PremiumCheckbox checked={true} onChange={() => {}} variant={style} />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--foreground))] text-center">
                      {style.replace('-', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">Category Manager</h2>
            {isLocked && <span className="text-xs text-[hsl(var(--muted-foreground))]">(Locked)</span>}
          </div>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 shadow-sm">
            <Reorder.Group axis="y" values={catOrder} onReorder={(newOrder) => {
              if (isLocked) return;
              setCatOrder(newOrder);
              newOrder.forEach((c, i) => db.categories.update(c.id, { order: i }));
            }} className="flex flex-col gap-2">
              {catOrder.map(cat => (
                <CategoryEditItem key={cat.id} category={cat} isLocked={isLocked} />
              ))}
            </Reorder.Group>
            
            {!isLocked && (
               <button onClick={() => db.categories.add({ id: uuidv4(), title: 'New Category', order: catOrder.length })} className="mt-4 flex items-center gap-2 text-sm text-[hsl(var(--primary))] font-medium px-4 py-2 hover:bg-[hsl(var(--primary)/0.1)] rounded-lg transition-colors">
                 <Plus size={16} /> Add Category
               </button>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--primary))] mb-4">Workspace Data</h2>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm flex flex-col">
            
            <div className="p-6 flex items-center justify-between border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[hsl(var(--primary)/0.1)] rounded-full text-[hsl(var(--primary))]"><Download size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Full App Export</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Download entire workspace</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={handleExport} className="px-6 py-2 rounded-xl bg-[hsl(var(--primary))] text-white font-medium text-sm">Export ZIP</button>
                {settings?.exportHistory && settings.exportHistory.length > 0 && (
                  <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))]">
                    Last export:<br/>
                    {new Date(settings.exportHistory[0]).toLocaleDateString()} — {new Date(settings.exportHistory[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 flex items-center justify-between border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-500"><Upload size={20} /></div>
                <div>
                  <div className="font-medium text-lg">Full App Import</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Restore everything from JSON</div>
                </div>
              </div>
              <button onClick={() => setIsImportOpen(true)} className="px-6 py-2 rounded-xl bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] transition-colors text-sm font-medium">Open Importer</button>
            </div>

            <div className="p-6 flex flex-col gap-4 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 text-orange-500 rounded-full"><Trash2 size={20} /></div>
                <div>
                  <div className="font-medium text-lg text-orange-500">Reset Workspace Checklist</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Resets all task progress globally, preserves structure. Type <strong>I agree to reset</strong> below to confirm.</div>
                </div>
              </div>
              <div className="flex gap-4">
                 <input value={resetChecklistConfirm} onChange={e => setResetChecklistConfirm(e.target.value)} placeholder="I agree to reset" className="flex-1 bg-transparent border border-[hsl(var(--border))] rounded-xl px-4 outline-none focus:border-orange-500" />
                 <button disabled={resetChecklistConfirm !== 'I agree to reset'} onClick={resetWorkspaceChecklist} className="px-6 py-2 rounded-xl bg-orange-500 text-white font-medium text-sm disabled:opacity-50 transition-opacity">Reset Progress</button>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-full"><Trash2 size={20} /></div>
                <div>
                  <div className="font-medium text-lg text-red-500">Delete Entire Workspace</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Permanently deletes all data. Type <strong>I agree to delete all</strong> below to confirm.</div>
                </div>
              </div>
              <div className="flex gap-4">
                 <input value={deleteWorkspaceConfirm} onChange={e => setDeleteWorkspaceConfirm(e.target.value)} placeholder="I agree to delete all" className="flex-1 bg-transparent border border-[hsl(var(--border))] rounded-xl px-4 outline-none focus:border-red-500" />
                 <button disabled={deleteWorkspaceConfirm !== 'I agree to delete all'} onClick={clearCache} className="px-6 py-2 rounded-xl bg-red-500 text-white font-medium text-sm disabled:opacity-50 transition-opacity">Delete Entire Workspace</button>
              </div>
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

    </div>
  );
}

function CategoryEditItem({ category, isLocked }: any) {
  const [title, setTitle] = useState(category.title);
  return (
    <Reorder.Item value={category} dragListener={!isLocked} className="flex items-center gap-3 p-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl group">
      {!isLocked && <div className="cursor-grab text-[hsl(var(--muted-foreground))] opacity-50 group-hover:opacity-100 transition-opacity"><GripVertical size={16}/></div>}
      <input 
        value={title} onChange={e => setTitle(e.target.value)} onBlur={() => db.categories.update(category.id, { title })} readOnly={isLocked}
        className="bg-transparent border-none outline-none font-medium text-[hsl(var(--foreground))] flex-1"
      />
      {!isLocked && <button onClick={() => confirm("Delete category and ALL its domains/subjects/tasks?") && db.categories.delete(category.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"><Trash2 size={16}/></button>}
    </Reorder.Item>
  );
}
