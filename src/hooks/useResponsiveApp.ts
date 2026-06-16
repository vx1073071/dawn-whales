// @ts-nocheck
// R231 ML#1: Responsive App layout hook — auto-adapt sidebar visibility per breakpoint
// Small screens: auto-collapse sidebar with mobile menu overlay
// Tablet: reduce sidebar width
// Desktop: full layout

import { useResponsive } from './useResponsive';
import { useCallback, useEffect } from 'react';

export interface ResponsiveAppState {
  sidebarVisible: boolean;
  sidebarMode: 'inline' | 'overlay' | 'hidden';
  sidebarWidth: number;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
}

export function useResponsiveApp(
  defaultCollapsed = false
): ResponsiveAppState & ReturnType<typeof useResponsive> {
  const responsive = useResponsive();
  const { isMobile, isTablet, breakpoint } = responsive;
  
  // On mobile: sidebar is overlay by default
  // On tablet: sidebar is inline but narrower
  // On desktop: sidebar is inline full width
  const sidebarMode: 'inline' | 'overlay' | 'hidden' = 
    breakpoint === 'sm' ? 'overlay' : 'inline';
    
  const sidebarWidth = breakpoint === 'sm' ? 280 : isTablet ? 200 : 260;
  
  // Auto-close overlay on mobile when navigating (handled by Sidebar component)
  // Auto-collapse on very small screens (< 360px)
  const verySmall = typeof window !== 'undefined' && window.innerWidth < 360;
  
  return {
    ...responsive,
    sidebarVisible: !verySmall,
    sidebarMode,
    sidebarWidth,
    toggleSidebar: useCallback(() => {
      // Handled by Sidebar component toggle
    }, []),
    openSidebar: useCallback(() => {
      // Handled by Sidebar component open
    }, []),
    closeSidebar: useCallback(() => {
      // Handled by Sidebar component close
    }, []),
  };
}
