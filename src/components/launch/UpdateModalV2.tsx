// ── R213 ML P4-2: UpdateModalV2 — v2.1.0 更新弹窗 ──────────
// In-app update notification: version badge + release highlights + action buttons
// Restart later / Update now + auto-install indicator
// 9-language i18n + changelog link + skip version option

import React, { useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────
interface UpdateModalV2Props {
  visible?: boolean;
  currentVersion?: string;
  newVersion?: string;
  onUpdate?: () => void;
  onDismiss?: () => void;
  onSkip?: () => void;
  onChangelog?: () => void;
  locale?: string;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '🎉 v2.1.0 PHOENIX 可用！',
    subtitle: '凤凰涅槃 — 14轮迭代，20+新功能',
    currentVer: '当前版本', newVer: '新版本',
    highlights: '更新亮点',
    h1: '策略保险 + API Key + 创作者市场',
    h2: '龙虎榜3级漏斗 + 排行榜跟单 + AI盲盒',
    h3: '23计费触点 + 6层安全 + 9语言完整覆盖',
    h4: 'TSC 0错误 + 88模板 + 性能优化',
    updateNow: '立即更新', later: '稍后提醒', skip: '跳过此版本',
    changelog: '查看完整更新日志',
    updating: '更新中...', restartHint: '更新完成后将自动重启',
  },
  en: {
    title: '🎉 v2.1.0 PHOENIX Available!',
    subtitle: 'Phoenix Rising — 14 rounds, 20+ new features',
    currentVer: 'Current', newVer: 'New',
    highlights: 'Release Highlights',
    h1: 'Strategy Insurance + API Key + Creator Marketplace',
    h2: '3-Tier Ranking Funnel + Copy-Trade + AI Blind Box',
    h3: '23 Touchpoints + 6-Layer Security + 9 Languages',
    h4: 'TSC 0 Errors + 88 Templates + Performance Optimized',
    updateNow: 'Update Now', later: 'Remind Later', skip: 'Skip',
    changelog: 'View Full Changelog',
    updating: 'Updating...', restartHint: 'Will restart automatically after update',
  },
  ja: { title: '🎉 v2.1.0 PHOENIX 利用可能!', subtitle: 'フェニックス誕生 — 14ラウンド、20以上の新機能', currentVer: '現在', newVer: '最新', highlights: '更新ハイライト', h1: '戦略保険+APIキー+クリエイターマーケット', h2: '3段階ランキング+コピートレード+AI盲盒', h3: '23タッチポイント+6層セキュリティ+9言語', h4: 'TSC 0エラー+88テンプレート+性能最適化', updateNow: '今すぐ更新', later: '後で', skip: 'スキップ', changelog: '完全な更新履歴を見る', updating: '更新中...', restartHint: '更新後自動的に再起動します' },
  ko: { title: '🎉 v2.1.0 PHOENIX 사용 가능!', subtitle: '피닉스 탄생 — 14라운드, 20+ 신기능', currentVer: '현재', newVer: '신규', highlights: '업데이트 하이라이트', h1: '전략보험+API키+크리에이터 마켓', h2: '3단계 랭킹+카피트레이드+AI 블라인드박스', h3: '23터치포인트+6계층 보안+9개 언어', h4: 'TSC 0오류+88템플릿+성능 최적화', updateNow: '지금 업데이트', later: '나중에', skip: '건너뛰기', changelog: '전체 변경 로그 보기', updating: '업데이트 중...', restartHint: '업데이트 후 자동 재시작' },
  fr: { title: '🎉 v2.1.0 PHOENIX Disponible!', subtitle: 'Le Phénix Renaît — 14 rounds, 20+ nouveautés', currentVer: 'Actuel', newVer: 'Nouveau', highlights: 'Points forts', h1: 'Assurance+API Key+Marché Créateur', h2: 'Entonnoir 3 niveaux+Copie+Boîte Mystère IA', h3: '23 points+6 couches sécurité+9 langues', h4: 'TSC 0 erreurs+88 modèles+Performance', updateNow: 'Mettre à jour', later: 'Plus tard', skip: 'Passer', changelog: 'Voir le journal complet', updating: 'Mise à jour...', restartHint: 'Redémarrage automatique après mise à jour' },
  it: { title: '🎉 v2.1.0 PHOENIX Disponibile!', subtitle: 'La Fenice Risorge — 14 round, 20+ novità', currentVer: 'Corrente', newVer: 'Nuova', highlights: 'In evidenza', h1: 'Assicurazione+API Key+Mercato Creatore', h2: 'Imbuto 3 livelli+Copia+Scatola Mistero IA', h3: '23 punti+6 livelli sicurezza+9 lingue', h4: 'TSC 0 errori+88 modelli+Performance', updateNow: 'Aggiorna ora', later: 'Dopo', skip: 'Salta', changelog: 'Vedi registro completo', updating: 'Aggiornamento...', restartHint: 'Riavvio automatico dopo aggiornamento' },
  de: { title: '🎉 v2.1.0 PHOENIX Verfügbar!', subtitle: 'Phönix aus der Asche — 14 Runden, 20+ Neuerungen', currentVer: 'Aktuell', newVer: 'Neu', highlights: 'Highlights', h1: 'Versicherung+API-Key+Creator-Marktplatz', h2: '3-Stufen-Trichter+Kopie+KI-Überraschungsbox', h3: '23 Punkte+6 Sicherheitsebenen+9 Sprachen', h4: 'TSC 0 Fehler+88 Vorlagen+Performance', updateNow: 'Jetzt aktualisieren', later: 'Später', skip: 'Überspringen', changelog: 'Vollständiges Changelog', updating: 'Aktualisierung...', restartHint: 'Automatischer Neustart nach Update' },
  es: { title: '🎉 ¡v2.1.0 PHOENIX Disponible!', subtitle: 'El Fénix Renace — 14 rondas, 20+ novedades', currentVer: 'Actual', newVer: 'Nueva', highlights: 'Destacados', h1: 'Seguro+API Key+Mercado Creador', h2: 'Embudo 3 niveles+Copia+Caja Misterio IA', h3: '23 puntos+6 capas seguridad+9 idiomas', h4: 'TSC 0 errores+88 plantillas+Rendimiento', updateNow: 'Actualizar ahora', later: 'Después', skip: 'Saltar', changelog: 'Ver registro completo', updating: 'Actualizando...', restartHint: 'Se reiniciará automáticamente' },
};

