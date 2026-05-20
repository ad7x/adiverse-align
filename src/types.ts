export interface Category {
  id: string;
  title: string;
  order: number;
}

export interface Domain {
  id: string;
  categoryId: string;
  title: string;
  order: number;
}

export interface Subject {
  id: string;
  domainId: string;
  title: string;
  order: number;
  isLocked: boolean;
}

export interface Task {
  id: string;
  subjectId: string;
  parentId: string | null;
  type: 'section' | 'task';
  title: string;
  description: string;
  notes: string;
  completed: boolean;
  order: number;
  tags?: string[];
  finishedAt?: string | null;
}

export const CHECKMARK_STYLES = ['circle', 'rounded-square', 'square', 'minimalist'] as const;
export type CheckmarkStyle = typeof CHECKMARK_STYLES[number];

export const THEME_COLORS = ['blue', 'purple', 'green', 'red', 'orange', 'zinc'] as const;
export type ThemeColor = typeof THEME_COLORS[number];

export interface AppSettings {
  id: 'settings';
  theme: 'dark' | 'light';
  themeColor?: ThemeColor;
  checkmarkStyle?: CheckmarkStyle;
  userName: string;
  hasCompletedOnboarding: boolean;
  globalLock: boolean;
  exportHistory: string[];
}

export type ViewState = 
  | { type: 'home' }
  | { type: 'search'; initialQuery?: string }
  | { type: 'settings' }
  | { type: 'subject'; subjectId: string };
