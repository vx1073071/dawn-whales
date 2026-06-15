// ── R213 ML P4-4: FeeScheduleModal — v17.9 费率说明弹窗 ──────────
// Full fee schedule reference modal (v17.9, permanent lock)
// 5 execution fee types + P2P transfer + withdrawal + creator split
// 9-language i18n + color-coded fee tiers + copy-friendly format

import React from 'react';

// ── Types ───────────────────────────────────────────────────────────
interface FeeScheduleModalProps {
  visible?: boolean;
  onClose?: () => void;
  locale?: string;
}

// ── Fee Data ────────────────────────────────────────────────────────
const FEE_SCHEDULE = [
  { category: 'execution', items: [
    { nameKey: 'stock', descKey: 'stockDesc', rate: '0.1%', min: '2 USDT' },
    { nameKey: 'futures', descKey: 'futuresDesc', rate: '0.1%', min: '2 USDT' },
    { nameKey: 'option', descKey: 'optionDesc', rate: '0.1%', min: '2 USDT' },
    { nameKey: 'crypto', descKey: 'cryptoDesc', rate: '0.1%', min: '2 USDT' },
    { nameKey: 'perp', descKey: 'perpDesc', rate: '0.02%', min: '0.5 USDT' },
  ]},
  { category: 'transfer', items: [
    { nameKey: 'send', descKey: 'sendDesc', rate: '0.3%', min: '-' },
    { nameKey: 'receive', descKey: 'receiveDesc', rate: '0.3%', min: '-' },
  ]},
  { category: 'withdraw', items: [
    { nameKey: 'withdrawFee', descKey: 'withdrawDesc', rate: '0.1%', min: '2 USDT' },
  ]},
  { category: 'deposit', items: [
    { nameKey: 'trc20', descKey: 'trc20Desc', rate: '0%', min: '-' },
    { nameKey: 'erc20', descKey: 'erc20Desc', rate: '0%', min: '-' },
  ]},
  { category: 'creator', items: [
    { nameKey: 'L1', descKey: 'l1Desc', rate: '30%', min: 'Platform' },
    { nameKey: 'L2', descKey: 'l2Desc', rate: '20%', min: 'Platform' },
    { nameKey: 'L3', descKey: 'l3Desc', rate: '10%', min: 'Platform' },
  ]},
  { category: 'aiService', items: [
    { nameKey: 'ai1', descKey: 'ai1d', rate: '1 U/次', min: '-' },
    { nameKey: 'ai2', descKey: 'ai2d', rate: '1.5 U/次', min: '-' },
    { nameKey: 'ai3', descKey: 'ai3d', rate: '2 U/次', min: '-' },
    { nameKey: 'ai4', descKey: 'ai4d', rate: '1 U/次', min: 'Insurance' },
    { nameKey: 'ai5', descKey: 'ai5d', rate: '1 U/次', min: 'Review' },
  ]},
];

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '💰 v17.9 费率表 (永久锁定)',
    subtitle: '免费软件 · 交易过路费 · USDT内部钱包',
    execution: '📊 交易执行费', transfer: '🔄 用户间转账',
    withdraw: '🏦 提现', deposit: '📥 充值',
    creator: '🎨 创作者抽成', aiService: '🤖 AI服务计费',
    stock: '股票/ETF', stockDesc: 'A股、港股、美股',
    futures: '期货(非加密)', futuresDesc: '商品期货、股指期货',
    option: '期权(非加密)', optionDesc: '个股期权、指数期权',
    crypto: '加密现货', cryptoDesc: 'BTC/ETH/SOL等现货',
    perp: '加密合约', perpDesc: '永续合约、交割合约',
    send: '发送方', sendDesc: '转账发起方',
    receive: '接收方', receiveDesc: '转账接收方',
    withdrawFee: '提现费', withdrawDesc: 'USDT提至外部钱包',
    trc20: 'TRC-20', trc20Desc: '充100到100积分',
    erc20: 'ERC-20', erc20Desc: '充100到100(平台补贴gas)',
    L1: 'L1 新手', l1Desc: '注册即可·销量<100',
    L2: 'L2 进阶', l2Desc: '销量≥100笔',
    L3: 'L3 旗舰', l3Desc: '销量≥1000笔',
    ai1: 'AI画线+形态识别', ai1d: '自动画线识别',
    ai2: 'AI策略优化建议', ai2d: '策略参数优化',
    ai3: 'AI生成策略组合', ai3d: '多策略组合推荐',
    ai4: '策略保险(1U)', ai4d: '7天保障+免费诊断',
    ai5: '创作者审核(1U)', ai5d: '8项检查·无限次重审',
    fee: '费率', minFee: '最低', category: '类别',
    footer: 'Dawn Whales v17.9 收费目录 · 永久生效 · 纯USDT无KYC',
    close: '关闭',
  },
  en: {
    title: '💰 v17.9 Fee Schedule (Permanent)',
    subtitle: 'Free Software · Transaction Toll · USDT Wallet',
    execution: '📊 Execution Fees', transfer: '🔄 P2P Transfer',
    withdraw: '🏦 Withdrawal', deposit: '📥 Deposit',
    creator: '🎨 Creator Split', aiService: '🤖 AI Services',
    stock: 'Stock/ETF', stockDesc: 'A-share, HK, US stocks',
    futures: 'Futures (Non-Crypto)', futuresDesc: 'Commodity & index futures',
    option: 'Options (Non-Crypto)', optionDesc: 'Equity & index options',
    crypto: 'Crypto Spot', cryptoDesc: 'BTC/ETH/SOL spot',
    perp: 'Crypto Perps', perpDesc: 'Perpetual & delivery contracts',
    send: 'Sender', sendDesc: 'Transfer initiator',
    receive: 'Receiver', receiveDesc: 'Transfer recipient',
    withdrawFee: 'Withdrawal Fee', withdrawDesc: 'USDT to external wallet',
    trc20: 'TRC-20', trc20Desc: 'Deposit 100 = 100 credits',
    erc20: 'ERC-20', erc20Desc: 'Deposit 100 = 100 (subsidized gas)',
    L1: 'L1 Beginner', l1Desc: 'Register = L1, sales <100',
    L2: 'L2 Advanced', l2Desc: 'Sales ≥100',
    L3: 'L3 Flagship', l3Desc: 'Sales ≥1000',
    ai1: 'AI Drawing+Pattern', ai1d: 'Auto draw + pattern recognition',
    ai2: 'AI Optimization', ai2d: 'Strategy parameter optimization',
    ai3: 'AI Strategy Combo', ai3d: 'Multi-strategy combination',
    ai4: 'Strategy Insurance', ai4d: '7-day protection + free diagnosis',
    ai5: 'Creator Review', ai5d: '8 checks · unlimited retries',
    fee: 'Rate', minFee: 'Min', category: 'Category',
    footer: 'Dawn Whales v17.9 Fee Schedule · Permanent · USDT only, no KYC',
    close: 'Close',
  },
  ja: { title: '💰 v17.9 料金表 (永久)', subtitle: '無料ソフト·取引通行料·USDTウォレット', execution: '📊 執行手数料', transfer: '🔄 P2P送金', withdraw: '🏦 出金', deposit: '📥 入金', creator: '🎨 クリエイター分配', aiService: '🤖 AIサービス', stock: '株式/ETF', stockDesc: 'A株·香港·米国株', futures: '先物(非暗号)', futuresDesc: '商品·指数先物', option: 'オプション(非暗号)', optionDesc: '株式·指数オプション', crypto: '暗号資産現物', cryptoDesc: 'BTC/ETH/SOL現物', perp: '暗号無期限', perpDesc: '無期限·決済契約', send: '送金元', sendDesc: '送金開始者', receive: '受取人', receiveDesc: '送金受取人', withdrawFee: '出金手数料', withdrawDesc: '外部ウォレットへUSDT', trc20: 'TRC-20', trc20Desc: '100入金=100ポイント', erc20: 'ERC-20', erc20Desc: '100入金=100(ガス補助)', L1: 'L1 初心者', l1Desc: '登録= L1, 販売<100', L2: 'L2 上級', l2Desc: '販売≥100', L3: 'L3 フラッグシップ', l3Desc: '販売≥1000', ai1: 'AI描画+パターン', ai1d: '自動描画·パターン認識', ai2: 'AI最適化', ai2d: '戦略パラメータ最適化', ai3: 'AI戦略コンボ', ai3d: '複数戦略組合せ', ai4: '戦略保険', ai4d: '7日保護+無料診断', ai5: 'クリエイター審査', ai5d: '8項目·無制限再審査', fee: '料率', minFee: '最低', category: 'カテゴリ', footer: 'Dawn Whales v17.9 料金表·永久·USDTのみ·KYC不要', close: '閉じる' },
  ko: { title: '💰 v17.9 수수료표 (영구)', subtitle: '무료 소프트웨어·거래 통행료·USDT 지갑', execution: '📊 실행 수수료', transfer: '🔄 P2P 송금', withdraw: '🏦 출금', deposit: '📥 입금', creator: '🎨 크리에이터 분배', aiService: '🤖 AI 서비스', stock: '주식/ETF', stockDesc: 'A주·홍콩·미국 주식', futures: '선물(비암호)', futuresDesc: '상품·지수 선물', option: '옵션(비암호)', optionDesc: '주식·지수 옵션', crypto: '암호화폐 현물', cryptoDesc: 'BTC/ETH/SOL 현물', perp: '암호화폐 무기한', perpDesc: '무기한·만기 계약', send: '발신자', sendDesc: '송금 개시자', receive: '수신자', receiveDesc: '송금 수신자', withdrawFee: '출금 수수료', withdrawDesc: '외부 지갑으로 USDT', trc20: 'TRC-20', trc20Desc: '100 입금=100 크레딧', erc20: 'ERC-20', erc20Desc: '100 입금=100(가스 보조)', L1: 'L1 초보', l1Desc: '등록=L1, 판매<100', L2: 'L2 고급', l2Desc: '판매≥100', L3: 'L3 플래그십', l3Desc: '판매≥1000', ai1: 'AI 그리기+패턴', ai1d: '자동 그리기·패턴 인식', ai2: 'AI 최적화', ai2d: '전략 파라미터 최적화', ai3: 'AI 전략 콤보', ai3d: '다중 전략 조합', ai4: '전략 보험', ai4d: '7일 보호+무료 진단', ai5: '크리에이터 심사', ai5d: '8항목·무제한 재심사', fee: '수수료율', minFee: '최소', category: '카테고리', footer: 'Dawn Whales v17.9 수수료표·영구·USDT만·KYC 불필요', close: '닫기' },
  fr: { title: '💰 v17.9 Grille Tarifaire (Permanente)', subtitle: 'Logiciel gratuit·Taxe de transaction·Portefeuille USDT', execution: '📊 Frais d\'exécution', transfer: '🔄 Transfert P2P', withdraw: '🏦 Retrait', deposit: '📥 Dépôt', creator: '🎨 Partage Créateur', aiService: '🤖 Services IA', stock: 'Actions/ETF', stockDesc: 'Actions A, HK, US', futures: 'Futures (Non-Crypto)', futuresDesc: 'Futures matières premières', option: 'Options (Non-Crypto)', optionDesc: 'Options actions & indices', crypto: 'Crypto Spot', cryptoDesc: 'BTC/ETH/SOL spot', perp: 'Crypto Perps', perpDesc: 'Contrats perpétuels', send: 'Expéditeur', sendDesc: 'Initiateur du transfert', receive: 'Destinataire', receiveDesc: 'Destinataire du transfert', withdrawFee: 'Frais de retrait', withdrawDesc: 'USDT vers portefeuille externe', trc20: 'TRC-20', trc20Desc: 'Dépôt 100 = 100 crédits', erc20: 'ERC-20', erc20Desc: 'Dépôt 100 = 100 (gas subventionné)', L1: 'L1 Débutant', l1Desc: 'Inscription=L1, ventes<100', L2: 'L2 Avancé', l2Desc: 'Ventes≥100', L3: 'L3 Flagship', l3Desc: 'Ventes≥1000', ai1: 'IA Dessin+Pattern', ai1d: 'Dessin auto + reconnaissance', ai2: 'IA Optimisation', ai2d: 'Optimisation des paramètres', ai3: 'IA Combo Stratégie', ai3d: 'Combinaison multi-stratégies', ai4: 'Assurance Stratégie', ai4d: 'Protection 7j + diagnostic gratuit', ai5: 'Révision Créateur', ai5d: '8 vérifications·retours illimités', fee: 'Taux', minFee: 'Min', category: 'Catégorie', footer: 'Dawn Whales v17.9·Permanent·USDT uniquement·Sans KYC', close: 'Fermer' },
  it: { title: '💰 v17.9 Tariffario (Permanente)', subtitle: 'Software gratuito·Pedaggio·Portafoglio USDT', execution: '📊 Commissioni', transfer: '🔄 Trasferimento P2P', withdraw: '🏦 Prelievo', deposit: '📥 Deposito', creator: '🎨 Quota Creatore', aiService: '🤖 Servizi IA', stock: 'Azioni/ETF', stockDesc: 'Azioni A, HK, US', futures: 'Futures (Non-Crypto)', futuresDesc: 'Futures su materie prime', option: 'Opzioni (Non-Crypto)', optionDesc: 'Opzioni su azioni e indici', crypto: 'Crypto Spot', cryptoDesc: 'BTC/ETH/SOL spot', perp: 'Crypto Perps', perpDesc: 'Contratti perpetui', send: 'Mittente', sendDesc: 'Iniziatore trasferimento', receive: 'Destinatario', receiveDesc: 'Destinatario trasferimento', withdrawFee: 'Commissione prelievo', withdrawDesc: 'USDT a portafoglio esterno', trc20: 'TRC-20', trc20Desc: 'Deposito 100 = 100 crediti', erc20: 'ERC-20', erc20Desc: 'Deposito 100 = 100 (gas sovvenzionato)', L1: 'L1 Principiante', l1Desc: 'Registrazione=L1, vendite<100', L2: 'L2 Avanzato', l2Desc: 'Vendite≥100', L3: 'L3 Flagship', l3Desc: 'Vendite≥1000', ai1: 'IA Disegno+Pattern', ai1d: 'Disegno auto + riconoscimento', ai2: 'IA Ottimizzazione', ai2d: 'Ottimizzazione parametri', ai3: 'IA Combo Strategia', ai3d: 'Combinazione multi-strategia', ai4: 'Assicurazione Strategia', ai4d: 'Protezione 7gg + diagnosi gratuita', ai5: 'Revisione Creatore', ai5d: '8 controlli·tentativi illimitati', fee: 'Tasso', minFee: 'Min', category: 'Categoria', footer: 'Dawn Whales v17.9·Permanente·Solo USDT·No KYC', close: 'Chiudi' },
  de: { title: '💰 v17.9 Gebührenordnung (Permanent)', subtitle: 'Kostenlose Software·Transaktionsmaut·USDT-Wallet', execution: '📊 Ausführungsgebühren', transfer: '🔄 P2P-Überweisung', withdraw: '🏦 Auszahlung', deposit: '📥 Einzahlung', creator: '🎨 Ersteller-Anteil', aiService: '🤖 KI-Dienste', stock: 'Aktien/ETF', stockDesc: 'A-Aktien, HK, US', futures: 'Futures (Nicht-Krypto)', futuresDesc: 'Rohstoff- und Index-Futures', option: 'Optionen (Nicht-Krypto)', optionDesc: 'Aktien- und Indexoptionen', crypto: 'Krypto Spot', cryptoDesc: 'BTC/ETH/SOL Spot', perp: 'Krypto Perps', perpDesc: 'Perpetual-Kontrakte', send: 'Absender', sendDesc: 'Überweisungsinitiator', receive: 'Empfänger', receiveDesc: 'Überweisungsempfänger', withdrawFee: 'Auszahlungsgebühr', withdrawDesc: 'USDT an externe Wallet', trc20: 'TRC-20', trc20Desc: 'Einzahlung 100 = 100 Credits', erc20: 'ERC-20', erc20Desc: 'Einzahlung 100 = 100 (Gas subventioniert)', L1: 'L1 Anfänger', l1Desc: 'Registrierung=L1, Verkäufe<100', L2: 'L2 Fortgeschritten', l2Desc: 'Verkäufe≥100', L3: 'L3 Flagship', l3Desc: 'Verkäufe≥1000', ai1: 'KI Zeichnen+Pattern', ai1d: 'Auto-Zeichnen + Erkennung', ai2: 'KI Optimierung', ai2d: 'Parameteroptimierung', ai3: 'KI Strategie-Kombi', ai3d: 'Multi-Strategie-Kombination', ai4: 'Strategie-Versicherung', ai4d: '7 Tage Schutz + gratis Diagnose', ai5: 'Ersteller-Prüfung', ai5d: '8 Prüfungen·unbegrenzt', fee: 'Satz', minFee: 'Min', category: 'Kategorie', footer: 'Dawn Whales v17.9·Permanent·Nur USDT·Kein KYC', close: 'Schließen' },
  es: { title: '💰 v17.9 Tarifario (Permanente)', subtitle: 'Software gratis·Peaje·Monedero USDT', execution: '📊 Comisiones', transfer: '🔄 Transferencia P2P', withdraw: '🏦 Retiro', deposit: '📥 Depósito', creator: '🎨 Cuota Creador', aiService: '🤖 Servicios IA', stock: 'Acciones/ETF', stockDesc: 'Acciones A, HK, US', futures: 'Futuros (No-Crypto)', futuresDesc: 'Futuros de materias primas', option: 'Opciones (No-Crypto)', optionDesc: 'Opciones sobre acciones', crypto: 'Crypto Spot', cryptoDesc: 'BTC/ETH/SOL spot', perp: 'Crypto Perps', perpDesc: 'Contratos perpetuos', send: 'Remitente', sendDesc: 'Iniciador transferencia', receive: 'Destinatario', receiveDesc: 'Destinatario transferencia', withdrawFee: 'Comisión retiro', withdrawDesc: 'USDT a monedero externo', trc20: 'TRC-20', trc20Desc: 'Depósito 100 = 100 créditos', erc20: 'ERC-20', erc20Desc: 'Depósito 100 = 100 (gas subsidiado)', L1: 'L1 Principiante', l1Desc: 'Registro=L1, ventas<100', L2: 'L2 Avanzado', l2Desc: 'Ventas≥100', L3: 'L3 Flagship', l3Desc: 'Ventas≥1000', ai1: 'IA Dibujo+Patrón', ai1d: 'Dibujo auto + reconocimiento', ai2: 'IA Optimización', ai2d: 'Optimización de parámetros', ai3: 'IA Combo Estrategia', ai3d: 'Combinación multi-estrategia', ai4: 'Seguro Estrategia', ai4d: 'Protección 7d + diagnóstico gratis', ai5: 'Revisión Creador', ai5d: '8 verificaciones·reintentos ilimitados', fee: 'Tasa', minFee: 'Mín', category: 'Categoría', footer: 'Dawn Whales v17.9·Permanente·Solo USDT·Sin KYC', close: 'Cerrar' },
};

