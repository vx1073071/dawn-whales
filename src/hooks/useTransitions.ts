// R235 ML#2: useTransitions — Micro-interaction animation hooks
// Page transitions, list animations, hover effects, loading states

import { useState, useCallback, useEffect, useRef } from 'react';

// ── Fade-in on mount ─────────────────────────────────────────────────
export function useFadeIn(delay = 0) {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  
  const style: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  };
  
  return { visible, style };
}

// ── Staggered list animation ─────────────────────────────────────────
export function useStaggeredList(_count: number, staggerMs = 50, baseDelay = 0) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), baseDelay);
    return () => clearTimeout(timer);
  }, [baseDelay]);
  
  const getItemStyle = useCallback((index: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.35s ease ${index * staggerMs}ms, transform 0.35s ease ${index * staggerMs}ms`,
  }), [mounted, staggerMs]);
  
  return { getItemStyle, mounted };
}

// ── Hover scale effect ───────────────────────────────────────────────
export function useHoverScale(scale = 1.02, duration = 0.2) {
  const [hovered, setHovered] = useState(false);
  
  const bind = {
    onMouseEnter: useCallback(() => setHovered(true), []),
    onMouseLeave: useCallback(() => setHovered(false), []),
    style: {
      transform: hovered ? `scale(${scale})` : 'scale(1)',
      transition: `transform ${duration}s ease`,
      cursor: 'pointer',
    } as React.CSSProperties,
  };
  
  return bind;
}

// ── Pulse effect (for live indicators) ────────────────────────────────
export function usePulse(active = true, interval = 2000) {
  const [pulsing, setPulsing] = useState(false);
  
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setPulsing(p => !p);
    }, interval);
    return () => clearInterval(timer);
  }, [active, interval]);
  
  const style: React.CSSProperties = {
    transition: 'opacity 1s ease',
    opacity: pulsing ? 0.5 : 1,
  };
  
  return { pulsing, style };
}

// ── Slide-in panel ───────────────────────────────────────────────────
export function useSlideIn(direction: 'left' | 'right' | 'up' | 'down' = 'right', open = false, width = 320) {
  // Controls slide-in animation for side panels / modals
  const transformMap = {
    left: `translateX(${open ? 0 : -width}px)`,
    right: `translateX(${open ? 0 : width}px)`,
    up: `translateY(${open ? 0 : -width}px)`,
    down: `translateY(${open ? 0 : width}px)`,
  };
  
  const style: React.CSSProperties = {
    transform: transformMap[direction],
    opacity: open ? 1 : 0,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
    pointerEvents: open ? 'auto' : 'none',
  };
  
  return { style, open };
}

// ── Count-up animation ───────────────────────────────────────────────
export function useCountUp(target: number, duration = 1000, enabled = true) {
  const [value, setValue] = useState(0);
  const animRef = useRef<number>();
  const startRef = useRef<number>();
  
  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    
    startRef.current = Date.now();
    const startVal = value;
    const diff = target - startVal;
    
    const animate = () => {
      const elapsed = Date.now() - (startRef.current || 0);
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(startVal + diff * eased);
      
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [target, duration, enabled]);
  
  return value;
}

// ── Shimmer text (loading placeholder animation) ─────────────────────
export function useShimmer(enabled = true) {
  const style: React.CSSProperties = enabled ? {
    background: 'linear-gradient(90deg, var(--surface-3, #334155) 25%, var(--surface-2, #1e293b) 50%, var(--surface-3, #334155) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 2s ease-in-out infinite',
    borderRadius: 4,
    color: 'transparent',
  } : {};
  
  return style;
}
