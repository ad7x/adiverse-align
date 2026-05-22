import Dexie, { type Table } from 'dexie';
import type { Category, Domain, Subject, SubjectInstance, Task, AppSettings, Media } from './types';
import { v4 as uuidv4 } from 'uuid';

export class AdiverseDB extends Dexie {
  categories!: Table<Category, string>;
  domains!: Table<Domain, string>;
  subjects!: Table<Subject, string>;
  subjectInstances!: Table<SubjectInstance, string>;
  tasks!: Table<Task, string>;
  settings!: Table<AppSettings, string>;
  media!: Table<Media, string>;

  constructor() {
    super('AdiverseAlignDB');

    this.version(2).stores({
      categories: 'id, order',
      domains: 'id, categoryId, order',
      subjects: 'id, domainId, order',
      tasks: 'id, subjectId, parentId, type, order',
      settings: 'id'
    });

    this.version(3).stores({
      subjectInstances: 'id, subjectId, order',
      tasks: 'id, subjectId, instanceId, parentId, type, order'
    }).upgrade(async tx => {
      const allTasks = await tx.table('tasks').toArray();
      const subjectGroups: Record<string, any[]> = {};

      for (const t of allTasks) {
        if (!subjectGroups[t.subjectId]) subjectGroups[t.subjectId] = [];
        subjectGroups[t.subjectId].push(t);
      }

      const instancesToAdd = [];
      const tasksToUpdate = [];

      for (const [subjId, subjTasks] of Object.entries(subjectGroups)) {
        const instanceId = uuidv4();
        instancesToAdd.push({
          id: instanceId,
          subjectId: subjId,
          name: 'Original',
          createdAt: new Date().toISOString(),
          order: 0
        });

        for (const t of subjTasks) {
          const newTask = { ...t, instanceId };
          if (!newTask.createdAt) newTask.createdAt = new Date().toISOString();
          if (!newTask.updatedAt) newTask.updatedAt = new Date().toISOString();
          if (newTask.finishedAt !== undefined) {
            newTask.completedAt = newTask.finishedAt;
            delete newTask.finishedAt;
          }
          tasksToUpdate.push(newTask);
        }
      }

      if (instancesToAdd.length > 0) {
        await tx.table('subjectInstances').bulkAdd(instancesToAdd);
        await tx.table('tasks').bulkPut(tasksToUpdate);
      }
    });

    this.version(4).stores({
      media: 'id'
    });

    // v5: Fix finishedAt→completedAt for tasks created after v3 migration,
    // and normalize any stale finishedAt fields still in the DB.
    this.version(5).stores({}).upgrade(async tx => {
      const allTasks = await tx.table('tasks').toArray();
      const tasksToFix = [];

      for (const t of allTasks) {
        let changed = false;
        const updated = { ...t };

        // If finishedAt exists but completedAt doesn't, migrate it
        if (updated.finishedAt !== undefined) {
          if (!updated.completedAt && updated.finishedAt) {
            updated.completedAt = updated.finishedAt;
          }
          delete updated.finishedAt;
          changed = true;
        }

        if (changed) {
          tasksToFix.push(updated);
        }
      }

      if (tasksToFix.length > 0) {
        await tx.table('tasks').bulkPut(tasksToFix);
      }
    });
  }
}

export const db = new AdiverseDB();

db.on('populate', () => {
  db.settings.add({
    id: 'settings',
    theme: 'dark',
    userName: '',
    hasCompletedOnboarding: false,
    globalLock: false,
    exportHistory: [],
    soundEnabled: true,
    celebrationEnabled: true
  });
});
