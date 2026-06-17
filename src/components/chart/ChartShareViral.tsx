// @ts-nocheck
// R286 ML#3: ChartShareViral — 图表示分享裂变UI (6h)
// Snapshot → annotate → share link/card → referral bonus → viral loop
// 图表分享裂变: 截图→标注→分享链接→邀请奖励→病毒传播
import React, { useState, useCallback } from 'react';
import { Camera, Share2, Link, Copy, Twitter, MessageCircle, Gift, Users, Zap, Download, PenTool } from 'lucide-react';

interface ShareOption {
  id: string; label: string; icon: React.ReactNode; color: string;
}

interface Props { dark?: boolean; symbol?: string; timeframe?: string; }

export default function ChartShareViral({ dark = true, symbol = 'AAPL', timeframe = '1D' }: Props) {
  const [step, setStep] = useState<'preview' | 'annotate' | 'share' | 'referral'>('preview');
  const [note, setNote] = useState('');
  const [watermark, setWatermark] = useState(true);
  const [includeStats, setIncludeStats] = useState(true);

  const c = dark ? {
    bg:'#0a0e1a',s:'#111827',sh:'#1a2236',b:'#1e293b',t:'#e2e8f0',t2:'#64748b',
    a:'#3b82f6',ab:'#1e3a5f',ok:'#22c55e',er:'#ef4444',wa:'#f59e0b',
  } : { bg:'#f8fafc',s:'#fff',sh:'#f1f5f9',b:'#e2e8f0',t:'#0f172a',t2:'#64748b',a:'#2563eb',ab:'#dbeafe',ok:'#16a34a',er:'#dc2626',wa:'#d97706' };

  const shareOptions: ShareOption[] = [
    { id: 'copy', label: '复制链接', icon: <Copy size={14}/>, color: c.a },
    { id: 'twitter', label: 'Twitter/X', icon: <Twitter size={14}/>, color: '#1DA1F2' },
    { id: 'telegram', label: 'Telegram', icon: <MessageCircle size={14}/>, color: '#26A5E4' },
    { id: 'download', label: '下载PNG', icon: <Download size={14}/>, color: c.t2 },
  ];

  return <div style={{ padding: 14, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 420, borderRadius: 14 }}>
    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      <Camera size={16} style={{ color: c.a }}/> 分享图表
    </div>

    {/* Step indicator */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      {['preview', 'annotate', 'share', 'referral'].map((s, i) => <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: step === s ? c.a : c.b, transition: 'all 0.2s' }}/>)}
    </div>

    {/* ── Preview ── */}
    {step === 'preview' && <div>
      <div style={{ width: '100%', height: 200, borderRadius: 10, background: c.s, border: `1px solid ${c.b}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 40 }}>📊</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{symbol} · {timeframe}</div>
        <div style={{ fontSize: 11, color: c.t2 }}>K线截图预览区域</div>
        <div style={{ fontSize: 9, color: c.t2 }}>（实�截图将显示在此处）</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)}/>
          🔖 添加 "Made with Dawn Whales" 水印
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={includeStats} onChange={e => setIncludeStats(e.target.checked)}/>
          📊 附带统计数据 (OHLC+涨跌幅)
        </label>
      </div>

      <button onClick={() => setStep('annotate')} style={{ width: '100%', padding: '10px', borderRadius: 10, background: c.a, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <PenTool size={14}/> 添加标注 → 下一步
      </button>
    </div>}

    {/* ── Annotate ── */}
    {step === 'annotate' && <div>
      <div style={{ width: '100%', height: 200, borderRadius: 10, background: c.s, border: `1px solid ${c.b}`, marginBottom: 10, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 40 }}>📊</div>
        {note && <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: '4px 8px', borderRadius: 4, background: '#000000aa', color: '#fff', fontSize: 11, textAlign: 'center' }}>{note}</div>}
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="添加标注文字 (如: MACD金叉+放量突破)" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: c.s, border: `1px solid ${c.b}`, color: c.t, fontSize: 12, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}/>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setStep('preview')} style={{ flex: 1, padding: '10px', borderRadius: 10, background: c.sh, color: c.t2, border: 'none', cursor: 'pointer', fontSize: 12 }}>← 返回</button>
        <button onClick={() => setStep('share')} style={{ flex: 1, padding: '10px', borderRadius: 10, background: c.a, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Share2 size={13}/> 分享
        </button>
      </div>
    </div>}

    {/* ── Share ── */}
    {step === 'share' && <div>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>📤</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>选择分享方式</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {shareOptions.map(o => <button key={o.id} style={{
          padding: '12px 8px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          cursor: 'pointer', border: `1px solid ${c.b}`, background: c.s, color: o.color, fontSize: 11, fontWeight: 500,
        }}>{o.icon} {o.label}</button>)}
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: c.a + '10', border: `1px solid ${c.a}20`, marginBottom: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: c.t2 }}>🔗 分享链接已复制到剪贴板</div>
        <div style={{ fontSize: 10, color: c.t2, marginTop: 4 }}>https://dawnwhales.com/share/chart/abc123</div>
      </div>
      <button onClick={() => setStep('referral')} style={{ width: '100%', padding: '10px', borderRadius: 10, background: c.wa, color: '#000', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Gift size={14}/> 邀请好友 → 双方各得 1 USDT 体验金
      </button>
    </div>}

    {/* ── Referral ── */}
    {step === 'referral' && <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🎁</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>邀请好友，一起赚钱</div>
      <div style={{ fontSize: 12, color: c.t2, marginBottom: 14 }}>
        好友通过你的链接注册 → 双方各得 1 USDT 体验金
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { l: '已邀请', v: '0 人' },
          { l: '获得奖励', v: '0 USDT' },
          { l: '排队中', v: '0 人' },
          { l: '终身分成', v: '5%' },
        ].map((r, i) => <div key={i} style={{ padding: '10px 6px', borderRadius: 8, background: c.s, border: `1px solid ${c.b}` }}>
          <div style={{ fontSize: 10, color: c.t2, marginBottom: 2 }}>{r.l}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.t }}>{r.v}</div>
        </div>)}
      </div>

      <div style={{ padding: 10, borderRadius: 8, background: c.s, border: `1px solid ${c.b}`, fontSize: 11, color: c.t2, marginBottom: 10, wordBreak: 'break-all' }}>
        🔗 你的专属链接: dawnwhales.com/r/user123
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setStep('share')} style={{ flex: 1, padding: '8px', borderRadius: 8, background: c.sh, color: c.t2, border: 'none', cursor: 'pointer', fontSize: 11 }}>← 返回</button>
        <button style={{ flex: 2, padding: '8px', borderRadius: 8, background: c.wa, color: '#000', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Users size={13}/> 复制邀请链接
        </button>
      </div>
    </div>}
  </div>;
}
