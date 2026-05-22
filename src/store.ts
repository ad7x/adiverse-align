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
  // Sidebar domain expansion persistence
  expandedSidebarNodes: Record<string, boolean>;
  toggleSidebarNode: (id: string) => void;
  setSidebarNodeExpanded: (id: string, expanded: boolean) => void;
  // Per-subject section expansion persistence
  expandedSections: Record<string, Record<string, boolean>>;
  toggleSection: (subjectId: string, sectionId: string) => void;
  // Per-subject task description expansion persistence
  expandedTasks: Record<string, Record<string, boolean>>;
  toggleTaskExpanded: (subjectId: string, taskId: string) => void;
  setMultipleTasksExpanded: (subjectId: string, taskIds: string[], expanded: boolean) => void;
  setTaskExpanded: (subjectId: string, taskId: string, expanded: boolean) => void;
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
      expandedSidebarNodes: {},
      toggleSidebarNode: (id) => set((state) => ({
        expandedSidebarNodes: {
          ...state.expandedSidebarNodes,
          [id]: !state.expandedSidebarNodes[id]
        }
      })),
      setSidebarNodeExpanded: (id, expanded) => set((state) => ({
        expandedSidebarNodes: {
          ...state.expandedSidebarNodes,
          [id]: expanded
        }
      })),
      expandedSections: {},
      toggleSection: (subjectId, sectionId) => set((state) => {
        const subjectSections = state.expandedSections[subjectId] || {};
        return {
          expandedSections: {
            ...state.expandedSections,
            [subjectId]: {
              ...subjectSections,
              [sectionId]: !subjectSections[sectionId]
            }
          }
        };
      }),
      expandedTasks: {},
      toggleTaskExpanded: (subjectId, taskId) => set((state) => {
        const subjectTasks = state.expandedTasks[subjectId] || {};
        return {
          expandedTasks: {
            ...state.expandedTasks,
            [subjectId]: {
              ...subjectTasks,
              [taskId]: !subjectTasks[taskId]
            }
          }
        };
      }),
      setMultipleTasksExpanded: (subjectId, taskIds, expanded) => set((state) => {
        const subjectTasks = { ...(state.expandedTasks[subjectId] || {}) };
        taskIds.forEach(id => {
          subjectTasks[id] = expanded;
        });
        return {
          expandedTasks: {
            ...state.expandedTasks,
            [subjectId]: subjectTasks
          }
        };
      }),
      setTaskExpanded: (subjectId, taskId, expanded) => set((state) => {
        const subjectTasks = state.expandedTasks[subjectId] || {};
        return {
          expandedTasks: {
            ...state.expandedTasks,
            [subjectId]: {
              ...subjectTasks,
              [taskId]: expanded
            }
          }
        };
      }),
    }),
    {
      name: 'adiverse-ui-storage-v3',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        // Persist activeView but strip transient highlightId
        activeView: state.activeView.type === 'subject'
          ? { type: 'subject' as const, subjectId: state.activeView.subjectId }
          : state.activeView,
        expandedSidebarNodes: state.expandedSidebarNodes,
        expandedSections: state.expandedSections,
        expandedTasks: state.expandedTasks,
      }),
    }
  )
);
