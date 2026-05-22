import JSZip from 'jszip';
import { db } from '../db';
import type { Task, Subject } from '../types';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';

// ─── Workspace Export (ZIP) ───────────────────────────────────────────

export async function exportWorkspaceZip(): Promise<Blob> {
  const zip = new JSZip();

  const data = {
    categories: await db.categories.toArray(),
    domains: await db.domains.toArray(),
    subjects: await db.subjects.toArray(),
    subjectInstances: await db.subjectInstances.toArray(),
    tasks: await db.tasks.toArray(),
    settings: await db.settings.get('settings')
  };

  zip.file('workspace.json', JSON.stringify(data, null, 2));

  // Export all media blobs
  const mediaItems = await db.media.toArray();
  if (mediaItems.length > 0) {
    const mediaFolder = zip.folder('media')!;
    for (const item of mediaItems) {
      mediaFolder.file(item.id, item.fileBlob);
    }
    const mediaMeta = mediaItems.map(m => ({
      id: m.id, mimeType: m.mimeType, name: m.name, createdAt: m.createdAt
    }));
    mediaFolder.file('media_meta.json', JSON.stringify(mediaMeta, null, 2));
  }

  return zip.generateAsync({ type: 'blob' });
}

// ─── Workspace Import (ZIP) ──────────────────────────────────────────

export async function importWorkspaceZip(file: File, mode: 'replace' | 'merge') {
  const zip = await JSZip.loadAsync(file);

  const workspaceFile = zip.file('workspace.json');
  if (!workspaceFile) throw new Error('Invalid workspace ZIP: missing workspace.json');

  const dataString = await workspaceFile.async('string');
  const data = JSON.parse(dataString);

  if (mode === 'replace') {
    // Clear everything first (including media), then restore atomically
    await db.transaction('rw', [db.categories, db.domains, db.subjects, db.subjectInstances, db.tasks, db.settings, db.media], async () => {
      await db.categories.clear();
      await db.domains.clear();
      await db.subjects.clear();
      await db.subjectInstances.clear();
      await db.tasks.clear();
      await db.media.clear();

      if (data.categories) await db.categories.bulkAdd(data.categories);
      if (data.domains) await db.domains.bulkAdd(data.domains);
      if (data.subjects) await db.subjects.bulkAdd(data.subjects);
      if (data.subjectInstances) await db.subjectInstances.bulkAdd(data.subjectInstances);
      if (data.tasks) await db.tasks.bulkAdd(data.tasks);
      if (data.settings) await db.settings.put(data.settings);
    });
  } else {
    await db.transaction('rw', [db.categories, db.domains, db.subjects, db.subjectInstances, db.tasks], async () => {
      if (data.categories) await db.categories.bulkPut(data.categories);
      if (data.domains) await db.domains.bulkPut(data.domains);
      if (data.subjects) await db.subjects.bulkPut(data.subjects);
      if (data.subjectInstances) await db.subjectInstances.bulkPut(data.subjectInstances);
      if (data.tasks) await db.tasks.bulkPut(data.tasks);
    });
  }

  // Restore media blobs (after transaction, since blobs can't be part of Dexie transactions easily)
  const mediaFolder = zip.folder('media');
  if (mediaFolder) {
    const metaFile = mediaFolder.file('media_meta.json');
    if (metaFile) {
      const metaString = await metaFile.async('string');
      const mediaMeta = JSON.parse(metaString);
      const newMedia = [];
      for (const m of mediaMeta) {
        const fileObj = mediaFolder.file(m.id);
        if (fileObj) {
          const fileBlob = await fileObj.async('blob');
          newMedia.push({ ...m, fileBlob: new Blob([fileBlob], { type: m.mimeType }) });
        }
      }
      if (newMedia.length > 0) {
        await db.media.bulkPut(newMedia);
      }
    }
  }
}

// ─── Subject/Instance Export (JSON) ──────────────────────────────────

