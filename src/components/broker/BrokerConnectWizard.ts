/* ════════════════════════════════════════════════════════════════════════════
 * R228 QC-2.5 — 券商连接向导 (Broker Connect Wizard) 交互设计 + 13券商文案
 * 
 * 流程: 选券商 → 连接方式(扫码/Key) → 安全声明 → 测试连接 → 完成
 * 
 * 安全第一: 
 *   - API Key仅存本机加密, 不上传服务器
 *   - 明文Key仅在连接测试时加载到内存
 *   - 连接成功后立即清除内存中的Key副本
 *   - 提供撤销/重新生成API Key的外部链接
 * ════════════════════════════════════════════════════════════════════════════ */

export const BROKER_CONNECT_WIZARD = {
  version: 'v1.0',

  /* ═══════════════════════════════════════════════════════════════════════
   * Security — shared across all brokers
   * ═══════════════════════════════════════════════════════════════════════ */
  security: {
    lockBadge: '🔒 端到端加密',
    coreStatementZh: '您的API Key仅存储在本机, 经AES-256-GCM加密后保存, 绝不离开您的电脑。我们无法访问您的密钥, 也无法代替您下单。',
    coreStatementEn: 'Your API Key is stored locally, encrypted with AES-256-GCM, and never leaves your device. We cannot access your keys or place orders on your behalf.',
    coreStatementJa: 'APIキーはAES-256-GCMで暗号化され、あなたのPCにのみ保存されます。私たちがあなたのキーにアクセスしたり、代理で注文することはできません。',
    bulletPoints: [
      { zh: '仅存本机, 不上传云端', en: 'Local only, never uploaded', ja: 'ローカルのみ、クラウドに非送信' },
      { zh: 'AES-256-GCM 军用级加密', en: 'AES-256-GCM military-grade encryption', ja: 'AES-256-GCM 軍事レベルの暗号化' },
      { zh: '连接测试后密钥清理', en: 'Key wiped from memory after test', ja: '接続テスト後にメモリから消去' },
      { zh: '可随时撤销: 去券商后台重新生成Key', en: 'Revocable: regenerate key on broker\'s site anytime', ja: 'いつでも無効化可能: 証券会社サイトでキー再生成' },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * Wizard steps
   * ═══════════════════════════════════════════════════════════════════════ */
  steps: [
    // Step 1: Select broker
    {
      step: 1,
      title: { zh: '选择券商', en: 'Select Broker', ja: '証券会社を選択' },
      subtitle: { zh: '支持13家券商实时行情+交易', en: '13 brokers for real-time data + trading', ja: '13社のリアルタイムデータ+取引対応' },
      layout: 'card-grid',
      gridCols: { desktop: 4, tablet: 3, mobile: 2 },
      cardTemplate: {
        fields: ['logo', 'name', 'region', 'features', 'status'],
        statusBadge: { connected: { zh: '已连接', en: 'Connected', ja: '接続済', color: '#22c55e' }, available: { zh: '可连接', en: 'Available', ja: '接続可', color: '#6366f1' }, soon: { zh: '即将支持', en: 'Coming Soon', ja: '近日対応', color: '#9ca3af' } },
      },
    },

    // Step 2: Connection method
    {
      step: 2,
      title: { zh: '连接方式', en: 'Connection Method', ja: '接続方法' },
      layout: 'split',
      methods: {
        qr: {
          label: { zh: '扫码连接', en: 'Scan QR', ja: 'QRコード' },
          desc: { zh: '用券商App扫描二维码, 自动完成授权', en: 'Scan QR with broker app to auto-authorize', ja: '証券アプリでQRコードをスキャン、自動認証' },
          fallback: { zh: '二维码未加载? 使用Key连接', en: 'QR not loading? Use API Key', ja: 'QRが読込めませんか? APIキーで接続' },
        },
        key: {
          label: { zh: 'API Key连接', en: 'API Key', ja: 'APIキー' },
          fields: ['apiKey', 'apiSecret', 'passphrase?'],
          hint: { zh: '在券商后台 → API管理 → 创建新Key获取', en: 'Get from broker → API Management → Create Key', ja: '証券会社のAPI管理→新規キー作成から取得' },
        },
      },
    },

    // Step 3: Security confirmation
    {
      step: 3,
      title: { zh: '安全确认', en: 'Security Check', ja: 'セキュリティ確認' },
      content: 'securityStatement', // from security block above
      confirmCheckbox: { zh: '我理解: 我的密钥仅存在本机, 不上传云端。我可以随时去券商后台撤销。', en: 'I understand: keys stay local, never uploaded. I can revoke them anytime.', ja: '理解しました: キーはローカルのみ保存、クラウド非送信。いつでも無効化可能です。' },
    },

    // Step 4: Test connection
    {
      step: 4,
      title: { zh: '测试连接', en: 'Testing...', ja: '接続テスト中...' },
      states: {
        testing: { zh: '正在连接到 {broker}...', en: 'Connecting to {broker}...', ja: '{broker}に接続中...' },
        success: { zh: '✅ {broker} 连接成功! 延迟 {latency}ms', en: '✅ {broker} connected! Latency {latency}ms', ja: '✅ {broker} 接続成功! レイテンシ {latency}ms' },
        failure: { zh: '❌ 连接失败: {reason}', en: '❌ Connection failed: {reason}', ja: '❌ 接続失敗: {reason}' },
      },
      details: ['accountBalance', 'permissions', 'marketAccess'],
    },

    // Step 5: Done
    {
      step: 5,
      title: { zh: '连接完成', en: 'All Set', ja: '接続完了' },
      summary: { zh: '{broker} 已成功连接。你现在可以看到实时行情, 并开始下单了。', en: '{broker} is connected. You can now see real-time data and start trading.', ja: '{broker}接続完了。リアルタイムデータの表示と取引を開始できます。' },
      nextActions: [
        { id: 'view_quotes', zh: '查看行情', en: 'View Quotes', ja: '相場を見る' },
        { id: 'place_order', zh: '开始下单', en: 'Place Order', ja: '注文する' },
        { id: 'connect_another', zh: '再连一个券商', en: 'Connect Another', ja: '別の銘柄を追加' },
      ],
    },
  ],

  /* ═══════════════════════════════════════════════════════════════════════
   * 13 Brokers — individual copy
   * ═══════════════════════════════════════════════════════════════════════ */
  brokers: [
    {
      id: 'futu',
      name: { zh: '富途牛牛', en: 'Futu OpenD', ja: '富途 (Futu)' },
      logo: '🐮',
      region: { zh: '港股/美股/A股', en: 'HK/US/CN', ja: '香港/米国/中国' },
      features: { zh: '实时行情 · 期权链 · 窝轮牛熊 · 条件选股', en: 'Real-time · Option chain · Warrants/CBBC · Stock screener', ja: 'リアルタイム · オプションチェーン · ワラント · 銘柄スクリーナ' },
      connectionType: 'desktop_app',
      setupGuide: { zh: '1. 打开富途OpenD → 2. 设置→API管理→开启 → 3. 复制端口11111 → 4. 在下方输入Key', en: '1. Launch FutuOpenD → 2. Settings → API → Enable → 3. Note port 11111 → 4. Enter key below', ja: '1. FutuOpenD起動 → 2. 設定→API管理→有効化 → 3. ポート11111確認 → 4. キー入力' },
      keyLabel: { zh: 'FutuOpenD 解锁密码', en: 'FutuOpenD Password', ja: 'FutuOpenD パスワード' },
      link: 'https://openapi.futunn.com/',
      port: 11111,
      securityTip: { zh: '请先在富途OpenD GUI中手动输入交易密码解锁, 我们不会接触您的交易密码。', en: 'Unlock trading password in FutuOpenD GUI first. We never touch your trading password.', ja: 'まずFutuOpenD GUIで取引パスワードを手動解除。取引パスワードは一切触れません。' },
    },
    {
      id: 'ibkr',
      name: { zh: '盈透证券', en: 'Interactive Brokers', ja: 'IBKR' },
      logo: '🏦',
      region: { zh: '全球 150+市场', en: 'Global 150+ markets', ja: '世界150+市場' },
      features: { zh: '全球股票 · 期货 · 期权 · 外汇 · 债券', en: 'Global stocks · Futures · Options · FX · Bonds', ja: '世界株 · 先物 · オプション · FX · 債券' },
      connectionType: 'api_key',
      setupGuide: { zh: '1. 登录IBKR账户管理 → 2. Settings → API → Configuration → 3. 启用Socket端口 → 4. 创建应用获取Client ID', en: '1. Login IBKR Account Management → 2. Settings → API → Configuration → 3. Enable Socket → 4. Create app for Client ID', ja: '1. IBKR口座管理にログイン → 2. 設定→API→構成 → 3. ソケット有効化 → 4. アプリ作成でClient ID取得' },
      keyLabel: { zh: 'Client ID + Port', en: 'Client ID + Port', ja: 'クライアントID + ポート' },
      link: 'https://www.interactivebrokers.com/api/',
      port: 7497,
    },
    {
      id: 'schwab',
      name: { zh: '嘉信理财', en: 'Charles Schwab', ja: 'チャールズシュワブ' },
      logo: '🟦',
      region: { zh: '美股/ETF/期权', en: 'US Stocks/ETF/Options', ja: '米国株/ETF/オプション' },
      features: { zh: '零佣金美股 · Schwab ETF · OAuth一键登录 · 退休账户', en: '$0 comm · Schwab ETFs · OAuth login · IRA accounts', ja: '手数料無料 · Schwab ETF · OAuthログイン · 退職口座'},
      connectionType: 'oauth',
      setupGuide: { zh: '1. 注册Schwab开发者 → 2. 创建App → OAuth2 PKCE → 3. 获取App Key → 4. 在下方进行OAuth授权', en: '1. Register Schwab developer → 2. Create App with OAuth2 PKCE → 3. Get App Key → 4. Authorize below', ja: '1. Schwab開発者登録 → 2. OAuth2 PKCEアプリ作成 → 3. App Key取得 → 4. 下で認証' },
      keyLabel: { zh: 'App Key + App Secret', en: 'App Key + App Secret', ja: 'アプリキー + アプリシークレット' },
      link: 'https://developer.schwab.com/',
    },
    {
      id: 'etrade',
      name: { zh: 'E*TRADE', en: 'E*TRADE', ja: 'E*TRADE' },
      logo: '🟪',
      region: { zh: '美股/ETF/期权', en: 'US Stocks/ETF/Options', ja: '米国株/ETF/オプション' },
      features: { zh: 'Power E*TRADE · OAuth1.0a安全连接 · 期权分析', en: 'Power E*TRADE · OAuth1.0a · Options analytics', ja: 'Power E*TRADE · OAuth1.0a · オプション分析' },
      connectionType: 'oauth',
      setupGuide: { zh: '1. 注册E*TRADE开发者 → 2. 创建App → 获取Consumer Key+Secret → 3. 下方OAuth授权', en: '1. Register E*TRADE developer → 2. Create App → Get Consumer Key+Secret → 3. OAuth below', ja: '1. E*TRADE開発者登録 → 2. アプリ作成→Consumer Key+Secret取得 → 3. OAuth認証' },
      keyLabel: { zh: 'Consumer Key + Consumer Secret', en: 'Consumer Key + Consumer Secret', ja: 'コンシューマキー + シークレット' },
      link: 'https://developer.etrade.com/',
      note: { zh: 'E*TRADE使用OAuth1.0a, 需要HMAC-SHA1签名。这是最安全的连接方式。', en: 'E*TRADE uses OAuth1.0a with HMAC-SHA1 signing — the most secure connection method.', ja: 'E*TRADEはOAuth1.0a(HMAC-SHA1署名)使用 — 最も安全な接続方式です。' },
    },
    {
      id: 'binance',
      name: { zh: '币安', en: 'Binance', ja: 'バイナンス' },
      logo: '🔶',
      region: { zh: '加密货币 现货+合约', en: 'Crypto Spot+Futures', ja: '暗号資産 現物+先物' },
      features: { zh: '现货/合约/期权 · 极速WebSocket · USDT本位', en: 'Spot/Futures/Options · Fast WS · USDT-M', ja: '現物/先物/オプション · 高速WS · USDT建て' },
      connectionType: 'api_key',
      setupGuide: { zh: '1. 登录币安 → 2. API管理 → 3. 创建API Key → 4. 设置权限(只读+交易) → 5. 绑定IP(可选)', en: '1. Login Binance → 2. API Management → 3. Create API Key → 4. Set permissions (Read+Trade) → 5. Bind IP (optional)', ja: '1. バイナンスログイン → 2. API管理 → 3. APIキー作成 → 4. 権限設定(読取+取引) → 5. IP制限(任意)' },
      keyLabel: { zh: 'API Key + Secret Key', en: 'API Key + Secret Key', ja: 'APIキー + シークレットキー' },
      link: 'https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072',
      securityTip: { zh: '强烈建议绑定IP白名单, 并关闭提现权限。', en: 'Strongly recommended: IP whitelist + disable withdrawal permission.', ja: 'IPホワイトリスト設定と出金権限無効化を強く推奨します。' },
    },
    {
      id: 'okx',
      name: { zh: 'OKX', en: 'OKX', ja: 'OKX' },
      logo: '⬜',
      region: { zh: '加密货币 现货+合约', en: 'Crypto Spot+Futures', ja: '暗号資産 現物+先物' },
      features: { zh: '统一账户 · 多保证金模式 · 跨币种保证金', en: 'Unified account · Multi-margin · Cross-collateral', ja: '統合口座 · マルチ証拠金 · クロス担保' },
      connectionType: 'api_key',
      setupGuide: { zh: '1. OKX → 右上角头像 → API → 2. 创建V5 API Key → 3. 设置Passphrase → 4. 权限选Trade+Read', en: '1. OKX → Profile → API → 2. Create V5 API Key → 3. Set Passphrase → 4. Trade+Read permissions', ja: '1. OKX → プロフィール → API → 2. V5 APIキー作成 → 3. パスフレーズ設定 → 4. 取引+読取権限' },
      keyLabel: { zh: 'API Key + Secret + Passphrase', en: 'API Key + Secret + Passphrase', ja: 'APIキー + シークレット + パスフレーズ' },
      link: 'https://www.okx.com/account/my-api',
      note: { zh: 'OKX的Passphrase是创建Key时自己设置的, 与登录密码无关。', en: 'OKX Passphrase is set when creating the key, not your login password.', ja: 'OKXパスフレーズはキー作成時の設定で、ログインパスワードとは別です。' },
    },
    {
      id: 'futu_hk',
      name: { zh: '富途 (港股)', en: 'Futu (HK)', ja: '富途 (香港株)' },
      logo: '🐮',
      region: { zh: '港股专属', en: 'HK Stocks Only', ja: '香港株のみ' },
      features: { zh: '港股实时Level2 · 窝轮牛熊 · 期权链 · 暗盘', en: 'HK Lv2 · Warrants/CBBC · Option chain · Grey market', ja: '香港株Lv2 · ワラント/牛熊 · オプション · グレーマーケット' },
      connectionType: 'desktop_app',
      setupGuide: { zh: '同上富途连接流程。如只交易港股, 建议用港股专用连接减少延迟。', en: 'Same as Futu above. For HK-only trading, use this dedicated connection for lower latency.', ja: '上記富途と同じ。香港株専用なら低レイテンシで接続。' },
      keyLabel: { zh: '同富途OpenD', en: 'Same as Futu OpenD', ja: '富途OpenDと同じ' },
      link: 'https://openapi.futunn.com/',
      securityTip: { zh: '与富途共用同一OpenD连接, 无需额外Key。', en: 'Shares the same OpenD connection as Futu. No extra key needed.', ja: '富途と同じOpenD接続を共有。追加キー不要。' },
    },
    {
      id: 'etoro',
      name: { zh: 'eToro', en: 'eToro', ja: 'eToro' },
      logo: '🔵',
      region: { zh: '全球 股票/ETF/加密/跟单', en: 'Global Stocks/ETF/Crypto/Copy', ja: '世界株/ETF/暗号資産/コピー' },
      features: { zh: '社交跟单 · Smart Portfolio · 零佣金 · 碎片股', en: 'Social copy · Smart Portfolio · $0 comm · Fractional shares', ja: 'ソーシャルコピー · スマートPF · 手数料無料 · 端株' },
      connectionType: 'api_key',
      setupGuide: { zh: '1. eToro → Settings → API → 2. 生成Client ID+Secret → 3. 仅需Read权限', en: '1. eToro → Settings → API → 2. Generate Client ID+Secret → 3. Read-only is enough', ja: '1. eToro → 設定 → API → 2. Client ID+Secret生成 → 3. 読取権限のみで十分' },
      keyLabel: { zh: 'Client ID + Client Secret', en: 'Client ID + Client Secret', ja: 'クライアントID + シークレット' },
      link: 'https://www.etoro.com/developer/',
    },
    {
      id: 'webull',
      name: { zh: '微牛', en: 'Webull', ja: 'Webull' },
      logo: '🔴',
      region: { zh: '美股/港股/A股', en: 'US/HK/CN Stocks', ja: '米国/香港/中国株' },
      features: { zh: '零佣金 · 盘前盘后 · IPO认购 · Paper Trading', en: '$0 comm · Pre/After hours · IPO · Paper Trading', ja: '手数料無料 · 時間外取引 · IPO · ペーパートレード' },
      connectionType: 'api_key',
      setupGuide: { zh: '1. Webull → 我的 → 设置 → API → 2. 生成API Key → 3. 先在模拟环境测试', en: '1. Webull → Me → Settings → API → 2. Generate API Key → 3. Test in paper first', ja: '1. Webull → マイ → 設定 → API → 2. APIキー生成 → 3. まずペーパーでテスト' },
      keyLabel: { zh: 'API Key + Secret (纸交可选)', en: 'API Key + Secret (paper available)', ja: 'APIキー + シークレット (ペーパー可)' },
      link: 'https://www.webull.com/help/',
      note: { zh: 'Webull支持模拟交易环境, 建议先用Paper Trading测试策略。', en: 'Webull offers paper trading. Test strategies there first.', ja: 'Webullはペーパートレード対応。まず戦略をテストしてください。' },
    },
    {
      id: 'bybit',
      name: { zh: 'Bybit', en: 'Bybit', ja: 'バイビット' },
      logo: '⚫',
      region: { zh: '加密货币 现货+合约', en: 'Crypto Spot+Futures', ja: '暗号資産 現物+先物' },
      features: { zh: 'USDT永续 · 反向合约 · 期权 · 统一保证金', en: 'USDT perp · Inverse · Options · Unified margin', ja: 'USDT無期限 · インバース · オプション · 統一証拠金' },
      connectionType: 'api_key',
      setupGuide: { zh: '1. Bybit → 账户 → API管理 → 2. 创建API Key → 3. 设置权限 → 4. 绑定IP(建议)', en: '1. Bybit → Account → API → 2. Create API Key → 3. Set permissions → 4. Bind IP (recommended)', ja: '1. Bybit → 口座 → API管理 → 2. APIキー作成 → 3. 権限設定 → 4. IP制限(推奨)' },
      keyLabel: { zh: 'API Key + Secret Key', en: 'API Key + Secret Key', ja: 'APIキー + シークレットキー' },
      link: 'https://www.bybit.com/app/user/api-management',
    },
    {
      id: 'coinbase',
      name: { zh: 'Coinbase', en: 'Coinbase', ja: 'コインベース' },
      logo: '🟦',
      region: { zh: '加密货币 美股合规', en: 'Crypto (US Compliant)', ja: '暗号資産 (米国準拠)' },
      features: { zh: '美国合规 · 质押收益 · Coinbase Earn · 高级交易', en: 'US compliant · Staking · Coinbase Earn · Advanced Trade', ja: '米国準拠 · ステーキング · Coinbase Earn · アドバンスト取引' },
      connectionType: 'api_key',
      setupGuide: { zh: '1. Coinbase → Settings → API → 2. 创建API Key → 3. 设置权限 → 4. 记录API Secret(仅显示一次)', en: '1. Coinbase → Settings → API → 2. Create Key → 3. Set permissions → 4. Save Secret (shown once)', ja: '1. Coinbase → 設定 → API → 2. キー作成 → 3. 権限設定 → 4. シークレット保存(1回限り表示)' },
      keyLabel: { zh: 'API Key + API Secret', en: 'API Key + API Secret', ja: 'APIキー + APIシークレット' },
      link: 'https://www.coinbase.com/settings/api',
      securityTip: { zh: 'Coinbase的API Secret只显示一次, 请立即复制保存。', en: 'Coinbase API Secret is shown once only. Copy it immediately.', ja: 'Coinbase APIシークレットは1回限り表示。すぐにコピー保存を。' },
    },
    {
      id: 'saxo',
      name: { zh: '盛宝银行', en: 'Saxo Bank', ja: 'サクソバンク' },
      logo: '🔷',
      region: { zh: '全球 71交易所 60+货币对', en: 'Global 71 Exchanges 60+ FX pairs', ja: '世界71取引所 60+通貨ペア' },
      features: { zh: '机构级 · 71交易所 · 多资产 · 专业期权', en: 'Institutional · 71 exchanges · Multi-asset · Pro options', ja: '機関投資家級 · 71取引所 · マルチアセット · プロオプション' },
      connectionType: 'api_key',
      setupGuide: { zh: '1. Saxo开发者门户 → 2. 创建App → 3. OAuth2 Authorization Code → 4. 获取Client ID', en: '1. Saxo Developer Portal → 2. Create App → 3. OAuth2 Auth Code → 4. Get Client ID', ja: '1. Saxo開発者ポータル → 2. アプリ作成 → 3. OAuth2認可コード → 4. Client ID取得' },
      keyLabel: { zh: 'Client ID + Client Secret', en: 'Client ID + Client Secret', ja: 'クライアントID + シークレット' },
      link: 'https://www.developer.saxo/',
    },
    {
      id: 'tiger',
      name: { zh: '老虎证券', en: 'Tiger Brokers', ja: 'タイガーブローカーズ' },
      logo: '🐯',
      region: { zh: '美股/港股/新加坡/澳股', en: 'US/HK/SG/AU Stocks', ja: '米国/香港/シンガポール/豪州株' },
      features: { zh: 'AI选股 · 社区 · IPO · 老虎钱', en: 'AI stock pick · Community · IPO · Tiger Coin', ja: 'AI銘柄選択 · コミュニティ · IPO · タイガーコイン' },
      connectionType: 'desktop_app',
      setupGuide: { zh: '1. 打开老虎证券App → 2. 设置 → API开放平台 → 3. 创建应用 → 4. 获取App Key', en: '1. Open Tiger App → 2. Settings → API Platform → 3. Create App → 4. Get App Key', ja: '1. タイガーアプリ → 2. 設定 → APIプラットフォーム → 3. アプリ作成 → 4. App Key取得' },
      keyLabel: { zh: 'App Key + App Secret', en: 'App Key + App Secret', ja: 'アプリキー + シークレット' },
      link: 'https://www.itiger.com/openapi/',
    },
  ],

  /* ═══════════════════════════════════════════════════════════════════════
   * Manage connected brokers
   * ═══════════════════════════════════════════════════════════════════════ */
  management: {
    title: { zh: '已连接券商', en: 'Connected Brokers', ja: '接続済み証券会社' },
    emptyState: { zh: '还没连接任何券商。点击上方选择一个开始。', en: 'No broker connected. Pick one above to get started.', ja: 'まだ証券会社が接続されていません。上から選んで始めましょう。' },
    cardFields: ['name', 'status', 'latency', 'balance', 'permissions', 'lastConnected'],
    actions: [
      { id: 'test', zh: '测试连接', en: 'Test Connection', ja: '接続テスト' },
      { id: 'disconnect', zh: '断开', en: 'Disconnect', ja: '切断' },
      { id: 'refresh', zh: '刷新', en: 'Refresh', ja: 'リフレッシュ' },
    ],
    disconnectWarn: { zh: '断开后将无法获取该券商行情和下单。已保存的策略不受影响。确定断开吗?', en: 'Disconnecting will stop data and trading for this broker. Saved strategies are not affected. Proceed?', ja: '切断するとこの証券会社のデータと取引が停止します。保存済み戦略に影響はありません。切断しますか?' },
  },
};

export default BROKER_CONNECT_WIZARD;
