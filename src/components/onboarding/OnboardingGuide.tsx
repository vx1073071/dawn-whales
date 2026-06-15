// ── R215 ML P4: OnboardingGuide — 3问引导推荐 ──────────
// U6: 3-step questionnaire for new users (资金/市场/风险) → recommend 3-5 templates
// Integrates with StrategyMatchEngine to convert answers → factor profile
// Progress dots + skip/back buttons + result card with template recommendations
// 9-language i18n

import React, { useState, useCallback } from 'react';
import { Button, Tag, Empty, Progress } from 'antd';
import {
  DollarOutlined, GlobalOutlined, RiseOutlined,
  RightOutlined, LeftOutlined,
  ThunderboltOutlined, ArrowRightOutlined,
} from '@ant-design/icons';

export interface QuestionAnswers {
  capital: 'small' | 'medium' | 'large' | null;
  market: string | null;
  risk: 'conservative' | 'balanced' | 'aggressive' | null;
}

export interface RecommendedTemplate {
  id: string;
  name: string;
  nameCN: string;
  oneLiner: string;
  marketTags: string[];
  matchScore: number; // 0-100
  riskLevel: 'conservative' | 'balanced' | 'aggressive';
  category: string;
  factors?: string[];
}

interface OnboardingGuideProps {
  visible?: boolean;
  onComplete?: (answers: QuestionAnswers) => Promise<RecommendedTemplate[]>;
  onSelectTemplate?: (tmpl: RecommendedTemplate) => void;
  onSkip?: () => void;
  locale?: string;
  loading?: boolean;
}

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '🎯 3 问找到适合你的策略',
    subtitle: '1 分钟回答 3 个问题,我们推荐 3-5 个模板',
    step: '第 {n}/3 步',
    q1: '1️⃣ 你的本金是?',
    q1hint: '影响单笔交易金额 + 风险敞口',
    cap_small: '1 万以下', cap_small_d: '新手友好,小额试水',
    cap_medium: '1-10 万', cap_medium_d: '进阶级用户',
    cap_large: '10 万以上', cap_large_d: '专业/机构级',
    q2: '2️⃣ 你想交易哪个市场?',
    q2hint: '选择你最熟悉的市场',
    market_us: '🇺🇸 美股', market_hk: '🇭🇰 港股', market_cn: '🇨🇳 A股',
    market_jp: '🇯🇵 日股', market_kr: '🇰🇷 韩股', market_tw: '🇹🇼 台股',
    market_sg: '🇸🇬 新加坡', market_au: '🇦🇺 澳洲', market_in: '🇮🇳 印度',
    market_eu: '🇪🇺 欧洲', market_crypto: '🪙 加密货币', market_cross: '🌍 跨市场',
    q3: '3️⃣ 你能接受的最大亏损?',
    q3hint: '决定风险等级',
    r1: '🛡️ 保守(最多亏 5%)', r1d: '稳定收益,低风险',
    r2: '⚖️ 平衡(最多亏 15%)', r2d: '稳健增长,中风险',
    r3: '⚡ 激进(可亏 30%+)', r3d: '追求高收益,高风险',
    next: '下一步', prev: '上一步', skip: '跳过', getResult: '查看推荐',
    matching: 'AI 正在匹配策略...', matchDone: '找到 {n} 个匹配策略',
    noMatch: '没有找到完全匹配的策略,试试调整选项',
    useTemplate: '使用此策略',
    retry: '重新开始',
  },
  en: {
    title: '🎯 3 questions to find your strategy',
    subtitle: '1 minute for 3-5 template recommendations',
    step: 'Step {n}/3',
    q1: '1️⃣ Your capital?',
    q1hint: 'Affects position size + risk exposure',
    cap_small: '<$1.5K', cap_small_d: 'Beginner-friendly',
    cap_medium: '$1.5K-15K', cap_medium_d: 'Intermediate user',
    cap_large: '$15K+', cap_large_d: 'Pro/Institutional',
    q2: '2️⃣ Which market?',
    q2hint: 'Pick the market you know best',
    market_us: '🇺🇸 US', market_hk: '🇭🇰 HK', market_cn: '🇨🇳 CN',
    market_jp: '🇯🇵 JP', market_kr: '🇰🇷 KR', market_tw: '🇹🇼 TW',
    market_sg: '🇸🇬 SG', market_au: '🇦🇺 AU', market_in: '🇮🇳 IN',
    market_eu: '🇪🇺 EU', market_crypto: '🪙 Crypto', market_cross: '🌍 Cross-Market',
    q3: '3️⃣ Max loss tolerance?',
    q3hint: 'Determines risk level',
    r1: '🛡️ Conservative (≤5%)', r1d: 'Stable, low risk',
    r2: '⚖️ Balanced (≤15%)', r2d: 'Steady growth, mid risk',
    r3: '⚡ Aggressive (≤30%+)', r3d: 'High return, high risk',
    next: 'Next', prev: 'Previous', skip: 'Skip', getResult: 'See Matches',
    matching: 'AI matching strategies...', matchDone: 'Found {n} matching strategies',
    noMatch: 'No exact match, try adjusting',
    useTemplate: 'Use This',
    retry: 'Start Over',
  },
  ja: { title: '🎯 3問で戦略を見つける', subtitle: '1分で3-5個のテンプレートを推薦', step: 'ステップ {n}/3', q1: '1️⃣ 資金は?', q1hint: 'ポジションサイズ+リスクに影響', cap_small: '15万未満', cap_small_d: '初心者向け', cap_medium: '15-150万', cap_medium_d: '中級者', cap_large: '150万以上', cap_large_d: 'プロ/機関', q2: '2️⃣ 市場は?', q2hint: '最も慣れた市場を選択', market_us: '🇺🇸 米国', market_hk: '🇭🇰 香港', market_cn: '🇨🇳 中国', market_jp: '🇯🇵 日本', market_kr: '🇰🇷 韓国', market_tw: '🇹🇼 台湾', market_sg: '🇸🇬 シンガポール', market_au: '🇦🇺 オーストラリア', market_in: '🇮🇳 インド', market_eu: '🇪🇺 ヨーロッパ', market_crypto: '🪙 暗号', market_cross: '🌍 クロス市場', q3: '3️⃣ 最大損失は?', q3hint: 'リスクレベルを決定', r1: '🛡️ 保守(5%以下)', r1d: '安定,低リスク', r2: '⚖️ バランス(15%以下)', r2d: '堅実成長,中リスク', r3: '⚡ 積極(30%以上)', r3d: '高リターン,高リスク', next: '次へ', prev: '戻る', skip: 'スキップ', getResult: '結果を見る', matching: 'AIがマッチング中...', matchDone: '{n}件の一致', noMatch: '完全一致なし,調整してください', useTemplate: 'これを使う', retry: 'やり直す' },
  ko: { title: '🎯 3가지 질문으로 전략 찾기', subtitle: '1분에 3-5개 템플릿 추천', step: '단계 {n}/3', q1: '1️⃣ 자본금?', q1hint: '포지션 크기+리스크 영향', cap_small: '150만 미만', cap_small_d: '초보자 친화', cap_medium: '150-1500만', cap_medium_d: '중급자', cap_large: '1500만 이상', cap_large_d: '프로/기관', q2: '2️⃣ 시장?', q2hint: '가장 잘 아는 시장', market_us: '🇺🇸 미국', market_hk: '🇭🇰 홍콩', market_cn: '🇨🇳 중국', market_jp: '🇯🇵 일본', market_kr: '🇰🇷 한국', market_tw: '🇹🇼 대만', market_sg: '🇸🇬 싱가포르', market_au: '🇦🇺 호주', market_in: '🇮🇳 인도', market_eu: '🇪🇺 유럽', market_crypto: '🪙 암호화폐', market_cross: '🌍 크로스 시장', q3: '3️⃣ 최대 손실?', q3hint: '리스크 레벨 결정', r1: '🛡️ 보수(5% 이하)', r1d: '안정, 낮은 리스크', r2: '⚖️ 균형(15% 이하)', r2d: '안정 성장, 중간 리스크', r3: '⚡ 적극(30% 이상)', r3d: '고수익, 높은 리스크', next: '다음', prev: '이전', skip: '건너뛰기', getResult: '결과 보기', matching: 'AI 매칭 중...', matchDone: '{n}개 일치', noMatch: '정확한 일치 없음', useTemplate: '사용', retry: '다시 시작' },
  fr: { title: '🎯 3 questions pour trouver votre stratégie', subtitle: '1 minute pour 3-5 recommandations', step: 'Étape {n}/3', q1: '1️⃣ Votre capital?', q1hint: 'Affecte la position + le risque', cap_small: '<1.5K$', cap_small_d: 'Débutant', cap_medium: '1.5-15K$', cap_medium_d: 'Intermédiaire', cap_large: '15K$+', cap_large_d: 'Pro/Institutionnel', q2: '2️⃣ Quel marché?', q2hint: 'Choisissez le marché que vous connaissez', market_us: '🇺🇸 US', market_hk: '🇭🇰 HK', market_cn: '🇨🇳 CN', market_jp: '🇯🇵 JP', market_kr: '🇰🇷 KR', market_tw: '🇹🇼 TW', market_sg: '🇸🇬 SG', market_au: '🇦🇺 AU', market_in: '🇮🇳 IN', market_eu: '🇪🇺 EU', market_crypto: '🪙 Crypto', market_cross: '🌍 Multi-marchés', q3: '3️⃣ Perte max tolérée?', q3hint: 'Détermine le niveau de risque', r1: '🛡️ Conservateur (≤5%)', r1d: 'Stable, faible risque', r2: '⚖️ Équilibré (≤15%)', r2d: 'Croissance régulière, risque moyen', r3: '⚡ Agressif (≤30%+)', r3d: 'Rendement élevé, haut risque', next: 'Suivant', prev: 'Précédent', skip: 'Passer', getResult: 'Voir les correspondances', matching: 'Correspondance IA...', matchDone: '{n} stratégies trouvées', noMatch: 'Aucune correspondance exacte', useTemplate: 'Utiliser', retry: 'Recommencer' },
  it: { title: '🎯 3 domande per trovare la tua strategia', subtitle: '1 minuto per 3-5 raccomandazioni', step: 'Passo {n}/3', q1: '1️⃣ Capitale?', q1hint: 'Influenza posizione + rischio', cap_small: '<1.5K$', cap_small_d: 'Principiante', cap_medium: '1.5-15K$', cap_medium_d: 'Intermedio', cap_large: '15K$+', cap_large_d: 'Pro/Istituzionale', q2: '2️⃣ Mercato?', q2hint: 'Scegli il mercato che conosci', market_us: '🇺🇸 US', market_hk: '🇭🇰 HK', market_cn: '🇨🇳 CN', market_jp: '🇯🇵 JP', market_kr: '🇰🇷 KR', market_tw: '🇹🇼 TW', market_sg: '🇸🇬 SG', market_au: '🇦🇺 AU', market_in: '🇮🇳 IN', market_eu: '🇪🇺 EU', market_crypto: '🪙 Crypto', market_cross: '🌍 Multi-mercato', q3: '3️⃣ Perdita max?', q3hint: 'Determina il livello di rischio', r1: '🛡️ Conservativo (≤5%)', r1d: 'Stabile, basso rischio', r2: '⚖️ Bilanciato (≤15%)', r2d: 'Crescita costante, rischio medio', r3: '⚡ Aggressivo (≤30%+)', r3d: 'Alto rendimento, alto rischio', next: 'Avanti', prev: 'Indietro', skip: 'Salta', getResult: 'Vedi corrispondenze', matching: 'Corrispondenza IA...', matchDone: '{n} strategie trovate', noMatch: 'Nessuna corrispondenza esatta', useTemplate: 'Usa', retry: 'Ricomincia' },
  de: { title: '🎯 3 Fragen für Ihre Strategie', subtitle: '1 Minute für 3-5 Empfehlungen', step: 'Schritt {n}/3', q1: '1️⃣ Ihr Kapital?', q1hint: 'Beeinflusst Position + Risiko', cap_small: '<1.5K$', cap_small_d: 'Anfänger', cap_medium: '1.5-15K$', cap_medium_d: 'Fortgeschritten', cap_large: '15K$+', cap_large_d: 'Pro/Institutionell', q2: '2️⃣ Welcher Markt?', q2hint: 'Wählen Sie den Markt, den Sie kennen', market_us: '🇺🇸 US', market_hk: '🇭🇰 HK', market_cn: '🇨🇳 CN', market_jp: '🇯🇵 JP', market_kr: '🇰🇷 KR', market_tw: '🇹🇼 TW', market_sg: '🇸🇬 SG', market_au: '🇦🇺 AU', market_in: '🇮🇳 IN', market_eu: '🇪🇺 EU', market_crypto: '🪙 Krypto', market_cross: '🌍 Multi-Markt', q3: '3️⃣ Max. Verlust?', q3hint: 'Bestimmt das Risikoniveau', r1: '🛡️ Konservativ (≤5%)', r1d: 'Stabil, geringes Risiko', r2: '⚖️ Ausgewogen (≤15%)', r2d: 'Stetiges Wachstum, mittleres Risiko', r3: '⚡ Aggressiv (≤30%+)', r3d: 'Hohe Rendite, hohes Risiko', next: 'Weiter', prev: 'Zurück', skip: 'Überspringen', getResult: 'Übereinstimmungen anzeigen', matching: 'KI-Abgleich...', matchDone: '{n} Strategien gefunden', noMatch: 'Keine genaue Übereinstimmung', useTemplate: 'Verwenden', retry: 'Neu starten' },
  es: { title: '🎯 3 preguntas para encontrar tu estrategia', subtitle: '1 minuto para 3-5 recomendaciones', step: 'Paso {n}/3', q1: '1️⃣ ¿Tu capital?', q1hint: 'Afecta posición + riesgo', cap_small: '<1.5K$', cap_small_d: 'Principiante', cap_medium: '1.5-15K$', cap_medium_d: 'Intermedio', cap_large: '15K$+', cap_large_d: 'Pro/Institucional', q2: '2️⃣ ¿Mercado?', q2hint: 'Elige el mercado que conoces', market_us: '🇺🇸 US', market_hk: '🇭🇰 HK', market_cn: '🇨🇳 CN', market_jp: '🇯🇵 JP', market_kr: '🇰🇷 KR', market_tw: '🇹🇼 TW', market_sg: '🇸🇬 SG', market_au: '🇦🇺 AU', market_in: '🇮🇳 IN', market_eu: '🇪🇺 EU', market_crypto: '🪙 Crypto', market_cross: '🌍 Multi-mercado', q3: '3️⃣ ¿Pérdida máx?', q3hint: 'Determina el nivel de riesgo', r1: '🛡️ Conservador (≤5%)', r1d: 'Estable, bajo riesgo', r2: '⚖️ Equilibrado (≤15%)', r2d: 'Crecimiento constante, riesgo medio', r3: '⚡ Agresivo (≤30%+)', r3d: 'Alto rendimiento, alto riesgo', next: 'Siguiente', prev: 'Anterior', skip: 'Saltar', getResult: 'Ver coincidencias', matching: 'IA emparejando...', matchDone: '{n} estrategias encontradas', noMatch: 'Sin coincidencia exacta', useTemplate: 'Usar', retry: 'Reiniciar' },
};

