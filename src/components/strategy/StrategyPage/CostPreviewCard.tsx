// ── R215 ML P2: CostPreviewCard — 每次AI操作前费用预览卡片 ──────────
// U2: Pre-action cost confirmation modal
// Shows: action + cost + current balance + free trial status
// 3 buttons: 取消 / 用免费次数 / 确认付费
// 9-language i18n + balance warning + AI fault refund disclaimer

import React, { useState } from 'react';

export interface CostPreviewProps {
  visible?: boolean;
  serviceName: string;
  serviceDesc?: string;
  costUSDT: number;
  currentBalance?: number;
  freeTrialsUsed?: number;
  freeTrialsTotal?: number;
  icon?: string;
  onConfirm?: (useFreeTrial: boolean) => Promise<void>;
  onCancel?: () => void;
  locale?: string;
}

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '💸 确认 AI 服务',
    will: '即将执行',
    cost: '本次费用',
    balance: '当前余额',
    afterBalance: '扣费后余额',
    free: '免费次数',
    freeUsed: '已使用',
    freeRemain: '剩余',
    useFree: '使用免费次数',
    payNow: '确认支付',
    cancel: '取消',
    insufficient: '余额不足',
    insufficientDesc: '本次操作需要',
    depositBtn: '去充值',
    refund: 'AI 故障自动退费',
    refundDesc: '服务异常 30 秒内自动到账',
    auto: '自动',
    confirm: '确认中...',
  },
  en: {
    title: '💸 Confirm AI Service',
    will: 'About to execute',
    cost: 'Service fee',
    balance: 'Current balance',
    afterBalance: 'After',
    free: 'Free trials',
    freeUsed: 'used',
    freeRemain: 'remaining',
    useFree: 'Use free trial',
    payNow: 'Confirm & Pay',
    cancel: 'Cancel',
    insufficient: 'Insufficient balance',
    insufficientDesc: 'This service requires',
    depositBtn: 'Deposit',
    refund: 'AI fault auto-refund',
    refundDesc: 'Auto refund within 30s on failure',
    auto: 'auto',
    confirm: 'Confirming...',
  },
  ja: { title: '💸 AIサービス確認', will: '実行予定', cost: '手数料', balance: '現在の残高', afterBalance: '後', free: '無料回数', freeUsed: '使用', freeRemain: '残り', useFree: '無料を使用', payNow: '確認して支払い', cancel: 'キャンセル', insufficient: '残高不足', insufficientDesc: 'この操作には', depositBtn: '入金', refund: 'AI障害自動返金', refundDesc: '30秒以内に自動返金', auto: '自動', confirm: '確認中...' },
  ko: { title: '💸 AI 서비스 확인', will: '실행 예정', cost: '수수료', balance: '현재 잔액', afterBalance: '차감 후', free: '무료 횟수', freeUsed: '사용', freeRemain: '남음', useFree: '무료 사용', payNow: '확인 및 결제', cancel: '취소', insufficient: '잔액 부족', insufficientDesc: '이 작업에는', depositBtn: '입금', refund: 'AI 장애 자동 환불', refundDesc: '30초 내 자동 환불', auto: '자동', confirm: '확인 중...' },
  fr: { title: '💸 Confirmer le service IA', will: 'À exécuter', cost: 'Frais', balance: 'Solde actuel', afterBalance: 'Après', free: 'Essais gratuits', freeUsed: 'utilisés', freeRemain: 'restants', useFree: 'Essai gratuit', payNow: 'Confirmer & Payer', cancel: 'Annuler', insufficient: 'Solde insuffisant', insufficientDesc: 'Ce service nécessite', depositBtn: 'Dépôt', refund: 'Remboursement auto panne IA', refundDesc: 'Sous 30s en cas de panne', auto: 'auto', confirm: 'Confirmation...' },
  it: { title: '💸 Conferma servizio IA', will: 'Da eseguire', cost: 'Costo', balance: 'Saldo attuale', afterBalance: 'Dopo', free: 'Prove gratuite', freeUsed: 'usate', freeRemain: 'rimanenti', useFree: 'Prova gratuita', payNow: 'Conferma & Paga', cancel: 'Annulla', insufficient: 'Saldo insufficiente', insufficientDesc: 'Richiede', depositBtn: 'Deposita', refund: 'Rimborso auto errore IA', refundDesc: 'Entro 30s in caso di errore', auto: 'auto', confirm: 'Conferma...' },
  de: { title: '💸 KI-Dienst bestätigen', will: 'Wird ausgeführt', cost: 'Gebühr', balance: 'Aktuelles Guthaben', afterBalance: 'Nachher', free: 'Gratis-Tests', freeUsed: 'genutzt', freeRemain: 'verbleibend', useFree: 'Gratis-Test', payNow: 'Bestätigen & Zahlen', cancel: 'Abbrechen', insufficient: 'Unzureichendes Guthaben', insufficientDesc: 'Dieser Dienst erfordert', depositBtn: 'Einzahlen', refund: 'KI-Fehler Auto-Erstattung', refundDesc: 'Auto-Erstattung in 30s', auto: 'auto', confirm: 'Bestätige...' },
  es: { title: '💸 Confirmar servicio IA', will: 'A ejecutar', cost: 'Costo', balance: 'Saldo actual', afterBalance: 'Después', free: 'Pruebas gratis', freeUsed: 'usadas', freeRemain: 'restantes', useFree: 'Prueba gratis', payNow: 'Confirmar y Pagar', cancel: 'Cancelar', insufficient: 'Saldo insuficiente', insufficientDesc: 'Este servicio requiere', depositBtn: 'Depositar', refund: 'Reembolso auto por error IA', refundDesc: 'En 30s si falla', auto: 'auto', confirm: 'Confirmando...' },
};

