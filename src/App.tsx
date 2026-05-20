import React, { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useUIStore } from './store';
import { HomeView } from './components/views/HomeView';
import { SubjectView } from './components/views/SubjectView';
import { SettingsView } from './components/views/SettingsView';
import { SearchView } from './components/views/SearchView';
import { OnboardingModal } from './components/common/OnboardingModal';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function App() {
  const { activeView, setActiveView } = useUIStore();
  const settings = useLiveQuery(() => db.settings.get('settings'));

  useEffect(() => {
    if (settings?.theme) {
      if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
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
          {activeView.type === 'subject' && <SubjectView subjectId={activeView.subjectId} />}
        </div>
      </AppLayout>
    </>
  );
}
