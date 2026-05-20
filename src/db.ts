import Dexie, { type Table } from 'dexie';
import type { Category, Domain, Subject, Task, AppSettings } from './types';

export class AdiverseDB extends Dexie {
  categories!: Table<Category, string>;
  domains!: Table<Domain, string>;
  subjects!: Table<Subject, string>;
  tasks!: Table<Task, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('AdiverseAlignDB');
    this.version(2).stores({
      categories: 'id, order',
      domains: 'id, categoryId, order',
      subjects: 'id, domainId, order',
      tasks: 'id, subjectId, parentId, type, order',
      settings: 'id'
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
    exportHistory: []
  });
});
