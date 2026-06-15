// ── R213 ML P4-1: LaunchHeroV2 — v2.1.0 启动页 Hero Banner ──────────
// Upgraded from LaunchPageV1: v2.1.0 PHOENIX stats + new features grid
// 14 rounds / 470h / 6 collaborators / 88 templates / 23 touchpoints
// 9-language i18n + animated version badge + feature highlight cards

import React, { useState, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────
interface LaunchHeroV2Props {
  onGetStarted?: () => void;
  onChangeLog?: () => void;
  locale?: string;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    badge: '🚀 v2.1.0 PHOENIX',
    title: '凤凰涅槃，浴火重生',
    subtitle: '14轮协作 · 470小时 · 6个数字员工 · 88策略模板 · 23计费触点',
    getStarted: '立即开始', changelog: '更新日志',
    stats: '关键数据', templates: '88 策略模板', touchpoints: '23 计费触点',
    rounds: '14 轮迭代', hours: '470 开发小时', agents: '6 数字员工',
    newIn: 'v2.1.0 新功能',
    f1title: '策略保险', f1desc: '1U买保险，7天保障，亏损>5%免费AI诊断',
    f2title: 'API Key连接', f2desc: '币安/OKX/富途，AES-256加密，只读+交易，禁止提币',
    f3title: '创作者市场', f3desc: '上传策略→1U AI审核→8项检查→上架+排行榜联动',
    f4title: '龙虎榜3级漏斗', f4desc: '免费Top20→1U日报→0.5U实时推送，因子排名+AI解读',
    f5title: '排行榜+盲盒', f5desc: '实盘排名+跟单0.1%+AI因子盲盒1U翻牌',
    f6title: '9语言全覆盖', f6desc: '0个中文字符残留，完整国际化',
    footer: 'Phoenix rises from the ashes. v2.1.0 — Built by 6 digital colleagues.',
  },
  en: {
    badge: '🚀 v2.1.0 PHOENIX', title: 'Phoenix Rising',
    subtitle: '14 rounds · 470 hours · 6 digital colleagues · 88 templates · 23 touchpoints',
    getStarted: 'Get Started', changelog: 'Changelog',
    stats: 'Key Stats', templates: '88 Templates', touchpoints: '23 Touchpoints',
    rounds: '14 Rounds', hours: '470 Hours', agents: '6 Colleagues',
    newIn: "What's New in v2.1.0",
    f1title: 'Strategy Insurance', f1desc: '1U for 7-day protection. Loss >5% triggers free AI diagnosis',
    f2title: 'API Key Connect', f2desc: 'Binance/OKX/Futu. AES-256 encrypted. Trade-only, no withdrawal',
    f3title: 'Creator Marketplace', f3desc: 'Upload strategies → 1U AI review → 8 checks → list + Leaderboard',
    f4title: '3-Tier Ranking Funnel', f4desc: 'Free Top20 → 1U Daily Briefing → 0.5U Real-time Push',
    f5title: 'Leaderboard + BlindBox', f5desc: 'Live rankings + copy-trade 0.1% + AI factor blind box 1U',
    f6title: '9 Languages', f6desc: 'Zero CJK in codebase, full i18n across all modules',
    footer: 'Phoenix rises from the ashes. v2.1.0 — Built by 6 digital colleagues.',
  },
  ja: { badge: '🚀 v2.1.0 PHOENIX', title: 'フェニックス誕生', subtitle: '14ラウンド·470時間·6体のデジタル同僚·88テンプレート·23タッチポイント', getStarted: '開始', changelog: '更新履歴', stats: '主要データ', templates: '88 テンプレート', touchpoints: '23 タッチポイント', rounds: '14 ラウンド', hours: '470 時間', agents: '6 同僚', newIn: 'v2.1.0 新機能', f1title: '戦略保険', f1desc: '1Uで7日間保護。損失5%超で無料AI診断', f2title: 'APIキー接続', f2desc: 'Binance/OKX/Futu。AES-256暗号化。取引のみ、出金不可', f3title: 'クリエイターマーケット', f3desc: '戦略アップロード→1U AI審査→8項目チェック→公開+ランキング', f4title: '3段階ランキング', f4desc: '無料Top20→1U日報→0.5Uリアルタイム通知', f5title: 'リーダーボード+盲盒', f5desc: '実績ランキング+コピートレード0.1%+AI因子盲盒1U', f6title: '9言語対応', f6desc: 'コードベースに漢字ゼロ、完全i18n', footer: 'Phoenix rises from the ashes. v2.1.0 — Built by 6 digital colleagues.' },
  ko: { badge: '🚀 v2.1.0 PHOENIX', title: '피닉스 탄생', subtitle: '14라운드·470시간·6디지털 동료·88템플릿·23터치포인트', getStarted: '시작하기', changelog: '변경 로그', stats: '주요 지표', templates: '88 템플릿', touchpoints: '23 터치포인트', rounds: '14 라운드', hours: '470 시간', agents: '6 동료', newIn: 'v2.1.0 신기능', f1title: '전략 보험', f1desc: '1U로 7일 보호. 손실 5% 초과시 무료 AI 진단', f2title: 'API 키 연결', f2desc: 'Binance/OKX/Futu. AES-256 암호화. 거래만, 출금 불가', f3title: '크리에이터 마켓', f3desc: '전략 업로드→1U AI 심사→8항목 검사→등록+리더보드', f4title: '3단계 랭킹', f4desc: '무료 Top20→1U 일일브리핑→0.5U 실시간푸시', f5title: '리더보드+블라인드박스', f5desc: '실적 랭킹+카피트레이드 0.1%+AI 팩터 블라인드박스 1U', f6title: '9개 언어', f6desc: '코드베이스 한자 제로, 완전 i18n', footer: 'Phoenix rises from the ashes. v2.1.0 — Built by 6 digital colleagues.' },
  fr: { badge: '🚀 v2.1.0 PHOENIX', title: 'Le Phénix Renaît', subtitle: '14 rounds·470h·6 collègues numériques·88 modèles·23 points', getStarted: 'Démarrer', changelog: 'Journal', stats: 'Statistiques', templates: '88 Modèles', touchpoints: '23 Points', rounds: '14 Rounds', hours: '470 Heures', agents: '6 Collègues', newIn: 'Nouveau en v2.1.0', f1title: 'Assurance Stratégie', f1desc: '1U pour 7j de protection. Perte>5%→diagnostic IA gratuit', f2title: 'Connexion API', f2desc: 'Binance/OKX/Futu. AES-256 chiffré. Trading seul, pas de retrait', f3title: 'Marché Créateur', f3desc: 'Upload→1U révision IA→8 vérifications→publication+Classement', f4title: 'Entonnoir 3 Niveaux', f4desc: 'Top20 gratuit→1U Briefing→0.5U Push temps réel', f5title: 'Classement+Boîte Mystère', f5desc: 'Classement live+copie 0.1%+boîte mystère IA 1U', f6title: '9 Langues', f6desc: 'Zéro caractère chinois, i18n complet', footer: 'Phoenix rises from the ashes. v2.1.0 — Built by 6 digital colleagues.' },
  it: { badge: '🚀 v2.1.0 PHOENIX', title: 'La Fenice Risorge', subtitle: '14 round·470h·6 colleghi digitali·88 modelli·23 punti', getStarted: 'Inizia', changelog: 'Registro', stats: 'Statistiche', templates: '88 Modelli', touchpoints: '23 Punti', rounds: '14 Round', hours: '470 Ore', agents: '6 Colleghi', newIn: 'Novità v2.1.0', f1title: 'Assicurazione', f1desc: '1U per 7gg protezione. Perdita>5%→diagnosi IA gratuita', f2title: 'API Key', f2desc: 'Binance/OKX/Futu. AES-256 cifrato. Solo trading, no prelievo', f3title: 'Mercato Creatore', f3desc: 'Upload→1U revisione IA→8 controlli→pubblicazione+Classifica', f4title: 'Imbuto 3 Livelli', f4desc: 'Top20 gratis→1U Briefing→0.5U Push in tempo reale', f5title: 'Classifica+Scatola Mistero', f5desc: 'Classifica live+copia 0.1%+scatola mistero IA 1U', f6title: '9 Lingue', f6desc: 'Zero caratteri cinesi, i18n completo', footer: 'Phoenix rises from the ashes. v2.1.0 — Built by 6 digital colleagues.' },
  de: { badge: '🚀 v2.1.0 PHOENIX', title: 'Phönix aus der Asche', subtitle: '14 Runden·470h·6 digitale Kollegen·88 Vorlagen·23 Punkte', getStarted: 'Starten', changelog: 'Änderungen', stats: 'Kennzahlen', templates: '88 Vorlagen', touchpoints: '23 Punkte', rounds: '14 Runden', hours: '470 Stunden', agents: '6 Kollegen', newIn: 'Neu in v2.1.0', f1title: 'Strategie-Versicherung', f1desc: '1U für 7 Tage Schutz. Verlust>5%→kostenlose KI-Diagnose', f2title: 'API-Key', f2desc: 'Binance/OKX/Futu. AES-256 verschlüsselt. Nur Handel, keine Auszahlung', f3title: 'Creator-Marktplatz', f3desc: 'Upload→1U KI-Prüfung→8 Checks→Veröffentlichung+Rangliste', f4title: '3-Stufen-Trichter', f4desc: 'Kostenlos Top20→1U Tagesbriefing→0.5U Echtzeit-Push', f5title: 'Rangliste+Überraschungsbox', f5desc: 'Live-Rangliste+Kopie 0.1%+KI-Überraschungsbox 1U', f6title: '9 Sprachen', f6desc: 'Null CJK im Code, vollständige i18n', footer: 'Phoenix rises from the ashes. v2.1.0 — Built by 6 digital colleagues.' },
  es: { badge: '🚀 v2.1.0 PHOENIX', title: 'El Fénix Renace', subtitle: '14 rondas·470h·6 colegas digitales·88 plantillas·23 puntos', getStarted: 'Comenzar', changelog: 'Registro', stats: 'Estadísticas', templates: '88 Plantillas', touchpoints: '23 Puntos', rounds: '14 Rondas', hours: '470 Horas', agents: '6 Colegas', newIn: 'Nuevo en v2.1.0', f1title: 'Seguro de Estrategia', f1desc: '1U por 7d protección. Pérdida>5%→diagnóstico IA gratis', f2title: 'Conexión API', f2desc: 'Binance/OKX/Futu. AES-256 cifrado. Solo trading, sin retiro', f3title: 'Mercado Creador', f3desc: 'Subir→1U revisión IA→8 verificaciones→publicación+Ranking', f4title: 'Embudo 3 Niveles', f4desc: 'Top20 gratis→1U Briefing→0.5U Push tiempo real', f5title: 'Ranking+Caja Misterio', f5desc: 'Ranking en vivo+copia 0.1%+caja misterio IA 1U', f6title: '9 Idiomas', f6desc: 'Cero caracteres chinos, i18n completo', footer: 'Phoenix rises from the ashes. v2.1.0 — Built by 6 digital colleagues.' },
};

