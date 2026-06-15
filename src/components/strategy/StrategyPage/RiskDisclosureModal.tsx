// ── R216 ML P2: RiskDisclosureModal — 实盘前风险揭示书弹窗+二次确认 ──────────
// P2: 2 checkboxes + slider confirmation + disclaimer
// Required before any live trading: User must acknowledge risk + confirm via slider
// 9-language i18n + compliance-grade UI + audit trail metadata

import React, { useState, useRef } from 'react';

export interface RiskDisclosureData {
  strategyName: string;
  strategyId: string;
  estimatedMaxLoss: number; // 0-100 (% of capital)
  estimatedAnnualReturn: number; // 0-100
  sharpeRatio: number;
  hasInsurance?: boolean;
  hasStopLoss?: boolean;
  hasAPISafety?: boolean;
}

interface RiskDisclosureModalProps {
  visible?: boolean;
  data: RiskDisclosureData;
  onConfirm?: () => Promise<void>;
  onCancel?: () => void;
  locale?: string;
}

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '⚠️ 实盘前风险揭示书',
    subtitle: '请仔细阅读,理解所有风险后再开启实盘交易',
    strategy: '策略',
    metrics: '关键指标',
    maxLoss: '预估最大亏损', annualReturn: '预估年化收益', sharpe: '夏普比',
    riskAck1: '我已了解: 该策略可能亏损全部本金',
    riskAck2: '我已了解: 历史业绩不代表未来收益,实盘可能完全不同',
    sliderHint: '拖动滑块从左到右确认',
    sliderComplete: '✅ 风险已确认',
    sliderIncomplete: '请拖动滑块确认',
    insurance: '策略保险', insuranceOn: '已购买(亏损>5%触发免费AI诊断)',
    insuranceOff: '未购买(建议先购买)',
    stopLoss: '止损规则', stopLossOn: '已设置', stopLossOff: '未设置',
    apiSafe: 'API Key安全', apiSafeOn: '已授权(只读+交易,禁提币)',
    apiSafeOff: '未授权',
    confirmBtn: '我已了解所有风险,继续实盘',
    cancelBtn: '再想想',
    holdNotice: '⚠️ 数字货币和金融工具交易涉及重大风险',
    regulatory: '📜 本平台不构成投资建议, 用户需自负盈亏',
  },
  en: {
    title: '⚠️ Live Trading Risk Disclosure',
    subtitle: 'Please read carefully and understand all risks before going live',
    strategy: 'Strategy',
    metrics: 'Key Metrics',
    maxLoss: 'Est. Max Loss', annualReturn: 'Est. Annual Return', sharpe: 'Sharpe',
    riskAck1: 'I understand: This strategy may lose my entire capital',
    riskAck2: 'I understand: Past performance does not guarantee future results',
    sliderHint: 'Drag slider left to right to confirm',
    sliderComplete: '✅ Risk Confirmed',
    sliderIncomplete: 'Drag slider to confirm',
    insurance: 'Strategy Insurance', insuranceOn: 'Purchased (loss>5% triggers free AI diagnosis)',
    insuranceOff: 'Not purchased (recommended)',
    stopLoss: 'Stop-Loss Rule', stopLossOn: 'Configured', stopLossOff: 'Not configured',
    apiSafe: 'API Key Safety', apiSafeOn: 'Authorized (Read+Trade only, no withdrawal)',
    apiSafeOff: 'Not authorized',
    confirmBtn: 'I understand all risks, proceed to live',
    cancelBtn: 'Think again',
    holdNotice: '⚠️ Trading involves substantial risk of loss',
    regulatory: '📜 This platform is not investment advice, you bear all risk',
  },
  ja: { title: '⚠️ 実取引前リスク開示書', subtitle: '実取引開始前にすべてのリスクを理解してください', strategy: '戦略', metrics: '主要指標', maxLoss: '推定最大損失', annualReturn: '推定年率リターン', sharpe: 'シャープ', riskAck1: '理解しました: この戦略で元本をすべて失う可能性があります', riskAck2: '理解しました: 過去のパフォーマンスは将来を保証しません', sliderHint: 'スライダーを右にドラッグして確認', sliderComplete: '✅ 確認済', sliderIncomplete: 'スライダーをドラッグ', insurance: '戦略保険', insuranceOn: '購入済', insuranceOff: '未購入(推奨)', stopLoss: '損切りルール', stopLossOn: '設定済', stopLossOff: '未設定', apiSafe: 'APIキー安全性', apiSafeOn: '認証済', apiSafeOff: '未認証', confirmBtn: 'すべてのリスクを理解,実取引へ', cancelBtn: '再考する', holdNotice: '⚠️ 取引には大きな損失リスクが伴います', regulatory: '📜 本プラットフォームは投資助言ではありません' },
  ko: { title: '⚠️ 실거래 전 위험 고지서', subtitle: '실거래 시작 전 모든 위험을 이해하세요', strategy: '전략', metrics: '주요 지표', maxLoss: '예상 최대 손실', annualReturn: '예상 연간 수익', sharpe: '샤프', riskAck1: '이해: 이 전략으로 원금을 모두 잃을 수 있음', riskAck2: '이해: 과거 실적이 미래를 보장하지 않음', sliderHint: '슬라이더를 오른쪽으로 끌어서 확인', sliderComplete: '✅ 확인됨', sliderIncomplete: '슬라이더를 드래그', insurance: '전략 보험', insuranceOn: '구매함', insuranceOff: '미구매(권장)', stopLoss: '스탑로스', stopLossOn: '설정됨', stopLossOff: '미설정', apiSafe: 'API 키 보안', apiSafeOn: '인증됨', apiSafeOff: '미인증', confirmBtn: '모든 위험을 이해, 실거래로', cancelBtn: '다시 생각', holdNotice: '⚠️ 거래에는 큰 손실 위험', regulatory: '📜 본 플랫폼은 투자 조언 아님' },
  fr: { title: '⚠️ Divulgation des Risques', subtitle: 'Veuillez lire attentivement avant de passer en direct', strategy: 'Stratégie', metrics: 'Indicateurs', maxLoss: 'Perte max estimée', annualReturn: 'Rendement annuel', sharpe: 'Sharpe', riskAck1: 'Je comprends: cette stratégie peut perdre tout mon capital', riskAck2: 'Je comprends: les performances passées ne garantissent pas le futur', sliderHint: 'Glissez le curseur pour confirmer', sliderComplete: '✅ Confirmé', sliderIncomplete: 'Glissez pour confirmer', insurance: 'Assurance', insuranceOn: 'Acheté', insuranceOff: 'Non acheté (recommandé)', stopLoss: 'Stop-Loss', stopLossOn: 'Configuré', stopLossOff: 'Non configuré', apiSafe: 'Sécurité API', apiSafeOn: 'Autorisé', apiSafeOff: 'Non autorisé', confirmBtn: 'Je comprends, continuer', cancelBtn: 'Réfléchir', holdNotice: '⚠️ Le trading comporte des risques', regulatory: '📜 Ce n\'est pas un conseil d\'investissement' },
  it: { title: '⚠️ Divulgazione Rischi', subtitle: 'Leggere attentamente prima del live', strategy: 'Strategia', metrics: 'Indicatori', maxLoss: 'Perdita max stimata', annualReturn: 'Rendimento annuo', sharpe: 'Sharpe', riskAck1: 'Capisco: questa strategia può perdere tutto il capitale', riskAck2: 'Capisco: i rendimenti passati non garantiscono il futuro', sliderHint: 'Trascina il cursore per confermare', sliderComplete: '✅ Confermato', sliderIncomplete: 'Trascina per confermare', insurance: 'Assicurazione', insuranceOn: 'Acquistata', insuranceOff: 'Non acquistata (consigliata)', stopLoss: 'Stop-Loss', stopLossOn: 'Configurato', stopLossOff: 'Non configurato', apiSafe: 'Sicurezza API', apiSafeOn: 'Autorizzato', apiSafeOff: 'Non autorizzato', confirmBtn: 'Capisco, procedi al live', cancelBtn: 'Riflettere', holdNotice: '⚠️ Il trading comporta rischi', regulatory: '📜 Non è un consiglio di investimento' },
  de: { title: '⚠️ Risikoaufklärung', subtitle: 'Bitte lesen Sie sorgfältig vor dem Live-Handel', strategy: 'Strategie', metrics: 'Kennzahlen', maxLoss: 'Geschätzter Max-Verlust', annualReturn: 'Geschätzte Jahresrendite', sharpe: 'Sharpe', riskAck1: 'Ich verstehe: Diese Strategie kann mein gesamtes Kapital verlieren', riskAck2: 'Ich verstehe: Vergangene Performance garantiert keine Zukunft', sliderHint: 'Schieberegler nach rechts ziehen', sliderComplete: '✅ Bestätigt', sliderIncomplete: 'Ziehen zum Bestätigen', insurance: 'Versicherung', insuranceOn: 'Gekauft', insuranceOff: 'Nicht gekauft (empfohlen)', stopLoss: 'Stop-Loss', stopLossOn: 'Konfiguriert', stopLossOff: 'Nicht konfiguriert', apiSafe: 'API-Sicherheit', apiSafeOn: 'Autorisiert', apiSafeOff: 'Nicht autorisiert', confirmBtn: 'Verstanden, Live starten', cancelBtn: 'Überdenken', holdNotice: '⚠️ Handel birgt Verlustrisiken', regulatory: '📜 Keine Anlageberatung' },
  es: { title: '⚠️ Divulgación de Riesgos', subtitle: 'Lea atentamente antes del trading en vivo', strategy: 'Estrategia', metrics: 'Métricas', maxLoss: 'Pérdida máx estimada', annualReturn: 'Retorno anual', sharpe: 'Sharpe', riskAck1: 'Entiendo: esta estrategia puede perder todo mi capital', riskAck2: 'Entiendo: el rendimiento pasado no garantiza el futuro', sliderHint: 'Arrastre el control para confirmar', sliderComplete: '✅ Confirmado', sliderIncomplete: 'Arrastre para confirmar', insurance: 'Seguro', insuranceOn: 'Comprado', insuranceOff: 'No comprado (recomendado)', stopLoss: 'Stop-Loss', stopLossOn: 'Configurado', stopLossOff: 'No configurado', apiSafe: 'Seguridad API', apiSafeOn: 'Autorizado', apiSafeOff: 'No autorizado', confirmBtn: 'Entiendo, proceder', cancelBtn: 'Pensar de nuevo', holdNotice: '⚠️ El trading tiene riesgos', regulatory: '📜 No es consejo de inversión' },
};

