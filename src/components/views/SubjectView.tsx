import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { MoreHorizontal, Plus, GripVertical, CheckCircle2, Circle, CheckSquare, Square, Check, Minus, Bot, Trash2, ChevronRight, Info, Upload, Copy, ChevronDown, Calendar, Tag, AlignLeft, X } from 'lucide-react';
import { motion, AnimatePresence, Reorder, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';

export function SubjectView({ subjectId }: { subjectId: string }) {
  const subject = useLiveQuery(() => db.subjects.get(subjectId), [subjectId]);
  const categories = useLiveQuery(() => db.categories.toArray());
  const domains = useLiveQuery(() => db.domains.toArray());
  
  const rawTasks = useLiveQuery(() => db.tasks.where('subjectId').equals(subjectId).toArray(), [subjectId]);
  const settings = useLiveQuery(() => db.settings.get('settings'));
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 20 });
  
  const backgroundTemplate = useMotionTemplate`radial-gradient(circle 600px at ${smoothX}px ${smoothY}px, hsl(var(--primary) / 0.08), transparent 80%)`;
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'upload'>('paste');
  const [showAiGuide, setShowAiGuide] = useState(false);
  const [pasteData, setPasteData] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fullPromptText = `Generate a VALID JSON checklist for my study tracker app.

STRICT RULES:

Return ONLY raw JSON.

Do NOT include markdown.
Do NOT wrap in \`\`\`json.
Do NOT explain anything.
Do NOT add comments.

JSON structure must EXACTLY follow this schema:

{
  "sections": [
    {
      "title": "Section Name",
      "subsections": [
        {
          "title": "Subsection Name",
          "tasks": [
            {
              "title": "Task name",
              "completed": false,
              "description": "",
              "notes": ""
            }
          ]
        }
      ],
      "tasks": [
        {
          "title": "Task name",
          "completed": false,
          "description": "",
          "notes": ""
        }
      ]
    }
  ]
}

REQUIREMENTS:

- Group related topics into sections
- Use subsections when useful
- Keep task names concise but descriptive
- completed must always be false
- JSON must be syntactically valid`;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fullPromptText);
      const toast = document.createElement('div');
      toast.className = "fixed bottom-8 left-1/2 -translate-x-1/2 bg-[hsl(var(--foreground))] text-[hsl(var(--background))] px-5 py-2.5 rounded-full text-sm font-medium shadow-2xl z-[9000] transition-opacity duration-300";
      toast.textContent = "Prompt copied to clipboard";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    } catch(err) {}
  };

  useEffect(() => {
    if (rawTasks) setTasks([...rawTasks].sort((a, b) => a.order - b.order));
  }, [rawTasks]);
  
  // Close menu when clicked outside behavior can be added later if needed,
  // For now, toggle handles it.

  // When menu opens/closes, reset submenus
  useEffect(() => {
    if (!menuOpen) setShowExportMenu(false);
  }, [menuOpen]);

  const isGlobalLocked = settings?.globalLock || false;
  const isSubjectLocked = subject?.isLocked || false;
  const isLockedForEdit = isGlobalLocked || isSubjectLocked;

  const toggleSubjectLock = async () => {
    if (subject) await db.subjects.update(subjectId, { isLocked: !subject.isLocked });
    setMenuOpen(false);
  };

  const getSubjectJSON = () => {
    const topLevel = tasks.filter(t => !t.parentId).sort((a,b)=>a.order - b.order);
    
    const serializeSection = (sec: any): any => {
      const children = tasks.filter(c => c.parentId === sec.id).sort((a,b)=>a.order - b.order);
      const subSections = children.filter(c => c.type === 'section').map(serializeSection);
      const subTasks = children.filter(c => c.type === 'task').map(c => ({
        title: c.title,
        completed: c.completed,
        description: c.description
      }));
      
      const result: any = { title: sec.title };
      if (subSections.length > 0) result.subsections = subSections;
      if (subTasks.length > 0) result.tasks = subTasks;
      return result;
    };

    const result: any = {};
    const sections = topLevel.filter(t => t.type === 'section').map(serializeSection);
    const orphanTasks = topLevel.filter(t => t.type === 'task').map(c => ({
      title: c.title,
      completed: c.completed,
      description: c.description
    }));

    if (sections.length > 0) result.sections = sections;
    if (orphanTasks.length > 0) result.tasks = orphanTasks;
    
    return JSON.stringify(result, null, 2);
  };

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(getSubjectJSON());
      const toast = document.createElement('div');
      toast.className = "fixed bottom-8 left-1/2 -translate-x-1/2 bg-[hsl(var(--foreground))] text-[hsl(var(--background))] px-5 py-2.5 rounded-full text-sm font-medium shadow-2xl z-[9000] transition-opacity duration-300";
      toast.textContent = "Subject JSON copied to clipboard";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    } catch(err) {}
    setMenuOpen(false);
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([getSubjectJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subject?.title.toLowerCase().replace(/ /g, '-') || 'subject'}.json`;
    a.click();
    setMenuOpen(false);
  };

  const processImport = async (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      let globalOrder = tasks.length;
      
      const importSection = async (sec: any, parentId: string | null = null) => {
        const sectionId = uuidv4();
        await db.tasks.add({
          id: sectionId, subjectId, parentId, type: 'section',
          title: sec.title || 'Untitled Section', description: sec.description || '', notes: '', completed: false, order: globalOrder++
        });
        
        const children = sec.tasks || sec.children || [];
        for (const ct of children) {
          await db.tasks.add({
            id: uuidv4(), subjectId, parentId: sectionId, type: 'task',
            title: ct.title || 'Untitled Task', description: ct.description || '', notes: '', completed: ct.completed || false, order: globalOrder++
          });
        }

        const subsections = sec.subsections || [];
        for (const subsec of subsections) {
           await importSection(subsec, sectionId);
        }
      };

      if (data.sections && Array.isArray(data.sections)) {
        for (const sec of data.sections) {
          await importSection(sec, null);
        }
      }
      
      if (data.tasks && Array.isArray(data.tasks)) {
        for (const pt of data.tasks) {
           if (pt.type === 'section' || pt.sections || pt.tasks || pt.children) {
             await importSection(pt, null);
           } else {
             await db.tasks.add({
                id: uuidv4(), subjectId, parentId: null, type: 'task',
                title: pt.title || 'Untitled Task', description: pt.description || '', notes: '', completed: pt.completed || false, order: globalOrder++
             });
           }
        }
      }
      
      setIsImportModalOpen(false);
      setPasteData('');
    } catch (e) {
      alert("Invalid JSON format. Please check your data.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => processImport(event.target?.result as string);
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!subject || !categories || !domains) return null;

  const domain = domains.find(d => d.id === subject.domainId);
  const category = categories.find(c => c.id === domain?.categoryId);
  
  const completed = tasks.filter(t => t.type === 'task' && t.completed).length;
  const total = tasks.filter(t => t.type === 'task').length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const topLevel = tasks.filter(t => !t.parentId);

  return (
    <div 
      className="h-full relative overflow-hidden flex flex-col bg-[hsl(var(--background))]" 
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-50 dark:opacity-30"
        style={{
          background: backgroundTemplate
        }}
      />
      
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 w-full p-4 sm:p-8 md:p-12">
        <div className="max-w-5xl mx-auto flex flex-col min-h-full">
        
          <div className="bg-[hsl(var(--foreground)/0.02)] backdrop-blur-3xl border border-[hsl(var(--border))] rounded-[32px] p-8 md:p-10 relative overflow-hidden shadow-sm transition-all mb-10 group">
            <div className="flex items-center justify-between mb-8 z-10 relative">
              <div className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.15em] opacity-80">
                {category?.title} / {domain?.title} / <span className="text-[hsl(var(--foreground))]">{subject.title}</span>
              </div>
              
              <div className="relative">
                <button 
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 -mr-2 rounded-full hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))] focus:outline-none"
                >
                  <MoreHorizontal size={24} />
                </button>
                
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-12 w-56 bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-xl rounded-xl custom-glass z-20 flex flex-col p-1.5"
                    >
                      {!showExportMenu ? (
                        <>
                          <button onClick={() => setShowExportMenu(true)} className="flex items-center justify-between w-full text-left p-2.5 text-[13px] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">
                            Export <ChevronRight size={14}/>
                          </button>
                          <button onClick={() => { setIsImportModalOpen(true); setMenuOpen(false); }} className="flex items-center justify-between w-full text-left p-2.5 text-[13px] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50" disabled={isLockedForEdit}>
                            Import <ChevronRight size={14}/>
                          </button>
                          
                          <button disabled={isGlobalLocked} onClick={toggleSubjectLock} className="w-full text-left p-2.5 text-[13px] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50">
                            {isSubjectLocked ? "Unlock View" : "Lock View"}
                          </button>
                          <button disabled={isLockedForEdit} onClick={async () => {
                            if(!confirm("Reset all progress for this subject?")) return;
                            const tasksToUpdate = await db.tasks.where({ subjectId }).toArray();
                            for(const t of tasksToUpdate) await db.tasks.update(t.id, { completed: false });
                            setMenuOpen(false);
                          }} className="w-full text-left p-2.5 text-[13px] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50">Reset Progress</button>
                          <button disabled={isLockedForEdit} onClick={async () => {
                            if(confirm("Delete this subject permanently?")) await db.subjects.delete(subjectId);
                          }} className="w-full text-left p-2.5 text-[13px] font-medium rounded-lg hover:bg-red-500/10 text-red-500 transition-colors disabled:opacity-50">Delete Subject</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setShowExportMenu(false)} className="flex items-center gap-2 text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest p-2 hover:text-[hsl(var(--foreground))] transition-colors">
                            <ChevronRight size={12} className="rotate-180" /> Back
                          </button>
                          <button onClick={handleCopyJSON} className="w-full text-left p-2.5 text-[13px] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">Copy JSON to Clipboard</button>
                          <button onClick={handleDownloadJSON} className="w-full text-left p-2.5 text-[13px] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">Download JSON File</button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mb-12 z-10 relative">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">{subject.title}</h1>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between z-10 relative gap-8 md:gap-0 mt-4">
              <div className="flex items-center gap-5">
                <div className="relative w-16 h-16 shrink-0 bg-[hsl(var(--background)/0.5)] rounded-full flex items-center justify-center shadow-inner">
                   <svg className="w-full h-full -rotate-90 absolute inset-0 text-[hsl(var(--primary))]" viewBox="0 0 36 36">
                     <path className="text-[hsl(var(--muted))]" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                     <motion.path className="text-[hsl(var(--primary))]" strokeWidth="3" strokeDasharray={`${progress}, 100`} stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" initial={{ strokeDasharray: "0, 100" }} animate={{ strokeDasharray: `${progress}, 100` }} />
                   </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-lg text-[hsl(var(--foreground))] mb-0.5">Overall Progress</span>
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{completed} / {total} tasks completed</span>
                </div>
              </div>
              
              <div className="text-5xl lg:text-7xl font-black tracking-tighter text-[hsl(var(--primary))]/20 leading-none">
                 {progress}%
              </div>
            </div>
          </div>

      <AnimatePresence>
        {isImportModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden flex flex-col relative">
               
               {showAiGuide ? (
                 <div className="p-6 flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
                   <div className="flex items-center justify-between mb-4">
                     <h2 className="text-xl font-semibold flex items-center gap-2 text-[hsl(var(--primary))]"><Bot size={20}/> AI Import Guide</h2>
                     <button onClick={() => setShowAiGuide(false)} className="text-sm font-semibold hover:text-[hsl(var(--primary))] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Back</button>
                   </div>
                   
                   <p className="text-sm mb-4 text-[hsl(var(--muted-foreground))] leading-relaxed">
                     Use this prompt in ChatGPT, Gemini, Claude, or any AI chatbot to generate checklist JSON compatible with this app.
                   </p>

                   <div className="relative flex-1 overflow-hidden bg-black/80 rounded-xl border border-[hsl(var(--border))] flex flex-col group mb-2 shadow-inner">
                     <div className="absolute top-2 right-2 z-10">
                       <button 
                         onClick={handleCopyPrompt}
                         className="p-2 text-[hsl(var(--muted-foreground))] hover:bg-white/10 hover:text-white rounded-md transition-colors backdrop-blur-sm"
                         title="Copy Prompt"
                       >
                         <Copy size={16} />
                       </button>
                     </div>
                     <div className="flex-1 p-5 pt-10 text-[12px] sm:text-[13px] leading-relaxed font-mono overflow-y-auto text-gray-300 whitespace-pre-wrap selection:bg-[hsl(var(--primary)/0.4)] custom-scrollbar">
                       {fullPromptText}
                     </div>
                   </div>
                 </div>
               ) : (
                 <>
                   <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                     <div className="flex space-x-4">
                       <button onClick={() => setImportTab('paste')} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${importTab === 'paste' ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Paste JSON</button>
                       <button onClick={() => setImportTab('upload')} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${importTab === 'upload' ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Upload JSON</button>
                     </div>
                     <button onClick={() => setShowAiGuide(true)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors p-1" title="Import Guide">
                       <Info size={18} />
                     </button>
                   </div>
                   
                   <div className="p-6 flex flex-col gap-4">
                     {importTab === 'paste' ? (
                       <textarea 
                         value={pasteData} onChange={e => setPasteData(e.target.value)} 
                         placeholder="Paste subject JSON here..."
                         className="w-full h-48 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm font-mono focus:border-[hsl(var(--primary))] outline-none resize-none"
                       />
                     ) : (
                       <>
                         <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[hsl(var(--border))] rounded-xl hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                           <Upload size={32} className="text-[hsl(var(--muted-foreground))] mb-4" />
                           <span className="text-sm text-[hsl(var(--muted-foreground))] font-medium">Click to select .json file</span>
                         </div>
                         <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                       </>
                     )}
                     
                     <div className="flex gap-3 justify-end mt-2">
                       <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium transition-colors">Cancel</button>
                       {importTab === 'paste' && <button onClick={() => processImport(pasteData)} className="px-5 py-2 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-medium transition-colors">Import</button>}
                     </div>
                   </div>
                 </>
               )}
               
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 pb-20">
        <Reorder.Group axis="y" values={topLevel} onReorder={(newOrder) => {
          if (!isLockedForEdit) newOrder.forEach((t, i) => db.tasks.update(t.id, { order: i }));
        }} className="flex flex-col gap-6">
          {topLevel.map(item => (
            item.type === 'section' 
              ? <SectionNode key={item.id} section={item} allTasks={tasks} isLockedForEdit={isLockedForEdit} settings={settings} />
              : <TaskNode key={item.id} task={item} isLockedForEdit={isLockedForEdit} settings={settings} />
          ))}
        </Reorder.Group>

        {!isLockedForEdit && (
          <div className="mt-8 flex items-center gap-4">
            <button onClick={() => db.tasks.add({ id: uuidv4(), subjectId, parentId: null, type: 'task', title: '', description: '', notes: '', completed: false, order: tasks.length })} className="flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] hover:text-white px-4 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-full shadow-sm hover:shadow-md transition-all">
              <Plus size={16} /> Add Task
            </button>
            <button onClick={() => db.tasks.add({ id: uuidv4(), subjectId, parentId: null, type: 'section', title: '', description: '', notes: '', completed: false, order: tasks.length })} className="flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] px-4 py-2 border border-transparent hover:border-[hsl(var(--primary)/0.3)] rounded-full transition-all">
              <Plus size={16} /> Add Section
            </button>
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}

function SectionNode({ section, allTasks, isLockedForEdit, level = 0, settings }: any) {
  const children = allTasks.filter((t:any) => t.parentId === section.id).sort((a:any, b:any) => a.order - b.order);
  const [title, setTitle] = useState(section.title);
  const [isExpanded, setIsExpanded] = useState(false);

  // recursively get all descendant tasks
  const getDescendantTasks = (parentId: string): any[] => {
    let result: any[] = [];
    const directChildren = allTasks.filter((t:any) => t.parentId === parentId);
    for (const child of directChildren) {
      if (child.type === 'task') {
        result.push(child);
      } else if (child.type === 'section') {
        result = result.concat(getDescendantTasks(child.id));
      }
    }
    return result;
  };

  const descendantTasks = getDescendantTasks(section.id);
  const completedCount = descendantTasks.filter((t:any) => t.completed).length;
  const totalCount = descendantTasks.length;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Reorder.Item value={section} dragListener={!isLockedForEdit} className={`flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl mb-4 overflow-hidden ${level > 0 ? 'ml-6 border-l-2 border-l-[hsl(var(--primary)/0.5)]' : ''}`}>
      <div 
        className="flex items-center gap-3 p-4 group cursor-pointer hover:bg-[hsl(var(--muted)/0.3)] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        
        {!isLockedForEdit && <div className="text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 cursor-grab" onClick={e => e.stopPropagation()}><GripVertical size={16}/></div>}
        
        <input 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          onBlur={() => db.tasks.update(section.id, { title })} 
          readOnly={isLockedForEdit}
          onClick={e => e.stopPropagation()}
          placeholder={level === 0 ? "Section Name" : "Subsection Name"}
          className="text-base font-semibold bg-transparent border-none outline-none text-[hsl(var(--foreground))] flex-1"
        />

        <div className="flex items-center gap-4 ml-auto" onClick={e => e.stopPropagation()}>
          <div className="w-24 md:w-32 h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden hidden sm:block">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} className="bg-[hsl(var(--primary))] h-full rounded-full" />
          </div>
          <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] whitespace-nowrap min-w-[3rem] text-right">
            {completedCount} / {totalCount}
          </span>
          {!isLockedForEdit && <button onClick={() => db.tasks.delete(section.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"><Trash2 size={14}/></button>}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[hsl(var(--border))]"
          >
            <div className="p-4 flex flex-col gap-2 relative">
              <Reorder.Group axis="y" values={children} onReorder={(newOrder) => {
                if (!isLockedForEdit) newOrder.forEach((t, i) => db.tasks.update(t.id, { order: i }));
              }}>
                {children.map((child:any) => (
                  child.type === 'section' 
                    ? <SectionNode key={child.id} section={child} allTasks={allTasks} isLockedForEdit={isLockedForEdit} level={level + 1} settings={settings} />
                    : <TaskNode key={child.id} task={child} isLockedForEdit={isLockedForEdit} settings={settings} />
                ))}
              </Reorder.Group>
              
              {!isLockedForEdit && (
                <div className="flex items-center gap-2 mt-1">
                  {level === 0 && (
                    <button onClick={() => db.tasks.add({ id: uuidv4(), subjectId: section.subjectId, parentId: section.id, type: 'section', title: '', description: '', notes: '', completed: false, order: children.length })} className="text-[hsl(var(--muted-foreground))] text-sm py-2 px-3 hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-lg text-left flex items-center gap-2 transition-colors w-max">
                      <Plus size={14} /> Add subsection
                    </button>
                  )}
                  <button onClick={() => db.tasks.add({ id: uuidv4(), subjectId: section.subjectId, parentId: section.id, type: 'task', title: '', description: '', notes: '', completed: false, tags: [], order: children.length })} className="text-[hsl(var(--muted-foreground))] text-sm py-2 px-3 hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-lg text-left flex items-center gap-2 transition-colors w-max">
                    <Plus size={14} /> Add task
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

function TaskNode({ task, isLockedForEdit, settings }: any) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const completed = task.completed;
  const tags = task.tags || [];

  const toggleCompleted = () => {
    const newCompleted = !completed;
    db.tasks.update(task.id, { 
      completed: newCompleted,
      finishedAt: newCompleted ? new Date().toISOString() : null
    });
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim() !== '') {
      const newTags = [...tags, tagInput.trim()];
      db.tasks.update(task.id, { tags: newTags });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag: string) => tag !== tagToRemove);
    db.tasks.update(task.id, { tags: newTags });
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString(undefined, { 
      month: 'short', day: 'numeric', 
      hour: 'numeric', minute: '2-digit' 
    });
  };

  const checkmarkStyle = settings?.checkmarkStyle || 'circle';

  let CheckIcon = Circle;
  let CheckedIcon = CheckCircle2;

  if (checkmarkStyle === 'rounded-square') {
    CheckIcon = Square;
    CheckedIcon = CheckSquare;
  } else if (checkmarkStyle === 'square') {
    CheckIcon = () => <div className="w-[18px] h-[18px] border-[1.5px] border-current" />;
    CheckedIcon = () => (
      <div className="w-[18px] h-[18px] border-[1.5px] border-current bg-current flex items-center justify-center relative">
        <Check size={12} className="text-[hsl(var(--background))] absolute" strokeWidth={3} />
      </div>
    );
  } else if (checkmarkStyle === 'minimalist') {
    CheckIcon = () => <div className="w-[18px] h-[18px] border-b-2 border-[hsl(var(--muted-foreground)/0.3)] transition-colors hover:border-current" />;
    CheckedIcon = () => <Check size={18} strokeWidth={2.5} className="text-[hsl(var(--primary))]" />;
  }

  return (
    <Reorder.Item value={task} dragListener={!isLockedForEdit} className={`flex flex-col rounded-xl mb-2 border ${isExpanded ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))]' : 'border-transparent hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)]'} transition-colors ${completed ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3 p-3 group">
        {!isLockedForEdit && <div className="mt-1.5 cursor-grab text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100"><GripVertical size={14}/></div>}
        
        <button onClick={toggleCompleted} className="mt-1.5 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors flex items-center justify-center w-[18px] h-[18px]">
          {completed ? 
            (checkmarkStyle === 'square' || checkmarkStyle === 'minimalist' ? <CheckedIcon /> : <CheckedIcon size={18} className="text-[hsl(var(--primary))]" />) : 
            (checkmarkStyle === 'square' || checkmarkStyle === 'minimalist' ? <CheckIcon /> : <CheckIcon size={18} />)
          }
        </button>

        <div className="flex-1 flex flex-col pt-1">
          <input 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            onBlur={() => db.tasks.update(task.id, { title })} 
            readOnly={isLockedForEdit}
            placeholder="Task title" 
            className={`bg-transparent border-none outline-none font-medium text-sm flex-1 ${completed ? 'line-through text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}
          />
          {/* Quick info row if not expanded */}
          {!isExpanded && (tags.length > 0 || completed) && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {tags.map((tag: string, idx: number) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] font-medium uppercase tracking-wider">{tag}</span>
              ))}
              {completed && task.finishedAt && (
                <span className="text-[10px] flex items-center gap-1 text-[hsl(var(--muted-foreground))]"><Calendar size={10} /> {formatDate(task.finishedAt)}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 shrink-0">
          {!isLockedForEdit && <button onClick={() => db.tasks.delete(task.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"><Trash2 size={14}/></button>}
          <button onClick={() => setIsExpanded(!isExpanded)} className={`p-1 rounded-md transition-colors ${isExpanded || description || tags.length > 0 ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100'}`}>
             {isExpanded ? <ChevronDown size={16} /> : <AlignLeft size={16} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[hsl(var(--border))]">
            <div className="p-4 pl-10 sm:pl-12 flex flex-col gap-4">
              
              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-1.5"><AlignLeft size={14} /> Description</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  onBlur={() => db.tasks.update(task.id, { description })}
                  readOnly={isLockedForEdit}
                  placeholder="Add details about this task..."
                  className="w-full min-h-[60px] bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg p-2.5 text-sm resize-y outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                />
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-1.5"><Tag size={14} /> Tags</label>
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((tag: string, idx: number) => (
                    <span key={idx} className="text-[11px] px-2 py-1 rounded-md bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] font-medium flex items-center gap-1">
                      {tag}
                      {!isLockedForEdit && <X size={12} className="cursor-pointer hover:text-[hsl(var(--foreground))]" onClick={() => removeTag(tag)} />}
                    </span>
                  ))}
                  {!isLockedForEdit && (
                    <input 
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                      placeholder="Add tag and press Enter..."
                      className="bg-transparent border border-[hsl(var(--border))] rounded-md px-2 py-1 flex-1 min-w-[120px] text-xs outline-none focus:border-[hsl(var(--primary))]"
                    />
                  )}
                </div>
              </div>

              {/* Completion Date */}
              {completed && task.finishedAt && (
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] font-medium border-t border-[hsl(var(--border))] pt-3 mt-1">
                  <Calendar size={14} /> Completed on {formatDate(task.finishedAt)}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </Reorder.Item>
  );
}
