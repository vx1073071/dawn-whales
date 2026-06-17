// ── R216 ML P1: StrategyActivationFlow — 4步策略激活流程UI ──────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// P1: Wizard with 4 steps: 预览 → 配置 → 沙盒 → 实盘确认
// Step indicator + progress + sandbox result display + live trading confirmation
// 9-language i18n + stepper + auto-save between steps

import React, { useState } from 'react';
import { Button, Progress, Alert } from 'antd';
import {
  CheckCircleOutlined, ArrowRightOutlined, ArrowLeftOutlined,
  ExperimentOutlined, RocketOutlined,
  EyeOutlined, SettingOutlined, ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';

export interface ActivationConfig {
  initialCapital: number;
  riskPerTrade: number; // % 1-10
  maxPositions: number; // 1-20
  stopLossPct: number; // 1-20
  takeProfitPct: number; // 2-50
  rebalanceFreq: 'daily' | 'weekly' | 'monthly';
  notifyOnSignal: boolean;
  notifyOnTrade: boolean;
  apiKeyId?: string;
}

export interface SandboxResult {
  period: number; // days
  startDate: number;
  endDate: number;
  totalReturn: number; // %
  annualReturn: number;
  maxDrawdown: number; // %
  sharpeRatio: number;
  winRate: number; // %
  totalTrades: number;
  equityCurve: { date: number; value: number }[];
  topDrawdown: { date: number; value: number; recovered: boolean };
}

interface StrategyActivationFlowProps {
  strategyId: string;
  strategyName: string;
  initialConfig?: Partial<ActivationConfig>;
  onConfigSave?: (config: ActivationConfig) => Promise<void>;
  onRunSandbox?: (config: ActivationConfig) => Promise<SandboxResult>;
  onGoLive?: (config: ActivationConfig) => Promise<void>;
  onCancel?: () => void;
  locale?: string;
}

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '🚀 策略激活流程',
    subtitle: '4 步开启你的策略',
    step: '第 {n} 步',
    step1: '1️⃣ 预览',
    step2: '⚙️ 配置',
    step3: '🧪 沙盒',
    step4: '🚀 实盘',
    step1title: '策略预览', step1desc: '确认策略核心信息',
    step2title: '参数配置', step2desc: '设置资金、风险和交易参数',
    step3title: '沙盒模拟', step3desc: '用历史数据回测 30 天',
    step4title: '实盘确认', step4desc: '最终确认并启动实盘',
    strategy: '策略', market: '适用市场', oneLiner: '核心逻辑',
    back: '上一步', next: '下一步', run: '运行沙盒', running: '运行中...',
    skipToLive: '跳过沙盒', goLive: '开启实盘', goLiveLive: '启动中...',
    cancel: '取消', complete: '已完成', ready: '已就绪',
    cap: '初始资金 (USDT)', risk: '单笔风险 %', pos: '最大持仓数',
    sl: '止损 %', tp: '止盈 %', freq: '调仓频率',
    notify: '通知', notifySignal: '信号推送', notifyTrade: '成交通知',
    daily: '每日', weekly: '每周', monthly: '每月',
    sandboxResult: '沙盒结果', period: '回测期', totalReturn: '总收益',
    annualReturn: '年化收益', maxDD: '最大回撤', winRate: '胜率',
    trades: '交易笔数', sharpe: '夏普比',
    sandboxNote: '⚠️ 沙盒基于历史数据,实盘可能不同。AI故障自动退费。',
    liveNote: '🚨 开启实盘前请确认: 已了解所有风险、已设置止损、API Key已授权',
    insufficient: '⚠️ 配置不完整,无法进入下一步',
    saved: '✅ 配置已保存',
  },
  en: {
    title: '🚀 Strategy Activation',
    subtitle: '4 steps to go live',
    step: 'Step {n}',
    step1: '1️⃣ Preview', step2: '⚙️ Configure', step3: '🧪 Sandbox', step4: '🚀 Go Live',
    step1title: 'Strategy Preview', step1desc: 'Confirm strategy core info',
    step2title: 'Configuration', step2desc: 'Set capital, risk, and trading params',
    step3title: 'Sandbox Simulation', step3desc: '30-day historical backtest',
    step4title: 'Live Confirmation', step4desc: 'Final confirmation and go live',
    strategy: 'Strategy', market: 'Markets', oneLiner: 'Core Logic',
    back: 'Back', next: 'Next', run: 'Run Sandbox', running: 'Running...',
    skipToLive: 'Skip Sandbox', goLive: 'Go Live', goLiveLive: 'Starting...',
    cancel: 'Cancel', complete: 'Complete', ready: 'Ready',
    cap: 'Initial Capital (USDT)', risk: 'Risk per Trade %', pos: 'Max Positions',
    sl: 'Stop-Loss %', tp: 'Take-Profit %', freq: 'Rebalance Frequency',
    notify: 'Notifications', notifySignal: 'Signal Push', notifyTrade: 'Trade Execution',
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
    sandboxResult: 'Sandbox Result', period: 'Period', totalReturn: 'Total Return',
    annualReturn: 'Annual Return', maxDD: 'Max Drawdown', winRate: 'Win Rate',
    trades: 'Trades', sharpe: 'Sharpe',
    sandboxNote: '⚠️ Sandbox is based on history. Live may differ. AI fault auto-refund.',
    liveNote: '🚨 Before going live: confirm you understand risks, stop-loss is set, API authorized',
    insufficient: '⚠️ Configuration incomplete',
    saved: '✅ Saved',
  },
  ja: { title: '🚀 戦略有効化', subtitle: '4ステップで実取引', step: 'ステップ {n}', step1: '1️⃣ プレビュー', step2: '⚙️ 設定', step3: '🧪 サンドボックス', step4: '🚀 実取引', step1title: '戦略プレビュー', step1desc: '戦略情報を確認', step2title: 'パラメータ設定', step2desc: '資金・リスク・取引パラメータ', step3title: 'サンドボックス', step3desc: '30日間の履歴バックテスト', step4title: '実取引確認', step4desc: '最終確認', strategy: '戦略', market: '市場', oneLiner: 'コアロジック', back: '戻る', next: '次へ', run: 'サンドボックス実行', running: '実行中...', skipToLive: 'スキップ', goLive: '実取引開始', goLiveLive: '開始中...', cancel: 'キャンセル', complete: '完了', ready: '準備完了', cap: '初期資金 (USDT)', risk: '取引リスク %', pos: '最大ポジション', sl: '損切り %', tp: '利確 %', freq: 'リバラン頻度', notify: '通知', notifySignal: 'シグナル', notifyTrade: '約定通知', daily: '毎日', weekly: '毎週', monthly: '毎月', sandboxResult: 'サンドボックス結果', period: '期間', totalReturn: '総収益', annualReturn: '年率', maxDD: '最大DD', winRate: '勝率', trades: '取引数', sharpe: 'シャープ', sandboxNote: '⚠️ 履歴ベース, 実取引は異なる可能性', liveNote: '🚨 実取引前に確認: リスク理解, 損切り設定, API認証', insufficient: '⚠️ 設定不完全', saved: '✅ 保存済' },
  ko: { title: '🚀 전략 활성화', subtitle: '4단계로 실거래', step: '단계 {n}', step1: '1️⃣ 미리보기', step2: '⚙️ 설정', step3: '🧪 샌드박스', step4: '🚀 실거래', step1title: '전략 미리보기', step1desc: '전략 정보 확인', step2title: '매개변수 설정', step2desc: '자금, 리스크, 거래 설정', step3title: '샌드박스', step3desc: '30일 백테스트', step4title: '실거래 확인', step4desc: '최종 확인', strategy: '전략', market: '시장', oneLiner: '핵심 로직', back: '뒤로', next: '다음', run: '샌드박스 실행', running: '실행 중...', skipToLive: '건너뛰기', goLive: '실거래 시작', goLiveLive: '시작 중...', cancel: '취소', complete: '완료', ready: '준비됨', cap: '초기 자금 (USDT)', risk: '거래당 리스크 %', pos: '최대 포지션', sl: '스탑로스 %', tp: '익절 %', freq: '리밸런스 빈도', notify: '알림', notifySignal: '시그널', notifyTrade: '체결 알림', daily: '매일', weekly: '매주', monthly: '매월', sandboxResult: '샌드박스 결과', period: '기간', totalReturn: '총 수익', annualReturn: '연간', maxDD: '최대 DD', winRate: '승률', trades: '거래 수', sharpe: '샤프', sandboxNote: '⚠️ 과거 데이터 기반, 실거래는 다를 수 있음', liveNote: '🚨 실거래 전 확인: 리스크 이해, 스탑로스 설정, API 인증', insufficient: '⚠️ 설정 미완료', saved: '✅ 저장됨' },
  fr: { title: '🚀 Activation', subtitle: '4 étapes pour démarrer', step: 'Étape {n}', step1: '1️⃣ Aperçu', step2: '⚙️ Configurer', step3: '🧪 Sandbox', step4: '🚀 Live', step1title: 'Aperçu de la stratégie', step1desc: 'Confirmer les infos', step2title: 'Configuration', step2desc: 'Capital, risque, paramètres', step3title: 'Sandbox', step3desc: 'Backtest 30 jours', step4title: 'Confirmation Live', step4desc: 'Confirmation finale', strategy: 'Stratégie', market: 'Marchés', oneLiner: 'Logique', back: 'Retour', next: 'Suivant', run: 'Lancer Sandbox', running: 'En cours...', skipToLive: 'Passer', goLive: 'Démarrer', goLiveLive: 'Démarrage...', cancel: 'Annuler', complete: 'Terminé', ready: 'Prêt', cap: 'Capital initial (USDT)', risk: 'Risque/trade %', pos: 'Max positions', sl: 'Stop-Loss %', tp: 'Take-Profit %', freq: 'Fréquence', notify: 'Notifications', notifySignal: 'Signaux', notifyTrade: 'Trades', daily: 'Quotidien', weekly: 'Hebdo', monthly: 'Mensuel', sandboxResult: 'Résultat Sandbox', period: 'Période', totalReturn: 'Rendement total', annualReturn: 'Rendement annuel', maxDD: 'Drawdown max', winRate: 'Taux de gain', trades: 'Trades', sharpe: 'Sharpe', sandboxNote: '⚠️ Sandbox basé sur l\'historique, live peut différer', liveNote: '🚨 Avant live: comprendre les risques, stop-loss, API autorisée', insufficient: '⚠️ Configuration incomplète', saved: '✅ Sauvegardé' },
  it: { title: '🚀 Attivazione', subtitle: '4 passi per andare live', step: 'Passo {n}', step1: '1️⃣ Anteprima', step2: '⚙️ Configura', step3: '🧪 Sandbox', step4: '🚀 Live', step1title: 'Anteprima strategia', step1desc: 'Conferma info', step2title: 'Configurazione', step2desc: 'Capitale, rischio, parametri', step3title: 'Sandbox', step3desc: 'Backtest 30 giorni', step4title: 'Conferma Live', step4desc: 'Conferma finale', strategy: 'Strategia', market: 'Mercati', oneLiner: 'Logica', back: 'Indietro', next: 'Avanti', run: 'Avvia Sandbox', running: 'In corso...', skipToLive: 'Salta', goLive: 'Vai Live', goLiveLive: 'Avvio...', cancel: 'Annulla', complete: 'Completo', ready: 'Pronto', cap: 'Capitale iniziale (USDT)', risk: 'Rischio/trade %', pos: 'Posizioni max', sl: 'Stop-Loss %', tp: 'Take-Profit %', freq: 'Frequenza', notify: 'Notifiche', notifySignal: 'Segnali', notifyTrade: 'Trade', daily: 'Giornaliero', weekly: 'Settimanale', monthly: 'Mensile', sandboxResult: 'Risultato Sandbox', period: 'Periodo', totalReturn: 'Rendimento totale', annualReturn: 'Rendimento annuo', maxDD: 'Drawdown max', winRate: 'Win rate', trades: 'Trade', sharpe: 'Sharpe', sandboxNote: '⚠️ Sandbox basato su storia, live può differire', liveNote: '🚨 Prima del live: conferma rischi, stop-loss, API autorizzata', insufficient: '⚠️ Configurazione incompleta', saved: '✅ Salvato' },
  de: { title: '🚀 Aktivierung', subtitle: '4 Schritte zum Live-Handel', step: 'Schritt {n}', step1: '1️⃣ Vorschau', step2: '⚙️ Konfig', step3: '🧪 Sandbox', step4: '🚀 Live', step1title: 'Strategie-Vorschau', step1desc: 'Infos bestätigen', step2title: 'Konfiguration', step2desc: 'Kapital, Risiko, Parameter', step3title: 'Sandbox', step3desc: '30-Tage-Backtest', step4title: 'Live-Bestätigung', step4desc: 'Endgültige Bestätigung', strategy: 'Strategie', market: 'Märkte', oneLiner: 'Logik', back: 'Zurück', next: 'Weiter', run: 'Sandbox starten', running: 'Läuft...', skipToLive: 'Überspringen', goLive: 'Live starten', goLiveLive: 'Startet...', cancel: 'Abbrechen', complete: 'Fertig', ready: 'Bereit', cap: 'Startkapital (USDT)', risk: 'Risiko/Trade %', pos: 'Max. Positionen', sl: 'Stop-Loss %', tp: 'Take-Profit %', freq: 'Frequenz', notify: 'Benachrichtigungen', notifySignal: 'Signale', notifyTrade: 'Trades', daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', sandboxResult: 'Sandbox-Ergebnis', period: 'Zeitraum', totalReturn: 'Gesamtrendite', annualReturn: 'Jahresrendite', maxDD: 'Max. Drawdown', winRate: 'Gewinnrate', trades: 'Trades', sharpe: 'Sharpe', sandboxNote: '⚠️ Sandbox basiert auf Historie, Live kann abweichen', liveNote: '🚨 Vor Live: Risiken verstehen, Stop-Loss, API autorisiert', insufficient: '⚠️ Konfiguration unvollständig', saved: '✅ Gespeichert' },
  es: { title: '🚀 Activación', subtitle: '4 pasos para el live', step: 'Paso {n}', step1: '1️⃣ Vista previa', step2: '⚙️ Configurar', step3: '🧪 Sandbox', step4: '🚀 En vivo', step1title: 'Vista previa', step1desc: 'Confirmar info', step2title: 'Configuración', step2desc: 'Capital, riesgo, parámetros', step3title: 'Sandbox', step3desc: 'Backtest 30 días', step4title: 'Confirmación Live', step4desc: 'Confirmación final', strategy: 'Estrategia', market: 'Mercados', oneLiner: 'Lógica', back: 'Atrás', next: 'Siguiente', run: 'Ejecutar Sandbox', running: 'Ejecutando...', skipToLive: 'Saltar', goLive: 'Ir en vivo', goLiveLive: 'Iniciando...', cancel: 'Cancelar', complete: 'Completo', ready: 'Listo', cap: 'Capital inicial (USDT)', risk: 'Riesgo/trade %', pos: 'Posiciones máx', sl: 'Stop-Loss %', tp: 'Take-Profit %', freq: 'Frecuencia', notify: 'Notificaciones', notifySignal: 'Señales', notifyTrade: 'Trades', daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', sandboxResult: 'Resultado Sandbox', period: 'Período', totalReturn: 'Retorno total', annualReturn: 'Retorno anual', maxDD: 'Drawdown máx', winRate: 'Tasa de acierto', trades: 'Trades', sharpe: 'Sharpe', sandboxNote: '⚠️ Sandbox basado en historia, live puede diferir', liveNote: '🚨 Antes del live: confirmar riesgos, stop-loss, API autorizada', insufficient: '⚠️ Configuración incompleta', saved: '✅ Guardado' },
};

const DEFAULT_CONFIG: ActivationConfig = {
  initialCapital: 1000,
  riskPerTrade: 2,
  maxPositions: 5,
  stopLossPct: 5,
  takeProfitPct: 15,
  rebalanceFreq: 'weekly',
  notifyOnSignal: true,
  notifyOnTrade: true,
};

const StrategyActivationFlow: React.FC<StrategyActivationFlowProps> = ({
  strategyId, strategyName,
  initialConfig, onConfigSave, onRunSandbox, onGoLive, onCancel,
  locale: pl,
}) => {
  // strategyId and onConfigSave reserved for future use (logging + persistence)
  void strategyId; void onConfigSave;
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ActivationConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [goingLive, setGoingLive] = useState(false);

  const steps = [
    { key: 'preview', icon: <EyeOutlined />, label: t.step1, title: t.step1title, desc: t.step1desc },
    { key: 'config', icon: <SettingOutlined />, label: t.step2, title: t.step2title, desc: t.step2desc },
    { key: 'sandbox', icon: <ExperimentOutlined />, label: t.step3, title: t.step3title, desc: t.step3desc },
    { key: 'live', icon: <RocketOutlined />, label: t.step4, title: t.step4title, desc: t.step4desc },
  ];

  const isConfigValid = config.initialCapital > 0 && config.riskPerTrade > 0 && config.riskPerTrade <= 10 && config.maxPositions > 0;





  const handleRunSandbox = async () => {
    if (!onRunSandbox) {
      // Demo sandbox result
      setSandboxResult(generateDemoSandboxResult());
      return;
    }
    setSandboxRunning(true);
    try {
      const res = await onRunSandbox(config);
      setSandboxResult(res);
    } finally { setSandboxRunning(false); }
  };

  const handleGoLive = async () => {
    if (!onGoLive) return;
    setGoingLive(true);
    try { await onGoLive(config); } finally { setGoingLive(false); }
  };

  return (
    <div style={{
      maxWidth: 720, margin: '0 auto', padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
          {t.title}
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{t.subtitle}</p>
      </div>

      {/* ── Stepper ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 18, left: 24, right: 24, height: 2,
          background: '#e2e8f0', zIndex: 0,
        }}>
          <div style={{
            height: '100%', background: '#3b82f6',
            width: `${(step / 3) * 100}%`, transition: 'width 0.3s',
          }} />
        </div>
        {steps.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.key} style={{ position: 'relative', zIndex: 1, textAlign: 'center', flex: 1 }}>
              <div style={{
                width: 36, height: 36, margin: '0 auto', borderRadius: '50%',
                background: isDone ? '#22c55e' : isActive ? '#3b82f6' : '#fff',
                border: `2px solid ${isDone || isActive ? (isDone ? '#22c55e' : '#3b82f6') : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16,
              }}>
                {isDone ? <CheckCircleOutlined /> : s.icon}
              </div>
              <div style={{ fontSize: 11, color: isActive ? '#3b82f6' : isDone ? '#22c55e' : '#94a3b8', marginTop: 6, fontWeight: isActive ? 700 : 500 }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Step Content ───────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', minHeight: 320 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
          {steps[step].title}
        </h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 20px' }}>{steps[step].desc}</p>

        {/* ── Step 0: Preview ─────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{t.strategy}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>{strategyName}</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                {t.oneLiner}: 通过动量+估值因子筛选优质标的,定期调仓,严控风险。
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <Stat icon="📊" label="Markets" value="多市场" />
              <Stat icon="📅" label="Holding" value="5-20天" />
              <Stat icon="📈" label="Est. Return" value="8-12%" />
            </div>
          </div>
        )}

        {/* ── Step 1: Config ─────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <ConfigField label={t.cap}>
                <input type="number" value={config.initialCapital}
                  onChange={e => setConfig({ ...config, initialCapital: Number(e.target.value) })}
                  style={inputStyle} min={100} step={100} />
              </ConfigField>
              <ConfigField label={t.risk}>
                <input type="number" value={config.riskPerTrade}
                  onChange={e => setConfig({ ...config, riskPerTrade: Number(e.target.value) })}
                  style={inputStyle} min={0.5} max={10} step={0.5} />
              </ConfigField>
              <ConfigField label={t.pos}>
                <input type="number" value={config.maxPositions}
                  onChange={e => setConfig({ ...config, maxPositions: Number(e.target.value) })}
                  style={inputStyle} min={1} max={20} />
              </ConfigField>
              <ConfigField label={t.sl}>
                <input type="number" value={config.stopLossPct}
                  onChange={e => setConfig({ ...config, stopLossPct: Number(e.target.value) })}
                  style={inputStyle} min={1} max={20} step={0.5} />
              </ConfigField>
              <ConfigField label={t.tp}>
                <input type="number" value={config.takeProfitPct}
                  onChange={e => setConfig({ ...config, takeProfitPct: Number(e.target.value) })}
                  style={inputStyle} min={2} max={50} step={1} />
              </ConfigField>
              <ConfigField label={t.freq}>
                <select value={config.rebalanceFreq}
                  onChange={e => setConfig({ ...config, rebalanceFreq: e.target.value as any })}
                  style={inputStyle}>
                  <option value="daily">{t.daily}</option>
                  <option value="weekly">{t.weekly}</option>
                  <option value="monthly">{t.monthly}</option>
                </select>
              </ConfigField>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={config.notifyOnSignal}
                  onChange={e => setConfig({ ...config, notifyOnSignal: e.target.checked })} />
                🔔 {t.notifySignal}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={config.notifyOnTrade}
                  onChange={e => setConfig({ ...config, notifyOnTrade: e.target.checked })} />
                ✅ {t.notifyTrade}
              </label>
            </div>
            {!isConfigValid && (
              <Alert type="warning" message={t.insufficient} style={{ marginTop: 12 }} />
            )}
          </div>
        )}

        {/* ── Step 2: Sandbox ────────────────────────────────────── */}
        {step === 2 && (
          <div>
            {sandboxRunning ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <ExperimentOutlined spin style={{ fontSize: 32, color: '#3b82f6' }} />
                <div style={{ marginTop: 12, color: '#64748b' }}>{t.running}</div>
                <Progress percent={66} showInfo={false} style={{ maxWidth: 240, margin: '12px auto 0' }} />
              </div>
            ) : sandboxResult ? (
              <div>
                <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 12px', color: '#065f46' }}>📊 {t.sandboxResult}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <Stat icon="💰" label={t.totalReturn} value={`+${sandboxResult.totalReturn.toFixed(2)}%`} color="green" />
                    <Stat icon="📅" label={t.annualReturn} value={`+${sandboxResult.annualReturn.toFixed(1)}%`} color="green" />
                    <Stat icon="📉" label={t.maxDD} value={`-${sandboxResult.maxDrawdown.toFixed(1)}%`} color="red" />
                    <Stat icon="🎯" label={t.winRate} value={`${sandboxResult.winRate.toFixed(1)}%`} />
                    <Stat icon="📊" label={t.sharpe} value={sandboxResult.sharpeRatio.toFixed(2)} />
                    <Stat icon="🔁" label={t.trades} value={sandboxResult.totalTrades} />
                  </div>
                </div>
                <Alert type="info" message={t.sandboxNote} showIcon />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <ExperimentOutlined style={{ fontSize: 40, color: '#94a3b8' }} />
                <div style={{ marginTop: 12, color: '#64748b', marginBottom: 16 }}>30 days of historical data</div>
                <Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={handleRunSandbox}>
                  {t.run}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Live Confirmation ──────────────────────────── */}
        {step === 3 && (
          <div>
            <div style={{ background: '#fef3c7', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 12px', color: '#92400e' }}>📋 {t.ready}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
                <SummaryRow label={t.strategy} value={strategyName} />
                <SummaryRow label={t.cap} value={`${config.initialCapital} USDT`} />
                <SummaryRow label={t.risk} value={`${config.riskPerTrade}%/笔`} />
                <SummaryRow label={t.sl} value={`${config.stopLossPct}%`} />
              </div>
              {sandboxResult && (
                <div style={{ marginTop: 12, padding: 8, background: 'rgba(255,255,255,0.6)', borderRadius: 6, fontSize: 12, color: '#065f46' }}>
                  ✅ {t.sandboxResult}: {sandboxResult.totalReturn.toFixed(2)}% ({t.annualReturn} {sandboxResult.annualReturn.toFixed(1)}%)
                </div>
              )}
            </div>
            <Alert type="error" message={t.liveNote} showIcon icon={<WarningOutlined />} />
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <Button onClick={step === 0 ? onCancel : () => setStep(s => s - 1)} icon={step > 0 ? <ArrowLeftOutlined /> : undefined}>
          {step === 0 ? t.cancel : t.back}
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          {step < 2 && (
            <Button type="primary" disabled={step === 1 && !isConfigValid} onClick={() => setStep(s => s + 1)} icon={<ArrowRightOutlined />}>
              {t.next}
            </Button>
          )}
          {step === 2 && sandboxResult && (
            <Button type="primary" onClick={() => setStep(3)} icon={<ArrowRightOutlined />}>
              {t.next}
            </Button>
          )}
          {step === 3 && (
            <Button type="primary" danger icon={<RocketOutlined />} loading={goingLive} onClick={handleGoLive}>
              {t.goLive}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Helper sub-components ──────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 6,
  border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
};

const ConfigField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
    {children}
  </div>
);

const Stat: React.FC<{ icon: string; label: string; value: string | number; color?: string }> = ({ icon, label, value, color }) => (
  <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
    <div style={{ fontSize: 18 }}>{icon}</div>
    <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: color || '#1e293b' }}>{value}</div>
  </div>
);

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: '#92400e' }}>{label}:</span>
    <strong style={{ color: '#1e293b' }}>{value}</strong>
  </div>
);

function generateDemoSandboxResult(): SandboxResult {
  const now = Date.now();
  const dayMs = 86400000;
  return {
    period: 30,
    startDate: now - 30 * dayMs,
    endDate: now,
    totalReturn: 8.3 + Math.random() * 5,
    annualReturn: 95 + Math.random() * 30,
    maxDrawdown: 4 + Math.random() * 3,
    sharpeRatio: 1.5 + Math.random() * 0.8,
    winRate: 60 + Math.random() * 10,
    totalTrades: Math.floor(20 + Math.random() * 20),
    equityCurve: Array.from({ length: 30 }, (_, i) => ({ date: now - (30 - i) * dayMs, value: 100 + (i + 1) * 0.3 + Math.random() * 0.5 })),
    topDrawdown: { date: now - 10 * dayMs, value: 95.5, recovered: true },
  };
}

export default StrategyActivationFlow;