const RiskDisclosureModal: React.FC<RiskDisclosureModalProps> = ({
  visible = true, data, onConfirm, onCancel, locale: pl,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  if (!visible) return null;

  const allAcked = ack1 && ack2 && sliderValue >= 95;

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    let clientX = 0;
    if ('touches' in e) { clientX = e.touches[0]?.clientX ?? 0; }
    else { clientX = (e as React.MouseEvent).clientX; }
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderValue(pct);
  };

  const handleConfirm = async () => {
    if (!onConfirm || !allAcked) return;
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10003,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px 28px',
        maxWidth: 480, width: '92%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', margin: '0 0 4px' }}>
            {t.title}
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{t.subtitle}</p>
        </div>

        {/* ── Strategy + Metrics ─────────────────────────────────── */}
        <div style={{ background: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#92400e', marginBottom: 4 }}>{t.strategy}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
            {data.strategyName}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Metric label={t.maxLoss} value={`${data.estimatedMaxLoss.toFixed(1)}%`} color="#dc2626" />
            <Metric label={t.annualReturn} value={`${data.estimatedAnnualReturn.toFixed(1)}%`} color="#22c55e" />
            <Metric label={t.sharpe} value={data.sharpeRatio.toFixed(2)} color="#3b82f6" />
          </div>
        </div>

        {/* ── Safety Status ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <SafetyItem label={t.insurance} ok={data.hasInsurance} okText={t.insuranceOn} badText={t.insuranceOff} />
          <SafetyItem label={t.stopLoss} ok={data.hasStopLoss} okText={t.stopLossOn} badText={t.stopLossOff} />
          <SafetyItem label={t.apiSafe} ok={data.hasAPISafety} okText={t.apiSafeOn} badText={t.apiSafeOff} />
        </div>

        {/* ── Acknowledgements ───────────────────────────────────── */}
        <div style={{ background: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 12, border: '1px solid #fca5a5' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#7f1d1d', marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={ack1} onChange={e => setAck1(e.target.checked)} style={{ marginTop: 2 }} />
            <span><strong>①</strong> {t.riskAck1}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#7f1d1d', cursor: 'pointer' }}>
            <input type="checkbox" checked={ack2} onChange={e => setAck2(e.target.checked)} style={{ marginTop: 2 }} />
            <span><strong>②</strong> {t.riskAck2}</span>
          </label>
        </div>

        {/* ── Slider Confirmation ────────────────────────────────── */}
        <div
          ref={trackRef}
          onMouseMove={(e) => { if (e.buttons === 1) handleSliderMove(e); }}
          onClick={handleSliderMove}
          onTouchMove={handleSliderMove}
          style={{
            position: 'relative', height: 44, background: '#e2e8f0',
            borderRadius: 22, marginBottom: 8, cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${sliderValue}%`,
            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
            borderRadius: 22, transition: 'width 0.1s',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: '#1e293b',
            pointerEvents: 'none',
          }}>
            {sliderValue < 95 ? `→ ${t.sliderHint}` : t.sliderComplete}
          </div>
          <div style={{
            position: 'absolute', top: 4, left: `${Math.max(0, sliderValue - 8)}%`,
            width: 36, height: 36, borderRadius: '50%',
            background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'left 0.1s',
          }} />
        </div>

        {/* ── Regulatory Notice ──────────────────────────────────── */}
        <div style={{ background: '#f0f9ff', borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 11, color: '#0369a1' }}>
          <div>{t.holdNotice}</div>
          <div style={{ marginTop: 4 }}>{t.regulatory}</div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, background: 'transparent', color: '#64748b',
            border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            {t.cancelBtn}
          </button>
          <button onClick={handleConfirm} disabled={!allAcked || loading} style={{
            flex: 2,
            background: allAcked ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : '#cbd5e1',
            color: '#fff', border: 'none', borderRadius: 10, padding: '12px',
            fontSize: 13, fontWeight: 700, cursor: allAcked ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.7 : 1,
            boxShadow: allAcked ? '0 4px 12px rgba(220,38,38,0.3)' : 'none',
          }}>
            {loading ? '...' : t.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 10, color: '#92400e' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
  </div>
);

const SafetyItem: React.FC<{ label: string; ok?: boolean; okText: string; badText: string }> = ({ label, ok, okText, badText }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 10px', background: ok ? '#ecfdf5' : '#fef3c7',
    borderRadius: 6, fontSize: 12,
  }}>
    <span style={{ color: ok ? '#065f46' : '#92400e', fontWeight: 500 }}>{label}</span>
    <span style={{ color: ok ? '#22c55e' : '#f59e0b', fontSize: 11 }}>
      {ok ? `✓ ${okText}` : `⚠ ${badText}`}
    </span>
  </div>
);

export default RiskDisclosureModal;
