// ── R211 ML P8: CreatorUpload — 创作者上传UI ──────────
// Strategy template → fill 4 golden rules → submit AI review (1U) → 8-item result
// Four Golden Rules: 1. Human-readable (≤80 chars) 2. Stop-loss explicit
// 3. Market+asset applicable 4. Failure self-check
// AI review: 8 checks → pass (list + Leaderboard link) / fail (suggestions + retry 1U)
// Non-refundable 1U per submission, unlimited retries

import React, { useState, useCallback } from 'react';
import { Button, Tag, Card, Input, Alert, Progress } from 'antd';
import {
  UploadOutlined, CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined, CrownOutlined, TrophyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface ReviewItem {
  name: string;
  passed: boolean;
  detail: string;
  suggestion?: string;
}

interface ReviewResult {
  reviewId: string;
  totalChecks: number;
  passedChecks: number;
  items: ReviewItem[];
  passed: boolean;
  costUSDT: number; // always 1
  reviewedAt: number;
}

interface CreatorUploadProps {
  onUpload?: (submission: {
    strategyName: string;
    goldenRules: {
      humanDesc: string;
      stopLossRule: string;
      applicableMarket: string;
      failureSelfCheck: string;
    };
    templateConfig: {
      factorIds: string[];
      parameters: Record<string, number>;
    };
    backtestSummary: string;
  }) => Promise<{ success: boolean; reviewResult?: ReviewResult; error?: string }>;
  locale?: string;
  compact?: boolean;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '创作者上传', submit: '提交审核', submitting: '提交中...', retry: '重新提交',
    strategyName: '策略名称', strategyPlaceholder: '如：MACD金叉动量策略',
    goldenRules: '四铁律', rule1: '人话描述 (≤80字)', rule1PH: '用通俗语言描述策略逻辑，让新手能看懂',
    rule2: '止损规则', rule2PH: '如：单笔亏损>2%止损 或 ATR×2止盈',
    rule3: '适用市场+品种', rule3PH: '如：A股主板 或 BTC-USDT现货',
    rule4: '失效自检', rule4PH: '如：MACD在震荡市中无效 或 单边行情失效',
    templateConfig: '模板配置', factorIds: '因子ID列表', factorIdsPH: '用逗号分隔，如：MACD_12_26, RSI_14',
    parameters: '参数', parametersPH: 'JSON格式：{"stopLossPct": 2, "takeProfitPct": 5}',
    backtest: '回测摘要', backtestPH: '简要描述回测结果，如：胜率65%，夏普1.8',
    review: '审核结果', reviewCost: '审核费用', reviewHint: '审核 1U/次，不通过不退费，可无限次重审',
    pass: '通过', fail: '未通过', resubmit: '修改后重新提交',
    passedAll: '全部通过！', passedDetail: '通过 {n}/{total} 项检查',
    failedDetail: '未通过 {n}/{total} 项检查，请修改后重试',
    checks: '审核项', online: '已上架', linked: '已关联排行榜',
    cancel: '取消', confirm: '确认', error: '提交失败',
  },
  en: {
    title: 'Creator Upload', submit: 'Submit Review', submitting: 'Submitting...', retry: 'Retry',
    strategyName: 'Strategy Name', strategyPlaceholder: 'e.g. MACD Golden Cross Momentum',
    goldenRules: 'Four Golden Rules', rule1: 'Human Description (≤80 chars)', rule1PH: 'Explain in plain language beginners can understand',
    rule2: 'Stop-loss Rule', rule2PH: 'e.g. Single loss >2% stop-loss or ATR×2 take-profit',
    rule3: 'Market + Asset', rule3PH: 'e.g. A-share market or BTC-USDT spot',
    rule4: 'Failure Self-check', rule4PH: 'e.g. MACD fails in range-bound markets',
    templateConfig: 'Template Config', factorIds: 'Factor IDs', factorIdsPH: 'Comma-separated: MACD_12_26, RSI_14',
    parameters: 'Parameters', parametersPH: 'JSON: {"stopLossPct": 2, "takeProfitPct": 5}',
    backtest: 'Backtest Summary', backtestPH: 'e.g. Win rate 65%, Sharpe 1.8',
    review: 'Review Result', reviewCost: 'Review Fee', reviewHint: '1U per review, non-refundable, unlimited retries',
    pass: 'PASS', fail: 'FAIL', resubmit: 'Edit & Resubmit',
    passedAll: 'All Passed!', passedDetail: '{n}/{total} checks passed',
    failedDetail: '{n}/{total} checks failed — fix & retry',
    checks: 'Checks', online: 'Listed', linked: 'Linked to Leaderboard',
    cancel: 'Cancel', confirm: 'Confirm', error: 'Submission failed',
  },
  ja: { title: 'クリエイターアップロード', submit: '審査を提出', submitting: '提出中...', retry: '再提出', strategyName: '戦略名', strategyPlaceholder: '例: MACDゴールデンクロス', goldenRules: '四つの鉄則', rule1: '人にわかる説明(≤80字)', rule1PH: '初心者にもわかる平易な言葉で', rule2: '損切りルール', rule2PH: '例: 単一損失>2%損切り', rule3: '適用市場+銘柄', rule3PH: '例: A株 または BTC-USDT', rule4: '無効化自己チェック', rule4PH: '例: MACDはレンジ相場で無効', templateConfig: 'テンプレート設定', factorIds: '因子ID', factorIdsPH: 'カンマ区切り', parameters: 'パラメータ', parametersPH: 'JSON形式', backtest: 'バックテスト要約', backtestPH: '例: 勝率65%, シャープ1.8', review: '審査結果', reviewCost: '審査費用', reviewHint: '1U/回, 返金不可, 無制限再審査', pass: '合格', fail: '不合格', resubmit: '修正して再提出', passedAll: '全合格!', passedDetail: '{n}/{total} 項目合格', failedDetail: '{n}/{total} 項目不合格', checks: 'チェック項目', online: '公開済', linked: 'ランキング連携済', cancel: 'キャンセル', confirm: '確認', error: '提出失敗' },
  ko: { title: '크리에이터 업로드', submit: '심사 제출', submitting: '제출 중...', retry: '재제출', strategyName: '전략명', strategyPlaceholder: '예: MACD 골든크로스', goldenRules: '4대 원칙', rule1: '사람이 이해할 설명(≤80자)', rule1PH: '초보자도 이해할 수 있게', rule2: '스탑로스 규칙', rule2PH: '예: 단일손실>2% 스탑로스', rule3: '적용 시장+자산', rule3PH: '예: A주식 또는 BTC-USDT', rule4: '무효화 자가진단', rule4PH: '예: MACD는 레인지장에서 무효', templateConfig: '템플릿 설정', factorIds: '팩터 ID', factorIdsPH: '쉼표 구분', parameters: '파라미터', parametersPH: 'JSON 형식', backtest: '백테스트 요약', backtestPH: '예: 승률65%, 샤프1.8', review: '심사 결과', reviewCost: '심사 비용', reviewHint: '1U/회, 환불불가, 무제한 재심사', pass: '합격', fail: '불합격', resubmit: '수정 후 재제출', passedAll: '전체 합격!', passedDetail: '{n}/{total} 항목 합격', failedDetail: '{n}/{total} 항목 불합격', checks: '심사 항목', online: '등록됨', linked: '리더보드 연동됨', cancel: '취소', confirm: '확인', error: '제출 실패' },
  fr: { title: 'Upload Créateur', submit: 'Soumettre', submitting: 'Envoi...', retry: 'Réessayer', strategyName: 'Nom stratégie', strategyPlaceholder: 'ex: MACD Croix d\'or', goldenRules: '4 règles d\'or', rule1: 'Description simple (≤80 car.)', rule1PH: 'Expliquez simplement pour débutants', rule2: 'Règle stop-loss', rule2PH: 'ex: Perte>2% stop-loss', rule3: 'Marché+Actif', rule3PH: 'ex: Actions A ou BTC-USDT', rule4: 'Auto-diagnostic échec', rule4PH: 'ex: MACD échoue en range', templateConfig: 'Config template', factorIds: 'IDs facteurs', factorIdsPH: 'Séparés par virgules', parameters: 'Paramètres', parametersPH: 'JSON', backtest: 'Résumé backtest', backtestPH: 'ex: Win rate 65%, Sharpe 1.8', review: 'Résultat examen', reviewCost: 'Frais examen', reviewHint: '1U/examen, non remboursable, illimité', pass: 'OK', fail: 'ÉCHEC', resubmit: 'Modifier & Resoumettre', passedAll: 'Tout OK!', passedDetail: '{n}/{total} contrôles OK', failedDetail: '{n}/{total} échecs', checks: 'Contrôles', online: 'En ligne', linked: 'Classement lié', cancel: 'Annuler', confirm: 'Confirmer', error: 'Échec envoi' },
  it: { title: 'Upload Creatore', submit: 'Invia revisione', submitting: 'Invio...', retry: 'Riprova', strategyName: 'Nome strategia', strategyPlaceholder: 'es: MACD Croce d\'oro', goldenRules: '4 regole d\'oro', rule1: 'Descrizione semplice (≤80 car.)', rule1PH: 'Spiega in modo semplice', rule2: 'Regola stop-loss', rule2PH: 'es: Perdita>2% stop', rule3: 'Mercato+Asset', rule3PH: 'es: Azioni A o BTC-USDT', rule4: 'Auto-verifica fallimento', rule4PH: 'es: MACD fallisce in range', templateConfig: 'Config template', factorIds: 'ID fattori', factorIdsPH: 'Separati da virgola', parameters: 'Parametri', parametersPH: 'JSON', backtest: 'Riepilogo backtest', backtestPH: 'es: Win 65%, Sharpe 1.8', review: 'Esito revisione', reviewCost: 'Costo revisione', reviewHint: '1U/revisione, non rimborsabile, illimitata', pass: 'OK', fail: 'FALLITO', resubmit: 'Modifica & Reinvia', passedAll: 'Tutto OK!', passedDetail: '{n}/{total} superati', failedDetail: '{n}/{total} falliti', checks: 'Controlli', online: 'Online', linked: 'Classifica collegata', cancel: 'Annulla', confirm: 'Conferma', error: 'Invio fallito' },
  de: { title: 'Creator-Upload', submit: 'Prüfung einreichen', submitting: 'Einreichung...', retry: 'Erneut', strategyName: 'Strategiename', strategyPlaceholder: 'z.B. MACD Golden Cross', goldenRules: '4 goldene Regeln', rule1: 'Einfache Erklärung (≤80 Z.)', rule1PH: 'Für Anfänger verständlich erklären', rule2: 'Stop-Loss-Regel', rule2PH: 'z.B. Verlust>2% Stop', rule3: 'Markt+Asset', rule3PH: 'z.B. A-Aktien oder BTC-USDT', rule4: 'Fehler-Selbstcheck', rule4PH: 'z.B. MACD versagt in Seitwärtsmärkten', templateConfig: 'Template-Konfig', factorIds: 'Faktor-IDs', factorIdsPH: 'Kommagetrennt', parameters: 'Parameter', parametersPH: 'JSON', backtest: 'Backtest-Zusammenfassung', backtestPH: 'z.B. Treffer 65%, Sharpe 1.8', review: 'Prüfergebnis', reviewCost: 'Prüfgebühr', reviewHint: '1U/Prüfung, nicht erstattbar, unbegrenzt', pass: 'OK', fail: 'FEHLER', resubmit: 'Bearbeiten & Neu', passedAll: 'Alles OK!', passedDetail: '{n}/{total} Prüfungen OK', failedDetail: '{n}/{total} fehlgeschlagen', checks: 'Prüfungen', online: 'Online', linked: 'Rangliste verknüpft', cancel: 'Abbrechen', confirm: 'Bestätigen', error: 'Einreichung fehlgeschlagen' },
  es: { title: 'Subir Estrategia', submit: 'Enviar revisión', submitting: 'Enviando...', retry: 'Reintentar', strategyName: 'Nombre estrategia', strategyPlaceholder: 'ej: MACD Cruce Dorado', goldenRules: '4 reglas de oro', rule1: 'Descripción simple (≤80 car.)', rule1PH: 'Explica de forma sencilla', rule2: 'Regla stop-loss', rule2PH: 'ej: Pérdida>2% stop', rule3: 'Mercado+Activo', rule3PH: 'ej: Acciones A o BTC-USDT', rule4: 'Autochequeo fallo', rule4PH: 'ej: MACD falla en rangos', templateConfig: 'Config plantilla', factorIds: 'IDs de factores', factorIdsPH: 'Separados por coma', parameters: 'Parámetros', parametersPH: 'JSON', backtest: 'Resumen backtest', backtestPH: 'ej: Acierto 65%, Sharpe 1.8', review: 'Resultado revisión', reviewCost: 'Costo revisión', reviewHint: '1U/revisión, no reembolsable, ilimitado', pass: 'OK', fail: 'FALLÓ', resubmit: 'Editar y Reenviar', passedAll: '¡Todo OK!', passedDetail: '{n}/{total} controles OK', failedDetail: '{n}/{total} fallaron', checks: 'Controles', online: 'Publicado', linked: 'Ranking vinculado', cancel: 'Cancelar', confirm: 'Confirmar', error: 'Envío fallido' },
};

