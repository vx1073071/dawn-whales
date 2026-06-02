import { create } from 'zustand';
import type { AppState, SidebarView, ConnectionStatus } from '@/lib/types';

interface AppStore extends AppState {
  setView: (view: SidebarView) => void;
  toggleSidebar: () => void;
  setConnection: (status: ConnectionStatus | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarView: 'market',
  sidebarCollapsed: false,
  connectionStatus: null,

  setView: (view) => set({ sidebarView: view }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setConnection: (status) => set({ connectionStatus: status }),
}));
