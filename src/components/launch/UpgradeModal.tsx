// ── R225 ML#2: UpgradeModal — v2.3.0 CRYSTAL 升级弹窗 ──────────
// 3-step upgrade wizard: ① What's New ② Feature Walkthrough ③ Ready
// 11-language i18n + progress bar + skip option + restart trigger
// 升级引导3步: 亮点预览→新功能走查→确认升级

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ── Types ───────────────────────────────────────────────────────────
interface UpgradeModalProps {
  visible: boolean;
  currentVersion?: string;
  newVersion?: string;
  onUpgrade?: () => void;
  onDismiss?: () => void;
  onSkip?: () => void;
  locale?: string;
  /** Auto-show on first launch of new version */
  autoShow?: boolean;
}

type WizardStep = 'highlights' | 'walkthrough' | 'ready';

interface FeatureHighlight {
  icon: string;
  titleKey: string;
  descKey: string;
}

// ── Feature highlights for v2.3.0 CRYSTAL ──────────────────────────
const FEATURES: FeatureHighlight[] = [
  { icon: '🖱️', titleKey: 'f1_title', descKey: 'f1_desc' },
  { icon: '🪟', titleKey: 'f2_title', descKey: 'f2_desc' },
  { icon: '🎛️', titleKey: 'f3_title', descKey: 'f3_desc' },
  { icon: '💀', titleKey: 'f4_title', descKey: 'f4_desc' },
  { icon: '🔐', titleKey: 'f5_title', descKey: 'f5_desc' },
  { icon: '🌐', titleKey: 'f6_title', descKey: 'f6_desc' },
  { icon: '📊', titleKey: 'f7_title', descKey: 'f7_desc' },
  { icon: '⚡', titleKey: 'f8_title', descKey: 'f8_desc' },
];