// ── Stats Config ────────────────────────────────────────────────────
const STATS = [
  { key: 'templates', icon: '📋', color: '#3b82f6' },
  { key: 'touchpoints', icon: '⚡', color: '#f59e0b' },
  { key: 'rounds', icon: '🔄', color: '#8b5cf6' },
  { key: 'hours', icon: '⏱️', color: '#22c55e' },
  { key: 'agents', icon: '🦐', color: '#ef4444' },
];

const FEATURES = [
  { key: 'f1', icon: '🛡️', color: '#3b82f6' },
  { key: 'f2', icon: '🔐', color: '#22c55e' },
  { key: 'f3', icon: '🏆', color: '#f59e0b' },
  { key: 'f4', icon: '📊', color: '#8b5cf6' },
  { key: 'f5', icon: '🎁', color: '#ec4899' },
  { key: 'f6', icon: '🌍', color: '#06b6d4' },
];

// ── Component ───────────────────────────────────────────────────────
const LaunchHeroV2: React.FC<LaunchHeroV2Props> = ({
  onGetStarted, onChangeLog, locale: pl,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const [badgePulse, setBadgePulse] = useState(true);
  useEffect(() => {
    const tm = setTimeout(() => setBadgePulse(false), 3000);
    return () => clearTimeout(tm);
  }, []);

  return (
    <div style={{
      maxWidth: 960, margin: '0 auto', padding: '40px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ── Version Badge ─────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          color: '#fff', borderRadius: 20, padding: '6px 20px',
          fontSize: 14, fontWeight: 700, letterSpacing: '0.5px',
          animation: badgePulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
          boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
        }}>
          {t.badge}
        </span>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <h1 style={{
        fontSize: 42, fontWeight: 800, textAlign: 'center',
        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: 16, lineHeight: 1.2,
      }}>
        {t.title}
      </h1>

      <p style={{
        textAlign: 'center', fontSize: 16, color: '#64748b',
        maxWidth: 640, margin: '0 auto 32px', lineHeight: 1.6,
      }}>
        {t.subtitle}
      </p>

      <div style={{ textAlign: 'center', marginBottom: 48, display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button onClick={onGetStarted} style={{
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          color: '#fff', border: 'none', borderRadius: 12, padding: '14px 36px',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(239,68,68,0.3)',
          transition: 'transform 0.2s',
        }}>
          {t.getStarted} →
        </button>
        <button onClick={onChangeLog} style={{
          background: 'transparent', color: '#64748b',
          border: '2px solid #e2e8f0', borderRadius: 12, padding: '14px 28px',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          📋 {t.changelog}
        </button>
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 24,
        flexWrap: 'wrap', marginBottom: 56,
        background: '#f8fafc', borderRadius: 16, padding: '24px 32px',
      }}>
        <h3 style={{ width: '100%', textAlign: 'center', margin: '0 0 16px', color: '#1e293b', fontSize: 18 }}>
          📊 {t.stats}
        </h3>
        {STATS.map(s => (
          <div key={s.key} style={{
            textAlign: 'center', minWidth: 100,
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>
              {(t as any)[s.key]}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              {s.key === 'templates' ? 'Templates' : s.key === 'touchpoints' ? 'Touchpoints' : s.key === 'rounds' ? 'Rounds' : s.key === 'hours' ? 'Hours' : 'Colleagues'}
            </div>
          </div>
        ))}
      </div>

      {/* ── What's New ────────────────────────────────────────────── */}
      <h2 style={{
        textAlign: 'center', fontSize: 24, fontWeight: 700,
        color: '#1e293b', marginBottom: 32,
      }}>
        ✨ {t.newIn}
      </h2>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16, marginBottom: 48,
      }}>
        {FEATURES.map((f, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: '20px 24px',
            border: `1px solid ${f.color}20`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, color: f.color }}>{f.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              {(t as any)[f.key + 'title']}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              {(t as any)[f.key + 'desc']}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center', color: '#94a3b8', fontSize: 13,
        paddingTop: 32, borderTop: '1px solid #e2e8f0',
      }}>
        🦐 {t.footer}
      </div>
    </div>
  );
};

export default LaunchHeroV2;
