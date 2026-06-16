// @ts-nocheck
// R232 ML#1: CrashReportPanel — Error log viewer for debugging
// Shows recent errors captured by SentryProvider with filtering and detail view
import React, { useState, useMemo } from 'react';
import { useSentry, SentryErrorInfo } from './SentryProvider';

export interface CrashReportPanelProps {
  maxHeight?: number;
  className?: string;
}

type FilterLevel = 'all' | 'error' | 'warning' | 'fatal';

export default function CrashReportPanel({ maxHeight = 400, className = '' }: CrashReportPanelProps) {
  const { errors, clearErrors } = useSentry();
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [selected, setSelected] = useState<SentryErrorInfo | null>(null);
  
  const filtered = useMemo(() => {
    if (filter === 'all') return errors;
    return errors.filter(e => e.level === filter);
  }, [errors, filter]);
  
  const counts = useMemo(() => ({
    all: errors.length,
    error: errors.filter(e => e.level === 'error').length,
    warning: errors.filter(e => e.level === 'warning').length,
    fatal: errors.filter(e => e.level === 'fatal').length,
  }), [errors]);
  
  if (errors.length === 0) {
    return React.createElement('div', {
      className: `crash-report-panel ${className}`,
      style: { padding: 32, textAlign: 'center', color: 'var(--text-tertiary, #64748b)', fontSize: 13 },
    }, 'No errors recorded. Everything looks good! 🎉');
  }
  
  return React.createElement('div', {
    className: `crash-report-panel ${className}`,
    style: { height: '100%', display: 'flex', flexDirection: 'column' },
  }, [
    // Header
    React.createElement('div', { key: 'header', style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', borderBottom: '1px solid var(--border-color, #334155)',
    }}, [
      React.createElement('div', { key: 'filters', style: { display: 'flex', gap: 4 } }, [
        (['all', 'error', 'warning', 'fatal'] as FilterLevel[]).map(level =>
          React.createElement('button', {
            key: level,
            onClick: () => { setFilter(level); setSelected(null); },
            style: {
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              border: filter === level ? '1px solid var(--brand, #d4a574)' : '1px solid transparent',
              background: filter === level ? 'var(--brand-bg, rgba(212,165,116,0.15))' : 'transparent',
              color: filter === level ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
            },
          }, `${level.charAt(0).toUpperCase() + level.slice(1)} (${counts[level]})`)
        ),
      ]),
      React.createElement('button', {
        key: 'clear', onClick: clearErrors,
        style: {
          padding: '4px 12px', borderRadius: 6, fontSize: 11, background: 'var(--surface-2, #1e293b)',
          border: '1px solid var(--border-color, #334155)', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer',
        },
      }, 'Clear All'),
    ]),
    // Error list + detail
    React.createElement('div', { key: 'body', style: { flex: 1, display: 'flex', minHeight: 0 } }, [
      // Error list
      React.createElement('div', { key: 'list', style: {
        width: selected ? '40%' : '100%', overflow: 'auto', borderRight: selected ? '1px solid var(--border-color, #334155)' : 'none',
      }}, 
        filtered.slice(0, 50).map((err, i) =>
          React.createElement('div', {
            key: i,
            onClick: () => setSelected(err),
            style: {
              padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color, #334155)',
              background: selected === err ? 'var(--surface-2, #1e293b)' : 'transparent',
              transition: 'background 0.15s',
            },
          }, [
            React.createElement('div', { key: 'top', style: { display: 'flex', justifyContent: 'space-between', marginBottom: 2 } }, [
              React.createElement('span', { key: 'level', style: {
                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                background: err.level === 'fatal' ? '#ef444420' : err.level === 'error' ? '#ef444420' : '#f59e0b20',
                color: err.level === 'fatal' ? '#ef4444' : err.level === 'error' ? '#ef4444' : '#f59e0b',
              }}, err.level.toUpperCase()),
              React.createElement('span', { key: 'time', style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } },
                new Date(err.timestamp).toLocaleTimeString()),
            ]),
            React.createElement('div', { key: 'msg', style: { fontSize: 12, color: 'var(--text-primary, #e2e8f0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              err.error.message),
          ])
        )
      ),
      // Detail panel
      selected && React.createElement('div', { key: 'detail', style: { width: '60%', overflow: 'auto', padding: 12 } }, [
        React.createElement('div', { key: 'close', style: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 } }, [
          React.createElement('h4', { key: 't', style: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', margin: 0 } }, 'Error Details'),
          React.createElement('button', { key: 'x', onClick: () => setSelected(null), style: { background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 16 } }, '✕'),
        ]),
        React.createElement('div', { key: 'meta', style: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' } }, [
          React.createElement('span', { key: 'time', style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, `Time: ${new Date(selected.timestamp).toLocaleString()}`),
          React.createElement('span', { key: 'level', style: { fontSize: 11, color: selected.level === 'fatal' ? '#ef4444' : '#f59e0b', fontWeight: 600 } }, `Level: ${selected.level.toUpperCase()}`),
          selected.tags && Object.entries(selected.tags).map(([k, v]) =>
            React.createElement('span', { key: k, style: { fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)' } }, `${k}: ${v}`)
          ),
        ]),
        React.createElement('div', { key: 'msg', style: { marginBottom: 12, padding: 12, background: 'var(--surface-2, #1e293b)', borderRadius: 8, borderLeft: '3px solid #ef4444' } }, [
          React.createElement('div', { key: 'l', style: { fontSize: 12, color: 'var(--text-tertiary, #64748b)', marginBottom: 4 } }, 'Message'),
          React.createElement('div', { key: 'm', style: { fontSize: 13, color: 'var(--text-primary, #e2e8f0)' } }, selected.error.message),
        ]),
        React.createElement('details', { key: 'stack', open: true }, [
          React.createElement('summary', { key: 's', style: { fontSize: 11, color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', marginBottom: 8 } }, 'Stack Trace'),
          React.createElement('pre', { key: 'p', style: { fontSize: 10, maxHeight: 250, overflow: 'auto', padding: 8, background: 'var(--surface-2, #1e293b)', borderRadius: 6, color: '#94a3b8', lineHeight: 1.6 } },
            selected.componentStack || selected.error.stack || 'No stack trace available'),
        ]),
      ]),
    ]),
  ]);
}