// R217 P15: 8 项审核项的具体精简建议
const SUGGESTIONS: Record<string, Record<string, string>> = {
  '人话描述': {
    'zh-CN': '样例: "MACD金叉追入ROE>20%标的,止损-8%,连续miss退出"',
    en: 'Example: "Buy stocks when MACD golden cross + ROE>20%, stop -8%"',
  },
  '止损规则': {
    'zh-CN': '样例: "单笔亏-2%止损 或 ATR×2止盈(具体数字)"',
    en: 'Example: "Single loss -2% or ATR×2 take-profit"',
  },
  '适用市场+品种': {
    'zh-CN': '样例: "S&P500" 而非"美股全市场"; 港股恒生指数 82 只',
    en: 'Example: "S&P500" not "US entire market"; HK Hang Seng 82 stocks',
  },
  '失效自检': {
    'zh-CN': '样例: "MACD 在震荡市失效" / "利率变化时估值因子失真"',
    en: 'Example: "MACD fails in range-bound markets"',
  },
  '因子ID有效': {
    'zh-CN': '从下拉菜单选(MACD_12_26, RSI_14),勿手填',
    en: 'Pick from dropdown (MACD_12_26, RSI_14), do not hand-type',
  },
  '参数合理性': {
    'zh-CN': '样例: 止损 2-5%, 持仓 5-10 只, 杠杆 ≤ 1.5x',
    en: 'Example: stop 2-5%, positions 5-10, leverage ≤ 1.5x',
  },
  '回测数据完整': {
    'zh-CN': '样例: 胜率 65%, 夏普 1.8, 最大回撤 -12%, 样本数 252 天',
    en: 'Example: Win 65%, Sharpe 1.8, Max DD -12%, 252-day sample',
  },
  '抄袭检测': {
    'zh-CN': '差异化: 加入你的独到因子或参数 (如自创的"社群情绪"因子)',
    en: 'Differentiate: add your unique factor or param (e.g., custom "social sentiment")',
  },
};

