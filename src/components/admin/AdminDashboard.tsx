/**
 * Admin Dashboard — R88 C-03
 * Funnel, retention, and invitation data visualization.
 */
import React, { useEffect, useState } from 'react';

interface AdminStats {
  users: { total: number; active7d: number; active30d: number };
  funnel: { visits: number; downloads: number; registrations: number; active: number };
  retention: { day1: number; day7: number; day30: number };
  invitations: { sent: number; accepted: number; rate: number };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, fetch from /api/admin/stats
    setStats({
      users: { total: 0, active7d: 0, active30d: 0 },
      funnel: { visits: 0, downloads: 0, registrations: 0, active: 0 },
      retention: { day1: 0, day7: 0, day30: 0 },
      invitations: { sent: 0, accepted: 0, rate: 0 },
    });
    setLoading(false);
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!stats) return null;

  const StatCard = ({ title, value, sub }: { title: string; value: string | number; sub?: string }) => (
    <div style={{
      background: 'var(--dw-surface, #111827)',
      border: '1px solid var(--dw-border, #1F2937)',
      borderRadius: 8,
      padding: '16px 20px',
      minWidth: 180,
    }}>
      <div style={{ fontSize: 13, color: 'var(--dw-text-muted, #9CA3AF)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--dw-gold, #D4A853)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--dw-text-muted, #9CA3AF)', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--dw-text, #E5E7EB)' }}>
        Admin Dashboard
      </h2>

      {/* Funnel */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--dw-text, #E5E7EB)' }}>用户漏斗</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard title="访问量" value={stats.funnel.visits} />
        <StatCard title="下载量" value={stats.funnel.downloads} sub={`转化率 ${stats.funnel.visits > 0 ? ((stats.funnel.downloads / stats.funnel.visits) * 100).toFixed(1) : 0}%`} />
        <StatCard title="注册量" value={stats.funnel.registrations} />
        <StatCard title="活跃用户" value={stats.funnel.active} />
      </div>

      {/* Retention */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--dw-text, #E5E7EB)' }}>用户留存</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard title="次日留存" value={`${stats.retention.day1}%`} />
        <StatCard title="7日留存" value={`${stats.retention.day7}%`} />
        <StatCard title="30日留存" value={`${stats.retention.day30}%`} />
      </div>

      {/* Users */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--dw-text, #E5E7EB)' }}>用户概览</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard title="总用户" value={stats.users.total} />
        <StatCard title="7日活跃" value={stats.users.active7d} />
        <StatCard title="30日活跃" value={stats.users.active30d} />
      </div>

      {/* Invitations */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--dw-text, #E5E7EB)' }}>邀请裂变</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard title="邀请发送" value={stats.invitations.sent} />
        <StatCard title="邀请接受" value={stats.invitations.accepted} />
        <StatCard title="邀请转化率" value={`${stats.invitations.rate}%`} />
      </div>
    </div>
  );
};

export default AdminDashboard;
