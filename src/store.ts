import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViewState } from './types';

interface UIState {
  activeView: ViewState;
  setActiveView: (view: ViewState) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeView: { type: 'home' },
      setActiveView: (view) => set({ activeView: view }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      sidebarWidth: 280,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
    }),
    {
      name: 'adiverse-ui-storage-v2',
      partialize: (state) => ({ 
        sidebarCollapsed: state.sidebarCollapsed, 
        sidebarWidth: state.sidebarWidth,
        activeView: state.activeView
      }),
    }
  )
);
