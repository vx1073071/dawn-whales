/**
 * useGesture — Touch gesture hooks for mobile
 * (ML-46-03, R46 Phase 6.3)
 *
 * Provides:
 * - useSwipe: detect swipe direction + distance
 * - usePinchZoom: pinch-to-zoom support
 * - useLongPress: long press with duration
 * - useSwipeBack: iOS-style swipe-to-go-back
 */

import { useRef, useEffect, useState } from 'react';

// ── useSwipe ─────────────────────────────────────────────────────────────

interface SwipeState {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
  progress: number; // 0–1
}

interface UseSwipeOptions {
  threshold?: number;  // min px before registering
  maxDistance?: number; // max px for full progress
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useSwipe(ref: React.RefObject<HTMLElement | null>, options: UseSwipeOptions = {}) {
  const { threshold = 50, maxDistance = 150 } = options;
  const [swipe, setSwipe] = useState<SwipeState>({ direction: null, distance: 0, progress: 0 });
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!startRef.current) return;
      const dx = e.touches[0].clientX - startRef.current.x;
      const dy = e.touches[0].clientY - startRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      let direction: SwipeState['direction'] = null;
      let distance = 0;

      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left';
        distance = absDx;
      } else {
        direction = dy > 0 ? 'down' : 'up';
        distance = absDy;
      }

      setSwipe({
        direction: distance >= threshold ? direction : null,
        distance,
        progress: Math.min(distance / maxDistance, 1),
      });
    };

    const onTouchEnd = () => {
      if (!startRef.current) return;

      if (swipe.direction && swipe.distance >= threshold) {
        switch (swipe.direction) {
          case 'left': options.onSwipeLeft?.(); break;
          case 'right': options.onSwipeRight?.(); break;
          case 'up': options.onSwipeUp?.(); break;
          case 'down': options.onSwipeDown?.(); break;
        }
      }

      startRef.current = null;
      setSwipe({ direction: null, distance: 0, progress: 0 });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [swipe.direction, swipe.distance, threshold, maxDistance, options]);

  return swipe;
}

// ── useSwipeBack ────────────────────────────────────────────────────────

interface UseSwipeBackOptions {
  onBack: () => void;
  threshold?: number;
}

export function useSwipeBack(ref: React.RefObject<HTMLElement | null>, options: UseSwipeBackOptions) {
  const { onBack, threshold = 80 } = options;
  const swipe = useSwipe(ref, {
    threshold,
    onSwipeRight: onBack,
  });

  return swipe;
}

// ── usePinchZoom ─────────────────────────────────────────────────────────

interface PinchState {
  scale: number;
  active: boolean;
}

export function usePinchZoom(ref: React.RefObject<HTMLElement | null>) {
  const [pinch, setPinch] = useState<PinchState>({ scale: 1, active: false });
  const initialDistanceRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const getDistance = (e: TouchEvent): number => {
      if (e.touches.length < 2) return 0;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        initialDistanceRef.current = getDistance(e);
        initialScaleRef.current = pinch.scale;
        setPinch(prev => ({ ...prev, active: true }));
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pinch.active || e.touches.length < 2) return;
      const currentDistance = getDistance(e);
      if (initialDistanceRef.current === 0) return;

      const scale = initialScaleRef.current * (currentDistance / initialDistanceRef.current);
      setPinch({ scale: Math.max(0.5, Math.min(3, scale)), active: true });
      e.preventDefault();
    };

    const onTouchEnd = () => {
      setPinch(prev => ({ ...prev, active: false }));
      initialDistanceRef.current = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pinch.active, pinch.scale]);

  return pinch;
}

// ── useLongPress ─────────────────────────────────────────────────────────

interface UseLongPressOptions {
  duration?: number; // ms
  onLongPress: () => void;
}

export function useLongPress(ref: React.RefObject<HTMLElement | null>, options: UseLongPressOptions) {
  const { duration = 500, onLongPress } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = () => {
      timerRef.current = setTimeout(onLongPress, duration);
    };

    const onTouchEnd = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onTouchMove = () => {
      // Cancel on move
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchmove', onTouchMove);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchmove', onTouchMove);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onLongPress]);
}

export default useSwipe;