const CostPreviewCard: React.FC<CostPreviewProps> = ({
  visible = true, serviceName, serviceDesc, costUSDT, currentBalance,
  freeTrialsUsed = 0, freeTrialsTotal = 0, icon = '⚙️',
  onConfirm, onCancel, locale: pl,
}) => {
  // R217 P12: Price anchoring — show human-readable value comparison
  const getPriceAnchor = (cost: number): string => {
    if (cost <= 0) return '';
    if (cost === 0.5) return '≈ 1杯咖啡';
    if (cost === 1.0) return '≈ 专业分析师 10 分钟工作量';
    if (cost === 1.5) return '≈ 2小时手动调参';
    if (cost === 2.0) return '≈ 1小时专家咨询';
    if (cost <= 0.3) return '≈ 1支棒棒糖';
    if (cost <= 0.8) return '≈ 1杯奶茶';
    if (cost <= 2) return '≈ 一顿快餐';
    if (cost <= 5) return '≈ 半天兼职收入';
    return '≈ 一天兼职收入';
  };
  const priceAnchor = getPriceAnchor(costUSDT);
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const [useFree, setUseFree] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const effectiveCost = useFree && freeTrialsUsed < freeTrialsTotal ? 0 : costUSDT;
  const hasFree = freeTrialsUsed < freeTrialsTotal;
  const afterBalance = currentBalance !== undefined ? currentBalance - effectiveCost : undefined;
  const insufficient = currentBalance !== undefined && currentBalance < effectiveCost;

  const handleConfirm = async () => {
    if (!onConfirm) return;
    setLoading(true);
    try { await onConfirm(useFree && hasFree); } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10002,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px 28px',
        maxWidth: 400, width: '90%',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
            {t.title}
          </h3>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t.will}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>{serviceName}</div>
          {serviceDesc && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{serviceDesc}</div>
          )}
        </div>

        {/* ── Cost & Balance ─────────────────────────────────────── */}
        <div style={{
          background: effectiveCost === 0 ? '#ecfdf5' : '#fef3c7',
          borderRadius: 10, padding: '12px 16px', marginBottom: 12,
          border: `1px solid ${effectiveCost === 0 ? '#6ee7b7' : '#fbbf24'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{t.cost}</span>
            <span style={{
              fontSize: 22, fontWeight: 800,
              color: effectiveCost === 0 ? '#22c55e' : '#dc2626',
            }}>
              {effectiveCost === 0 ? `🎁 ${t.free}` : `${effectiveCost} USDT`}
            </span>
          </div>
          {/* R217 P12: Price anchoring */}
          {priceAnchor && effectiveCost > 0 && (
            <div style={{ fontSize: 11, color: '#92400e', fontStyle: 'italic', marginBottom: 4 }}>
              💡 {priceAnchor}
            </div>
          )}
          {currentBalance !== undefined && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                <span>{t.balance}</span>
                <span style={{ fontWeight: 600 }}>{currentBalance.toFixed(2)} USDT</span>
              </div>
              {effectiveCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: afterBalance && afterBalance >= 0 ? '#64748b' : '#dc2626' }}>
                    {afterBalance && afterBalance < 0 ? `⚠️ ${t.insufficient}` : t.afterBalance}
                  </span>
                  <span style={{ fontWeight: 600, color: afterBalance && afterBalance < 0 ? '#dc2626' : '#22c55e' }}>
                    {afterBalance?.toFixed(2)} USDT
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Free Trial Option ──────────────────────────────────── */}
        {freeTrialsTotal > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', background: '#f8fafc', borderRadius: 8,
            marginBottom: 12, fontSize: 12,
          }}>
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>🎁 {t.free}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>
                {t.freeUsed} {freeTrialsUsed}/{freeTrialsTotal} · {t.freeRemain} {Math.max(0, freeTrialsTotal - freeTrialsUsed)}
              </div>
            </div>
            <button
              disabled={!hasFree}
              onClick={() => setUseFree(!useFree)}
              style={{
                background: useFree && hasFree ? '#22c55e' : hasFree ? '#fff' : '#cbd5e1',
                color: useFree && hasFree ? '#fff' : hasFree ? '#22c55e' : '#94a3b8',
                border: `1px solid ${hasFree ? '#22c55e' : '#cbd5e1'}`,
                borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                cursor: hasFree ? 'pointer' : 'not-allowed',
              }}
            >
              {useFree && hasFree ? '✓' : t.useFree}
            </button>
          </div>
        )}

        {/* ── AI Fault Refund Notice ─────────────────────────────── */}
        <div style={{
          background: '#f0f9ff', borderRadius: 8, padding: '8px 12px',
          marginBottom: 16, fontSize: 11, color: '#0369a1',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>🛡️</span>
          <div>
            <strong>{t.refund}</strong>
            <div style={{ fontSize: 10, color: '#0c4a6e' }}>{t.refundDesc}</div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, background: 'transparent', color: '#64748b',
            border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            {t.cancel}
          </button>

          {insufficient ? (
            <button onClick={onCancel} style={{
              flex: 2, background: '#f59e0b', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
            }}>
              💰 {t.depositBtn}
            </button>
          ) : (
            <button onClick={handleConfirm} disabled={loading} style={{
              flex: 2,
              background: effectiveCost === 0
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#fff', border: 'none', borderRadius: 10, padding: '12px',
              fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              boxShadow: '0 2px 8px rgba(220,38,38,0.2)',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? t.confirm : (effectiveCost === 0 ? `🎁 ${t.useFree}` : t.payNow)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CostPreviewCard;
