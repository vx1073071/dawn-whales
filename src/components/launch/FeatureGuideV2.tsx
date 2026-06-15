// ── R213 ML P4-3: FeatureGuideV2 — v2.1.0 新功能引导 ──────────
// Step-by-step onboarding for new v2.1.0 features
// 4 steps: Insurance → API Key → Creator → Ranking
// Each step: feature card + CTA + skip/tutorial flow
// 9-language i18n + progress dots + auto-dismiss

import React, { useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────
interface GuideStep {
  id: string;
  icon: string;
  color: string;
  titleKey: string;
  descKey: string;
  ctaKey: string;
  path?: string; // navigation target
}

interface FeatureGuideV2Props {
  visible?: boolean;
  onDismiss?: () => void;
  onNavigate?: (path: string) => void;
  locale?: string;
  steps?: GuideStep[];
}

// ── Default Steps ───────────────────────────────────────────────────
const DEFAULT_STEPS: GuideStep[] = [
  { id: 'insurance', icon: '🛡️', color: '#3b82f6', titleKey: 's1title', descKey: 's1desc', ctaKey: 's1cta', path: '/insurance' },
  { id: 'apikey', icon: '🔐', color: '#22c55e', titleKey: 's2title', descKey: 's2desc', ctaKey: 's2cta', path: '/settings/apikey' },
  { id: 'creator', icon: '🏆', color: '#f59e0b', titleKey: 's3title', descKey: 's3desc', ctaKey: 's3cta', path: '/marketplace/upload' },
  { id: 'ranking', icon: '📊', color: '#8b5cf6', titleKey: 's4title', descKey: 's4desc', ctaKey: 's4cta', path: '/ranking' },
];

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '🎉 欢迎升级到 v2.1.0 PHOENIX！',
    subtitle: '4个新功能，让策略交易更强大',
    step: '步骤 {n}/{total}',
    s1title: '策略保险', s1desc: '给策略买份保险（1U），7天内亏损>5%自动触发免费AI诊断，原价2.5U的AI服务免费获得。', s1cta: '了解保险',
    s2title: 'API Key连接交易所', s2desc: '连接币安/OKX/富途，AES-256加密存储，只授权读取+交易，绝不请求提币权限，策略自动执行。', s2cta: '连接交易所',
    s3title: '创作者市场上传', s3desc: '上传你的策略模板→填写四铁律→AI自动审核（1U/次，8项检查）→通过后自动上架+关联排行榜。', s3cta: '上传策略',
    s4title: '龙虎榜+排行榜+盲盒', s4desc: '免费查看Top20因子排名→1U解锁日简报AI解读→0.5U实时推送。排行榜跟单0.1%执行费+AI因子盲盒翻牌。', s4cta: '查看排行',
    skip: '跳过引导', next: '下一步', prev: '上一步', done: '开始使用',
  },
  en: {
    title: '🎉 Welcome to v2.1.0 PHOENIX!',
    subtitle: '4 new features to supercharge your trading',
    step: 'Step {n}/{total}',
    s1title: 'Strategy Insurance', s1desc: 'Insure your strategy for 1U. Loss >5% in 7 days triggers free AI diagnosis worth 2.5U.', s1cta: 'Learn About Insurance',
    s2title: 'Connect Exchange API', s2desc: 'Connect Binance/OKX/Futu. AES-256 encrypted. Read+trade only, never withdrawal. Auto-execute strategies.', s2cta: 'Connect Exchange',
    s3title: 'Creator Marketplace', s3desc: 'Upload strategies → Golden Rules → AI review (1U, 8 checks) → auto-list + Leaderboard link.', s3cta: 'Upload Strategy',
    s4title: 'Rankings + Blind Box', s4desc: 'Free Top20 factors → 1U daily briefing + AI → 0.5U real-time push. Copy-trade 0.1% + AI factor blind box.', s4cta: 'View Rankings',
    skip: 'Skip Tour', next: 'Next', prev: 'Previous', done: 'Get Started',
  },
  ja: { title: '🎉 v2.1.0 PHOENIXへようこそ!', subtitle: '4つの新機能でトレードを強化', step: 'ステップ {n}/{total}', s1title: '戦略保険', s1desc: '1Uで戦略を保険。7日以内に損失5%超で無料AI診断(2.5U相当)。', s1cta: '保険について', s2title: 'APIキー接続', s2desc: 'Binance/OKX/Futuに接続。AES-256暗号化。読取+取引のみ、出金不可。', s2cta: '取引所に接続', s3title: 'クリエイターマーケット', s3desc: '戦略アップロード→鉄則記入→AI審査(1U,8項目)→自動公開+ランキング連携。', s3cta: '戦略をアップロード', s4title: 'ランキング+盲盒', s4desc: '無料Top20因子→1U日報+AI→0.5Uリアルタイム通知。コピートレード0.1%+AI盲盒。', s4cta: 'ランキングを見る', skip: 'スキップ', next: '次へ', prev: '戻る', done: '始める' },
  ko: { title: '🎉 v2.1.0 PHOENIX에 오신 것을 환영합니다!', subtitle: '4가지 신기능으로 트레이딩 강화', step: '{n}/{total}단계', s1title: '전략 보험', s1desc: '1U로 전략 보험. 7일 내 손실 5% 초과시 무료 AI 진단(2.5U 상당).', s1cta: '보험 알아보기', s2title: 'API 키 연결', s2desc: 'Binance/OKX/Futu 연결. AES-256 암호화. 읽기+거래만, 출금 불가.', s2cta: '거래소 연결', s3title: '크리에이터 마켓', s3desc: '전략 업로드→원칙 작성→AI 심사(1U,8항목)→자동 등록+리더보드.', s3cta: '전략 업로드', s4title: '랭킹+블라인드박스', s4desc: '무료 Top20→1U 일일브리핑→0.5U 실시간푸시. 카피트레이드 0.1%+AI 블라인드박스.', s4cta: '랭킹 보기', skip: '건너뛰기', next: '다음', prev: '이전', done: '시작하기' },
  fr: { title: '🎉 Bienvenue sur v2.1.0 PHOENIX!', subtitle: '4 nouveautés pour booster votre trading', step: 'Étape {n}/{total}', s1title: 'Assurance Stratégie', s1desc: 'Assurez votre stratégie pour 1U. Perte>5%→diagnostic IA gratuit (valeur 2.5U).', s1cta: 'En savoir plus', s2title: 'Connexion API', s2desc: 'Connectez Binance/OKX/Futu. AES-256 chiffré. Lecture+trading, jamais retrait.', s2cta: 'Connecter Exchange', s3title: 'Marché Créateur', s3desc: 'Upload stratégie→Règles d\'or→Révision IA(1U,8 vérifs)→Publication+Classement.', s3cta: 'Upload Stratégie', s4title: 'Classement+Boîte Mystère', s4desc: 'Top20 gratuit→1U briefing+IA→0.5U push temps réel. Copie 0.1%+boîte mystère IA.', s4cta: 'Voir classement', skip: 'Passer', next: 'Suivant', prev: 'Précédent', done: 'Commencer' },
  it: { title: '🎉 Benvenuto in v2.1.0 PHOENIX!', subtitle: '4 novità per potenziare il trading', step: 'Passo {n}/{total}', s1title: 'Assicurazione', s1desc: 'Assicura la strategia per 1U. Perdita>5%→diagnosi IA gratuita (valore 2.5U).', s1cta: 'Scopri', s2title: 'Connessione API', s2desc: 'Connetti Binance/OKX/Futu. AES-256 cifrato. Lettura+trading, mai prelievo.', s2cta: 'Connetti Exchange', s3title: 'Mercato Creatore', s3desc: 'Upload strategia→Regole d\'oro→Revisione IA(1U,8 controlli)→Pubblicazione.', s3cta: 'Carica Strategia', s4title: 'Classifica+Scatola Mistero', s4desc: 'Top20 gratis→1U briefing+IA→0.5U push. Copia 0.1%+scatola mistero IA.', s4cta: 'Vedi classifica', skip: 'Salta', next: 'Avanti', prev: 'Indietro', done: 'Inizia' },
  de: { title: '🎉 Willkommen bei v2.1.0 PHOENIX!', subtitle: '4 Neuerungen für besseres Trading', step: 'Schritt {n}/{total}', s1title: 'Strategie-Versicherung', s1desc: 'Strategie für 1U versichern. Verlust>5%→kostenlose KI-Diagnose (Wert 2.5U).', s1cta: 'Mehr erfahren', s2title: 'API-Key-Verbindung', s2desc: 'Binance/OKX/Futu verbinden. AES-256 verschlüsselt. Lesen+Handel, nie Auszahlung.', s2cta: 'Börse verbinden', s3title: 'Creator-Marktplatz', s3desc: 'Strategie hochladen→Goldene Regeln→KI-Prüfung(1U,8 Checks)→Veröffentlichung.', s3cta: 'Strategie hochladen', s4title: 'Rangliste+Überraschungsbox', s4desc: 'Top20 gratis→1U Briefing+KI→0.5U Echtzeit-Push. Kopie 0.1%+KI-Überraschungsbox.', s4cta: 'Rangliste ansehen', skip: 'Überspringen', next: 'Weiter', prev: 'Zurück', done: 'Starten' },
  es: { title: '🎉 ¡Bienvenido a v2.1.0 PHOENIX!', subtitle: '4 novedades para potenciar tu trading', step: 'Paso {n}/{total}', s1title: 'Seguro de Estrategia', s1desc: 'Asegura tu estrategia por 1U. Pérdida>5%→diagnóstico IA gratis (valor 2.5U).', s1cta: 'Más info', s2title: 'Conexión API', s2desc: 'Conecta Binance/OKX/Futu. AES-256 cifrado. Lectura+trading, nunca retiro.', s2cta: 'Conectar Exchange', s3title: 'Mercado Creador', s3desc: 'Subir estrategia→Reglas de oro→Revisión IA(1U,8 verificaciones)→Publicación.', s3cta: 'Subir Estrategia', s4title: 'Ranking+Caja Misterio', s4desc: 'Top20 gratis→1U briefing+IA→0.5U push tiempo real. Copia 0.1%+caja misterio IA.', s4cta: 'Ver ranking', skip: 'Saltar', next: 'Siguiente', prev: 'Anterior', done: 'Comenzar' },
};

