import JSZip from 'jszip';
import { db } from '../db';
import type { Task, Subject } from '../types';

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
  return JSON.stringify({ subject, tasks }, null, 2);
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
  const idPattern = /data-media-id="([a-f0-9-]+)"/g;

  for (const t of exportTasks) {
    const searchText = (t.description || '') + (t.notes || '');
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
