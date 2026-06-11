/**
 * TimezoneSelector — Settings UI for timezone selection (R98 M-01)
 *
 * Features:
 * - IANA timezone list with search
 * - Recently used timezones (quick select)
 * - Shows UTC offset for each timezone
 * - localStorage persistence via useTimezone hook
 * - Immediate effect on switch (no save button needed)
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getAllTimezones, getTimezoneOffset, isDST } from '@/utils/formatTime';
import { useTimezone } from '@/hooks/useTimezone';

export default function TimezoneSelector() {
  const { timezone, setTimezone, recentTimezones } = useTimezone();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allTimezones = useMemo(() => getAllTimezones(), []);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allTimezones.slice(0, 50); // show top 50 by default
    const q = search.toLowerCase();
    return allTimezones
      .filter((tz) => tz.toLowerCase().includes(q) || getTimezoneOffset(tz).includes(q))
      .slice(0, 50);
  }, [allTimezones, search]);

  const handleSelect = useCallback(
    (tz: string) => {
      setTimezone(tz);
      setSearch('');
      setIsOpen(false);
    },
    [setTimezone]
  );

  // Current display value
  const currentOffset = getTimezoneOffset(timezone);
  const currentDST = isDST(timezone);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Label */}
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--dw-text, #E5E7EB)' }}>
        🌍 Timezone
      </label>

      {/* Current selection display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors"
        style={{
          background: 'var(--dw-surface, #111827)',
          borderColor: isOpen ? '#6366F1' : 'var(--dw-border, #1F2937)',
          color: 'var(--dw-text, #E5E7EB)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{timezone.replace(/_/g, ' ')}</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#6366F122', color: '#818CF8' }}>
            UTC{currentOffset}
          </span>
          {currentDST && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#D4A85322', color: '#D4A853' }}>
              DST
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--dw-text-muted, #9CA3AF)' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg border shadow-xl overflow-hidden"
          style={{
            background: 'var(--dw-surface, #111827)',
            borderColor: 'var(--dw-border, #1F2937)',
            maxHeight: 400,
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--dw-border, #1F2937)' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search timezone (e.g., Tokyo, UTC+8)..."
              className="w-full px-3 py-1.5 rounded-md text-sm outline-none"
              style={{
                background: 'var(--dw-bg, #0A0A10)',
                color: 'var(--dw-text, #E5E7EB)',
                border: '1px solid var(--dw-border, #1F2937)',
              }}
              autoFocus
            />
          </div>

          {/* Recently used */}
          {recentTimezones.length > 0 && !search && (
            <div className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--dw-border, #1F2937)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--dw-text-muted, #9CA3AF)' }}>
                Recently Used
              </div>
              <div className="flex flex-wrap gap-1">
                {recentTimezones.map((tz) => (
                  <button
                    key={tz}
                    onClick={() => handleSelect(tz)}
                    className="px-2 py-1 rounded text-xs cursor-pointer transition-colors hover:opacity-80"
                    style={{
                      background: tz === timezone ? '#6366F1' : 'var(--dw-border, #1F2937)',
                      color: tz === timezone ? '#FFF' : 'var(--dw-text, #E5E7EB)',
                    }}
                  >
                    {tz.split('/').pop()?.replace(/_/g, ' ')} ({getTimezoneOffset(tz)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timezone list */}
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm" style={{ color: 'var(--dw-text-muted, #9CA3AF)' }}>
                No timezone found
              </div>
            )}
            {filtered.map((tz) => {
              const offset = getTimezoneOffset(tz);
              const isActive = tz === timezone;
              return (
                <button
                  key={tz}
                  onClick={() => handleSelect(tz)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors"
                  style={{
                    background: isActive ? '#6366F122' : 'transparent',
                    color: isActive ? '#818CF8' : 'var(--dw-text, #E5E7EB)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = '#1F293744';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span className="truncate">{tz.replace(/_/g, ' ')}</span>
                  <span className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--dw-text-muted, #9CA3AF)' }}>
                    UTC{offset}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