// ── 11-language i18n ────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL',
    subtitle: '水晶之舰 — 12轮匠心打磨，75+交互增强',
    stepHighlights: '新功能亮点',
    stepWalkthrough: '功能走查',
    stepReady: '准备就绪',
    next: '下一步',
    back: '上一步',
    upgradeNow: '🚀 升级到 v2.3.0',
    skipVersion: '跳过此版本',
    remindLater: '稍后提醒',
    upgrading: '升级中...',
    restartHint: '升级完成后将自动重启，预计30秒',
    readyTitle: '✨ 一切就绪！',
    readyDesc: 'v2.3.0 CRYSTAL 已准备就绪。12轮迭代，75+交互增强，345组件全量审计。',
    readyCTA: '点击下方按钮开始升级',
    p1: '右键菜单全面覆盖：K线图/自选表/深度面板 3处统一',
    p2: '多显示器面板分离：K线/深度/指标/策略 独立窗口',
    p3: '图表工具栏自定义：6项开关持久化记忆',
    p4: '骨架屏+截图水印：加载态优雅，截图自动品牌水印',
    p5: '17家券商并发接入：富途/IBKR/币安/OKX 全支持',
    p6: '11语言完整覆盖：zh/en/ja/ko/fr/it/de/es/ru/zh-HK/zh-TW',
    p7: '38个交互维度审计：Loading/Error/Empty/A11y全量检测',
    p8: '性能全面提升：组件加载<100ms, 图表渲染<50ms',
    f1_title: '右键菜单',
    f1_desc: 'K线/自选/深度3处统一右键菜单',
    f2_title: '多屏分离',
    f2_desc: '面板独立窗口，多显示器布局',
    f3_title: '工具栏记忆',
    f3_desc: '6项工具栏开关，持久化偏好',
    f4_title: '骨架屏',
    f4_desc: '加载态脉冲动画，视觉优雅',
    f5_title: '安全加固',
    f5_desc: '6层安全审计，计费精度4dp',
    f6_title: '11语言',
    f6_desc: '完整国际化覆盖，0硬编码',
    f7_title: '交互终审',
    f7_desc: '345组件10维交互一致性审计',
    f8_title: '性能优化',
    f8_desc: 'TSC 0错误，构建<400MB',
  },
  en: {
    welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL',
    subtitle: 'The Crystal Ship — 12 rounds of craftsmanship, 75+ interaction enhancements',
    stepHighlights: "What's New",
    stepWalkthrough: 'Walkthrough',
    stepReady: 'Ready',
    next: 'Next',
    back: 'Back',
    upgradeNow: '🚀 Upgrade to v2.3.0',
    skipVersion: 'Skip this version',
    remindLater: 'Remind later',
    upgrading: 'Upgrading...',
    restartHint: 'Will restart automatically after upgrade (~30s)',
    readyTitle: '✨ All Ready!',
    readyDesc: 'v2.3.0 CRYSTAL is ready. 12 rounds, 75+ interaction enhancements, 345-component audit.',
    readyCTA: 'Click below to start the upgrade',
    p1: 'Right-click menu everywhere: Chart/Watchlist/Depth panels',
    p2: 'Multi-monitor panel detach: KLine/Depth/Indicator/Strategy',
    p3: 'Chart toolbar customization: 6 toggle switches with memory',
    p4: 'Skeleton screens + watermark: elegant loading, brand overlay',
    p5: '17 broker concurrent access: Futu/IBKR/Binance/OKX',
    p6: '11 language complete coverage: zh/en/ja/ko/fr/it/de/es/ru/zh-HK/zh-TW',
    p7: '38-dimension interaction audit: Loading/Error/Empty/A11y',
    p8: 'Performance boost: component load <100ms, chart render <50ms',
    f1_title: 'Context Menu',
    f1_desc: 'Unified right-click on Chart/Watch/Depth',
    f2_title: 'Multi-Screen',
    f2_desc: 'Detach panels to separate windows',
    f3_title: 'Toolbar Memory',
    f3_desc: '6 toggle switches, persistent preferences',
    f4_title: 'Skeleton UI',
    f4_desc: 'Pulse animation loading states',
    f5_title: 'Security Hardened',
    f5_desc: '6-layer audit, 4dp billing precision',
    f6_title: '11 Languages',
    f6_desc: 'Full i18n coverage, zero hardcoded text',
    f7_title: 'Interaction Audit',
    f7_desc: '345 components, 10-dimension review',
    f8_title: 'Performance',
    f8_desc: 'TSC 0 errors, build <400MB',
  },
  ja: { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: 'クリスタルシップ — 12ラウンド、75以上の機能強化', stepHighlights: '新機能', stepWalkthrough: 'ウォークスルー', stepReady: '準備完了', next: '次へ', back: '戻る', upgradeNow: '🚀 v2.3.0にアップグレード', skipVersion: 'スキップ', remindLater: '後で', upgrading: 'アップグレード中...', restartHint: 'アップグレード後自動再起動（約30秒）', readyTitle: '✨ 準備完了！', readyDesc: 'v2.3.0 CRYSTALの準備ができました。', readyCTA: '下のボタンをクリックして開始', p1: '右クリックメニュー：チャート/銘柄/深度', p2: 'マルチモニター分離', p3: 'ツールバーカスタマイズ', p4: 'スケルトン+透かし', p5: '17証券同時接続', p6: '11言語完全対応', p7: '345コンポーネント監査', p8: 'パフォーマンス最適化', f1_title: '右クリック', f1_desc: '統一右クリックメニュー', f2_title: 'マルチ画面', f2_desc: 'パネル分離', f3_title: 'ツールバー', f3_desc: '6項目カスタマイズ', f4_title: 'スケルトン', f4_desc: 'ローディングアニメ', f5_title: 'セキュリティ', f5_desc: '6層監査', f6_title: '11言語', f6_desc: '完全i18n', f7_title: '監査', f7_desc: '345コンポーネント', f8_title: '性能', f8_desc: 'TSC 0エラー' },
  ko: { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: '크리스탈 쉽 — 12라운드, 75+ 기능 강화', stepHighlights: '새 기능', stepWalkthrough: '워크스루', stepReady: '준비 완료', next: '다음', back: '뒤로', upgradeNow: '🚀 v2.3.0으로 업그레이드', skipVersion: '건너뛰기', remindLater: '나중에', upgrading: '업그레이드 중...', restartHint: '업그레이드 후 자동 재시작 (~30초)', readyTitle: '✨ 준비 완료!', readyDesc: 'v2.3.0 CRYSTAL이 준비되었습니다.', readyCTA: '아래 버튼을 클릭하여 시작', p1: '우클릭 메뉴: 차트/관심/깊이', p2: '멀티모니터 분리', p3: '툴바 사용자 정의', p4: '스켈레톤+워터마크', p5: '17개 증권사 동시 연결', p6: '11개 언어', p7: '345개 컴포넌트 감사', p8: '성능 최적화', f1_title: '우클릭', f1_desc: '통합 우클릭 메뉴', f2_title: '멀티화면', f2_desc: '패널 분리', f3_title: '툴바', f3_desc: '6항목 사용자 정의', f4_title: '스켈레톤', f4_desc: '로딩 애니메이션', f5_title: '보안', f5_desc: '6계층 감사', f6_title: '11언어', f6_desc: '완전 i18n', f7_title: '감사', f7_desc: '345컴포넌트', f8_title: '성능', f8_desc: 'TSC 0 오류' },
  fr: { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: 'Le Vaisseau Crystal — 12 rounds, 75+ améliorations', stepHighlights: 'Nouveautés', stepWalkthrough: 'Visite guidée', stepReady: 'Prêt', next: 'Suivant', back: 'Retour', upgradeNow: '🚀 Mettre à niveau vers v2.3.0', skipVersion: 'Passer', remindLater: 'Plus tard', upgrading: 'Mise à niveau...', restartHint: 'Redémarrage automatique (~30s)', readyTitle: '✨ Tout est prêt!', readyDesc: 'v2.3.0 CRYSTAL est prêt.', readyCTA: 'Cliquez ci-dessous pour commencer', p1: 'Menu contextuel unifié', p2: 'Panneaux détachables multi-écrans', p3: 'Barre d\'outils personnalisable', p4: 'Squelettes + filigrane', p5: '17 courtiers simultanés', p6: '11 langues', p7: 'Audit 345 composants', p8: 'Performance optimisée', f1_title: 'Menu contextuel', f1_desc: 'Clic droit unifié', f2_title: 'Multi-écran', f2_desc: 'Panneaux détachables', f3_title: 'Barre d\'outils', f3_desc: '6 interrupteurs', f4_title: 'Squelettes', f4_desc: 'Animation de chargement', f5_title: 'Sécurité', f5_desc: 'Audit 6 couches', f6_title: '11 langues', f6_desc: 'i18n complète', f7_title: 'Audit', f7_desc: '345 composants', f8_title: 'Performance', f8_desc: 'TSC 0 erreurs' },
  it: { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: 'La Nave di Cristallo — 12 round, 75+ miglioramenti', stepHighlights: 'Novità', stepWalkthrough: 'Tour guidato', stepReady: 'Pronto', next: 'Avanti', back: 'Indietro', upgradeNow: '🚀 Aggiorna a v2.3.0', skipVersion: 'Salta', remindLater: 'Dopo', upgrading: 'Aggiornamento...', restartHint: 'Riavvio automatico (~30s)', readyTitle: '✨ Tutto pronto!', readyDesc: 'v2.3.0 CRYSTAL è pronto.', readyCTA: 'Clicca sotto per iniziare', p1: 'Menu contestuale unificato', p2: 'Pannelli staccabili multi-schermo', p3: 'Barra strumenti personalizzabile', p4: 'Scheletri + filigrana', p5: '17 broker simultanei', p6: '11 lingue', p7: 'Audit 345 componenti', p8: 'Performance ottimizzata', f1_title: 'Menu contestuale', f1_desc: 'Clic destro unificato', f2_title: 'Multi-schermo', f2_desc: 'Pannelli staccabili', f3_title: 'Barra strumenti', f3_desc: '6 interruttori', f4_title: 'Scheletri', f4_desc: 'Animazione caricamento', f5_title: 'Sicurezza', f5_desc: 'Audit 6 livelli', f6_title: '11 lingue', f6_desc: 'i18n completa', f7_title: 'Audit', f7_desc: '345 componenti', f8_title: 'Performance', f8_desc: 'TSC 0 errori' },
  de: { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: 'Das Kristallschiff — 12 Runden, 75+ Verbesserungen', stepHighlights: 'Neuigkeiten', stepWalkthrough: 'Rundgang', stepReady: 'Bereit', next: 'Weiter', back: 'Zurück', upgradeNow: '🚀 Auf v2.3.0 aktualisieren', skipVersion: 'Überspringen', remindLater: 'Später', upgrading: 'Aktualisierung...', restartHint: 'Automatischer Neustart (~30s)', readyTitle: '✨ Alles bereit!', readyDesc: 'v2.3.0 CRYSTAL ist bereit.', readyCTA: 'Klicken Sie unten zum Starten', p1: 'Kontextmenü vereinheitlicht', p2: 'Panels Multi-Monitor ablösbar', p3: 'Werkzeugleiste anpassbar', p4: 'Skelette + Wasserzeichen', p5: '17 Broker gleichzeitig', p6: '11 Sprachen', p7: '345 Komponenten Audit', p8: 'Performance optimiert', f1_title: 'Kontextmenü', f1_desc: 'Einheitliches Rechtsklick', f2_title: 'Multi-Screen', f2_desc: 'Panels ablösbar', f3_title: 'Werkzeugleiste', f3_desc: '6 Schalter', f4_title: 'Skelette', f4_desc: 'Ladeanimation', f5_title: 'Sicherheit', f5_desc: '6-Ebenen Audit', f6_title: '11 Sprachen', f6_desc: 'Vollständige i18n', f7_title: 'Audit', f7_desc: '345 Komponenten', f8_title: 'Performance', f8_desc: 'TSC 0 Fehler' },
  es: { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: 'La Nave de Cristal — 12 rondas, 75+ mejoras', stepHighlights: 'Novedades', stepWalkthrough: 'Recorrido', stepReady: 'Listo', next: 'Siguiente', back: 'Atrás', upgradeNow: '🚀 Actualizar a v2.3.0', skipVersion: 'Saltar', remindLater: 'Después', upgrading: 'Actualizando...', restartHint: 'Reinicio automático (~30s)', readyTitle: '✨ ¡Todo listo!', readyDesc: 'v2.3.0 CRYSTAL está listo.', readyCTA: 'Haz clic abajo para comenzar', p1: 'Menú contextual unificado', p2: 'Paneles separables multi-pantalla', p3: 'Barra de herramientas personalizable', p4: 'Esqueletos + marca de agua', p5: '17 brokers simultáneos', p6: '11 idiomas', p7: 'Auditoría 345 componentes', p8: 'Rendimiento optimizado', f1_title: 'Menú contextual', f1_desc: 'Clic derecho unificado', f2_title: 'Multi-pantalla', f2_desc: 'Paneles separables', f3_title: 'Herramientas', f3_desc: '6 interruptores', f4_title: 'Esqueletos', f4_desc: 'Animación de carga', f5_title: 'Seguridad', f5_desc: 'Auditoría 6 capas', f6_title: '11 idiomas', f6_desc: 'i18n completa', f7_title: 'Auditoría', f7_desc: '345 componentes', f8_title: 'Rendimiento', f8_desc: 'TSC 0 errores' },
  ru: { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: 'Кристальный корабль — 12 раундов, 75+ улучшений', stepHighlights: 'Новое', stepWalkthrough: 'Обзор', stepReady: 'Готово', next: 'Далее', back: 'Назад', upgradeNow: '🚀 Обновить до v2.3.0', skipVersion: 'Пропустить', remindLater: 'Позже', upgrading: 'Обновление...', restartHint: 'Автоперезапуск (~30с)', readyTitle: '✨ Всё готово!', readyDesc: 'v2.3.0 CRYSTAL готов.', readyCTA: 'Нажмите ниже чтобы начать', p1: 'Контекстное меню', p2: 'Открепляемые панели', p3: 'Настройка панели инструментов', p4: 'Скелетоны + водяной знак', p5: '17 брокеров одновременно', p6: '11 языков', p7: 'Аудит 345 компонентов', p8: 'Оптимизация производительности', f1_title: 'Контекстное меню', f1_desc: 'Единое меню ПКМ', f2_title: 'Мультиэкран', f2_desc: 'Открепление панелей', f3_title: 'Инструменты', f3_desc: '6 переключателей', f4_title: 'Скелетоны', f4_desc: 'Анимация загрузки', f5_title: 'Безопасность', f5_desc: 'Аудит 6 уровней', f6_title: '11 языков', f6_desc: 'Полная i18n', f7_title: 'Аудит', f7_desc: '345 компонентов', f8_title: 'Производительность', f8_desc: 'TSC 0 ошибок' },
  'zh-HK': { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: '水晶之艦 — 12輪匠心打磨，75+互動增強', stepHighlights: '新功能亮點', stepWalkthrough: '功能走查', stepReady: '準備就緒', next: '下一步', back: '上一步', upgradeNow: '🚀 升級到 v2.3.0', skipVersion: '跳過此版本', remindLater: '稍後提醒', upgrading: '升級中...', restartHint: '升級完成後將自動重啟，預計30秒', readyTitle: '✨ 一切就緒！', readyDesc: 'v2.3.0 CRYSTAL 已準備就緒。', readyCTA: '點擊下方按鈕開始升級', p1: '右鍵選單全面覆蓋', p2: '多顯示器面板分離', p3: '圖表工具欄自定義', p4: '骨架屏+截圖水印', p5: '17家券商並發接入', p6: '11語言完整覆蓋', p7: '345組件互動審計', p8: '性能全面提升', f1_title: '右鍵選單', f1_desc: '統一右鍵選單', f2_title: '多屏分離', f2_desc: '面板獨立視窗', f3_title: '工具欄記憶', f3_desc: '6項開關持久化', f4_title: '骨架屏', f4_desc: '載入態動畫', f5_title: '安全加固', f5_desc: '6層安全審計', f6_title: '11語言', f6_desc: '完整國際化', f7_title: '互動審計', f7_desc: '345組件檢測', f8_title: '性能', f8_desc: 'TSC 0錯誤' },
  'zh-TW': { welcome: '🎉 Dawn Whales v2.3.0 CRYSTAL', subtitle: '水晶之艦 — 12輪匠心打磨，75+互動增強', stepHighlights: '新功能亮點', stepWalkthrough: '功能走查', stepReady: '準備就緒', next: '下一步', back: '上一步', upgradeNow: '🚀 升級到 v2.3.0', skipVersion: '跳過此版本', remindLater: '稍後提醒', upgrading: '升級中...', restartHint: '升級完成後將自動重啟，預計30秒', readyTitle: '✨ 一切就緒！', readyDesc: 'v2.3.0 CRYSTAL 已準備就緒。', readyCTA: '點擊下方按鈕開始升級', p1: '右鍵選單全面覆蓋', p2: '多顯示器面板分離', p3: '圖表工具欄自定義', p4: '骨架屏+截圖水印', p5: '17家券商並發接入', p6: '11語言完整覆蓋', p7: '345組件互動審計', p8: '性能全面提升', f1_title: '右鍵選單', f1_desc: '統一右鍵選單', f2_title: '多屏分離', f2_desc: '面板獨立視窗', f3_title: '工具欄記憶', f3_desc: '6項開關持久化', f4_title: '骨架屏', f4_desc: '載入態動畫', f5_title: '安全加固', f5_desc: '6層安全審計', f6_title: '11語言', f6_desc: '完整國際化', f7_title: '互動審計', f7_desc: '345組件檢測', f8_title: '性能', f8_desc: 'TSC 0錯誤' },
};

