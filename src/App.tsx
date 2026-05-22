import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useUIStore } from './store';
import { HomeView } from './components/views/HomeView';
import { SubjectView } from './components/views/SubjectView';
import { SettingsView } from './components/views/SettingsView';
import { SearchView } from './components/views/SearchView';
import { OnboardingModal } from './components/common/OnboardingModal';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { hasAdvancedNodes, filterAdvancedNodes, convertJsonToMarkdown } from './lib/zip';

export default function App() {
  const { activeView, setActiveView } = useUIStore();
  const settings = useLiveQuery(() => db.settings.get('settings'));

  useEffect(() => {
    const initSettings = async () => {
      try {
        const existing = await db.settings.get('settings');
        if (!existing) {
          await db.settings.add({
            id: 'settings',
            theme: 'dark',
            userName: '',
            hasCompletedOnboarding: false,
            globalLock: false,
            exportHistory: [],
            soundEnabled: true,
            celebrationEnabled: true
          });
        }
      } catch (error) {
        console.error('Failed to initialize settings:', error);
      }
    };
    initSettings();
  }, []);

  // Migrate legacy tasks
  useEffect(() => {
    const migrateTasks = async () => {
      try {
        const tasks = await db.tasks.toArray();
        const updates: { id: string; changes: any }[] = [];
        
        for (const task of tasks) {
          // If task has a legacy description field but no descriptionMarkdown field
          if (task.description && task.descriptionMarkdown === undefined) {
            let changes: any = {};
            let isJson = false;
            let jsonContent: any = null;
            
            try {
              jsonContent = JSON.parse(task.description);
              isJson = (jsonContent && typeof jsonContent === 'object');
            } catch (e) {
              // It's already plain text, not JSON
            }
            
            if (isJson && jsonContent) {
              // Check if old description contains advanced nodes:
              // (images, youtube, embeds, callouts, iframes, bookmarks/linkPreviews)
              const hasAdvanced = hasAdvancedNodes(jsonContent);
              
              if (hasAdvanced) {
                // preserve the FULL original content in notesRich
                changes.notesRich = { type: 'rich', content: jsonContent };
              }
              
              // Only markdown-compatible content should become descriptionMarkdown.
              // Filter advanced nodes first
              const cleanedJson = filterAdvancedNodes(jsonContent);
              // Convert to markdown
              const markdown = convertJsonToMarkdown(cleanedJson);
              changes.descriptionMarkdown = markdown;
            } else {
              // Plain text or already text: assign directly to descriptionMarkdown
              changes.descriptionMarkdown = task.description;
            }
            
            // Delete legacy description field by setting to null/undefined or deleting from Dexie update
            changes.description = null;
            updates.push({ id: task.id, changes });
          }
        }
        
        if (updates.length > 0) {
          console.log(`Migrating ${updates.length} tasks...`);
          await db.transaction('rw', db.tasks, async () => {
            for (const item of updates) {
              await db.tasks.update(item.id, item.changes);
            }
          });
          console.log('Migration complete.');
        }
      } catch (error) {
        console.error('Task migration failed:', error);
      }
    };
    migrateTasks();
  }, []);

  useEffect(() => {
    const activeTheme = settings?.theme || 'dark';
    if (activeTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (settings?.themeColor) {
      document.documentElement.dataset.themeColor = settings.themeColor;
    } else {
      document.documentElement.dataset.themeColor = 'blue';
    }
  }, [settings?.theme, settings?.themeColor]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setActiveView({ type: 'search' });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setActiveView]);

  return (
    <>
      <OnboardingModal />
      <AppLayout>
        <div className="flex-1 w-full h-full overflow-hidden relative bg-[hsl(var(--background))]">
          {activeView.type === 'home' && <HomeView />}
          {activeView.type === 'settings' && <SettingsView />}
          {activeView.type === 'search' && <SearchView />}
          {activeView.type === 'subject' && <SubjectView subjectId={activeView.subjectId} highlightId={activeView.highlightId} />}
        </div>
      </AppLayout>
    </>
  );
}
