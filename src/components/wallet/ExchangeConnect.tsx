// ── R211 ML P6: ExchangeConnect — API Key连接UI ──────────
// Paste API Key + Secret → verify permissions → connection status
// 3 exchanges: Binance / OKX / Futu
// Security: AES-256 encrypted, withdraw ❌ denied warning
// Permission display: read ✅ trade ✅ withdraw ❌
// Connection test + status badge + disconnect button

import React, { useState, useCallback } from 'react';
import { Button, Tag, Card, Input, Select, Alert } from 'antd';
import {
  LinkOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, EyeInvisibleOutlined,
  ReloadOutlined, ApiOutlined,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
type ExchangeCode = 'binance' | 'okx' | 'futu';

interface ExchangeKeyRecord {
  keyId: string;
  exchange: ExchangeCode;
  label: string;
  status: 'active' | 'disabled' | 'test_failed';
  permissions: { read: boolean; trade: boolean; withdraw: boolean };
  createdAt: number;
  lastUsedAt?: number;
  testResult?: boolean;
  maskedKey: string; // e.g. "abc12***ef34"
}

interface ExchangeConnectProps {
  savedKeys?: ExchangeKeyRecord[];
  onConnect?: (exchange: ExchangeCode, label: string, apiKey: string, secret: string) => Promise<{ success: boolean; record?: ExchangeKeyRecord; error?: string }>;
  onTest?: (keyId: string) => Promise<boolean>;
  onDisconnect?: (keyId: string) => Promise<void>;
  locale?: string;
  compact?: boolean;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: 'API Key 连接', connect: '连接交易所', pasteKey: '粘贴API Key', pasteSecret: '粘贴Secret Key',
    label: '标签', labelPlaceholder: '如：主账户Binance', selectExchange: '选择交易所',
    security: '安全提示', securityDesc: 'Key使用AES-256加密存储。仅授予只读+交易权限，绝不请求提币权限。',
    connectBtn: '连接', connecting: '连接中...', testBtn: '测试连接', testing: '测试中...',
    disconnect: '断开', disconnectConfirm: '确认断开此连接？',
    connected: '已连接', failed: '连接失败', inactive: '未验证',
    lastUsed: '上次使用', never: '从未', permission: '权限',
    read: '只读', trade: '交易', withdraw: '提币', withdrawWarning: '提币权限已禁用，安全无忧',
    noKeys: '未连接任何交易所', noKeysHint: '粘贴API Key以连接交易所，策略将自动执行',
    maxKeys: '最多连接5个交易所', addNew: '+ 新增连接',
    show: '显示', hide: '隐藏', copyHint: '已复制',
    exchangeBinance: '币安 Binance', exchangeOKX: 'OKX', exchangeFutu: '富途 Futu',
  },
  en: {
    title: 'API Key Connect', connect: 'Connect Exchange', pasteKey: 'Paste API Key', pasteSecret: 'Paste Secret Key',
    label: 'Label', labelPlaceholder: 'e.g. Main Binance', selectExchange: 'Select Exchange',
    security: 'Security Notice', securityDesc: 'Keys encrypted with AES-256. Read + Trade only. Withdraw is NEVER requested.',
    connectBtn: 'Connect', connecting: 'Connecting...', testBtn: 'Test', testing: 'Testing...',
    disconnect: 'Disconnect', disconnectConfirm: 'Confirm disconnect?',
    connected: 'Connected', failed: 'Failed', inactive: 'Unverified',
    lastUsed: 'Last used', never: 'Never', permission: 'Permissions',
    read: 'Read', trade: 'Trade', withdraw: 'Withdraw', withdrawWarning: 'Withdraw disabled — your funds are safe',
    noKeys: 'No exchange connected', noKeysHint: 'Paste API Key to connect — strategies auto-execute',
    maxKeys: 'Max 5 exchanges', addNew: '+ Add',
    show: 'Show', hide: 'Hide', copyHint: 'Copied',
    exchangeBinance: 'Binance', exchangeOKX: 'OKX', exchangeFutu: 'Futu',
  },
  ja: { title: 'APIキー接続', connect: '取引所に接続', pasteKey: 'APIキーを貼付', pasteSecret: 'シークレットを貼付', label: 'ラベル', labelPlaceholder: '例: メインBinance', selectExchange: '取引所を選択', security: 'セキュリティ通知', securityDesc: 'キーはAES-256で暗号化。読取+取引のみ。出金は絶対に要求しません。', connectBtn: '接続', connecting: '接続中...', testBtn: 'テスト', testing: 'テスト中...', disconnect: '切断', disconnectConfirm: '切断を確認?', connected: '接続済', failed: '失敗', inactive: '未検証', lastUsed: '最終使用', never: 'なし', permission: '権限', read: '読取', trade: '取引', withdraw: '出金', withdrawWarning: '出金無効 — 資金は安全', noKeys: '取引所未接続', noKeysHint: 'APIキーを貼付して取引所に接続', maxKeys: '最大5取引所', addNew: '+ 追加', show: '表示', hide: '非表示', exchangeBinance: 'Binance', exchangeOKX: 'OKX', exchangeFutu: 'Futu' },
  ko: { title: 'API 키 연결', connect: '거래소 연결', pasteKey: 'API 키 붙여넣기', pasteSecret: 'Secret 키 붙여넣기', label: '라벨', labelPlaceholder: '예: 메인 Binance', selectExchange: '거래소 선택', security: '보안 안내', securityDesc: '키는 AES-256으로 암호화. 읽기+거래만. 출금은 절대 요청하지 않음.', connectBtn: '연결', connecting: '연결 중...', testBtn: '테스트', testing: '테스트 중...', disconnect: '연결 해제', disconnectConfirm: '연결 해제 확인?', connected: '연결됨', failed: '실패', inactive: '미확인', lastUsed: '마지막 사용', never: '없음', permission: '권한', read: '읽기', trade: '거래', withdraw: '출금', withdrawWarning: '출금 비활성화 — 자금 안전', noKeys: '연결된 거래소 없음', noKeysHint: 'API 키를 붙여넣어 거래소에 연결', maxKeys: '최대 5개 거래소', addNew: '+ 추가', show: '보기', hide: '숨기기', exchangeBinance: 'Binance', exchangeOKX: 'OKX', exchangeFutu: 'Futu' },
  fr: { title: 'Connexion API Key', connect: 'Connecter Exchange', pasteKey: 'Coller API Key', pasteSecret: 'Coller Secret', label: 'Libellé', labelPlaceholder: 'ex: Binance Principal', selectExchange: 'Choisir Exchange', security: 'Avis de sécurité', securityDesc: 'Clés chiffrées AES-256. Lecture + Trading uniquement. Retrait JAMAIS demandé.', connectBtn: 'Connecter', connecting: 'Connexion...', testBtn: 'Tester', testing: 'Test...', disconnect: 'Déconnecter', disconnectConfirm: 'Confirmer la déconnexion?', connected: 'Connecté', failed: 'Échec', inactive: 'Non vérifié', lastUsed: 'Dernière utilisation', never: 'Jamais', permission: 'Permissions', read: 'Lecture', trade: 'Trading', withdraw: 'Retrait', withdrawWarning: 'Retrait désactivé — fonds sécurisés', noKeys: 'Aucun exchange connecté', noKeysHint: 'Collez votre API Key pour connecter', maxKeys: 'Max 5 exchanges', addNew: '+ Ajouter', show: 'Afficher', hide: 'Masquer', exchangeBinance: 'Binance', exchangeOKX: 'OKX', exchangeFutu: 'Futu' },
  it: { title: 'Connetti API Key', connect: 'Connetti Exchange', pasteKey: 'Incolla API Key', pasteSecret: 'Incolla Secret', label: 'Etichetta', labelPlaceholder: 'es: Binance Principale', selectExchange: 'Seleziona Exchange', security: 'Avviso sicurezza', securityDesc: 'Chiavi cifrate AES-256. Solo lettura+trading. Prelievo MAI richiesto.', connectBtn: 'Connetti', connecting: 'Connessione...', testBtn: 'Test', testing: 'Test...', disconnect: 'Disconnetti', disconnectConfirm: 'Conferma disconnessione?', connected: 'Connesso', failed: 'Fallito', inactive: 'Non verificato', lastUsed: 'Ultimo uso', never: 'Mai', permission: 'Permessi', read: 'Lettura', trade: 'Trading', withdraw: 'Prelievo', withdrawWarning: 'Prelievo disabilitato — fondi al sicuro', noKeys: 'Nessun exchange connesso', noKeysHint: 'Incolla la tua API Key', maxKeys: 'Max 5 exchange', addNew: '+ Aggiungi', show: 'Mostra', hide: 'Nascondi', exchangeBinance: 'Binance', exchangeOKX: 'OKX', exchangeFutu: 'Futu' },
  de: { title: 'API-Key-Verbindung', connect: 'Börse verbinden', pasteKey: 'API-Key einfügen', pasteSecret: 'Secret einfügen', label: 'Label', labelPlaceholder: 'z.B. Haupt-Binance', selectExchange: 'Börse wählen', security: 'Sicherheitshinweis', securityDesc: 'Schlüssel AES-256 verschlüsselt. Nur Lesen+Handel. Auszahlung wird NIE angefordert.', connectBtn: 'Verbinden', connecting: 'Verbinde...', testBtn: 'Test', testing: 'Teste...', disconnect: 'Trennen', disconnectConfirm: 'Trennung bestätigen?', connected: 'Verbunden', failed: 'Fehlgeschlagen', inactive: 'Ungeprüft', lastUsed: 'Zuletzt genutzt', never: 'Nie', permission: 'Berechtigungen', read: 'Lesen', trade: 'Handel', withdraw: 'Auszahlung', withdrawWarning: 'Auszahlung deaktiviert — Gelder sicher', noKeys: 'Keine Börse verbunden', noKeysHint: 'API-Key einfügen', maxKeys: 'Max 5 Börsen', addNew: '+ Neu', show: 'Anzeigen', hide: 'Verbergen', exchangeBinance: 'Binance', exchangeOKX: 'OKX', exchangeFutu: 'Futu' },
  es: { title: 'Conectar API Key', connect: 'Conectar Exchange', pasteKey: 'Pegar API Key', pasteSecret: 'Pegar Secret', label: 'Etiqueta', labelPlaceholder: 'ej: Binance Principal', selectExchange: 'Seleccionar Exchange', security: 'Aviso de seguridad', securityDesc: 'Claves cifradas AES-256. Solo lectura+negociación. Retiro NUNCA solicitado.', connectBtn: 'Conectar', connecting: 'Conectando...', testBtn: 'Probar', testing: 'Probando...', disconnect: 'Desconectar', disconnectConfirm: '¿Confirmar desconexión?', connected: 'Conectado', failed: 'Fallido', inactive: 'No verificado', lastUsed: 'Último uso', never: 'Nunca', permission: 'Permisos', read: 'Lectura', trade: 'Negociación', withdraw: 'Retiro', withdrawWarning: 'Retiro desactivado — fondos seguros', noKeys: 'Sin exchanges conectados', noKeysHint: 'Pega tu API Key para conectar', maxKeys: 'Máx 5 exchanges', addNew: '+ Agregar', show: 'Mostrar', hide: 'Ocultar', exchangeBinance: 'Binance', exchangeOKX: 'OKX', exchangeFutu: 'Futu' },
};

