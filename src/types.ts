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

export interface SubjectInstance {
  id: string;
  subjectId: string;
  name: string;
  createdAt: string;
  order: number;
}

export interface Task {
  id: string;
  subjectId: string;
  instanceId: string;
  parentId: string | null;
  type: 'section' | 'task' | 'youtube';
  title: string;
  description?: string;
  descriptionMarkdown?: string;
  notesRich?: { type: 'rich'; content: any };
  notes?: string;
  completed: boolean;
  order: number;
  tags?: string[];

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  completionCount?: number;

  // YouTube specifics
  youtubeUrl?: string;
  videoId?: string;
  thumbnail?: string;
  duration?: number;
}

export interface Media {
  id: string;
  fileBlob: Blob;
  mimeType: string;
  name: string;
  createdAt: string;
}

// These must match the variants in PremiumCheckbox.tsx
export const CHECKMARK_STYLES = ['modern', 'circle-glow', 'neon', 'minimal', 'gradient'] as const;
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
  profilePhotoId?: string; // media table ID for profile photo
  commitmentGoal?: string;
  commitmentDeadline?: string;
  commitmentChecklist?: { text: string; done: boolean }[];
  soundEnabled?: boolean;
  celebrationEnabled?: boolean;
}

export type ViewState =
  | { type: 'home' }
  | { type: 'search'; initialQuery?: string }
  | { type: 'settings' }
  | { type: 'subject'; subjectId: string; highlightId?: string };
