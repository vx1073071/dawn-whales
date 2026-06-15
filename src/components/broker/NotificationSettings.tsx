// ── R140-M01 NotificationSettings — 通知分级+智能静音 ────────────────────
// PM: P2-1, 3h. 成交声/止损弹窗/日报静默

import { useState, useCallback } from 'react';
import {
  Card, Switch, Select, Slider, Space, Tag, Button, message,
  TimePicker, Divider, Descriptions, Badge, Tooltip,
} from 'antd';
import {
  BellOutlined, SoundOutlined, NotificationOutlined, ThunderboltOutlined,
  DollarOutlined, SafetyCertificateOutlined, MoonOutlined,
  SettingOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

// ═══════════ Types ═══════════

interface NotificationRule {
  type: string;
  label: string;
  icon: React.ReactNode;
  sound: boolean;
  popup: boolean;
  badge: boolean;
  quietHours: boolean;  // obey quiet hours
}

interface NotificationSettings {
  rules: NotificationRule[];
  quietHoursEnabled: boolean;
  quietStart: string;   // HH:mm
  quietEnd: string;
  dailyReportTime: string;
  dailyReportEnabled: boolean;
  maxNotificationsPerHour: number;
  groupSimilar: boolean;  // group similar within 60s
}

// ═══════════ Default rules ═══════════

const DEFAULT_RULES: NotificationRule[] = [
  { type: 'order_filled', label: '成交', icon: <CheckCircleOutlined />, sound: true, popup: true, badge: true, quietHours: false },
  { type: 'order_failed', label: '失败', icon: <CloseCircleOutlined />, sound: true, popup: true, badge: true, quietHours: false },
  { type: 'order_retrying', label: '重试', icon: <ClockCircleOutlined />, sound: false, popup: false, badge: true, quietHours: true },
  { type: 'signal_received', label: '信号', icon: <ThunderboltOutlined />, sound: false, popup: false, badge: true, quietHours: true },
  { type: 'stop_loss', label: '止损', icon: <DollarOutlined />, sound: true, popup: true, badge: true, quietHours: false },
  { type: 'take_profit', label: '止盈', icon: <DollarOutlined />, sound: true, popup: true, badge: true, quietHours: false },
  { type: 'error', label: '错误', icon: <CloseCircleOutlined />, sound: true, popup: true, badge: true, quietHours: false },
  { type: 'daily_report', label: '日报', icon: <BellOutlined />, sound: false, popup: false, badge: false, quietHours: true },
];

// ── Main NotificationSettings ──

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('dw:ct:notifSettings');
      return saved ? JSON.parse(saved) : {
        rules: DEFAULT_RULES,
        quietHoursEnabled: true,
        quietStart: '23:00',
        quietEnd: '07:00',
        dailyReportTime: '20:00',
        dailyReportEnabled: true,
        maxNotificationsPerHour: 30,
        groupSimilar: true,
      };
    } catch {
      return {
        rules: DEFAULT_RULES,
        quietHoursEnabled: true,
        quietStart: '23:00',
        quietEnd: '07:00',
        dailyReportTime: '20:00',
        dailyReportEnabled: true,
        maxNotificationsPerHour: 30,
        groupSimilar: true,
      };
    }
  });

  const handleSave = useCallback(() => {
    try { localStorage.setItem('dw:ct:notifSettings', JSON.stringify(settings)); } catch {}
    message.success('通知设置已保存');
  }, [settings]);

  const updateRule = useCallback((type: string, field: keyof NotificationRule, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => r.type === type ? { ...r, [field]: value } : r),
    }));
  }, []);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Notification Rules */}
      <Card
        size="small"
        title={<Space><BellOutlined style={{ color: '#f59e0b' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>通知分级</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
        styles={{ body: { padding: '12px' } }}
      >
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '130px 1fr 55px 55px 55px 55px',
          gap: 4,
          marginBottom: 8,
          fontSize: 10,
          color: '#6b7280',
          padding: '0 8px',
        }}>
          <span>类型</span>
          <span></span>
          <span style={{ textAlign: 'center' }}>声音</span>
          <span style={{ textAlign: 'center' }}>弹窗</span>
          <span style={{ textAlign: 'center' }}>角标</span>
          <span style={{ textAlign: 'center' }}>静音</span>
        </div>

        {settings.rules.map((rule) => (
          <div key={rule.type} style={{
            display: 'grid',
            gridTemplateColumns: '130px 1fr 55px 55px 55px 55px',
            gap: 4,
            alignItems: 'center',
            padding: '8px',
            background: '#0d0f1a',
            borderRadius: 6,
            marginBottom: 4,
            border: '1px solid #2a2d3e',
          }}>
            <Space size={4}>
              <span style={{ color: rule.type === 'stop_loss' || rule.type === 'order_failed' ? '#ef4444' : rule.type === 'take_profit' || rule.type === 'order_filled' ? '#22c55e' : '#f59e0b' }}>
                {rule.icon}
              </span>
              <span style={{ color: '#e0e0e0', fontSize: 12 }}>{rule.label}</span>
            </Space>
            <span></span>
            <div style={{ textAlign: 'center' }}>
              <Switch size="small" checked={rule.sound} onChange={(v) => updateRule(rule.type, 'sound', v)} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <Switch size="small" checked={rule.popup} onChange={(v) => updateRule(rule.type, 'popup', v)} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <Switch size="small" checked={rule.badge} onChange={(v) => updateRule(rule.type, 'badge', v)} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <Switch
                size="small"
                checked={rule.quietHours}
                onChange={(v) => updateRule(rule.type, 'quietHours', v)}
                disabled={!settings.quietHoursEnabled}
              />
            </div>
          </div>
        ))}
      </Card>

      {/* Quiet Hours */}
      <Card
        size="small"
        title={<Space><MoonOutlined style={{ color: '#a78bfa' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>免打扰模式</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
        styles={{ body: { padding: '14px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ color: '#e0e0e0', fontSize: 13 }}>夜间免打扰</div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>在指定时段内静音非紧急通知</div>
          </div>
          <Switch checked={settings.quietHoursEnabled} onChange={(v) => setSettings((p) => ({ ...p, quietHoursEnabled: v }))} />
        </div>

        {settings.quietHoursEnabled && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ color: '#8b949e', fontSize: 12 }}>从</span>
            <TimePicker
              value={dayjs(settings.quietStart, 'HH:mm')}
              onChange={(t) => t && setSettings((p) => ({ ...p, quietStart: t.format('HH:mm') }))}
              format="HH:mm"
              size="small"
              style={{ background: '#0d0f1a' }}
            />
            <span style={{ color: '#8b949e', fontSize: 12 }}>到</span>
            <TimePicker
              value={dayjs(settings.quietEnd, 'HH:mm')}
              onChange={(t) => t && setSettings((p) => ({ ...p, quietEnd: t.format('HH:mm') }))}
              format="HH:mm"
              size="small"
              style={{ background: '#0d0f1a' }}
            />
          </div>
        )}
      </Card>

      {/* Daily Report */}
      <Card
        size="small"
        title={<Space><NotificationOutlined style={{ color: '#3b82f6' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>日报推送</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
        styles={{ body: { padding: '14px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ color: '#e0e0e0', fontSize: 13 }}>每日汇总报告</div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>定时推送当日跟单汇总</div>
          </div>
          <Switch checked={settings.dailyReportEnabled} onChange={(v) => setSettings((p) => ({ ...p, dailyReportEnabled: v }))} />
        </div>

        {settings.dailyReportEnabled && (
          <div>
            <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 4 }}>推送时间</div>
            <TimePicker
              value={dayjs(settings.dailyReportTime, 'HH:mm')}
              onChange={(t) => t && setSettings((p) => ({ ...p, dailyReportTime: t.format('HH:mm') }))}
              format="HH:mm"
              size="small"
              style={{ background: '#0d0f1a' }}
            />
          </div>
        )}
      </Card>

      {/* Advanced */}
      <Card
        size="small"
        title={<Space><SettingOutlined style={{ color: '#8b949e' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>高级设置</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
        styles={{ body: { padding: '14px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ color: '#e0e0e0', fontSize: 13 }}>合并同类通知</div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>60秒内相同类型通知合并为一条</div>
          </div>
          <Switch checked={settings.groupSimilar} onChange={(v) => setSettings((p) => ({ ...p, groupSimilar: v }))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#e0e0e0', fontSize: 13 }}>每小时最大通知数</div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>超过后停止推送，防止轰炸</div>
          </div>
          <Slider
            min={5}
            max={100}
            value={settings.maxNotificationsPerHour}
            onChange={(v) => setSettings((p) => ({ ...p, maxNotificationsPerHour: v }))}
            style={{ width: 120 }}
            styles={{ track: { background: '#3b82f6' } }}
          />
        </div>
      </Card>

      <Button type="primary" onClick={handleSave} block size="large">
        保存通知设置
      </Button>
    </div>
  );
}
