import { create } from 'zustand';
import type { AppState, SidebarView, ConnectionStatus } from '@/lib/types';

interface AppStore extends AppState {
  setView: (view: SidebarView) => void;
  toggleSidebar: () => void;
  setConnection: (status: ConnectionStatus | null) => void;
  emergencyStop: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarView: 'market',
  sidebarCollapsed: false,
  connectionStatus: null,

  setView: (view) => set({ sidebarView: view }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setConnection: (status) => set({ connectionStatus: status }),
  emergencyStop: () => {
    // Stop all live strategies
    if (typeof window !== 'undefined' && window.api?.strategy) {
      window.api.strategy.getAll().then((result: any) => {
        const strategies = result?.strategies || result || [];
        for (const s of strategies) {
          if (s.status === 'live') {
            window.api.strategy.stopLive(s.id);
          }
        }
      }).catch(() => {});
    }
  },
}));