// ── Component ───────────────────────────────────────────────────────
const FeatureGuideV2: React.FC<FeatureGuideV2Props> = ({
  visible = true, onDismiss, onNavigate, locale: pl, steps: propSteps,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;
  const steps = propSteps ?? DEFAULT_STEPS;

  const [step, setStep] = useState(0);
  const current = steps[step];

  if (!visible) return null;

  const handleNext = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else onDismiss?.();
  };

  const handlePrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleCTA = () => {
    if (current.path) onNavigate?.(current.path);
    handleNext();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '36px 40px',
        maxWidth: 480, width: '90%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
        animation: 'fadeIn 0.3s ease-out',
      }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{current.icon}</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
            {t.title}
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>{t.subtitle}</p>
        </div>

        {/* ── Progress Dots ───────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8,
              borderRadius: 4,
              background: i === step ? current.color : i < step ? '#22c55e' : '#e2e8f0',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        <div style={{
          fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 16,
        }}>
          {t.step.replace('{n}', String(step + 1)).replace('{total}', String(steps.length))}
        </div>

        {/* ── Feature Card ────────────────────────────────────────── */}
        <div style={{
          background: '#f8fafc', borderRadius: 14, padding: '20px 24px',
          border: `1px solid ${current.color}30`, marginBottom: 24,
        }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: current.color, marginBottom: 8,
          }}>
            {(t as any)[current.titleKey]}
          </div>
          <div style={{
            fontSize: 14, color: '#475569', lineHeight: 1.6,
          }}>
            {(t as any)[current.descKey]}
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePrev} disabled={step === 0} style={{
            flex: 1, background: 'transparent', color: step === 0 ? '#cbd5e1' : '#64748b',
            border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px',
            fontSize: 14, fontWeight: 500, cursor: step === 0 ? 'default' : 'pointer',
          }}>
            {t.prev}
          </button>

          <button onClick={handleCTA} style={{
            flex: 2, background: current.color, color: '#fff',
            border: 'none', borderRadius: 10, padding: '12px',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 4px 12px ${current.color}40`,
          }}>
            {(t as any)[current.ctaKey]}
          </button>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button onClick={onDismiss} style={{
            background: 'transparent', color: '#94a3b8', border: 'none',
            fontSize: 12, cursor: 'pointer', padding: 0,
          }}>
            {t.skip}
          </button>

          <button onClick={handleNext} style={{
            background: 'transparent', color: current.color, border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>
            {step < steps.length - 1 ? t.next : t.done} →
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureGuideV2;
