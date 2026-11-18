import { create } from 'zustand';
import type { ProjectMeta } from '@/features/projects/types';
import type { Backend } from '@/features/projects/repo';

type WorkspaceState = {
  meta: ProjectMeta | null;
  backend: Backend | null;
  saving: 'idle' | 'saving' | 'saved' | 'error';
  savedAt: number | null;
  error: string | null;
};

export const useWorkspace = create<WorkspaceState>()(() => ({ meta: null, backend: null, saving: 'idle', savedAt: null, error: null }));
