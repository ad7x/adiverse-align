import React, { useState, useRef, useEffect, useCallback } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import {
  MoreHorizontal, Plus, GripVertical, Trash2, ChevronRight,
  Info, Upload, Copy, ChevronDown, Calendar, Tag, AlignLeft, X,
  MoreVertical, Bot, Youtube, Lock, Unlock, Download, FileJson, Edit3, FileText
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useMotionValue, useSpring, useMotionTemplate, useDragControls } from 'framer-motion';
import { PremiumCheckbox } from '../ui/PremiumCheckbox';
import { RichEditor } from '../ui/RichEditor';
import { SmartCloneModal, type CloneOption } from './SmartCloneModal';
import { YouTubeImportModal, type YoutubeImportMode } from './YouTubeImportModal';
import { exportSubjectZip, importSubjectZip, exportSubjectJSON } from '../../lib/zip';
import { useUIStore } from '../../store';
import { cn } from '../../lib/utils';

// ─── Main SubjectView ────────────────────────────────────────────────

export function SubjectView({ subjectId, highlightId }: { subjectId: string; highlightId?: string }) {
  const subject = useLiveQuery(() => db.subjects.get(subjectId), [subjectId]);
  const categories = useLiveQuery(() => db.categories.toArray());
  const domains = useLiveQuery(() => db.domains.toArray());
  const rawTasks = useLiveQuery(() => db.tasks.where('subjectId').equals(subjectId).toArray(), [subjectId]);
  const instances = useLiveQuery(() => db.subjectInstances.where('subjectId').equals(subjectId).sortBy('createdAt'), [subjectId]);
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const { expandedSections, toggleSection } = useUIStore();

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'upload'>('paste');
  const [showAiGuide, setShowAiGuide] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetInstanceConfirm, setResetInstanceConfirm] = useState('');
  const [showDeleteSubjectModal, setShowDeleteSubjectModal] = useState(false);
  const [deleteSubjectConfirm, setDeleteSubjectConfirm] = useState('');
  const [showExportWarning, setShowExportWarning] = useState<{ action: 'copy' | 'download' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mouse gradient
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 20 });
  const backgroundTemplate = useMotionTemplate`radial-gradient(circle 600px at ${smoothX}px ${smoothY}px, hsl(var(--primary) / 0.08), transparent 80%)`;

  // When instances load, select the most recent one
  useEffect(() => {
    if (instances && instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[instances.length - 1].id);
    }
    // If the selected instance was deleted, reset
    if (instances && selectedInstanceId && !instances.find(i => i.id === selectedInstanceId)) {
      setSelectedInstanceId(instances.length > 0 ? instances[instances.length - 1].id : null);
    }
  }, [instances, selectedInstanceId]);

  // Filter tasks to current instance
  useEffect(() => {
    if (rawTasks && selectedInstanceId) {
      setTasks([...rawTasks.filter(t => t.instanceId === selectedInstanceId)].sort((a, b) => a.order - b.order));
    } else {
      setTasks([]);
    }
  }, [rawTasks, selectedInstanceId]);

  // Close menu on outside click
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowExportMenu(false);
        setShowImportMenu(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('pointerdown', close);
      return () => document.removeEventListener('pointerdown', close);
    }
  }, [menuOpen]);

  // Reset export/import submenus when menu closes
  useEffect(() => {
    if (!menuOpen) {
      setShowExportMenu(false);
      setShowImportMenu(false);
    }
  }, [menuOpen]);

  // Reset expanded tasks when leaving this subject page or when subject changes
  useEffect(() => {
    return () => {
      useUIStore.setState((state) => ({
        expandedTasks: {
          ...state.expandedTasks,
          [subjectId]: {}
        }
      }));
    };
  }, [subjectId]);

  // Computed values
  const subjectViewLock = subject?.isLocked || false;
  const isStructureLocked = subjectViewLock;

  const toggleSubjectLock = async () => {
    if (subject) await db.subjects.update(subjectId, { isLocked: !subject.isLocked });
    setMenuOpen(false);
  };

  // ─── Instance management ───────────────────────────────────────

  const handleConfirmClone = async (name: string, option: CloneOption) => {
    setIsCloneModalOpen(false);
    const newInstanceId = uuidv4();
    await db.subjectInstances.add({
      id: newInstanceId, subjectId, name,
      createdAt: new Date().toISOString(), order: instances ? instances.length : 0
    });

    if (option !== 'empty_fresh' && selectedInstanceId) {
      const currentTasks = await db.tasks.where('subjectId').equals(subjectId).toArray();
      const currentInstanceTasks = currentTasks.filter(t => t.instanceId === selectedInstanceId);
      const idMap = new Map<string, string>();
      for (const t of currentInstanceTasks) idMap.set(t.id, uuidv4());

      const clonedTasks = currentInstanceTasks.map(t => ({
        ...t,
        id: idMap.get(t.id)!,
        instanceId: newInstanceId,
        parentId: t.parentId ? idMap.get(t.parentId) || null : null,
        completed: option.includes('completion') ? false : t.completed,
        completedAt: option.includes('completion') ? null : t.completedAt,
        notes: option.includes('notes') ? '' : t.notes,
        description: option.includes('descriptions') ? '' : t.description,
        tags: option === 'completion_notes_descriptions_tags' ? [] : t.tags
      }));

      await db.tasks.bulkAdd(clonedTasks);
    }
    setSelectedInstanceId(newInstanceId);
  };

  const handleRenameInstance = async () => {
    if (!selectedInstanceId) return;
    const inst = instances?.find(i => i.id === selectedInstanceId);
    if (!inst) return;
    const name = prompt("Rename instance:", inst.name);
    if (!name?.trim()) return;
    await db.subjectInstances.update(selectedInstanceId, { name: name.trim() });
    setMenuOpen(false);
  };

  const handleDeleteInstance = async () => {
    if (!selectedInstanceId || !instances) return;

    if (instances.length > 1) {
      if (confirm(`Delete instance '${instances.find(i => i.id === selectedInstanceId)?.name}'? All tasks and progress for this instance will be deleted.`)) {
        await db.tasks.where('instanceId').equals(selectedInstanceId).delete();
        await db.subjectInstances.delete(selectedInstanceId);
        setSelectedInstanceId(null);
        setMenuOpen(false);
      }
    } else {
      // Only one instance → require explicit "DELETE SUBJECT" confirmation
      setShowDeleteSubjectModal(true);
      setMenuOpen(false);
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (deleteSubjectConfirm !== 'DELETE SUBJECT') return;
    // Delete all tasks, instances, then the subject
    await db.tasks.where('subjectId').equals(subjectId).delete();
    const allInstances = await db.subjectInstances.where('subjectId').equals(subjectId).toArray();
    for (const inst of allInstances) await db.subjectInstances.delete(inst.id);
    await db.subjects.delete(subjectId);
    setShowDeleteSubjectModal(false);
    setDeleteSubjectConfirm('');
  };

  const handleResetInstance = async () => {
    if (resetInstanceConfirm !== 'I agree to reset this instance') return;
    if (selectedInstanceId) {
      const toUpdate = await db.tasks.where('instanceId').equals(selectedInstanceId).toArray();
      for (const t of toUpdate) {
        t.completed = false;
        t.completedAt = null;
        if (t.completionCount) t.completionCount = 0;
      }
      await db.tasks.bulkPut(toUpdate);
    }
    setShowResetModal(false);
    setResetInstanceConfirm('');
    setMenuOpen(false);
  };

  // ─── Export ────────────────────────────────────────────────────

  const handleCopyJSON = () => {
    setShowExportWarning({ action: 'copy' });
    setMenuOpen(false);
  };

  const handleDownloadJSON = () => {
    setShowExportWarning({ action: 'download' });
    setMenuOpen(false);
  };

  const handleCopyJSONDirect = async () => {
    const confirm = window.confirm("Quick JSON export/import excludes advanced notes, media, and images. Do you want to proceed with copy?");
    if (!confirm) return;
    const allTasks = await db.tasks.where('subjectId').equals(subjectId).toArray();
    const currentInstanceTasks = selectedInstanceId 
      ? allTasks.filter(t => t.instanceId === selectedInstanceId).sort((a, b) => a.order - b.order)
      : allTasks.sort((a, b) => a.order - b.order);
    const json = exportSubjectJSON(subject, currentInstanceTasks);
    try {
      await navigator.clipboard.writeText(json);
      showToast('JSON copied to clipboard');
    } catch { /* clipboard not available */ }
  };

  const handleDownloadJSONDirect = async () => {
    const confirm = window.confirm("Quick JSON export/import excludes advanced notes, media, and images. Do you want to proceed with download?");
    if (!confirm) return;
    const allTasks = await db.tasks.where('subjectId').equals(subjectId).toArray();
    const currentInstanceTasks = selectedInstanceId 
      ? allTasks.filter(t => t.instanceId === selectedInstanceId).sort((a, b) => a.order - b.order)
      : allTasks.sort((a, b) => a.order - b.order);
    const json = exportSubjectJSON(subject, currentInstanceTasks);
    downloadBlob(new Blob([json], { type: 'application/json' }), `${slugify(subject?.title)}.json`);
  };

  const handleDownloadZIP = async () => {
    try {
      const blob = await exportSubjectZip(subjectId, selectedInstanceId);
      downloadBlob(blob, `${slugify(subject?.title)}-export.zip`);
    } catch { showToast('Failed to export ZIP', true); }
    setMenuOpen(false);
  };

  // ─── Import ────────────────────────────────────────────────────

  const processImport = async (jsonStr: string, isZipImport = false) => {
    if (!isZipImport) {
      const confirm = window.confirm("Quick JSON export/import excludes advanced notes, media, and images. Do you want to proceed with import?");
      if (!confirm) return;
    }
    try {
      let data = JSON.parse(jsonStr);
      if (Array.isArray(data)) {
        data = { sections: data };
      }

      let globalOrder = tasks.length;
      const tasksToAdd: any[] = [];

      // Detect flat formats where data.tasks contains DB-dump flat tasks without nesting
      const isFlatImport = data.tasks && Array.isArray(data.tasks) && data.tasks.every((t: any) => !t.sections && !t.subsections && !t.tasks);

      if (isFlatImport) {
        const idMap: { [oldId: string]: string } = {};
        for (const t of data.tasks) {
          if (t.id) {
            idMap[t.id] = uuidv4();
          }
        }

        for (const t of data.tasks) {
          const newId = t.id ? (idMap[t.id] || uuidv4()) : uuidv4();
          const newParentId = t.parentId ? (idMap[t.parentId] || null) : null;
          const descMarkdown = t.descriptionMarkdown || t.description || '';
          const taskObj = {
            ...t,
            id: newId,
            subjectId,
            instanceId: selectedInstanceId,
            parentId: newParentId,
            type: t.type || 'task',
            title: t.title || 'Untitled Task',
            descriptionMarkdown: descMarkdown,
            completed: t.completed || false,
            order: globalOrder++
          };
          delete taskObj.tasks;
          delete taskObj.children;
          delete taskObj.subsections;
          delete taskObj.sections;
          delete taskObj.description;
          if (!isZipImport) {
            delete taskObj.notesRich;
          }
          tasksToAdd.push(taskObj);
        }
      } else {
        const importSection = (sec: any, parentId: string | null = null) => {
          const sectionId = uuidv4();
          const descMarkdown = sec.descriptionMarkdown || sec.description || '';
          const taskObj = {
            ...sec,
            id: sectionId,
            subjectId,
            instanceId: selectedInstanceId,
            parentId,
            type: sec.type || 'section',
            title: sec.title || 'Untitled Section',
            descriptionMarkdown: descMarkdown,
            completed: sec.completed || false,
            order: globalOrder++
          };
          delete taskObj.tasks;
          delete taskObj.children;
          delete taskObj.subsections;
          delete taskObj.sections;
          delete taskObj.description;
          if (!isZipImport) {
            delete taskObj.notesRich;
          }
          tasksToAdd.push(taskObj);

          for (const ct of (sec.tasks || sec.children || [])) {
            const taskDescMarkdown = ct.descriptionMarkdown || ct.description || '';
            const subTaskObj = {
              ...ct,
              id: uuidv4(),
              subjectId,
              instanceId: selectedInstanceId,
              parentId: sectionId,
              type: ct.type || 'task',
              title: ct.title || 'Untitled Task',
              descriptionMarkdown: taskDescMarkdown,
              completed: ct.completed || false,
              order: globalOrder++
            };
            delete subTaskObj.tasks;
            delete subTaskObj.children;
            delete subTaskObj.subsections;
            delete subTaskObj.sections;
            delete subTaskObj.description;
            if (!isZipImport) {
              delete subTaskObj.notesRich;
            }
            tasksToAdd.push(subTaskObj);
          }
          for (const subsec of (sec.subsections || [])) {
            importSection(subsec, sectionId);
          }
        };

        if (data.sections && Array.isArray(data.sections)) {
          for (const sec of data.sections) importSection(sec, null);
        }
        if (data.tasks && Array.isArray(data.tasks)) {
          for (const pt of data.tasks) {
            if (pt.sections || pt.subsections || pt.tasks || pt.children) {
              importSection(pt, null);
            } else {
              const taskDescMarkdown = pt.descriptionMarkdown || pt.description || '';
              const flatTaskObj = {
                ...pt,
                id: uuidv4(),
                subjectId,
                instanceId: selectedInstanceId,
                parentId: null,
                type: pt.type || 'task',
                title: pt.title || 'Untitled Task',
                descriptionMarkdown: taskDescMarkdown,
                completed: pt.completed || false,
                order: globalOrder++
              };
              delete flatTaskObj.tasks;
              delete flatTaskObj.children;
              delete flatTaskObj.subsections;
              delete flatTaskObj.sections;
              delete flatTaskObj.description;
              if (!isZipImport) {
                delete flatTaskObj.notesRich;
              }
              tasksToAdd.push(flatTaskObj);
            }
          }
        }
      }

      if (tasksToAdd.length > 0) await db.tasks.bulkAdd(tasksToAdd);
      setIsImportModalOpen(false);
      setPasteData('');
    } catch {
      showToast('Invalid JSON format. Please check your data.', true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.zip')) {
      try {
        const data = await importSubjectZip(file);
        if (data.tasks) processImport(JSON.stringify({ tasks: data.tasks }), true);
      } catch { showToast('Failed to parse ZIP.', true); }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => processImport(event.target?.result as string, false);
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── YouTube import ────────────────────────────────────────────

  const handleYoutubeImport = async (playlist: any, mode: YoutubeImportMode) => {
    let globalOrder = tasks.length;
    const tasksToAdd: any[] = [];

    if (mode === 'new_section') {
      const sectionId = uuidv4();
      tasksToAdd.push({
        id: sectionId, subjectId, instanceId: selectedInstanceId, parentId: null, type: 'section',
        title: playlist.title || 'YouTube Playlist', description: '', notes: '', completed: false, order: globalOrder++
      });
      for (const video of playlist.videos) {
        tasksToAdd.push({
          id: uuidv4(), subjectId, instanceId: selectedInstanceId, parentId: sectionId, type: 'youtube',
          title: video.title, description: '', notes: '', completed: false, order: globalOrder++,
          youtubeUrl: video.url, videoId: video.videoId, thumbnail: video.thumbnail, duration: video.duration
        });
      }
    } else {
      for (const video of playlist.videos) {
        tasksToAdd.push({
          id: uuidv4(), subjectId, instanceId: selectedInstanceId, parentId: null, type: 'youtube',
          title: video.title, description: '', notes: '', completed: false, order: globalOrder++,
          youtubeUrl: video.url, videoId: video.videoId, thumbnail: video.thumbnail, duration: video.duration
        });
      }
    }

    if (tasksToAdd.length > 0) await db.tasks.bulkAdd(tasksToAdd);
    setIsYoutubeModalOpen(false);
  };

  // ─── AI Prompt ─────────────────────────────────────────────────

  const fullPromptText = `Generate a VALID JSON checklist for my study tracker app.

STRICT RULES:

Return ONLY raw JSON.
Do NOT include markdown formatting wrappers (no \`\`\`json).
Do NOT explain anything.

JSON structure must EXACTLY follow this schema:

{
  "sections": [
    {
      "title": "Section Name",
      "description": "Section description in Markdown format (optional)",
      "tags": ["tag1", "tag2"],
      "subsections": [
        {
          "title": "Subsection Name",
          "description": "Subsection description in Markdown format (optional)",
          "tags": ["tag3"],
          "tasks": [
            { "title": "Task name", "completed": false, "description": "Task description in Markdown format (optional)", "tags": ["tag4"] }
          ]
        }
      ],
      "tasks": [
        { "title": "Task name", "completed": false, "description": "Task description in Markdown format (optional)", "tags": ["tag5"] }
      ]
    }
  ],
  "tasks": [
    { "title": "Root level flat task name", "completed": false, "description": "Task description in Markdown format (optional)", "tags": ["tag6"] }
  ]
}

REQUIREMENTS:
- Group related topics into sections
- Use subsections when useful
- Keep titles concise but descriptive
- completed must always be false
- description fields are optional but must use Markdown formatting (bold, italic, list items, etc.) if provided
- tags fields are optional list of tags
- JSON must be syntactically valid`;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fullPromptText);
      showToast('Prompt copied to clipboard');
    } catch { /* ignore */ }
  };

  // ─── Cascade section delete ────────────────────────────────────

  const cascadeDeleteSection = useCallback(async (sectionId: string) => {
    const children = await db.tasks.where('parentId').equals(sectionId).toArray();
    for (const child of children) {
      if (child.type === 'section') await cascadeDeleteSection(child.id);
      else await db.tasks.delete(child.id);
    }
    await db.tasks.delete(sectionId);
  }, []);

  // ─── Render gate ───────────────────────────────────────────────

  if (!subject || !categories || !domains) return null;

  const domain = domains.find(d => d.id === subject.domainId);
  const category = categories.find(c => c.id === domain?.categoryId);

  const completed = tasks.filter(t => (t.type === 'task' || t.type === 'youtube') && t.completed).length;
  const total = tasks.filter(t => t.type === 'task' || t.type === 'youtube').length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const topLevel = tasks.filter(t => !t.parentId);

  return (
    <div className="h-full relative overflow-hidden flex flex-col bg-[hsl(var(--background))]" onMouseMove={e => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    }}>
      <motion.div className="pointer-events-none absolute inset-0 z-0 opacity-50 dark:opacity-30" style={{ background: backgroundTemplate }} />

      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 w-full p-4 sm:p-8 md:p-12">
        <div className="max-w-5xl mx-auto flex flex-col min-h-full">

          {/* ─── Header card ──────────────────────────────────────── */}
          <div className="bg-[hsl(var(--foreground)/0.02)] backdrop-blur-3xl border border-[hsl(var(--border))] rounded-[32px] p-8 md:p-10 relative z-30 shadow-sm mb-10">

            {/* Breadcrumb + menu */}
            <div className="flex items-center justify-between mb-8 z-30 relative">
              <div className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.15em]">
                {category?.title} / {domain?.title} / <span className="text-[hsl(var(--foreground))]">{subject.title}</span>
              </div>

              <div ref={menuRef} className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 -mr-2 rounded-full hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))]">
                  <MoreHorizontal size={24} />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-12 w-56 bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-2xl rounded-xl z-50 flex flex-col p-1.5 backdrop-blur-md"
                    >
                      {!showExportMenu && !showImportMenu ? (
                        <>
                          <MenuBtn onClick={() => setShowExportMenu(true)}>Export <ChevronRight size={14} /></MenuBtn>
                          <MenuBtn onClick={() => setShowImportMenu(true)} disabled={isStructureLocked}>Import <ChevronRight size={14} /></MenuBtn>
                          <MenuBtn onClick={toggleSubjectLock} icon={subjectViewLock ? <Unlock size={14} /> : <Lock size={14} />}>
                            {subjectViewLock ? "Unlock View" : "Lock View"}
                          </MenuBtn>

                          <div className="h-[1px] bg-[hsl(var(--border))] my-1" />
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] px-2 py-1">Instances</div>

                          <MenuBtn onClick={() => { setIsCloneModalOpen(true); setMenuOpen(false); }} disabled={isStructureLocked} icon={<Plus size={14} />}>
                            Create New Instance
                          </MenuBtn>

                          {instances && instances.length > 0 && (
                            <div className="px-1 py-1">
                              <select
                                value={selectedInstanceId || ''}
                                onChange={e => { setSelectedInstanceId(e.target.value); setMenuOpen(false); }}
                                className="w-full p-2 text-[13px] font-medium rounded-md bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] outline-none cursor-pointer text-[hsl(var(--foreground))]"
                              >
                                {instances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                              </select>
                            </div>
                          )}

                          <MenuBtn onClick={handleRenameInstance} disabled={isStructureLocked}>Rename Instance</MenuBtn>
                          <MenuBtn onClick={() => { setShowResetModal(true); setMenuOpen(false); }} className="text-orange-500 hover:bg-orange-500/10">
                            Reset Progress
                          </MenuBtn>
                          <MenuBtn onClick={handleDeleteInstance} disabled={isStructureLocked} className="text-red-500 hover:bg-red-500/10" icon={<Trash2 size={14} />}>
                            Delete Instance
                          </MenuBtn>
                        </>
                      ) : showExportMenu ? (
                        <>
                          <MenuBtn onClick={() => setShowExportMenu(false)} icon={<ChevronRight size={12} className="rotate-180" />}>Back</MenuBtn>
                          <MenuBtn onClick={handleCopyJSON} icon={<Copy size={14} />}>Copy JSON</MenuBtn>
                          <MenuBtn onClick={handleDownloadJSON} icon={<FileJson size={14} />}>Download JSON</MenuBtn>
                          <MenuBtn onClick={handleDownloadZIP} icon={<Download size={14} />} className="text-[hsl(var(--primary))]">Download ZIP</MenuBtn>
                        </>
                      ) : (
                        <>
                          <MenuBtn onClick={() => setShowImportMenu(false)} icon={<ChevronRight size={12} className="rotate-180" />}>Back</MenuBtn>
                          <MenuBtn onClick={() => { setIsImportModalOpen(true); setMenuOpen(false); }} icon={<FileJson size={14} />}>JSON / ZIP File</MenuBtn>
                          <MenuBtn onClick={() => { setIsYoutubeModalOpen(true); setMenuOpen(false); }} icon={<Youtube size={14} className="text-red-500" />}>YouTube Playlist</MenuBtn>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Title */}
            <div className="mb-12 z-10 relative">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">{subject.title}</h1>
            </div>

            {/* Progress + instance badge */}
            <div className="flex flex-col md:flex-row md:items-end justify-between z-10 relative gap-8 md:gap-0 mt-4">
              <div className="flex items-center gap-5">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path className="text-[hsl(var(--muted))]" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <motion.path className="text-[hsl(var(--primary))]" strokeWidth="3" strokeDasharray={`${progress}, 100`} stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" initial={{ strokeDasharray: "0, 100" }} animate={{ strokeDasharray: `${progress}, 100` }} />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-lg text-[hsl(var(--foreground))]">Overall Progress</span>
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{completed} / {total} tasks</span>
                  {instances && instances.length > 1 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] mt-1 w-fit">
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-[hsl(var(--primary))]">{instances.find(i => i.id === selectedInstanceId)?.name}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-5xl lg:text-7xl font-black tracking-tighter text-[hsl(var(--primary)/0.2)] leading-none">{progress}%</div>
            </div>
          </div>

          {/* ─── Task List ────────────────────────────────────────── */}
          <div className="flex-1 pb-20">
            <Reorder.Group axis="y" values={topLevel.map(t => t.id)} onReorder={(newOrderIds) => {
              if (!isStructureLocked) newOrderIds.forEach((id, i) => db.tasks.update(id, { order: i }));
            }} className="flex flex-col gap-6">
              {topLevel.map(item =>
                item.type === 'section'
                  ? <SectionNode key={item.id} section={item} allTasks={tasks} isStructureLocked={isStructureLocked} settings={settings} subjectId={subjectId} expandedSections={expandedSections} toggleSection={toggleSection} onCascadeDelete={cascadeDeleteSection} />
                  : <TaskNode key={item.id} task={item} isStructureLocked={isStructureLocked} settings={settings} subjectId={subjectId} />
              )}
            </Reorder.Group>

            <div className="mt-8 flex items-center gap-4 flex-wrap">
              <button onClick={() => db.tasks.add({ id: uuidv4(), subjectId, instanceId: selectedInstanceId, parentId: null, type: 'task', title: '', descriptionMarkdown: '', completed: false, order: tasks.length })} className="flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] px-4 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-full shadow-sm hover:shadow-md transition-all">
                <Plus size={16} /> Add Task
              </button>
              <button onClick={() => db.tasks.add({ id: uuidv4(), subjectId, instanceId: selectedInstanceId, parentId: null, type: 'section', title: '', descriptionMarkdown: '', completed: false, order: tasks.length })} className="flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] px-4 py-2 border border-transparent hover:border-[hsl(var(--primary)/0.3)] rounded-full transition-all">
                <Plus size={16} /> Add Section
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modals ───────────────────────────────────────────────── */}
      <SmartCloneModal isOpen={isCloneModalOpen} onClose={() => setIsCloneModalOpen(false)} onConfirm={handleConfirmClone} />
      <YouTubeImportModal isOpen={isYoutubeModalOpen} onClose={() => setIsYoutubeModalOpen(false)} onImport={handleYoutubeImport} />

      {/* Import modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsImportModalOpen(false)} onKeyDown={e => { if (e.key === 'Escape') setIsImportModalOpen(false); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
              {!showAiGuide && <button onClick={() => setIsImportModalOpen(false)} className="absolute top-4 right-4 z-10 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1"><X size={18} /></button>}

              {showAiGuide ? (
                <div className="p-6 flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-[hsl(var(--primary))]"><Bot size={20} /> AI Import Guide</h2>
                    <button onClick={() => setShowAiGuide(false)} className="text-sm font-semibold hover:text-[hsl(var(--primary))] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Back</button>
                  </div>
                  <p className="text-sm mb-4 text-[hsl(var(--muted-foreground))]">Use this prompt in any AI chatbot to generate checklist JSON.</p>
                  <div className="relative flex-1 overflow-hidden bg-black/80 rounded-xl border border-[hsl(var(--border))] flex flex-col">
                    <button onClick={handleCopyPrompt} className="absolute top-2 right-2 z-10 p-2 text-gray-400 hover:bg-white/10 hover:text-white rounded-md" title="Copy Prompt"><Copy size={16} /></button>
                    <div className="flex-1 p-5 pt-10 text-[12px] leading-relaxed font-mono overflow-y-auto text-gray-300 whitespace-pre-wrap custom-scrollbar">{fullPromptText}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                    <div className="flex space-x-4">
                      <button onClick={() => setImportTab('paste')} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${importTab === 'paste' ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Paste JSON</button>
                      <button onClick={() => setImportTab('upload')} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${importTab === 'upload' ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Upload File</button>
                    </div>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                    <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 text-xs flex gap-2">
                      <Info size={16} className="shrink-0 mt-0.5" />
                      <span><strong>Warning:</strong> Quick JSON import excludes advanced notes, media, and images. Use ZIP import for a full backup.</span>
                    </div>
                    {importTab === 'paste' ? (
                      <textarea value={pasteData} onChange={e => setPasteData(e.target.value)} placeholder="Paste subject JSON here..." className="w-full h-48 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm font-mono focus:border-[hsl(var(--primary))] outline-none resize-none text-[hsl(var(--foreground))]" />
                    ) : (
                      <>
                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[hsl(var(--border))] rounded-xl hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                          <Upload size={32} className="text-[hsl(var(--muted-foreground))] mb-4" />
                          <span className="text-sm text-[hsl(var(--muted-foreground))] font-medium">Click to select .json or .zip file</span>
                        </div>
                        <input type="file" accept=".json,.zip" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                      </>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <button onClick={() => setShowAiGuide(true)} className="text-sm font-medium text-[hsl(var(--primary))] hover:underline transition-colors">Need help?</button>
                      {importTab === 'paste' && <button onClick={() => processImport(pasteData)} className="px-5 py-2 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-medium transition-colors">Import</button>}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset modal */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowResetModal(false); setResetInstanceConfirm(''); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-semibold mb-2 text-orange-500">Reset Progress</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">This will reset all task completion for the current instance. Type <strong>I agree to reset this instance</strong> to confirm.</p>
              <input value={resetInstanceConfirm} onChange={e => setResetInstanceConfirm(e.target.value)} placeholder="I agree to reset this instance" className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm focus:border-orange-500 outline-none mb-6 text-[hsl(var(--foreground))]" autoFocus />
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowResetModal(false); setResetInstanceConfirm(''); }} className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium text-[hsl(var(--foreground))]">Cancel</button>
                <button onClick={handleResetInstance} disabled={resetInstanceConfirm !== 'I agree to reset this instance'} className="px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium disabled:opacity-50">Confirm Reset</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete subject modal */}
      <AnimatePresence>
        {showDeleteSubjectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowDeleteSubjectModal(false); setDeleteSubjectConfirm(''); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-semibold mb-2 text-red-500">Delete Subject</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">This is the only instance. Deleting it will permanently delete the entire subject and all its data. Type <strong>DELETE SUBJECT</strong> to confirm.</p>
              <input value={deleteSubjectConfirm} onChange={e => setDeleteSubjectConfirm(e.target.value)} placeholder="DELETE SUBJECT" className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm focus:border-red-500 outline-none mb-6 text-[hsl(var(--foreground))] font-mono" autoFocus />
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowDeleteSubjectModal(false); setDeleteSubjectConfirm(''); }} className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium text-[hsl(var(--foreground))]">Cancel</button>
                <button onClick={handleConfirmDeleteSubject} disabled={deleteSubjectConfirm !== 'DELETE SUBJECT'} className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50">Delete Subject</button>
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
                Quick JSON export excludes advanced notes, images, and media. To keep all content, use the <strong>ZIP export</strong> instead.
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
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function slugify(s?: string) { return (s || 'subject').toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
function showToast(msg: string, isError = false) {
  const t = document.createElement('div');
  t.className = `fixed bottom-8 left-1/2 -translate-x-1/2 ${isError ? 'bg-red-500' : 'bg-[hsl(var(--foreground))]'} text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-2xl z-[9000]`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function MenuBtn({ children, onClick, disabled, className, icon }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string; icon?: React.ReactNode }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`flex items-center gap-2 w-full text-left p-2.5 text-[13px] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50 text-[hsl(var(--foreground))] ${className || ''}`}>
      {icon}{children}
    </button>
  );
}