export function exportSubjectJSON(subject: Subject | undefined, tasks: Task[]): string {
  // Build a tree structure of sections, subsections, and tasks
  // Find all sections (type === 'section' and parentId === null)
  const rootSections = tasks.filter(t => t.type === 'section' && !t.parentId);
  
  // Find all root-level tasks (type !== 'section' and parentId === null)
  const rootTasks = tasks.filter(t => t.type !== 'section' && !t.parentId);

  const formatTask = (t: Task) => {
    const obj: any = {
      title: t.title || '',
      completed: !!t.completed,
      description: t.descriptionMarkdown || t.description || '',
      tags: t.tags || []
    };
    if (t.type === 'youtube') {
      obj.type = 'youtube';
      if (t.youtubeUrl) obj.youtubeUrl = t.youtubeUrl;
      if (t.videoId) obj.videoId = t.videoId;
      if (t.thumbnail) obj.thumbnail = t.thumbnail;
      if (t.duration) obj.duration = t.duration;
    }
    return obj;
  };

  const formatSubsection = (sub: Task): any => {
    const childTasks = tasks.filter(t => t.type !== 'section' && t.parentId === sub.id);
    return {
      title: sub.title || '',
      description: sub.descriptionMarkdown || sub.description || '',
      tags: sub.tags || [],
      tasks: childTasks.map(formatTask)
    };
  };

  const formatSection = (sec: Task): any => {
    const subsections = tasks.filter(t => t.type === 'section' && t.parentId === sec.id);
    const childTasks = tasks.filter(t => t.type !== 'section' && t.parentId === sec.id);
    return {
      title: sec.title || '',
      description: sec.descriptionMarkdown || sec.description || '',
      tags: sec.tags || [],
      subsections: subsections.map(formatSubsection),
      tasks: childTasks.map(formatTask)
    };
  };

  const exportObj: any = {
    sections: rootSections.map(formatSection)
  };

  if (rootTasks.length > 0) {
    exportObj.tasks = rootTasks.map(formatTask);
  } else {
    exportObj.tasks = [];
  }

  return JSON.stringify(exportObj, null, 2);
}

// ─── Workspace Export (JSON) ──────────────────────────────────────────

export async function exportWorkspaceJSON(): Promise<string> {
  const categories = await db.categories.toArray();
  const domains = await db.domains.toArray();
  const subjects = await db.subjects.toArray();
  const subjectInstances = await db.subjectInstances.toArray();
  const tasks = await db.tasks.toArray();
  const settings = await db.settings.get('settings');

  const sanitizedTasks = tasks.map(t => {
    const { notesRich, ...rest } = t;
    return rest;
  });

  return JSON.stringify({
    categories,
    domains,
    subjects,
    subjectInstances,
    tasks: sanitizedTasks,
    settings
  }, null, 2);
}

export function filterAdvancedNodes(node: any): any {
  if (!node) return null;

  function filterNode(n: any): any[] {
    if (!n) return [];

    // Flatten callout and details/content nodes
    if (n.type === 'callout' || n.type === 'details' || n.type === 'detailsContent') {
      if (n.content && Array.isArray(n.content)) {
        return n.content.flatMap(filterNode);
      }
      return [];
    }

    if (n.type === 'detailsSummary') {
      const content = n.content && Array.isArray(n.content)
        ? n.content.flatMap(filterNode)
        : [];
      return [{
        type: 'paragraph',
        content
      }];
    }

    // Drop advanced media nodes
    if (['image', 'youtube', 'iframe', 'linkPreview'].includes(n.type)) {
      return [];
    }

    const newNode = { ...n };

    if (newNode.attrs) {
      const newAttrs = { ...newNode.attrs };
      delete newAttrs.textAlign;
      newNode.attrs = newAttrs;
    }

    if (newNode.marks && Array.isArray(newNode.marks)) {
      newNode.marks = newNode.marks.filter((mark: any) => {
        if (!mark) return false;
        return !['underline', 'highlight', 'textStyle'].includes(mark.type);
      });
    }

    if (newNode.content && Array.isArray(newNode.content)) {
      newNode.content = newNode.content.flatMap(filterNode);
    }

    return [newNode];
  }

  if (node.type === 'doc') {
    const newDoc = { ...node };
    if (newDoc.content && Array.isArray(newDoc.content)) {
      newDoc.content = newDoc.content.flatMap(filterNode);
    }
    return newDoc;
  }

  const filtered = filterNode(node);
  return filtered.length > 0 ? filtered[0] : null;
}