// ── Component ───────────────────────────────────────────────────────
const UpdateModalV2: React.FC<UpdateModalV2Props> = ({
  visible = true, currentVersion = 'v1.11.0', newVersion = 'v2.1.0',
  onUpdate, onDismiss, onSkip, onChangelog, locale: pl,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const [updating, setUpdating] = useState(false);

  if (!visible) return null;

  const handleUpdate = () => {
    setUpdating(true);
    onUpdate?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '36px 40px',
        maxWidth: 520, width: '90%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.4s ease-out',
      }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#fff', borderRadius: 16, padding: '6px 16px',
            fontSize: 13, fontWeight: 700, marginBottom: 16,
          }}>
            {newVersion}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            {t.title}
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            {t.subtitle}
          </p>
        </div>

        {/* ── Version Info ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 32,
          marginBottom: 24, padding: '12px 0',
          borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{t.currentVer}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>{currentVersion}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#22c55e', fontSize: 20 }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{t.newVer}</div>
            <div style={{
              fontSize: 16, fontWeight: 800,
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {newVersion}
            </div>
          </div>
        </div>

        {/* ── Highlights ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>
            ✨ {t.highlights}
          </div>
          {['h1', 'h2', 'h3', 'h4'].map((h, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '6px 0', fontSize: 13,
            }}>
              <span style={{
                color: '#fff', background: i === 0 ? '#f59e0b' : i === 1 ? '#3b82f6' : i === 2 ? '#22c55e' : '#8b5cf6',
                borderRadius: '50%', width: 20, height: 20, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
              }}>
                {i + 1}
              </span>
              <span style={{ color: '#475569', lineHeight: 1.5 }}>{(t as any)[h]}</span>
            </div>
          ))}
        </div>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={handleUpdate} disabled={updating} style={{
            width: '100%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#fff', border: 'none', borderRadius: 12, padding: '14px',
            fontSize: 16, fontWeight: 700, cursor: updating ? 'default' : 'pointer',
            opacity: updating ? 0.7 : 1,
            boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
          }}>
            {updating ? t.updating : t.updateNow}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDismiss} style={{
              flex: 1, background: 'transparent', color: '#64748b',
              border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              {t.later}
            </button>
            <button onClick={onSkip} style={{
              flex: 1, background: 'transparent', color: '#94a3b8',
              border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              {t.skip}
            </button>
          </div>

          {onChangelog && (
            <button onClick={onChangelog} style={{
              background: 'transparent', color: '#3b82f6', border: 'none',
              padding: '6px', fontSize: 12, cursor: 'pointer', marginTop: 4,
            }}>
              📋 {t.changelog}
            </button>
          )}
        </div>

        {updating && (
          <div style={{
            textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 12,
          }}>
            ⏳ {t.restartHint}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateModalV2;