// ─── SectionNode ─────────────────────────────────────────────────────

function SectionNode({ section, allTasks, isStructureLocked, level = 0, settings, subjectId, expandedSections, toggleSection, onCascadeDelete }: any) {
  const children = allTasks.filter((t: any) => t.parentId === section.id).sort((a: any, b: any) => a.order - b.order);
  const [title, setTitle] = useState(section.title);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);
  const dragControls = useDragControls();

  // Expansion state from store (persisted)
  const isExpanded = expandedSections?.[subjectId]?.[section.id] ?? false;
  const handleToggle = () => toggleSection(subjectId, section.id);

  // Sync title from db
  useEffect(() => { setTitle(section.title); }, [section.title]);

  const getDescendantTasks = (parentId: string): any[] => {
    let result: any[] = [];
    for (const child of allTasks.filter((t: any) => t.parentId === parentId)) {
      if (child.type === 'task' || child.type === 'youtube') result.push(child);
      else result = result.concat(getDescendantTasks(child.id));
    }
    return result;
  };

  const descendants = getDescendantTasks(section.id);
  const completedCount = descendants.filter((t: any) => t.completed).length;
  const totalCount = descendants.length;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  // Description bulk toggle support
  const expandedTasks = useUIStore(state => state.expandedTasks);
  const setMultipleTasksExpanded = useUIStore(state => state.setMultipleTasksExpanded);
  
  const descendantTaskIds = descendants.map((t: any) => t.id);
  const allExpanded = descendantTaskIds.length > 0 && descendantTaskIds.every(id => expandedTasks[subjectId]?.[id]);

  const toggleAllDescendantsExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMultipleTasksExpanded(subjectId, descendantTaskIds, !allExpanded);
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handlePointerDown = () => {
    if (isStructureLocked) return;
    timerRef.current = setTimeout(() => {
      setShowBottomSheet(true);
      if ("vibrate" in navigator) navigator.vibrate(50);
    }, 400);
  };
  const cancelPointer = () => clearTimeout(timerRef.current);

  const duplicateSection = async () => {
    const newSectionId = uuidv4();
    await db.tasks.add({ ...section, id: newSectionId, title: section.title + ' (Copy)', order: section.order + 1 });
    // Shallow copy children
    for (const child of children) {
      await db.tasks.add({ ...child, id: uuidv4(), parentId: newSectionId });
    }
    setShowBottomSheet(false);
  };

  return (
    <Reorder.Item value={section.id} dragListener={false} dragControls={dragControls} onDragStart={() => { if (navigator.vibrate) navigator.vibrate(15); }} className={`flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl mb-4 overflow-hidden ${level > 0 ? 'ml-6 border-l-2 border-l-[hsl(var(--primary)/0.5)]' : ''}`}>
      <div 
        className="flex items-center gap-3 p-4 group cursor-pointer hover:bg-[hsl(var(--muted)/0.3)] transition-colors select-none" 
        onClick={handleToggle}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelPointer}
        onPointerLeave={cancelPointer}
        onPointerCancel={cancelPointer}
        onPointerMove={cancelPointer}
      >
        <div className="text-[hsl(var(--muted-foreground))]">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div>
        {!isStructureLocked && (
          <div 
            className="text-[hsl(var(--muted-foreground))] opacity-60 md:opacity-0 md:group-hover:opacity-100 cursor-grab shrink-0 p-1 -m-1" 
            onClick={e => e.stopPropagation()}
            onPointerDown={e => {
              e.stopPropagation();
              dragControls.start(e, { distanceThreshold: 8 });
            }}
            style={{ touchAction: 'none' }}
          >
            <GripVertical size={16} />
          </div>
        )}
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => db.tasks.update(section.id, { title })}
          readOnly={isStructureLocked}
          onClick={e => {
            if (!isStructureLocked) {
              e.stopPropagation();
            }
          }}
          placeholder={level === 0 ? "Section Name" : "Subsection Name"}
          className="text-base font-semibold bg-transparent border-none outline-none text-[hsl(var(--foreground))] flex-1"
        />
        <div className="flex items-center gap-4 ml-auto" onClick={e => e.stopPropagation()}>
          <div className="w-24 md:w-32 h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden hidden sm:block">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} className="bg-[hsl(var(--primary))] h-full rounded-full" />
          </div>
          <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] whitespace-nowrap min-w-[3rem] text-right">{completedCount} / {totalCount}</span>
          
          {/* Descendants description expand/collapse toggle */}
          {descendantTaskIds.length > 0 && (
            <button 
              onClick={toggleAllDescendantsExpanded} 
              title={allExpanded ? "Collapse all descriptions" : "Expand all descriptions"} 
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1"
            >
              <AlignLeft size={16} className={cn("transition-colors", allExpanded && "text-[hsl(var(--primary))]")} />
            </button>
          )}

          {/* 3-dot dropdown menu */}
          {!isStructureLocked && (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1"
              >
                <MoreVertical size={16} />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }} 
                    exit={{ opacity: 0, scale: 0.95, y: -10 }} 
                    className="absolute right-0 mt-1 w-36 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-50 py-1"
                  >
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowMenu(false); 
                        if (!isStructureLocked) {
                          inputRef.current?.focus(); 
                        }
                      }} 
                      disabled={isStructureLocked} 
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-medium hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50 text-[hsl(var(--foreground))]"
                    >
                      <Edit3 size={14} /> Rename
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowMenu(false); 
                        if (!isStructureLocked) {
                          onCascadeDelete(section.id); 
                        }
                      }} 
                      disabled={isStructureLocked} 
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-medium hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50 text-red-500"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-[hsl(var(--border))]">
            <div className="p-4 flex flex-col gap-2">
              <Reorder.Group axis="y" values={children.map((c: any) => c.id)} onReorder={(newOrderIds) => { if (!isStructureLocked) newOrderIds.forEach((id, i) => db.tasks.update(id, { order: i })); }}>
                {children.map((child: any) =>
                  child.type === 'section'
                    ? <SectionNode key={child.id} section={child} allTasks={allTasks} isStructureLocked={isStructureLocked} level={level + 1} settings={settings} subjectId={subjectId} expandedSections={expandedSections} toggleSection={toggleSection} onCascadeDelete={onCascadeDelete} />
                    : <TaskNode key={child.id} task={child} isStructureLocked={isStructureLocked} settings={settings} subjectId={subjectId} />
                )}
              </Reorder.Group>
              {!isStructureLocked && (
                <div className="flex items-center gap-2 mt-1">
                  {level === 0 && (
                    <button onClick={() => db.tasks.add({ id: uuidv4(), subjectId: section.subjectId, instanceId: section.instanceId, parentId: section.id, type: 'section', title: '', descriptionMarkdown: '', completed: false, order: children.length })} className="text-[hsl(var(--muted-foreground))] text-sm py-2 px-3 hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-lg flex items-center gap-2 transition-colors">
                      <Plus size={14} /> Add subsection
                    </button>
                  )}
                  <button onClick={() => db.tasks.add({ id: uuidv4(), subjectId: section.subjectId, instanceId: section.instanceId, parentId: section.id, type: 'task', title: '', descriptionMarkdown: '', completed: false, tags: [], order: children.length })} className="text-[hsl(var(--muted-foreground))] text-sm py-2 px-3 hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-lg flex items-center gap-2 transition-colors">
                    <Plus size={14} /> Add task
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBottomSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center sm:p-4" onClick={() => setShowBottomSheet(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} className="w-full sm:max-w-md bg-[hsl(var(--card))] border-t sm:border border-[hsl(var(--border))] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden pb-8 sm:pb-0" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-[hsl(var(--border))] rounded-full mx-auto my-3 sm:hidden" />
              <div className="p-4 border-b border-[hsl(var(--border))]">
                <h3 className="font-semibold text-[hsl(var(--foreground))]">{title || 'Section Actions'}</h3>
              </div>
              <div className="p-2 flex flex-col">
                <MenuBtn onClick={() => { setShowBottomSheet(false); if (!isStructureLocked) { inputRef.current?.focus(); } }}>Rename</MenuBtn>
                {!isStructureLocked && (
                  <>
                    <MenuBtn onClick={() => { db.tasks.add({ id: uuidv4(), subjectId: section.subjectId, instanceId: section.instanceId, parentId: section.id, type: 'task', title: '', descriptionMarkdown: '', completed: false, tags: [], order: children.length }); setShowBottomSheet(false); }} icon={<Plus size={16} />}>Add Task</MenuBtn>
                    <MenuBtn onClick={() => { db.tasks.add({ id: uuidv4(), subjectId: section.subjectId, instanceId: section.instanceId, parentId: section.id, type: 'section', title: '', descriptionMarkdown: '', completed: false, order: children.length }); setShowBottomSheet(false); }} icon={<Plus size={16} />}>Add Subsection</MenuBtn>
                    <MenuBtn onClick={duplicateSection} icon={<Copy size={16} />}>Duplicate</MenuBtn>
                    <MenuBtn onClick={() => { onCascadeDelete(section.id); setShowBottomSheet(false); }} className="text-red-500" icon={<Trash2 size={16} />}>Delete</MenuBtn>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

// ─── TaskNode ────────────────────────────────────────────────────────

function TaskNode({ task, isStructureLocked, settings, subjectId }: any) {
  const [title, setTitle] = useState(task.title);
  const [tagInput, setTagInput] = useState('');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const dragControls = useDragControls();
  
  const taskRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const lastTapRef = useRef(0);

  const completed = task.completed;
  const tags = task.tags || [];

  // Expansion state from store (persisted)
  const expandedTasks = useUIStore(state => state.expandedTasks);
  const toggleTaskExpanded = useUIStore(state => state.toggleTaskExpanded);
  const setTaskExpanded = useUIStore(state => state.setTaskExpanded);
  const isExpanded = expandedTasks[subjectId]?.[task.id] ?? false;

  useEffect(() => { setTitle(task.title); }, [task.title]);



  const toggleCompleted = () => {
    const newCompleted = !completed;
    db.tasks.update(task.id, {
      completed: newCompleted,
      completedAt: newCompleted ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      db.tasks.update(task.id, { tags: [...tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    db.tasks.update(task.id, { tags: tags.filter((t: string) => t !== tagToRemove) });
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const checkmarkStyle = settings?.checkmarkStyle || 'modern';

  const handlePointerDown = (e: React.PointerEvent) => {
    // If clicking on interactive elements, do nothing
    const target = e.target as HTMLElement;
    if (
      target.closest('a') ||
      target.closest('button') ||
      target.closest('input[type="checkbox"]') ||
      target.closest('.premium-checkbox') ||
      target.closest('.tag-container') ||
      (!isStructureLocked && target.closest('input'))
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // double tap: only open description, never close it
      if (!isExpanded) {
        setTaskExpanded(subjectId, task.id, true);
      }
      lastTapRef.current = 0;
      cancelPointer();
      return;
    }
    lastTapRef.current = now;
    
    timerRef.current = setTimeout(() => {
      setShowBottomSheet(true);
      if ("vibrate" in navigator) navigator.vibrate(50);
    }, 400);
  };
  const cancelPointer = () => clearTimeout(timerRef.current);

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't toggle on interactive elements
    if (
      target.closest('a') ||
      target.closest('button') ||
      target.closest('input[type="checkbox"]') ||
      target.closest('.premium-checkbox') ||
      target.closest('.tag-container')
    ) {
      return;
    }
    // If already expanded, clicking row should NOT close it
    if (isExpanded) {
      return;
    }
    if (isStructureLocked) {
      setTaskExpanded(subjectId, task.id, true);
    } else {
      // Only toggle if not clicking on the title input
      if (!target.closest('input')) {
        setTaskExpanded(subjectId, task.id, true);
      }
    }
  };

  const duplicateTask = async () => {
    await db.tasks.add({ ...task, id: uuidv4(), title: task.title + ' (Copy)', order: task.order + 1 });
    setShowBottomSheet(false);
  };

  return (
    <Reorder.Item value={task.id} dragListener={false} dragControls={dragControls} onDragStart={() => { if (navigator.vibrate) navigator.vibrate(15); }} className={`flex flex-col rounded-xl mb-2 border ${isExpanded ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))]' : 'border-transparent hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.3)]'} transition-colors ${completed ? 'opacity-70' : ''}`} onPointerDown={e => e.stopPropagation()}>
      <div ref={taskRef} className="flex flex-col">
        <div 
          className="flex items-start gap-3 p-3 group relative select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={cancelPointer}
          onPointerLeave={cancelPointer}
          onPointerCancel={cancelPointer}
          onPointerMove={cancelPointer}
          onClick={handleRowClick}
        >
          {!isStructureLocked && (
            <div 
              className="mt-1.5 cursor-grab text-[hsl(var(--muted-foreground))] opacity-60 md:opacity-0 md:group-hover:opacity-100 shrink-0 p-1 -m-1"
              onClick={e => e.stopPropagation()}
              onPointerDown={e => {
                e.stopPropagation();
                dragControls.start(e, { distanceThreshold: 8 });
              }}
              style={{ touchAction: 'none' }}
            >
              <GripVertical size={14} />
            </div>
          )}

          <div 
            className="mt-1 shrink-0 premium-checkbox p-2 -m-2 select-none"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
            onMouseUp={e => e.stopPropagation()}
          >
            <PremiumCheckbox checked={completed} onChange={toggleCompleted} variant={checkmarkStyle} />
          </div>

          <div className="flex-1 flex flex-col pt-1">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => db.tasks.update(task.id, { title })}
              readOnly={isStructureLocked}
              onClick={e => {
                if (!isStructureLocked) {
                  e.stopPropagation();
                }
              }}
              placeholder="Task title"
              className={`bg-transparent border-none outline-none font-medium text-sm flex-1 ${completed ? 'line-through text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}
            />
            {task.youtubeUrl && (
              <a href={task.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-red-500 hover:underline mt-1 flex items-center gap-1 z-10" onClick={e => e.stopPropagation()}>
                <Youtube size={12} /> Watch Video {task.duration ? `(${Math.round(task.duration / 60)} min)` : ''}
              </a>
            )}
            {!isExpanded && (tags.length > 0 || completed) && (
              <div className="flex flex-wrap items-center gap-2 mt-2 tag-container">
                {tags.map((tag: string, idx: number) => (
                  <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] font-medium uppercase tracking-wider">{tag}</span>
                ))}
                {completed && task.completedAt && (
                  <span className="text-[10px] flex items-center gap-1 text-[hsl(var(--muted-foreground))]"><Calendar size={10} /> {formatDate(task.completedAt)}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 shrink-0 relative z-10">
            {!isStructureLocked && <button onClick={() => db.tasks.delete(task.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 hidden md:block"><Trash2 size={14} /></button>}
            <button 
              onClick={(e) => { e.stopPropagation(); toggleTaskExpanded(subjectId, task.id); }} 
              className={`p-1 rounded-md transition-colors ${isExpanded || tags.length > 0 ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 hidden md:block'}`}
            >
              {isExpanded ? <ChevronDown size={16} /> : <AlignLeft size={16} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[hsl(var(--border))]" onPointerDown={e => e.stopPropagation()}>
              <div className="p-4 pl-10 sm:pl-12 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-1.5"><AlignLeft size={14} /> Description</label>
                  <div className="mt-1">
                    <RichEditor
                      key={task.id + '-desc'}
                      initialContent={task.descriptionMarkdown || ''}
                      onSave={markdownContent => db.tasks.update(task.id, { descriptionMarkdown: markdownContent })}
                      readOnly={false}
                      mode="markdown"
                    />
                  </div>
                </div>

                {task.notesRich ? (
                  <div className="flex flex-col gap-1.5 border-t border-[hsl(var(--border))] pt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
                        <FileText size={14} /> Advanced Notes (Media-Rich)
                      </label>
                      <button
                        onClick={async () => {
                          if (window.confirm("Are you sure you want to delete advanced notes? This will permanently remove all media and images inside them.")) {
                            await db.tasks.update(task.id, { notesRich: null });
                          }
                        }}
                        className="text-xs text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Trash2 size={12} /> Delete Notes
                      </button>
                    </div>
                    <div className="mt-1">
                      <RichEditor
                        key={task.id + '-notes'}
                        initialContent={task.notesRich.content ? JSON.stringify(task.notesRich.content) : ''}
                        onSave={jsonString => {
                          try {
                            const parsed = JSON.parse(jsonString);
                            db.tasks.update(task.id, { notesRich: { type: 'rich', content: parsed } });
                          } catch (e) {
                            console.error('Failed to parse notes Rich editor state', e);
                          }
                        }}
                        readOnly={false}
                        mode="rich"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        db.tasks.update(task.id, { 
                          notesRich: { 
                            type: 'rich', 
                            content: { type: 'doc', content: [{ type: 'paragraph' }] } 
                          } 
                        });
                      }}
                      className="text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.3)] rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
                    >
                      <Plus size={14} /> Add Advanced Notes
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-1.5"><Tag size={14} /> Tags</label>
                  <div className="flex flex-wrap items-center gap-2 tag-container">
                    {tags.map((tag: string, idx: number) => (
                      <span key={idx} className="text-[11px] px-2 py-1 rounded-md bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] font-medium flex items-center gap-1">
                        {tag}
                        {/* tag delete remains allowed when locked */}
                        <X size={12} className="cursor-pointer hover:text-[hsl(var(--foreground))]" onClick={() => removeTag(tag)} />
                      </span>
                    ))}
                    <input data-task-tag-input={task.id} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Add tag..." className="bg-transparent border border-[hsl(var(--border))] rounded-md px-2 py-1 flex-1 min-w-[120px] text-xs outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--foreground))]" />
                  </div>
                </div>

                {completed && task.completedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] font-medium border-t border-[hsl(var(--border))] pt-3 mt-1">
                    <Calendar size={14} /> Completed on {formatDate(task.completedAt)}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showBottomSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center sm:p-4 task-bottom-sheet" onClick={() => setShowBottomSheet(false)} onPointerDown={e => e.stopPropagation()}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} className="w-full sm:max-w-md bg-[hsl(var(--card))] border-t sm:border border-[hsl(var(--border))] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden pb-8 sm:pb-0" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-[hsl(var(--border))] rounded-full mx-auto my-3 sm:hidden" />
              <div className="p-4 border-b border-[hsl(var(--border))]">
                <h3 className="font-semibold text-[hsl(var(--foreground))]">{title || 'Task Actions'}</h3>
              </div>
              <div className="p-2 flex flex-col">
                <MenuBtn onClick={() => { setTaskExpanded(subjectId, task.id, true); setShowBottomSheet(false); }} icon={<AlignLeft size={16} />}>Expand Description</MenuBtn>
                <MenuBtn onClick={() => { navigator.clipboard.writeText(title); showToast('Copied to clipboard'); setShowBottomSheet(false); }} icon={<Copy size={16} />}>Copy Title</MenuBtn>
                {/* Add Tags is always allowed */}
                <MenuBtn onClick={() => { setTaskExpanded(subjectId, task.id, true); setShowBottomSheet(false); setTimeout(() => { const el = document.querySelector(`[data-task-tag-input="${task.id}"]`) as HTMLInputElement; el?.focus(); }, 200); }} icon={<Tag size={16} />}>Add Tags</MenuBtn>
                {!isStructureLocked && (
                  <>
                    <MenuBtn onClick={duplicateTask} icon={<Copy size={16} />}>Duplicate</MenuBtn>
                    <MenuBtn onClick={() => { db.tasks.delete(task.id); setShowBottomSheet(false); }} className="text-red-500" icon={<Trash2 size={16} />}>Delete</MenuBtn>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}
