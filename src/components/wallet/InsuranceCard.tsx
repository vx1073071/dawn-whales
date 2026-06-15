// ── R211 ML P7: InsuranceCard — 策略保险UI ──────────
// 1U purchase → 7-day policy card → claim entry → diagnosis result
// Buy: [1U Purchase Insurance] button with balance check
// Active: show policy countdown + current loss% + [Claim] button when loss>5%
// Claimed: free AI diagnosis result (worth 2.5U) + suggested actions
// Expired: show "expired" badge + [Buy New] button

import React, { useState, useCallback } from 'react';
import { Button, Tag, Card, Progress, Modal } from 'antd';
import {
  SafetyCertificateOutlined, ClockCircleOutlined,
  ThunderboltOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface InsurancePolicy {
  policyId: string;
  strategyId: string;
  strategyName: string;
  purchasedAt: number;
  expiresAt: number;
  status: 'active' | 'claimed' | 'expired';
  premiumUSDT: number;
  lossPercent: number;
  claimResult?: {
    diagnosis: string;
    suggestedActions: string[];
    suggestedFactors: string[];
  };
}

interface InsuranceCardProps {
  strategyId?: string;
  strategyName?: string;
  currentPolicy?: InsurancePolicy | null;
  currentLossPercent?: number;
  balance?: number | null;
  onPurchase?: (strategyId: string) => Promise<{ success: boolean; policy?: InsurancePolicy }>;
  onClaim?: (policyId: string) => Promise<{ success: boolean; claimResult?: InsurancePolicy['claimResult'] }>;
  locale?: string;
  compact?: boolean;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '策略保险', buy: '1U 购买保险', buyDesc: '7天保障期，策略亏损>5%自动触发，免费AI诊断（价值2.5U）',
    active: '保障中', claimed: '已理赔', expired: '已到期',
    lossLabel: '当前亏损', claimBtn: '免费理赔', claimDesc: '亏损超5%，点击获取免费AI诊断',
    diagnosis: 'AI诊断结果', worth: '价值 2.5 USDT (免费)', actions: '建议操作',
    expireIn: '到期', noPolicy: '暂无保单', buyHint: '给策略买份保险，亏了免费诊断',
    renew: '重新购买', days: '天', hours: '小时',
    confirmBuy: '确认购买策略保险？', confirmBuyDesc: '将扣除 1 USDT，获得7天保障',
    cancel: '取消', confirm: '确认购买', purchasing: '购买中...',
  },
  en: {
    title: 'Strategy Insurance', buy: '1U Buy Insurance', buyDesc: '7-day protection. Loss >5% triggers free AI diagnosis (worth 2.5U)',
    active: 'Active', claimed: 'Claimed', expired: 'Expired',
    lossLabel: 'Current Loss', claimBtn: 'Free Claim', claimDesc: 'Loss >5%! Get free AI diagnosis now',
    diagnosis: 'AI Diagnosis', worth: 'Worth 2.5 USDT (Free)', actions: 'Suggested Actions',
    expireIn: 'Expires', noPolicy: 'No Active Policy', buyHint: 'Insure your strategy — loss triggers free diagnosis',
    renew: 'Buy New', days: 'd', hours: 'h',
    confirmBuy: 'Confirm Insurance Purchase?', confirmBuyDesc: '1 USDT will be deducted for 7-day protection',
    cancel: 'Cancel', confirm: 'Confirm Buy', purchasing: 'Purchasing...',
  },
  ja: { title: '戦略保険', buy: '1U 保険購入', buyDesc: '7日間保護。損失5%超で無料AI診断(2.5U相当)', active: '有効', claimed: '請求済', expired: '期限切れ', lossLabel: '現在の損失', claimBtn: '無料請求', claimDesc: '損失5%超!無料AI診断を受ける', diagnosis: 'AI診断結果', worth: '2.5 USDT相当(無料)', actions: '推奨アクション', expireIn: '期限', noPolicy: '保険なし', buyHint: '戦略に保険をかけよう', renew: '再購入', days: '日', hours: '時間', confirmBuy: '保険購入を確認?', confirmBuyDesc: '1 USDTが7日間保護のために引き落とされます', cancel: 'キャンセル', confirm: '購入する', purchasing: '購入中...' },
  ko: { title: '전략 보험', buy: '1U 보험 구매', buyDesc: '7일 보호. 손실 5% 초과시 무료 AI 진단(2.5U 상당)', active: '활성', claimed: '청구됨', expired: '만료됨', lossLabel: '현재 손실', claimBtn: '무료 청구', claimDesc: '손실 5% 초과! 무료 AI 진단 받기', diagnosis: 'AI 진단 결과', worth: '2.5 USDT 상당 (무료)', actions: '권장 조치', expireIn: '만료', noPolicy: '보험 없음', buyHint: '전략에 보험을 들어보세요', renew: '재구매', days: '일', hours: '시간', confirmBuy: '보험 구매 확인?', confirmBuyDesc: '7일 보호를 위해 1 USDT가 차감됩니다', cancel: '취소', confirm: '구매', purchasing: '구매 중...' },
  fr: { title: 'Assurance Stratégie', buy: '1U Acheter', buyDesc: 'Protection 7j. Perte >5% → diagnostic IA gratuit (valeur 2.5U)', active: 'Actif', claimed: 'Réclamé', expired: 'Expiré', lossLabel: 'Perte actuelle', claimBtn: 'Réclamation gratuite', claimDesc: 'Perte >5%! Diagnostic IA gratuit', diagnosis: 'Diagnostic IA', worth: 'Valeur 2.5 USDT (Gratuit)', actions: 'Actions suggérées', expireIn: 'Expire', noPolicy: 'Aucune police', buyHint: 'Assurez votre stratégie', renew: 'Racheter', days: 'j', hours: 'h', confirmBuy: 'Confirmer l\'achat?', confirmBuyDesc: '1 USDT sera déduit pour 7 jours de protection', cancel: 'Annuler', confirm: 'Confirmer', purchasing: 'Achat...' },
  it: { title: 'Assicurazione Strategia', buy: '1U Acquista', buyDesc: 'Protezione 7gg. Perdita >5% → diagnosi IA gratuita (valore 2.5U)', active: 'Attivo', claimed: 'Richiesto', expired: 'Scaduto', lossLabel: 'Perdita attuale', claimBtn: 'Richiesta gratuita', claimDesc: 'Perdita >5%! Diagnosi IA gratuita', diagnosis: 'Diagnosi IA', worth: 'Valore 2.5 USDT (Gratis)', actions: 'Azioni suggerite', expireIn: 'Scade', noPolicy: 'Nessuna polizza', buyHint: 'Assicura la tua strategia', renew: 'Riacquista', days: 'gg', hours: 'h', confirmBuy: 'Confermare acquisto?', confirmBuyDesc: '1 USDT sarà dedotto per 7 giorni di protezione', cancel: 'Annulla', confirm: 'Conferma', purchasing: 'Acquisto...' },
  de: { title: 'Strategie-Versicherung', buy: '1U Kaufen', buyDesc: '7 Tage Schutz. Verlust >5% → kostenlose KI-Diagnose (Wert 2.5U)', active: 'Aktiv', claimed: 'Eingelöst', expired: 'Abgelaufen', lossLabel: 'Aktueller Verlust', claimBtn: 'Kostenlos einlösen', claimDesc: 'Verlust >5%! Kostenlose KI-Diagnose', diagnosis: 'KI-Diagnose', worth: 'Wert 2.5 USDT (Kostenlos)', actions: 'Vorgeschlagene Aktionen', expireIn: 'Läuft ab', noPolicy: 'Keine Police', buyHint: 'Versichern Sie Ihre Strategie', renew: 'Neu kaufen', days: 'T', hours: 'Std', confirmBuy: 'Kauf bestätigen?', confirmBuyDesc: '1 USDT wird für 7 Tage Schutz abgezogen', cancel: 'Abbrechen', confirm: 'Bestätigen', purchasing: 'Kaufe...' },
  es: { title: 'Seguro de Estrategia', buy: '1U Comprar', buyDesc: 'Protección 7d. Pérdida >5% → diagnóstico IA gratuito (valor 2.5U)', active: 'Activo', claimed: 'Reclamado', expired: 'Expirado', lossLabel: 'Pérdida actual', claimBtn: 'Reclamar gratis', claimDesc: '¡Pérdida >5%! Diagnóstico IA gratuito', diagnosis: 'Diagnóstico IA', worth: 'Valor 2.5 USDT (Gratis)', actions: 'Acciones sugeridas', expireIn: 'Expira', noPolicy: 'Sin póliza', buyHint: 'Asegura tu estrategia', renew: 'Recomprar', days: 'd', hours: 'h', confirmBuy: '¿Confirmar compra?', confirmBuyDesc: 'Se deducirá 1 USDT por 7 días de protección', cancel: 'Cancelar', confirm: 'Confirmar', purchasing: 'Comprando...' },
};