function getItemSuggestion(name: string, lang: string): string {
  const entry = SUGGESTIONS[name];
  if (!entry) return '';
  return entry[lang] || entry['zh-CN'] || '';
}

// ── Component ───────────────────────────────────────────────────────
const CreatorUpload: React.FC<CreatorUploadProps> = ({
  onUpload,
  locale: pl,
  compact = false,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;
  const [strategyName, setStrategyName] = useState('');
  const [humanDesc, setHumanDesc] = useState('');
  const [stopLossRule, setStopLossRule] = useState('');
  const [applicableMarket, setApplicableMarket] = useState('');
  const [failureSelfCheck, setFailureSelfCheck] = useState('');
  const [factorIdsStr, setFactorIdsStr] = useState('');
  const [paramsStr, setParamsStr] = useState('{"stopLossPct": 2, "takeProfitPct": 5}');
  const [backtestSummary, setBacktestSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState('');

  const canSubmit = strategyName.trim() && humanDesc.trim() && stopLossRule.trim()
    && applicableMarket.trim() && failureSelfCheck.trim() && factorIdsStr.trim();

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!onUpload || !canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      let params: Record<string, number> = {};
      try { params = JSON.parse(paramsStr); } catch { /* use default */ }
      const factorIds = factorIdsStr.split(',').map(s => s.trim()).filter(Boolean);
      const res = await onUpload({
        strategyName: strategyName.trim(),
        goldenRules: {
          humanDesc: humanDesc.trim(),
          stopLossRule: stopLossRule.trim(),
          applicableMarket: applicableMarket.trim(),
          failureSelfCheck: failureSelfCheck.trim(),
        },
        templateConfig: { factorIds, parameters: params },
        backtestSummary: backtestSummary.trim(),
      });
      if (res.success && res.reviewResult) setReviewResult(res.reviewResult);
      else if (!res.success && res.error) setError(res.error ?? t.error);
    } finally { setSubmitting(false); }
  }, [onUpload, canSubmit, strategyName, humanDesc, stopLossRule, applicableMarket, failureSelfCheck, factorIdsStr, paramsStr, backtestSummary, t]);

  const handleReset = useCallback(() => {
    setReviewResult(null); setStrategyName('');
    setHumanDesc(''); setStopLossRule('');
    setApplicableMarket(''); setFailureSelfCheck('');
    setFactorIdsStr(''); setParamsStr('{"stopLossPct": 2, "takeProfitPct": 5}');
    setBacktestSummary('');
  }, []);

  const passPercent = reviewResult ? Math.round((reviewResult.passedChecks / reviewResult.totalChecks) * 100) : 0;

  return (
    <Card
      size={compact ? 'small' : 'default'}
      title={<span><UploadOutlined style={{ marginRight: 8 }} />{t.title}</span>}
      extra={reviewResult && (
        <Tag color={reviewResult.passed ? 'green' : 'red'} icon={reviewResult.passed ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {reviewResult.passed ? t.pass : t.fail}
        </Tag>
      )}
      style={{ marginBottom: compact ? 0 : 16 }}
    >
      {/* ── Review Result ────────────────────────────────────────── */}
      {reviewResult && (
        <div style={{
          background: reviewResult.passed ? '#ecfdf5' : '#fef3c7',
          borderRadius: 8, padding: 16, marginBottom: 16,
          border: `1px solid ${reviewResult.passed ? '#6ee7b7' : '#fbbf24'}`,
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: reviewResult.passed ? '#065f46' : '#92400e' }}>
            {reviewResult.passed ? t.passedAll : t.failedDetail.replace('{n}', String(reviewResult.totalChecks - reviewResult.passedChecks)).replace('{total}', String(reviewResult.totalChecks))}
          </div>
          {reviewResult.passed && (
            <div style={{ fontSize: 12, marginBottom: 8, color: '#065f46' }}>
              <Tag color="green" icon={<TrophyOutlined />} style={{ marginRight: 8 }}>{t.online}</Tag>
              <Tag color="blue" icon={<CrownOutlined />}>{t.linked}</Tag>
            </div>
          )}
          {reviewResult.passed && <Progress percent={passPercent} strokeColor="#22c55e" style={{ marginBottom: 12 }} />}

          {reviewResult.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '6px 0', borderBottom: i < reviewResult.items.length - 1 ? '1px solid #e5e7eb' : 'none',
            }}>
              {item.passed
                ? <CheckCircleOutlined style={{ color: '#22c55e', marginTop: 2 }} />
                : <CloseCircleOutlined style={{ color: '#ef4444', marginTop: 2 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: item.passed ? '#065f46' : '#991b1b' }}>
                  {item.name} {item.detail && `— ${item.detail}`}
                </div>
                {/* R217 P15: 具体精简建议 (≤80字) */}
                {!item.passed && (
                  <div style={{ fontSize: 12, color: '#b45309', marginTop: 4, padding: 6, background: 'rgba(254,243,199,0.5)', borderRadius: 4 }}>
                    💡 {getItemSuggestion(item.name, langKey)}
                  </div>
                )}
                {!item.passed && item.suggestion && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.suggestion}</div>
                )}
              </div>
            </div>
          ))}

          {!reviewResult.passed && (
            <Button type="primary" icon={<ReloadOutlined />} onClick={handleReset}
              style={{ marginTop: 12 }}>{t.resubmit}</Button>
          )}
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────────────── */}
      {!reviewResult && (
        <>
          <Alert
            type="info" showIcon message={t.reviewHint}
            icon={<QuestionCircleOutlined />}
            style={{ marginBottom: 16 }}
          />

          {/* Strategy Name */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>{t.strategyName}</div>
            <Input placeholder={t.strategyPlaceholder} value={strategyName}
              onChange={e => setStrategyName(e.target.value)} />
          </div>

          {/* Four Golden Rules */}
          <div style={{ fontWeight: 600, fontSize: 14, color: '#f59e0b', marginBottom: 8 }}>
            <CrownOutlined style={{ marginRight: 4 }} />{t.goldenRules}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>
              {t.rule1} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 11 }}>
                ({humanDesc.length}/80)
              </span>
            </div>
            <Input.TextArea rows={2} maxLength={80} showCount
              placeholder={t.rule1PH} value={humanDesc}
              onChange={e => setHumanDesc(e.target.value)} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>{t.rule2}</div>
            <Input.TextArea rows={2} placeholder={t.rule2PH} value={stopLossRule}
              onChange={e => setStopLossRule(e.target.value)} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>{t.rule3}</div>
            <Input placeholder={t.rule3PH} value={applicableMarket}
              onChange={e => setApplicableMarket(e.target.value)} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>{t.rule4}</div>
            <Input.TextArea rows={2} placeholder={t.rule4PH} value={failureSelfCheck}
              onChange={e => setFailureSelfCheck(e.target.value)} />
          </div>

          {/* Template Config */}
          <div style={{ fontWeight: 600, fontSize: 14, color: '#3b82f6', marginBottom: 8 }}>
            {t.templateConfig}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>{t.factorIds}</div>
            <Input placeholder={t.factorIdsPH} value={factorIdsStr}
              onChange={e => setFactorIdsStr(e.target.value)} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>{t.parameters}</div>
            <Input.TextArea rows={3} placeholder={t.parametersPH} value={paramsStr}
              onChange={e => setParamsStr(e.target.value)} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#1e293b' }}>{t.backtest}</div>
            <Input.TextArea rows={3} placeholder={t.backtestPH} value={backtestSummary}
              onChange={e => setBacktestSummary(e.target.value)} />
          </div>

          {/* Cost Tag + Submit */}
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button type="primary" size="large" icon={<UploadOutlined />}
              loading={submitting} disabled={!canSubmit} onClick={handleSubmit}>
              {t.submit}
            </Button>
            <Tag color="orange" icon={<QuestionCircleOutlined />}>
              {t.reviewCost}: <strong>1 USDT</strong>
            </Tag>
          </div>
        </>
      )}
    </Card>
  );
};

export default CreatorUpload;
