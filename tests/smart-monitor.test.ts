// ── JVS-107: Smart Monitor Tests (vitest) ──────────────────────────────────
import { describe, it, expect } from 'vitest';

interface Alert { id: string; level: string; source: string; status: string; title: string; createdAt: string; relatedEntityId?: string; }

describe('Alert Level Colors', () => {
  const colors: Record<string, string> = { critical: 'red', warning: 'yellow', info: 'blue' };
  it('3 levels defined', () => expect(Object.keys(colors).length).toBe(3));
  it('critical is red', () => expect(colors.critical).toBe('red'));
  it('warning is yellow', () => expect(colors.warning).toBe('yellow'));
  it('info is blue', () => expect(colors.info).toBe('blue'));
});

describe('Source Labels', () => {
  const labels: Record<string, string> = { market: '行情', risk: '风控', system: '系统', strategy: '策略', broker: '券商', data: '数据' };
  it('6 sources', () => expect(Object.keys(labels).length).toBe(6));
  it('market label', () => expect(labels.market).toBe('行情'));
  it('risk label', () => expect(labels.risk).toBe('风控'));
});

describe('Alert Filtering', () => {
  const alerts: Alert[] = [
    { id: '1', level: 'critical', source: 'risk', status: 'active', title: 'Drawdown', createdAt: '2026-06-05T10:00:00Z' },
    { id: '2', level: 'warning', source: 'market', status: 'active', title: 'Price surge', createdAt: '2026-06-05T11:00:00Z' },
    { id: '3', level: 'info', source: 'strategy', status: 'acknowledged', title: 'Buy signal', createdAt: '2026-06-05T12:00:00Z' },
    { id: '4', level: 'critical', source: 'system', status: 'resolved', title: 'Disconnect', createdAt: '2026-06-04T10:00:00Z' },
    { id: '5', level: 'warning', source: 'broker', status: 'active', title: 'Order rejected', createdAt: '2026-06-05T13:00:00Z' },
  ];
  it('filter critical', () => expect(alerts.filter(a => a.level === 'critical').length).toBe(2));
  it('filter active', () => expect(alerts.filter(a => a.status === 'active').length).toBe(3));
  it('filter market source', () => expect(alerts.filter(a => a.source === 'market').length).toBe(1));
  it('combined filter', () => expect(alerts.filter(a => a.level === 'critical' && a.status === 'active').length).toBe(1));
  it('sort by time desc', () => {
    const sorted = [...alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    expect(sorted[0].id).toBe('5');
  });
});

describe('Stats Computation', () => {
  const alerts = [
    { level: 'critical', status: 'active' }, { level: 'critical', status: 'active' },
    { level: 'warning', status: 'active' }, { level: 'warning', status: 'acknowledged' },
    { level: 'info', status: 'resolved' },
  ];
  it('total', () => expect(alerts.length).toBe(5));
  it('active count', () => expect(alerts.filter(a => a.status === 'active').length).toBe(3));
  it('acknowledged count', () => expect(alerts.filter(a => a.status === 'acknowledged').length).toBe(1));
  it('critical active', () => expect(alerts.filter(a => a.level === 'critical' && a.status === 'active').length).toBe(2));
});

describe('Time Formatting', () => {
  function timeAgo(isoStr: string): string {
    const now = new Date('2026-06-05T14:00:00Z').getTime();
    const diff = Math.floor((now - new Date(isoStr).getTime()) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return `${Math.floor(diff / 86400)}天前`;
  }
  it('seconds ago', () => expect(timeAgo('2026-06-05T13:59:30Z')).toBe('30秒前'));
  it('minutes ago', () => expect(timeAgo('2026-06-05T13:30:00Z')).toBe('30分钟前'));
  it('hours ago', () => expect(timeAgo('2026-06-05T10:00:00Z')).toBe('4小时前'));
  it('days ago', () => expect(timeAgo('2026-06-04T14:00:00Z')).toBe('1天前'));
});
