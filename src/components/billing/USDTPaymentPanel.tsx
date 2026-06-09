import { useState, type CSSProperties } from 'react';

interface TxRecord { id: string; type: 'deposit' | 'withdraw' | 'revenue'; amount: number; status: 'pending' | 'confirmed' | 'failed'; txHash: string; date: string; note: string }

interface RevenueTier { level: number; name: string; minRevenue: string; share: number; commission: number }

const INITIAL_TX: TxRecord[] = [
  { id: 'tx1', type: 'deposit', amount: 500, status: 'confirmed', txHash: '0x3f8a...9c2b', date: '2026-06-09 18:30', note: 'TRC20充值' },
  { id: 'tx2', type: 'withdraw', amount: 200, status: 'confirmed', txHash: '0x7d1e...4a6f', date: '2026-06-08 14:15', note: '提现到钱包' },
  { id: 'tx3', type: 'revenue', amount: 35.70, status: 'confirmed', txHash: '—', date: '2026-06-07 00:00', note: '订阅收入分账 (70%)' },
  { id: 'tx4', type: 'deposit', amount: 1000, status: 'pending', txHash: '0xab4c...f21d', date: '2026-06-09 20:28', note: 'TRC20充值 — 等待确认' },
];

const REVENUE_TIERS: RevenueTier[] = [
  { level: 1, name: '初级创作者', minRevenue: '$0', share: 70, commission: 30 },
  { level: 2, name: '高级创作者', minRevenue: '$500/月', share: 75, commission: 25 },
  { level: 3, name: 'VIP创作者', minRevenue: '$2000/月', share: 80, commission: 20 },
];

// ── Sub-components ──
function TxStatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: string; color: string; bg: string; label: string }> = {
    pending: { icon: '⏳', color: '#F59E0B', bg: '#F59E0B22', label: '确认中' },
    confirmed: { icon: '✅', color: '#10B981', bg: '#10B98122', label: '已确认' },
    failed: { icon: '❌', color: '#EF4444', bg: '#EF444422', label: '失败' },
  };
  const s = map[status] || map.failed;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.icon} {s.label}
    </span>
  );
}

function TierCard({ tier, isActive }: { tier: RevenueTier; isActive: boolean }) {
  return (
    <div style={{
      padding: '18px', borderRadius: 12, border: isActive ? '2px solid #D4A853' : '1px solid #374151',
      background: isActive ? '#D4A85308' : '#111827', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>
        {tier.level === 1 ? '🥉' : tier.level === 2 ? '🥈' : '🥇'}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>{tier.name}</div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>{tier.minRevenue}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#D4A853' }}>{tier.share}%</div>
      <div style={{ fontSize: 11, color: '#9CA3AF' }}>创作者分成</div>
      <div style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, background: '#374151', fontSize: 11, color: '#6B7280' }}>
        平台佣金 {tier.commission}%
      </div>
    </div>
  );
}