// ── Category Colors ─────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  execution: '#3b82f6', transfer: '#f59e0b', withdraw: '#ef4444',
  deposit: '#22c55e', creator: '#8b5cf6', aiService: '#ec4899',
};

// ── Component ───────────────────────────────────────────────────────
const FeeScheduleModal: React.FC<FeeScheduleModalProps> = ({
  visible = false, onClose, locale: pl,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '32px 36px',
        maxWidth: 620, width: '95%', maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
            {t.title}
          </h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{t.subtitle}</p>
        </div>

        {/* ── Table ───────────────────────────────────────────────── */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: 24 }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
            background: '#f1f5f9', padding: '10px 16px',
            fontSize: 12, fontWeight: 600, color: '#64748b',
          }}>
            <div>{t.category}</div>
            <div>{t.fee}</div>
            <div>{t.minFee}</div>
          </div>

          {/* Rows */}
          {FEE_SCHEDULE.map((section, si) => (
            <React.Fragment key={si}>
              {/* Section Header */}
              <div style={{
                background: `${CAT_COLORS[section.category]}08`,
                padding: '8px 16px', fontSize: 13, fontWeight: 700,
                color: CAT_COLORS[section.category],
                borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
              }}>
                {(t as any)[section.category]}
              </div>

              {/* Section Items */}
              {section.items.map((item, ii) => (
                <div key={ii} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                  padding: '10px 16px', fontSize: 13,
                  borderBottom: ii < section.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: ii % 2 === 0 ? '#fff' : '#fafbfc',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      {(t as any)[item.nameKey]}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {(t as any)[item.descKey]}
                    </div>
                  </div>
                  <div style={{
                    color: item.rate === '0%' ? '#22c55e' : '#1e293b',
                    fontWeight: 700, display: 'flex', alignItems: 'center',
                  }}>
                    {item.rate}
                  </div>
                  <div style={{
                    color: '#64748b', display: 'flex', alignItems: 'center',
                  }}>
                    {item.min}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div style={{
          textAlign: 'center', color: '#94a3b8', fontSize: 12,
          marginBottom: 20,
        }}>
          🦐 {t.footer}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={onClose} style={{
            background: '#3b82f6', color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 40px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
          }}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeeScheduleModal;