const MARKETS = [
  { key: 'us', code: 'us', emoji: '🇺🇸' },
  { key: 'hk', code: 'hk', emoji: '🇭🇰' },
  { key: 'cn', code: 'cn', emoji: '🇨🇳' },
  { key: 'jp', code: 'jp', emoji: '🇯🇵' },
  { key: 'kr', code: 'kr', emoji: '🇰🇷' },
  { key: 'tw', code: 'tw', emoji: '🇹🇼' },
  { key: 'sg', code: 'sg', emoji: '🇸🇬' },
  { key: 'au', code: 'au', emoji: '🇦🇺' },
  { key: 'in', code: 'in', emoji: '🇮🇳' },
  { key: 'eu', code: 'eu', emoji: '🇪🇺' },
  { key: 'crypto', code: 'crypto', emoji: '🪙' },
  { key: 'cross', code: 'cross', emoji: '🌍' },
];

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  visible = true, onComplete, onSelectTemplate, onSkip, locale: pl, loading = false,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionAnswers>({ capital: null, market: null, risk: null });
  const [results, setResults] = useState<RecommendedTemplate[]>([]);
  const [querying, setQuerying] = useState(false);

  if (!visible) return null;

  const canNext = (() => {
    if (step === 0) return answers.capital !== null;
    if (step === 1) return answers.market !== null;
    if (step === 2) return answers.risk !== null;
    return false;
  })();

  const handleNext = useCallback(async () => {
    if (step < 2) { setStep(s => s + 1); return; }
    // Final step - get results
    if (onComplete) {
      setQuerying(true);
      try {
        const res = await onComplete(answers);
        setResults(res);
        setStep(3);
      } finally { setQuerying(false); }
    } else {
      // No engine - use demo
      setResults(generateDemoRecommendations(answers));
      setStep(3);
    }
  }, [step, answers, onComplete]);

  const handlePrev = () => { if (step > 0) setStep(s => s - 1); };

  const handleReset = () => {
    setStep(0);
    setAnswers({ capital: null, market: null, risk: null });
    setResults([]);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '32px 40px',
        maxWidth: 520, width: '95%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
            {t.title}
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{t.subtitle}</p>
        </div>

        {/* ── Progress Bar ───────────────────────────────────────── */}
        <Progress
          percent={(step / 3) * 100}
          strokeColor={{ '0%': '#3b82f6', '100%': '#8b5cf6' }}
          showInfo={false}
          size="small"
          style={{ marginBottom: 8 }}
        />
        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginBottom: 24 }}>
          {step < 3 ? t.step.replace('{n}', String(step + 1)) : `✅ ${t.matchDone.replace('{n}', String(results.length))}`}
        </div>

        {/* ── Question 1: Capital ────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
              <DollarOutlined style={{ marginRight: 6, color: '#22c55e' }} />{t.q1}
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{t.q1hint}</p>
            {['small', 'medium', 'large'].map(k => (
              <button key={k}
                onClick={() => setAnswers({ ...answers, capital: k as any })}
                style={optionStyle(answers.capital === k)}>
                <div style={{ fontSize: 15, fontWeight: 600, color: answers.capital === k ? '#fff' : '#1e293b' }}>
                  {(t as any)['cap_' + k]}
                </div>
                <div style={{ fontSize: 11, color: answers.capital === k ? 'rgba(255,255,255,0.85)' : '#64748b' }}>
                  {(t as any)['cap_' + k + '_d']}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Question 2: Market ─────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
              <GlobalOutlined style={{ marginRight: 6, color: '#3b82f6' }} />{t.q2}
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{t.q2hint}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {MARKETS.map(m => (
                <button key={m.code}
                  onClick={() => setAnswers({ ...answers, market: m.code })}
                  style={{
                    ...optionStyle(answers.market === m.code, true),
                    padding: '10px 4px', fontSize: 12,
                  }}>
                  {(t as any)['market_' + m.key]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Question 3: Risk ───────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
              <RiseOutlined style={{ marginRight: 6, color: '#ef4444' }} />{t.q3}
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{t.q3hint}</p>
            {['conservative', 'balanced', 'aggressive'].map((k, i) => {
              const colors = ['#22c55e', '#3b82f6', '#ef4444'];
              return (
                <button key={k}
                  onClick={() => setAnswers({ ...answers, risk: k as any })}
                  style={{
                    ...optionStyle(answers.risk === k),
                    background: answers.risk === k ? colors[i] : '#fff',
                    borderColor: colors[i],
                  }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: answers.risk === k ? '#fff' : colors[i] }}>
                    {(t as any)['r' + (i + 1)]}
                  </div>
                  <div style={{ fontSize: 11, color: answers.risk === k ? 'rgba(255,255,255,0.85)' : '#64748b' }}>
                    {(t as any)['r' + (i + 1) + 'd']}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Results Step ───────────────────────────────────────── */}
        {step === 3 && (
          <div>
            {querying || loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <ThunderboltOutlined style={{ fontSize: 32, color: '#3b82f6', marginBottom: 12 }} spin />
                <div style={{ fontSize: 14, color: '#64748b' }}>{t.matching}</div>
              </div>
            ) : results.length === 0 ? (
              <Empty description={t.noMatch} />
            ) : (
              <div>
                {results.map((tmpl, i) => (
                  <div key={tmpl.id} style={{
                    background: i === 0 ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : '#f8fafc',
                    border: i === 0 ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                    borderRadius: 12, padding: 14, marginBottom: 10,
                    cursor: 'pointer', transition: 'transform 0.2s',
                  }}
                    onClick={() => onSelectTemplate?.(tmpl)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag color={tmpl.riskLevel === 'conservative' ? 'green' : tmpl.riskLevel === 'aggressive' ? 'red' : 'blue'}>
                          {tmpl.riskLevel === 'conservative' ? '🛡️' : tmpl.riskLevel === 'aggressive' ? '⚡' : '⚖️'}
                        </Tag>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                          {pl?.startsWith('zh') ? tmpl.nameCN : tmpl.name}
                        </span>
                        {i === 0 && <Tag color="gold">🏆 Top1</Tag>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{tmpl.matchScore}%</div>
                        <div style={{ fontSize: 9, color: '#94a3b8' }}>匹配度</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{tmpl.oneLiner}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {tmpl.marketTags.map((mt, j) => <Tag key={j}>{mt}</Tag>)}
                    </div>
                  </div>
                ))}
                <Button block icon={<ThunderboltOutlined />} type="primary" onClick={handleReset} style={{ marginTop: 8 }}>
                  {t.retry}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────── */}
        {step < 3 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button onClick={step === 0 ? onSkip : handlePrev} icon={step === 0 ? undefined : <LeftOutlined />}>
              {step === 0 ? t.skip : t.prev}
            </Button>
            <Button
              type="primary"
              disabled={!canNext || querying}
              loading={querying}
              onClick={handleNext}
              icon={step < 2 ? <RightOutlined /> : <ArrowRightOutlined />}
              style={{ flex: 1 }}
            >
              {step < 2 ? t.next : t.getResult}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Helper: Option style ───────────────────────────────────────────
const optionStyle = (selected: boolean, compact = false): React.CSSProperties => ({
  display: 'block', width: '100%',
  background: selected ? '#3b82f6' : '#fff',
  border: `2px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
  borderRadius: 12, padding: compact ? '10px 12px' : '14px 18px',
  marginBottom: 10, textAlign: 'left', cursor: 'pointer',
  transition: 'all 0.2s',
});

// ── Demo Data Generator ─────────────────────────────────────────────
function generateDemoRecommendations(answers: QuestionAnswers): RecommendedTemplate[] {
  const allTemplates: RecommendedTemplate[] = [
    { id: 'us_earn', name: 'Earnings Hunter', nameCN: '财报猎人', oneLiner: '季报后2日动量追入ROE>20%标的,止损-8%,连续miss退出。', marketTags: ['🇺🇸'], matchScore: 92, riskLevel: 'balanced', category: 'us', factors: ['MOM_12M', 'ROE', 'PE'] },
    { id: 'us_mag7', name: 'MAG7 Momentum', nameCN: 'MAG7动量', oneLiner: '按60日动量排Mag7持仓前3,周调止损-7%,跌出前5退出。', marketTags: ['🇺🇸'], matchScore: 88, riskLevel: 'balanced', category: 'us', factors: ['MOM_12M', 'ROE'] },
    { id: 'us_val', name: 'Value Rotation', nameCN: '价值轮动', oneLiner: '低PE+高股息前10等权配置,季调,止损-10%。', marketTags: ['🇺🇸'], matchScore: 85, riskLevel: 'conservative', category: 'us', factors: ['PE', 'DIV'] },
    { id: 'us_low', name: 'Low Vol', nameCN: '低波动', oneLiner: '低波动率前20+高质量因子加权,月调再平衡。', marketTags: ['🇺🇸'], matchScore: 90, riskLevel: 'conservative', category: 'us', factors: ['LOW_VOL', 'ROE'] },
    { id: 'us_vix', name: 'VIX Hedge', nameCN: 'VIX对冲', oneLiner: 'VIX>30时自动加对冲,VIX<15时平仓。', marketTags: ['🇺🇸'], matchScore: 75, riskLevel: 'balanced', category: 'us', factors: ['VIX', 'HEDGE_COST'] },
    { id: 'hk_div', name: 'HK Dividend', nameCN: '港股高息', oneLiner: '高股息率Top10+低PE+稳定派息,半年调。', marketTags: ['🇭🇰'], matchScore: 89, riskLevel: 'conservative', category: 'hk', factors: ['DIV', 'PE'] },
    { id: 'hk_ah', name: 'AH Premium', nameCN: 'AH溢价套利', oneLiner: 'AH价差>30%时买H卖A,收敛到10%平仓。', marketTags: ['🇭🇰', '🇨🇳'], matchScore: 80, riskLevel: 'balanced', category: 'hk', factors: ['AH_PREMIUM'] },
    { id: 'hk_tb', name: 'Turbo Direction', nameCN: '涡轮方向', oneLiner: '突破20日线+量>2倍买平值涡轮,止损-20%。', marketTags: ['🇭🇰'], matchScore: 70, riskLevel: 'aggressive', category: 'hk', factors: ['MOM_6M', 'TURN'] },
    { id: 'cr_btc', name: 'BTC Trend', nameCN: 'BTC趋势', oneLiner: 'BTC突破60日线+成交量>2倍,持有30天,止损-15%。', marketTags: ['🪙'], matchScore: 85, riskLevel: 'aggressive', category: 'crypto', factors: ['MOM', 'VOL'] },
    { id: 'cr_dca', name: 'Crypto DCA', nameCN: '加密定投', oneLiner: '每周固定金额买BTC+ETH,无视价格,长期持有。', marketTags: ['🪙'], matchScore: 95, riskLevel: 'conservative', category: 'crypto', factors: ['DCA'] },
    { id: 'xm_gr', name: 'Global Rotation', nameCN: '全球轮动', oneLiner: '全球大类资产Top3动量轮动,月调再平衡。', marketTags: ['🌍'], matchScore: 78, riskLevel: 'balanced', category: 'cross', factors: ['MOM', 'CORR'] },
  ];

  // Filter based on answers
  let filtered = allTemplates;
  if (answers.risk) filtered = filtered.filter(t => t.riskLevel === answers.risk);
  if (answers.market) {
    const marketEmojis: Record<string, string> = {
      us: '🇺🇸', hk: '🇭🇰', cn: '🇨🇳', jp: '🇯🇵', kr: '🇰🇷', tw: '🇹🇼',
      sg: '🇸🇬', au: '🇦🇺', in: '🇮🇳', eu: '🇪🇺', crypto: '🪙', cross: '🌍',
    };
    const emoji = marketEmojis[answers.market];
    if (emoji) {
      const marketMatched = allTemplates.filter(t => t.marketTags.includes(emoji));
      if (marketMatched.length > 0) {
        filtered = marketMatched.filter(t => !answers.risk || t.riskLevel === answers.risk);
        if (filtered.length === 0) filtered = marketMatched;
      }
    }
  }

  return filtered.slice(0, 5);
}

export default OnboardingGuide;
