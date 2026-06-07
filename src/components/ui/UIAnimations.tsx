/**
 * UI Animation Utilities — ML-50-01 [P0]
 * R50: v1.0.0 GA Polish — Animation presets, dark mode, a11y enhancements
 *
 * Extends UIPolish.tsx with:
 * - Keyframe animation presets
 * - Dark mode color tokens
 * - A11y utilities (skip link, screen reader helpers)
 * - Page transition wrapper
 */

import React, { useEffect, useRef, useState } from 'react';

// ── Keyframe Animation Presets ──────────────────────────────────────────

export const keyframes = {
  /** Fade in from below */
  fadeInUp: 'animate-[fadeInUp_0.4s_ease-out]',
  /** Fade in from right */
  fadeInRight: 'animate-[fadeInRight_0.3s_ease-out]',
  /** Scale in with bounce */
  scaleIn: 'animate-[scaleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]',
  /** Slide down (for dropdowns) */
  slideDown: 'animate-[slideDown_0.2s_ease-out]',
  /** Pulse glow */
  glowPulse: 'animate-[glowPulse_2s_ease-in-out_infinite]',
  /** Shimmer loading effect */
  shimmer: 'animate-[shimmer_1.5s_ease-in-out_infinite]',
};

// ── Dark Mode Color Tokens ──────────────────────────────────────────────

export const darkTokens = {
  surface: {
    0: '#0d0d15',    // deepest bg
    1: '#111119',    // sidebar bg
    2: '#1a1a25',    // card bg
    3: '#222230',    // elevated bg
  },
  border: {
    subtle: 'rgba(255,255,255,0.04)',
    default: 'rgba(255,255,255,0.06)',
    strong: 'rgba(255,255,255,0.10)',
    accent: 'rgba(212,168,83,0.20)',
  },
  text: {
    primary: '#e5e5e5',
    secondary: '#999',
    muted: '#666',
    disabled: '#444',
    accent: '#D4A853',
  },
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },
};

// ── Staggered List Animation ────────────────────────────────────────────

interface StaggerListProps {
  children: React.ReactNode[];
  className?: string;
  /** Delay between each child in ms */
  staggerMs?: number;
}

export const StaggerList: React.FC<StaggerListProps> = ({
  children,
  className,
  staggerMs = 50,
}) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {React.Children.map(children, (child, i) => (
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(12px)',
            transition: `all 0.4s ease-out ${i * staggerMs}ms`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

// ── Page Transition Wrapper ─────────────────────────────────────────────

interface PageTransitionProps {
  children: React.ReactNode;
  /** Unique key for the page */
  pageKey: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  pageKey,
}) => {
  const [isEntering, setIsEntering] = useState(true);

  useEffect(() => {
    setIsEntering(true);
    const t = setTimeout(() => setIsEntering(false), 50);
    return () => clearTimeout(t);
  }, [pageKey]);

  return (
    <div
      style={{
        opacity: isEntering ? 0 : 1,
        transform: isEntering ? 'translateY(8px)' : 'translateY(0)',
        transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
      }}
    >
      {children}
    </div>
  );
};

// ── A11y Skip Link ──────────────────────────────────────────────────────

export const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-black focus:rounded-lg focus:font-medium"
  >
    Skip to main content
  </a>
);

// ── Visually Hidden (Screen Reader Only) ────────────────────────────────

interface VisuallyHiddenProps {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as: Tag = 'span',
}) => (
  <Tag
    style={{
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
      whiteSpace: 'nowrap',
      borderWidth: 0,
    }}
  >
    {children}
  </Tag>
);

// ── Live Region (ARIA announcements) ────────────────────────────────────

interface LiveRegionProps {
  message: string;
  /** polite = wait for current announcement; assertive = interrupt immediately */
  assertive?: boolean;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  assertive = false,
}) => (
  <div
    role="status"
    aria-live={assertive ? 'assertive' : 'polite'}
    aria-atomic="true"
    className="sr-only"
  >
    {message}
  </div>
);

// ── Progress Ring ───────────────────────────────────────────────────────

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  max = 100,
  size = 48,
  strokeWidth = 3,
  color = '#D4A853',
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      {label && <span className="text-[10px] text-gray-500">{label}</span>}
    </div>
  );
};

// ── Number Counter Animation ────────────────────────────────────────────

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 800,
  format = (n) => n.toLocaleString(),
  className,
}) => {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = display;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
};

// ── Export all ──────────────────────────────────────────────────────────

export default {
  keyframes,
  darkTokens,
  StaggerList,
  PageTransition,
  SkipLink,
  VisuallyHidden,
  LiveRegion,
  ProgressRing,
  AnimatedNumber,
};