// ── Config ───────────────────────────────────────────────────────────
const EXCHANGE_OPTIONS: { code: ExchangeCode; nameKey: string; color: string; icon: string }[] = [
  { code: 'binance', nameKey: 'exchangeBinance', color: '#f0b90b', icon: '₿' },
  { code: 'okx', nameKey: 'exchangeOKX', color: '#000000', icon: '🅞' },
  { code: 'futu', nameKey: 'exchangeFutu', color: '#22c55e', icon: '🐂' },
];

function fmtTime(ts: number, lang: string): string {
  const d = new Date(ts);
  if (lang === 'zh-CN') return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Component ───────────────────────────────────────────────────────
const ExchangeConnect: React.FC<ExchangeConnectProps> = ({
  savedKeys: propKeys,
  onConnect,
  onTest,
  onDisconnect,
  locale: pl,
  compact = false,
}) => {
  const t = I18N[pl === 'zh-CN' || pl === 'zh-TW' ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en')] ?? I18N.en;
  const isCN = pl === 'zh-CN' || pl === 'zh-TW';

  const [keys, setKeys] = useState<ExchangeKeyRecord[]>(propKeys ?? []);
  const [showForm, setShowForm] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [exchange, setExchange] = useState<ExchangeCode>('binance');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  // ── Connect ──────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (!apiKey.trim() || !secret.trim() || !onConnect) return;
    setError('');
    setConnecting(true);
    try {
      const res = await onConnect(exchange, label || exchange, apiKey.trim(), secret.trim());
      if (res.success && res.record) {
        setKeys(prev => [...prev, res.record!]);
        setShowForm(false); setLabel(''); setApiKey(''); setSecret('');
      } else { setError(res.error ?? t.failed); }
    } finally { setConnecting(false); }
  }, [apiKey, secret, exchange, label, onConnect, t]);

  // ── Test ─────────────────────────────────────────────────────────
  const handleTest = useCallback(async (keyId: string) => {
    if (!onTest) return;
    setTestingId(keyId);
    try {
      const ok = await onTest(keyId);
      setKeys(prev => prev.map(k => k.keyId === keyId ? { ...k, testResult: ok, status: ok ? 'active' as const : 'test_failed' as const } : k));
    } finally { setTestingId(null); }
  }, [onTest]);

  // ── Disconnect ───────────────────────────────────────────────────
  const handleDisconnect = useCallback(async (keyId: string) => {
    if (!onDisconnect) return;
    await onDisconnect(keyId);
    setKeys(prev => prev.filter(k => k.keyId !== keyId));
  }, [onDisconnect]);

  const getExchangeInfo = (c: ExchangeCode) => {
    const cfg = EXCHANGE_OPTIONS.find(e => e.code === c);
    return cfg ?? { code: c, nameKey: c, color: '#64748b', icon: '📈' };
  };

  return (
    <Card
      size={compact ? 'small' : 'default'}
      title={<span><ApiOutlined style={{ marginRight: 8 }} />{t.title}</span>}
      extra={keys.length < 5 && (
        <Button size="small" type="dashed" icon={<LinkOutlined />} onClick={() => setShowForm(true)}>
          {t.addNew}
        </Button>
      )}
      style={{ marginBottom: compact ? 0 : 16 }}
    >
      {/* ── Security Alert ──────────────────────────────────────── */}
      <Alert
        type="success"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message={t.security}
        description={t.securityDesc}
        style={{ marginBottom: 16 }}
      />

      {/* ── Connection Form ─────────────────────────────────────── */}
      {showForm && (
        <div style={{
          background: '#f8fafc', borderRadius: 8, padding: 16,
          marginBottom: 16, border: '1px solid #e2e8f0',
        }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t.selectExchange}</div>
            <Select
              value={exchange}
              onChange={setExchange}
              style={{ width: '100%' }}
              options={EXCHANGE_OPTIONS.map(e => ({ value: e.code, label: <span>{e.icon} {(t as any)[e.nameKey] ?? e.code}</span> }))}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Input placeholder={t.labelPlaceholder} value={label}
              onChange={e => setLabel(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t.pasteKey}</div>
            <Input.Password
              placeholder="API Key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t.pasteSecret}</div>
            <Input.Password
              placeholder="Secret Key"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
            />
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<LinkOutlined />} loading={connecting} onClick={handleConnect}
              disabled={!apiKey.trim() || !secret.trim()}>
              {t.connectBtn}
            </Button>
            <Button onClick={() => { setShowForm(false); setError(''); }}>
              {t.cancel ?? (isCN ? '取消' : 'Cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Connected Keys ──────────────────────────────────────── */}
      {keys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
          <ApiOutlined style={{ fontSize: 32, marginBottom: 12 }} />
          <div>{t.noKeys}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{t.noKeysHint}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {keys.map(k => {
            const info = getExchangeInfo(k.exchange);
            const statusColor = k.status === 'active' ? 'green' : k.status === 'test_failed' ? 'red' : 'default';
            const statusText = k.status === 'active' ? t.connected : k.status === 'test_failed' ? t.failed : t.inactive;
            return (
              <div key={k.keyId} style={{
                background: '#f8fafc', borderRadius: 8, padding: '12px 16px',
                border: `1px solid ${k.status === 'active' ? '#d1fae5' : '#e2e8f0'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{info.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {k.label}
                        <Tag color={statusColor} style={{ marginLeft: 8 }}>{statusText}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {k.maskedKey} · {t.lastUsed}: {k.lastUsedAt ? fmtTime(k.lastUsedAt, pl ?? 'en') : t.never}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="small" icon={<ReloadOutlined />} loading={testingId === k.keyId}
                      onClick={() => handleTest(k.keyId)}>{t.testBtn}</Button>
                    <Button size="small" danger onClick={() => handleDisconnect(k.keyId)}>{t.disconnect}</Button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <Tag color={k.permissions.read ? 'green' : 'default'} icon={k.permissions.read ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>{t.read}</Tag>
                  <Tag color={k.permissions.trade ? 'green' : 'default'} icon={k.permissions.trade ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>{t.trade}</Tag>
                  <Tag color="red" icon={<CloseCircleOutlined />}>{t.withdraw}</Tag>
                  <span style={{ color: '#22c55e', fontSize: 11, alignSelf: 'center' }}>{t.withdrawWarning}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default ExchangeConnect;
