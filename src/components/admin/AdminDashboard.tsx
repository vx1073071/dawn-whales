/**
 * Admin Dashboard — R88 C-03
 * Funnel, retention, and invitation data visualization.
 */
import React, { useEffect, useState } from 'react';
import i18n from '../../i18n';

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
        <StatCard title={i18n.t('AdminDashboard.k1')} value={stats.funnel.visits} />
        <StatCard title={i18n.t('AdminDashboard.k2')} value={stats.funnel.downloads} sub={`转化率 ${stats.funnel.visits > 0 ? ((stats.funnel.downloads / stats.funnel.visits) * 100).toFixed(1) : 0}%`} />
        <StatCard title={i18n.t('AdminDashboard.k3')} value={stats.funnel.registrations} />
        <StatCard title={i18n.t('AdminDashboard.k4')} value={stats.funnel.active} />
      </div>

      {/* Retention */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--dw-text, #E5E7EB)' }}>用户留存</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard title={i18n.t('AdminDashboard.k5')} value={`${stats.retention.day1}%`} />
        <StatCard title={i18n.t('AdminDashboard.k6')} value={`${stats.retention.day7}%`} />
        <StatCard title={i18n.t('AdminDashboard.k7')} value={`${stats.retention.day30}%`} />
      </div>

      {/* Users */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--dw-text, #E5E7EB)' }}>用户概览</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard title={i18n.t('AdminDashboard.k8')} value={stats.users.total} />
        <StatCard title={i18n.t('AdminDashboard.k9')} value={stats.users.active7d} />
        <StatCard title={i18n.t('AdminDashboard.k10')} value={stats.users.active30d} />
      </div>

      {/* Invitations */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--dw-text, #E5E7EB)' }}>邀请裂变</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard title={i18n.t('AdminDashboard.k11')} value={stats.invitations.sent} />
        <StatCard title={i18n.t('AdminDashboard.k12')} value={stats.invitations.accepted} />
        <StatCard title={i18n.t('AdminDashboard.k13')} value={`${stats.invitations.rate}%`} />
      </div>
    </div>
  );
};

export default AdminDashboard;