// ── Styles ──────────────────────────────────────────────────────────
const STYLES = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 10001,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  modal: {
    background: 'linear-gradient(135deg, #0f1923 0%, #1a2332 100%)',
    border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 16, width: 560, maxWidth: '92vw', maxHeight: '90vh',
    overflow: 'hidden', boxShadow: '0 0 60px rgba(59,130,246,0.15), 0 25px 50px rgba(0,0,0,0.5)',
  },
  header: {
    padding: '28px 32px 16px', textAlign: 'center' as const,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  steps: {
    display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 32px 0',
  },
  stepDot: (active: boolean, done: boolean) => ({
    width: 32, height: 4, borderRadius: 2,
    background: active ? '#3b82f6' : done ? '#22c55e' : 'rgba(255,255,255,0.15)',
    transition: 'all 0.3s ease',
  }),
  body: { padding: '24px 32px', maxHeight: '50vh', overflowY: 'auto' as const },
  featureCard: {
    display: 'flex', alignItems: 'flex-start', gap: 16,
    padding: 14, marginBottom: 10,
    background: 'rgba(30,41,59,0.5)', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.05)',
    transition: 'all 0.2s ease',
  },
  footer: {
    padding: '16px 32px 24px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  primaryBtn: {
    padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: '#fff', fontWeight: 600, fontSize: 14,
    boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
  },
  secondaryBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
    cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  tertiaryBtn: {
    padding: '8px 16px', cursor: 'pointer', background: 'none',
    border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12,
  },
} as const;

