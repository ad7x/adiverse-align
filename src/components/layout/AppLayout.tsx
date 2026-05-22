import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useUIStore } from '../../store';
import { cn } from '../../lib/utils';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div 
      className="flex h-[100dvh] w-screen overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
    >
      <Sidebar />
      
      {/* Mobile Backdrop Overlay */}
      {isMobile && !sidebarCollapsed && (
        <div 
          onClick={() => setSidebarCollapsed(true)} 
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-45 transition-opacity duration-300"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Floating App Icon on Mobile when Sidebar is collapsed */}
        {isMobile && sidebarCollapsed && (
          <button 
            onClick={() => setSidebarCollapsed(false)} 
            className="fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-[hsl(var(--card))/0.6] backdrop-blur-md border border-[hsl(var(--border))] shadow-lg hover:bg-[hsl(var(--muted))] active:scale-95 transition-all flex items-center justify-center"
            aria-label="Open Sidebar"
          >
            <img 
              src="/favicon.png" 
              alt="App Logo" 
              className="w-5 h-5 object-contain rounded-md animate-pulse" 
            />
          </button>
        )}
        <div className={cn("flex-1 overflow-hidden relative", isMobile && sidebarCollapsed ? "pt-14" : "")}>
          {children}
        </div>
      </main>
    </div>
  );
}