// ── Tab: Wallet ──
function WalletTab() {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const balance = 2517.35;
  const addressWallet = 'TXq...7kFp';

  return (
    <div>
      {/* Balance card */}
      <div style={{
        padding: '24px', borderRadius: 14, background: 'linear-gradient(135deg, #6366F122, #D4A85314)',
        border: '1px solid #374151', textAlign: 'center', marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>USDT 余额</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: '#F9FAFB', fontFamily: 'monospace' }}>
          {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
          ≈ HK$ { (balance * 7.8).toLocaleString('en-US', { minimumFractionDigits: 2 }) }
        </div>
        <div style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, background: '#111827', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6B7280' }}>TRC20:</span>
          <span style={{ fontSize: 12, color: '#D1D5DB', fontFamily: 'monospace' }}>{addressWallet}</span>
          <span style={{ fontSize: 10, color: '#818CF8', cursor: 'pointer' }}>📋</span>
        </div>
      </div>

      {/* Deposit / Withdraw tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button onClick={() => setTab('deposit')} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none',
          background: tab === 'deposit' ? '#6366F1' : '#1F2937',
          color: tab === 'deposit' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>📥 充值</button>
        <button onClick={() => setTab('withdraw')} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none',
          background: tab === 'withdraw' ? '#6366F1' : '#1F2937',
          color: tab === 'withdraw' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>📤 提现</button>
      </div>

      {/* Deposit form */}
      {tab === 'deposit' && (
        <div style={{ padding: '20px', borderRadius: 12, background: '#111827', border: '1px solid #1F2937' }}>
          <div style={{ fontSize: 13, color: '#D1D5DB', marginBottom: 12 }}>
            仅支持 <strong style={{ color: '#F59E0B' }}>USDT-TRC20</strong> 网络 · 最低充值 <strong>10 USDT</strong> · 到账时间 1-3分钟
          </div>
          <div style={{ padding: '16px', borderRadius: 10, background: '#1F2937', border: '1px solid #374151', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>扫描或复制地址充值</div>
            <div style={{ fontSize: 14, color: '#D1D5DB', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 8 }}>
              TXqYH2G3kD6mZ5nP8rA1sF7wV4jB9cLp
            </div>
            <button style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#818CF8', fontSize: 12, cursor: 'pointer' }}>
              📋 复制地址
            </button>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F59E0B08', border: '1px solid #F59E0B33', fontSize: 11, color: '#FBBF24' }}>
            ⚠️ 请勿充值其他币种 (BSC/BEP20/ERC20)，否则将永久丢失
          </div>
        </div>
      )}

      {/* Withdraw form */}
      {tab === 'withdraw' && (
        <div style={{ padding: '20px', borderRadius: 12, background: '#111827', border: '1px solid #1F2937' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>提现金额 (USDT)</label>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="最低 50 USDT"
              style={{
                width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #374151',
                background: '#1F2937', color: '#E5E7EB', fontSize: 16, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
              手续费: 1.0 USDT · 到账金额: <span style={{ color: '#D1D5DB' }}>{amount ? Number(amount) - 1 : '—'} USDT</span>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>TRC20 收款地址</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="T开头 TRC20 地址"
              style={{
                width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #374151',
                background: '#1F2937', color: '#E5E7EB', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <button style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: amount && address ? '#6366F1' : '#374151',
            color: amount && address ? '#FFF' : '#6B7280', fontSize: 15, fontWeight: 700, cursor: amount && address ? 'pointer' : 'not-allowed',
          }}>
            确认提现
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab: Revenue ──
function RevenueTab() {
  const currentTier = 1;

  return (
    <div>
      {/* Revenue card */}
      <div style={{
        padding: '24px', borderRadius: 14, background: 'linear-gradient(135deg, #D4A85314, #10B9810A)',
        border: '1px solid #374151', marginBottom: 20,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>本月收入</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#10B981' }}>$357</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>到手 (70%)</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#D4A853' }}>$249</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>平台佣金</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#6B7280' }}>$107</div>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#D1D5DB', marginBottom: 12 }}>
          🏆 创作者分账等级
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {REVENUE_TIERS.map(t => (
            <TierCard key={t.level} tier={t} isActive={t.level === currentTier} />
          ))}
        </div>
      </div>

      {/* Progress to next tier */}
      <div style={{ padding: '14px 16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937' }}>
        <div style={{ fontSize: 12, color: '#D1D5DB', marginBottom: 6 }}>
          🎯 距离高级创作者还差 <strong style={{ color: '#D4A853' }}>$143/月</strong> — 升级后分成 75%
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#374151', overflow: 'hidden' }}>
          <div style={{ width: '71%', height: '100%', background: 'linear-gradient(90deg, #6366F1, #D4A853)', borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

// ── Tab: History ──
function HistoryTab() {
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>类型</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: '#9CA3AF' }}>金额</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#9CA3AF' }}>状态</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>TxHash</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>日期</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>备注</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_TX.map(tx => (
              <tr key={tx.id} style={{ borderBottom: '1px solid #1F2937' }}>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ color: tx.type === 'deposit' ? '#10B981' : tx.type === 'withdraw' ? '#EF4444' : '#D4A853', fontWeight: 600 }}>
                    {tx.type === 'deposit' ? '📥 充值' : tx.type === 'withdraw' ? '📤 提现' : '💰 收益'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#D1D5DB', fontWeight: 600 }}>
                  {tx.type === 'withdraw' ? '-' : '+'}{tx.amount.toFixed(2)} USDT
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><TxStatusBadge status={tx.status} /></td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{tx.txHash}</td>
                <td style={{ padding: '10px 12px', color: '#9CA3AF', fontSize: 11 }}>{tx.date}</td>
                <td style={{ padding: '10px 12px', color: '#9CA3AF', fontSize: 11 }}>{tx.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main ──
export default function USDTPaymentPanel() {
  const [tab, setTab] = useState<'wallet' | 'revenue' | 'history'>('wallet');

  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 820, margin: '0 auto',
  };

  return (
    <div style={theme}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>
            💰 USDT 钱包 & 收益
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            TRC20 充值提现 · 创作者收益分账 L1/L2/L3
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        <button onClick={() => setTab('wallet')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'wallet' ? '#6366F1' : '#1F2937',
          color: tab === 'wallet' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>💳 钱包</button>
        <button onClick={() => setTab('revenue')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'revenue' ? '#6366F1' : '#1F2937',
          color: tab === 'revenue' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>📊 收益分账</button>
        <button onClick={() => setTab('history')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'history' ? '#6366F1' : '#1F2937',
          color: tab === 'history' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>📋 交易记录</button>
      </div>

      {tab === 'wallet' && <WalletTab />}
      {tab === 'revenue' && <RevenueTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}