// ── Component ───────────────────────────────────────────────────────
const UpgradeModal: React.FC<UpgradeModalProps> = ({
  visible, currentVersion = 'v2.2.0', newVersion = 'v2.3.0',
  onUpgrade, onDismiss, onSkip, locale: pl,
}) => {
  const [step, setStep] = useState<WizardStep>('highlights');
  const [upgrading, setUpgrading] = useState(false);

  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const handleUpgrade = useCallback(() => {
    setUpgrading(true);
    onUpgrade?.();
  }, [onUpgrade]);

  const stepIndex = step === 'highlights' ? 0 : step === 'walkthrough' ? 1 : 2;

  if (!visible) return null;

  return createPortal(
    <div style={STYLES.overlay} onClick={onDismiss}>
      <div style={STYLES.modal} onClick={e => e.stopPropagation()} role="dialog" aria-label={t.welcome} aria-modal="true">
        {/* Header */}
        <div style={STYLES.header}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>
            {t.welcome}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            {t.subtitle}
          </p>
          <div style={STYLES.steps}>
            <div style={STYLES.stepDot(stepIndex >= 0, stepIndex > 0)} title={t.stepHighlights} />
            <div style={STYLES.stepDot(stepIndex >= 1, stepIndex > 1)} title={t.stepWalkthrough} />
            <div style={STYLES.stepDot(stepIndex >= 2, stepIndex > 2)} title={t.stepReady} />
          </div>
        </div>

        {/* Body */}
        <div style={STYLES.body}>
          {step === 'highlights' && (
            <div>
              <h3 style={{ color: '#3b82f6', fontSize: 15, margin: '0 0 16px' }}>
                🎯 {t.stepHighlights}
              </h3>
              {FEATURES.map((f, i) => (
                <div key={i} style={STYLES.featureCard}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{f.icon}</span>
                  <div>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      {t[f.titleKey]}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5 }}>
                      {t[f.descKey]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'walkthrough' && (
            <div>
              <h3 style={{ color: '#22c55e', fontSize: 15, margin: '0 0 16px' }}>
                🔍 {t.stepWalkthrough}
              </h3>
              {[t.p1, t.p2, t.p3, t.p4, t.p5, t.p6, t.p7, t.p8].map((p, i) => (
                <div key={i} style={{
                  ...STYLES.featureCard,
                  borderLeft: '3px solid rgba(34,197,94,0.4)',
                }}>
                  <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 12, minWidth: 24 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6 }}>
                    {p}
                  </span>
                </div>
              ))}
            </div>
          )}

          {step === 'ready' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
              <h3 style={{ color: '#e2e8f0', fontSize: 20, margin: '0 0 8px' }}>
                {t.readyTitle}
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6, maxWidth: 400, margin: '0 auto 16px' }}>
                {t.readyDesc}
              </p>
              <div style={{
                background: 'rgba(59,130,246,0.1)', borderRadius: 10,
                border: '1px solid rgba(59,130,246,0.2)', padding: '12px 16px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  <span>Current</span>
                  <span>→</span>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>{newVersion}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{currentVersion}</span>
                  <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 11 }}>{newVersion}</span>
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                {t.readyCTA}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={STYLES.footer}>
          <div>
            {step !== 'highlights' && (
              <button style={STYLES.secondaryBtn} onClick={() => setStep(s => s === 'walkthrough' ? 'highlights' : 'walkthrough')}>
                ← {t.back}
              </button>
            )}
            {!upgrading && (
              <button style={STYLES.tertiaryBtn} onClick={onSkip} tabIndex={-1}>
                {t.skipVersion}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step !== 'ready' ? (
              <button
                style={STYLES.primaryBtn}
                onClick={() => setStep(s => s === 'highlights' ? 'walkthrough' : 'ready')}
              >
                {t.next} →
              </button>
            ) : (
              <button
                style={{
                  ...STYLES.primaryBtn,
                  background: upgrading ? 'linear-gradient(135deg, #22c55e, #16a34a)' : STYLES.primaryBtn.background,
                  opacity: upgrading ? 0.8 : 1,
                  cursor: upgrading ? 'wait' : 'pointer',
                }}
                onClick={handleUpgrade}
                disabled={upgrading}
              >
                {upgrading ? t.upgrading : t.upgradeNow}
              </button>
            )}
          </div>
        </div>

        {upgrading && (
          <div style={{
            padding: '12px 32px 20px', textAlign: 'center' as const,
            color: 'rgba(255,255,255,0.35)', fontSize: 12,
          }}>
            ⏳ {t.restartHint}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default UpgradeModal;
export type { UpgradeModalProps };