// ─── Content Migration Utilities ─────────────────────────────────────

export function hasAdvancedNodes(node: any): boolean {
  if (!node) return false;
  if (['image', 'youtube', 'iframe', 'linkPreview', 'callout', 'details'].includes(node.type)) {
    return true;
  }
  if (node.content && Array.isArray(node.content)) {
    return node.content.some(hasAdvancedNodes);
  }
  return false;
}

export function convertJsonToMarkdown(json: any): string {
  try {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Link.configure({ openOnClick: true, autolink: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem.configure({ nested: true }),
        Markdown.configure({ html: false, linkify: true } as any),
      ],
      content: json,
    });
    const markdown = editor.getMarkdown();
    editor.destroy();
    return markdown;
  } catch (error) {
    console.error('Failed to convert JSON to Markdown:', error);
    return '';
  }
}


// ─── Subject/Instance Export (ZIP) ───────────────────────────────────

export async function exportSubjectZip(subjectId: string, instanceId: string | null): Promise<Blob> {
  const zip = new JSZip();

  const subject = await db.subjects.get(subjectId);
  const allTasks = await db.tasks.where('subjectId').equals(subjectId).toArray();
  const exportTasks = instanceId ? allTasks.filter(t => t.instanceId === instanceId) : allTasks;

  zip.file('subject.json', JSON.stringify({ subject, tasks: exportTasks }, null, 2));
  // Find media IDs referenced in task descriptions/notes using matchAll (no lastIndex bug)
  const mediaIds = new Set<string>();
  const idPattern = /(?:data-media-id="|"data-media-id"\s*:\s*")([a-f0-9-]+)"/g;

  for (const t of exportTasks) {
    const searchText = (t.descriptionMarkdown || '') + ' ' + (t.notesRich ? JSON.stringify(t.notesRich) : '');
    if (searchText) {
      for (const match of searchText.matchAll(idPattern)) {
        mediaIds.add(match[1]);
      }
    }
  }
  if (mediaIds.size > 0) {
    const mediaFolder = zip.folder('media')!;
    const mediaMeta = [];
    for (const id of mediaIds) {
      const item = await db.media.get(id);
      if (item) {
        mediaFolder.file(item.id, item.fileBlob);
        mediaMeta.push({ id: item.id, mimeType: item.mimeType, name: item.name, createdAt: item.createdAt });
      }
    }
    if (mediaMeta.length > 0) {
      mediaFolder.file('media_meta.json', JSON.stringify(mediaMeta, null, 2));
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

// ─── Subject/Instance Import (ZIP) ──────────────────────────────────

export async function importSubjectZip(file: File): Promise<{ subject: Subject; tasks: Task[] }> {
  const zip = await JSZip.loadAsync(file);

  const subjectFile = zip.file('subject.json');
  if (!subjectFile) throw new Error('Invalid subject ZIP: missing subject.json');

  const dataString = await subjectFile.async('string');
  const data = JSON.parse(dataString);

  // Restore media blobs
  const mediaFolder = zip.folder('media');
  if (mediaFolder) {
    const metaFile = mediaFolder.file('media_meta.json');
    if (metaFile) {
      const metaString = await metaFile.async('string');
      const mediaMeta = JSON.parse(metaString);
      const newMedia = [];
      for (const m of mediaMeta) {
        const fileObj = mediaFolder.file(m.id);
        if (fileObj) {
          const fileBlob = await fileObj.async('blob');
          newMedia.push({ ...m, fileBlob: new Blob([fileBlob], { type: m.mimeType }) });
        }
      }
      if (newMedia.length > 0) {
        await db.media.bulkPut(newMedia);
      }
    }
  }

  return data as { subject: Subject; tasks: Task[] };
}