// ── Helper ──────────────────────────────────────────────────────────
function getTimeLeft(expiresAt: number): { days: number; hours: number } {
  const diff = Math.max(0, expiresAt - Date.now());
  return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000) };
}

// ── Component ───────────────────────────────────────────────────────
const InsuranceCard: React.FC<InsuranceCardProps> = ({
  strategyId = 'default',
  strategyName = 'Strategy',
  currentPolicy: propPolicy,
  currentLossPercent = 0,
  balance,
  onPurchase,
  onClaim,
  locale: pl,
  compact = false,
}) => {
  const lang = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[lang] ?? I18N.en;

  const [policy, setPolicy] = useState<InsurancePolicy | null>(propPolicy ?? null);
  const [loading, setLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const timeLeft = policy?.status === 'active' ? getTimeLeft(policy.expiresAt) : null;
  const showClaim = policy?.status === 'active' && currentLossPercent >= 5;
  const balanceOk = (balance ?? 0) >= 1;

  // ── Purchase ──────────────────────────────────────────────────────
  const handlePurchase = useCallback(async () => {
    if (!onPurchase) return;
    setLoading(true);
    try {
      const res = await onPurchase(strategyId);
      if (res.success && res.policy) setPolicy(res.policy);
    } finally { setLoading(false); setModalOpen(false); }
  }, [onPurchase, strategyId]);

  // ── Claim ─────────────────────────────────────────────────────────
  const handleClaim = useCallback(async () => {
    if (!onClaim || !policy) return;
    setClaimLoading(true);
    try {
      const res = await onClaim(policy.policyId);
      if (res.success && res.claimResult) {
        setPolicy(prev => prev ? { ...prev, status: 'claimed' as const, claimResult: res.claimResult } : prev);
      }
    } finally { setClaimLoading(false); }
  }, [onClaim, policy]);

  // ── Status Badge ──────────────────────────────────────────────────
  const statusTag = !policy ? null : policy.status === 'active'
    ? <Tag color="green" icon={<SafetyCertificateOutlined />}>{t.active}</Tag>
    : policy.status === 'claimed'
    ? <Tag color="orange" icon={<CheckCircleOutlined />}>{t.claimed}</Tag>
    : <Tag color="default" icon={<CloseCircleOutlined />}>{t.expired}</Tag>;

  const lossColor = currentLossPercent >= 5 ? '#ef4444' : currentLossPercent >= 2 ? '#f59e0b' : '#22c55e';

  // ── No Policy ─────────────────────────────────────────────────────
  if (!policy || policy.status === 'expired') {
    return (
      <Card
        size={compact ? 'small' : 'default'}
        title={<span><SafetyCertificateOutlined style={{ marginRight: 8 }} />{t.title}</span>}
        style={{ marginBottom: compact ? 0 : 16 }}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <ExclamationCircleOutlined style={{ fontSize: 36, color: '#94a3b8', marginBottom: 12 }} />
          <div style={{ color: '#64748b', marginBottom: 8 }}>{t.noPolicy}</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>{t.buyHint}</div>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            loading={loading}
            disabled={!balanceOk}
            onClick={() => setModalOpen(true)}
          >
            {policy ? t.renew : t.buy}
          </Button>
          {balance !== null && balance !== undefined && !balanceOk && (
            <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>
              ⚠ {lang === 'zh-CN' ? '余额不足 1 USDT' : 'Insufficient balance (1 USDT required)'}
            </div>
          )}
        </div>

        <Modal
          open={modalOpen}
          title={t.confirmBuy}
          onOk={handlePurchase}
          onCancel={() => setModalOpen(false)}
          okText={loading ? t.purchasing : t.confirm}
          cancelText={t.cancel}
          confirmLoading={loading}
        >
          <div style={{ padding: '8px 0' }}>
            <p><strong>{strategyName}</strong></p>
            <p>{t.confirmBuyDesc}</p>
            <Tag color="blue">1 USDT</Tag>
            <Tag color="green">7 {lang === 'zh-CN' ? '天保障' : 'days'}</Tag>
          </div>
        </Modal>
      </Card>
    );
  }

  // ── Active / Claimed Policy ───────────────────────────────────────
  return (
    <Card
      size={compact ? 'small' : 'default'}
      title={<span><SafetyCertificateOutlined style={{ marginRight: 8 }} />{t.title}</span>}
      extra={statusTag}
      style={{ marginBottom: compact ? 0 : 16 }}
    >
      {/* ── Policy Header ────────────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{strategyName}</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ color: '#64748b' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {policy.status === 'active' && timeLeft
              ? `${t.expireIn}: ${timeLeft.days}${t.days} ${timeLeft.hours}${t.hours}`
              : policy.status === 'claimed'
              ? t.claimed
              : t.expired}
          </span>
          <span style={{ color: lossColor, fontWeight: 600 }}>
            {t.lossLabel}: {currentLossPercent.toFixed(1)}%
          </span>
          <Tag color="blue">1 USDT</Tag>
        </div>
      </div>

      {/* ── Progress Bar ─────────────────────────────────────────── */}
      {policy.status === 'active' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: lossColor }}>{currentLossPercent.toFixed(1)}%</span>
            <span style={{ color: '#94a3b8' }}>5% {lang === 'zh-CN' ? '触发线' : 'trigger'}</span>
          </div>
          <Progress
            percent={Math.min(100, (currentLossPercent / 5) * 100)}
            showInfo={false}
            strokeColor={lossColor}
            trailColor="#e2e8f0"
            size="small"
          />
        </div>
      )}

      {/* ── Claim Button ─────────────────────────────────────────── */}
      {showClaim && (
        <div style={{
          background: '#fef3c7', borderRadius: 8, padding: '12px 16px',
          marginBottom: 12, border: '1px solid #fbbf24',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExclamationCircleOutlined style={{ color: '#d97706', fontSize: 18 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#92400e', fontSize: 13 }}>{t.claimDesc}</div>
              <div style={{ color: '#a16207', fontSize: 12 }}>{t.worth}</div>
            </div>
            <Button
              type="primary"
              danger
              size="small"
              icon={<ThunderboltOutlined />}
              loading={claimLoading}
              onClick={handleClaim}
            >
              {t.claimBtn}
            </Button>
          </div>
        </div>
      )}

      {/* ── Claim Result ─────────────────────────────────────────── */}
      {policy.status === 'claimed' && policy.claimResult && (
        <div style={{
          background: '#ecfdf5', borderRadius: 8, padding: '16px',
          border: '1px solid #6ee7b7',
        }}>
          <div style={{ fontWeight: 600, color: '#065f46', marginBottom: 8, fontSize: 14 }}>
            <CheckCircleOutlined style={{ marginRight: 6 }} />{t.diagnosis}
            <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>{t.worth}</Tag>
          </div>

          <div style={{
            background: '#fff', borderRadius: 6, padding: 12,
            marginBottom: 10, fontSize: 13, color: '#334155', lineHeight: 1.6,
          }}>
            {policy.claimResult.diagnosis}
          </div>

          <div style={{ fontWeight: 600, color: '#065f46', marginBottom: 6, fontSize: 13 }}>
            {t.actions}
          </div>

          {policy.claimResult.suggestedActions.map((action, i) => (
            <Tag key={i} color="processing" style={{ marginBottom: 4 }}>
              {action}
            </Tag>
          ))}
          {policy.claimResult.suggestedFactors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {policy.claimResult.suggestedFactors.map((f, i) => (
                <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{f}</Tag>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default InsuranceCard;
