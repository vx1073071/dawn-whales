/**
 * R285 auto#1: i18n桥接 — 全项目2.3万硬编码中文迁移基础设施 (3h)
 *
 * 覆盖:
 *   - 前端 9,704 处硬编码中文 (564组件)
 *   - 后端 13,654 处硬编码中文 (526引擎)
 *   - 总计 ~23,358 处硬编码中文 → i18n key 迁移
 *
 * 架构:
 *   I18nBridge (Electron Main Process)
 *     ↓ IPC (i18n:* channels)
 *   Renderer (i18next + react-i18next)
 *
 * 特性:
 *   - 12 命名空间 (chart/drawing/indicator/factor/market/community/news/general/billing/settings/error/ai)
 *   - 11 locales (zh-CN/zh-HK/zh-TW/en/ja/ko/fr/it/de/es/ru)
 *   - Key 自动生成: MD5 hash of zh-CN source → 8-char hex
 *   - 预置 500+ 交易/UI 通用术语翻译 (zh-CN→en)
 *   - 批量注册: registerBatch() 一次性注册 23K 条目
 *   - 缺失检测: getMissingKeys(locale) 按 namespace 统计
 *   - 完成度估算: getCompletionStats()
 *   - 文件持久化: exportToJson/importFromJson
 *   - 参数插值: {{param}} → value
 *   - Fallback 链: target → zh-CN → key
 *
 * IPC Channels (12):
 *   i18n:getText       — 获取单个翻译
 *   i18n:getTexts      — 批量获取翻译
 *   i18n:getLocale     — 获取当前 locale
 *   i18n:setLocale     — 设置 locale
 *   i18n:getLocales    — 获取所有支持的 locales
 *   i18n:registerBatch — 批量注册翻译条目
 *   i18n:getMissingKeys — 获取某 locale 缺失的 key
 *   i18n:getStats      — 获取翻译完成度统计
 *   i18n:generateKey   — 从中文文本生成 key
 *   i18n:exportFile    — 导出某 locale 的 JSON
 *   i18n:importFile    — 导入 JSON 翻译文件
 *   i18n:scanHardcoded — 扫描并注册硬编码中文
 */

import { ipcMain } from 'electron';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type LocaleCode =
  | 'zh-CN' | 'zh-HK' | 'zh-TW'
  | 'en' | 'ja' | 'ko'
  | 'fr' | 'it' | 'de' | 'es' | 'ru';

export type Namespace =
  | 'chart'       // K线图/分时图/Footprint UI
  | 'drawing'     // 画线工具/画线面板
  | 'indicator'   // 技术指标
  | 'factor'      // 因子系统
  | 'market'      // 市场/行情/股票信息
  | 'community'   // 社区/分享
  | 'news'        // 新闻/快讯
  | 'general'     // 通用UI (按钮/标签/提示)
  | 'billing'     // 付费/账户
  | 'settings'    // 设置
  | 'error'       // 错误信息
  | 'ai';         // AI 分析/解读

export const ALL_LOCALES: LocaleCode[] = [
  'zh-CN', 'zh-HK', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'it', 'de', 'es', 'ru',
];

export const ALL_NAMESPACES: Namespace[] = [
  'chart', 'drawing', 'indicator', 'factor', 'market', 'community',
  'news', 'general', 'billing', 'settings', 'error', 'ai',
];

export interface TranslationEntry {
  /** i18n key (auto-generated 8-char hex or manual) */
  key: string;
  /** Namespace */
  namespace: Namespace;
  /** Source Chinese text (the hardcoded string) */
  zhCN: string;
  /** English translation */
  en?: string;
  /** Traditional Chinese (HK) */
  zhHK?: string;
  /** Traditional Chinese (TW) */
  zhTW?: string;
  /** Japanese */
  ja?: string;
  /** Korean */
  ko?: string;
  /** French */
  fr?: string;
  /** Italian */
  it?: string;
  /** German */
  de?: string;
  /** Spanish */
  es?: string;
  /** Russian */
  ru?: string;
  /** Context hint for translators */
  context?: string;
  /** Source file where this string was found */
  sourceFile?: string;
  /** Source line number */
  sourceLine?: number;
}

export interface NamespaceStats {
  namespace: Namespace;
  total: number;
  translated: number;
  missing: number;
  completionPercent: number;
}

export interface I18nStats {
  totalKeys: number;
  /** Per-locale stats */
  byLocale: Record<string, { total: number; translated: number; completionPercent: number }>;
  /** Per-namespace stats */
  byNamespace: NamespaceStats[];
  /** Top missing namespaces */
  topMissing: { namespace: Namespace; missing: number }[];
}

export interface ScanResult {
  file: string;
  matches: { line: number; text: string; suggestedNamespace: Namespace }[];
  totalMatches: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Key Generator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a stable i18n key from Chinese source text.
 * Uses MD5 first 8 hex characters for compact, unique, reproducible keys.
 */
function generateKey(zhText: string, namespace: Namespace): string {
  const hash = crypto.createHash('md5').update(zhText.trim()).digest('hex').slice(0, 8);
  return `${namespace}.${hash}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pre-built Common Translations (~500+ terms)
// ═══════════════════════════════════════════════════════════════════════════

const PREBUILT_TRANSLATIONS: TranslationEntry[] = [
  // ── chart (K线图/图表) ──────────────────────────────────────────────────
  { key: 'chart.kline', namespace: 'chart', zhCN: 'K线图', en: 'K-Line Chart', zhHK: 'K線圖', zhTW: 'K線圖', ja: 'ローソク足チャート', ko: '캔들차트' },
  { key: 'chart.time_line', namespace: 'chart', zhCN: '分时图', en: 'Time Line', zhHK: '分時圖', zhTW: '分時圖', ja: '時系列チャート', ko: '분봉차트' },
  { key: 'chart.footprint', namespace: 'chart', zhCN: '足迹图', en: 'Footprint Chart', ja: 'フットプリントチャート', ko: '풋프린트차트' },
  { key: 'chart.candlestick', namespace: 'chart', zhCN: '蜡烛图', en: 'Candlestick', zhHK: '蠟燭圖', zhTW: '蠟燭圖', ja: 'ローソク足', ko: '캔들' },
  { key: 'chart.heikin_ashi', namespace: 'chart', zhCN: '平均K线', en: 'Heikin-Ashi', zhHK: '平均K線', zhTW: '平均K線', ja: '平均足', ko: '헤이킨아시' },
  { key: 'chart.line', namespace: 'chart', zhCN: '折线图', en: 'Line Chart', zhHK: '折線圖', zhTW: '折線圖', ja: 'ラインチャート', ko: '라인차트' },
  { key: 'chart.mountain', namespace: 'chart', zhCN: '山形图', en: 'Mountain Chart', zhHK: '山形圖', zhTW: '山形圖', ja: 'マウンテンチャート', ko: '마운틴차트' },
  { key: 'chart.area', namespace: 'chart', zhCN: '面积图', en: 'Area Chart', zhHK: '面積圖', zhTW: '面積圖', ja: 'エリアチャート', ko: '영역차트' },
  { key: 'chart.volume', namespace: 'chart', zhCN: '成交量', en: 'Volume', zhHK: '成交量', zhTW: '成交量', ja: '出来高', ko: '거래량' },
  { key: 'chart.open', namespace: 'chart', zhCN: '开盘', en: 'Open', zhHK: '開盤', zhTW: '開盤', ja: '始値', ko: '시가' },
  { key: 'chart.high', namespace: 'chart', zhCN: '最高', en: 'High', zhHK: '最高', zhTW: '最高', ja: '高値', ko: '고가' },
  { key: 'chart.low', namespace: 'chart', zhCN: '最低', en: 'Low', zhHK: '最低', zhTW: '最低', ja: '安値', ko: '저가' },
  { key: 'chart.close', namespace: 'chart', zhCN: '收盘', en: 'Close', zhHK: '收盤', zhTW: '收盤', ja: '終値', ko: '종가' },
  { key: 'chart.timeframe', namespace: 'chart', zhCN: '周期', en: 'Timeframe', zhHK: '週期', zhTW: '週期', ja: '時間足', ko: '시간봉' },
  { key: 'chart.timeframe_1m', namespace: 'chart', zhCN: '1分钟', en: '1m', zhHK: '1分鐘', zhTW: '1分鐘', ja: '1分', ko: '1분' },
  { key: 'chart.timeframe_5m', namespace: 'chart', zhCN: '5分钟', en: '5m', zhHK: '5分鐘', zhTW: '5分鐘', ja: '5分', ko: '5분' },
  { key: 'chart.timeframe_15m', namespace: 'chart', zhCN: '15分钟', en: '15m', zhHK: '15分鐘', zhTW: '15分鐘', ja: '15分', ko: '15분' },
  { key: 'chart.timeframe_30m', namespace: 'chart', zhCN: '30分钟', en: '30m', zhHK: '30分鐘', zhTW: '30分鐘', ja: '30分', ko: '30분' },
  { key: 'chart.timeframe_1h', namespace: 'chart', zhCN: '1小时', en: '1h', zhHK: '1小時', zhTW: '1小時', ja: '1時間', ko: '1시간' },
  { key: 'chart.timeframe_4h', namespace: 'chart', zhCN: '4小时', en: '4h', zhHK: '4小時', zhTW: '4小時', ja: '4時間', ko: '4시간' },
  { key: 'chart.timeframe_D', namespace: 'chart', zhCN: '日线', en: 'Daily', zhHK: '日線', zhTW: '日線', ja: '日足', ko: '일봉' },
  { key: 'chart.timeframe_W', namespace: 'chart', zhCN: '周线', en: 'Weekly', zhHK: '週線', zhTW: '週線', ja: '週足', ko: '주봉' },
  { key: 'chart.timeframe_M', namespace: 'chart', zhCN: '月线', en: 'Monthly', zhHK: '月線', zhTW: '月線', ja: '月足', ko: '월봉' },
  { key: 'chart.crosshair', namespace: 'chart', zhCN: '十字准星', en: 'Crosshair', zhHK: '十字準星', zhTW: '十字準星', ja: 'クロスヘア', ko: '십자선' },
  { key: 'chart.data_window', namespace: 'chart', zhCN: '数据窗口', en: 'Data Window', zhHK: '數據窗口', zhTW: '數據窗口', ja: 'データウィンドウ', ko: '데이터창' },
  { key: 'chart.price_line', namespace: 'chart', zhCN: '价格线', en: 'Price Line', zhHK: '價格線', zhTW: '價格線', ja: 'プライスライン', ko: '가격선' },
  { key: 'chart.range_stats', namespace: 'chart', zhCN: '区间统计', en: 'Range Stats', zhHK: '區間統計', zhTW: '區間統計', ja: '範囲統計', ko: '구간통계' },
  { key: 'chart.session_highlight', namespace: 'chart', zhCN: '时段高亮', en: 'Session Highlight', zhHK: '時段高亮', zhTW: '時段高亮', ja: 'セッションハイライト', ko: '세션하이라이트' },
  { key: 'chart.asia_session', namespace: 'chart', zhCN: '亚洲时段', en: 'Asia Session', zhHK: '亞洲時段', zhTW: '亞洲時段', ja: 'アジア時間', ko: '아시아장' },
  { key: 'chart.europe_session', namespace: 'chart', zhCN: '欧洲时段', en: 'Europe Session', zhHK: '歐洲時段', zhTW: '歐洲時段', ja: '欧州時間', ko: '유럽장' },
  { key: 'chart.us_session', namespace: 'chart', zhCN: '美洲时段', en: 'US Session', zhHK: '美洲時段', zhTW: '美洲時段', ja: '米国時間', ko: '미국장' },
  { key: 'chart.multi_layout', namespace: 'chart', zhCN: '多屏布局', en: 'Multi Layout', zhHK: '多屏佈局', zhTW: '多屏佈局', ja: 'マルチレイアウト', ko: '멀티레이아웃' },
  { key: 'chart.indicator_overlay', namespace: 'chart', zhCN: '指标叠加', en: 'Indicator Overlay', zhHK: '指標疊加', zhTW: '指標疊加', ja: 'インジケーター重ね', ko: '지표중첩' },
  { key: 'chart.template_save', namespace: 'chart', zhCN: '模板保存', en: 'Save Template', zhHK: '模板保存', zhTW: '模板保存', ja: 'テンプレート保存', ko: '템플릿저장' },
  { key: 'chart.custom_period', namespace: 'chart', zhCN: '自定义周期', en: 'Custom Period', zhHK: '自定義週期', zhTW: '自定義週期', ja: 'カスタム期間', ko: '사용자주기' },
  { key: 'chart.fullscreen', namespace: 'chart', zhCN: '全屏', en: 'Fullscreen', zhHK: '全螢幕', zhTW: '全螢幕', ja: '全画面', ko: '전체화면' },
  { key: 'chart.screenshot', namespace: 'chart', zhCN: '截图', en: 'Screenshot', zhHK: '截圖', zhTW: '截圖', ja: 'スクリーンショット', ko: '스크린샷' },
  { key: 'chart.live', namespace: 'chart', zhCN: '实时', en: 'LIVE', zhHK: '實時', zhTW: '實時', ja: 'リアルタイム', ko: '실시간' },
  { key: 'chart.empty_state', namespace: 'chart', zhCN: '暂无数据，请选择股票查看', en: 'No data available. Select a stock to view.', zhHK: '暫無數據，請選擇股票查看', zhTW: '暫無數據，請選擇股票查看', ja: 'データがありません。銘柄を選択してください。', ko: '데이터가 없습니다. 종목을 선택하세요.' },
  { key: 'chart.loading', namespace: 'chart', zhCN: '加载中...', en: 'Loading...', zhHK: '加載中...', zhTW: '加載中...', ja: '読み込み中...', ko: '로딩중...' },
  { key: 'chart.demo_data', namespace: 'chart', zhCN: '⚠️ 演示数据 — 请连接券商获取实时行情', en: '⚠️ Demo Data — Connect a broker for live quotes', zhHK: '⚠️ 演示數據 — 請連接券商獲取實時行情', zhTW: '⚠️ 演示數據 — 請連接券商獲取實時行情', ja: '⚠️ デモデータ — ブローカーに接続してリアルタイム相場を取得', ko: '⚠️ 데모데이터 — 실시간 시세를 위해 브로커를 연결하세요' },

  // ── drawing (画线) ───────────────────────────────────────────────────────
  { key: 'drawing.trend_line', namespace: 'drawing', zhCN: '趋势线', en: 'Trend Line', zhHK: '趨勢線', zhTW: '趨勢線', ja: 'トレンドライン', ko: '추세선' },
  { key: 'drawing.horizontal_line', namespace: 'drawing', zhCN: '水平线', en: 'Horizontal Line', zhHK: '水平線', zhTW: '水平線', ja: '水平線', ko: '수평선' },
  { key: 'drawing.vertical_line', namespace: 'drawing', zhCN: '垂直线', en: 'Vertical Line', zhHK: '垂直線', zhTW: '垂直線', ja: '垂直線', ko: '수직선' },
  { key: 'drawing.parallel_channel', namespace: 'drawing', zhCN: '平行通道', en: 'Parallel Channel', zhHK: '平行通道', zhTW: '平行通道', ja: 'パラレルチャネル', ko: '평행채널' },
  { key: 'drawing.fib_retracement', namespace: 'drawing', zhCN: '斐波那契回调', en: 'Fibonacci Retracement', zhHK: '斐波那契回調', zhTW: '斐波那契回調', ja: 'フィボナッチリトレースメント', ko: '피보나치되돌림' },
  { key: 'drawing.fib_extension', namespace: 'drawing', zhCN: '斐波那契扩展', en: 'Fibonacci Extension', zhHK: '斐波那契擴展', zhTW: '斐波那契擴展', ja: 'フィボナッチエクステンション', ko: '피보나치확장' },
  { key: 'drawing.rectangle', namespace: 'drawing', zhCN: '矩形', en: 'Rectangle', zhHK: '矩形', zhTW: '矩形', ja: '長方形', ko: '사각형' },
  { key: 'drawing.support', namespace: 'drawing', zhCN: '支撑位', en: 'Support', zhHK: '支撐位', zhTW: '支撐位', ja: 'サポート', ko: '지지선' },
  { key: 'drawing.resistance', namespace: 'drawing', zhCN: '压力位', en: 'Resistance', zhHK: '壓力位', zhTW: '壓力位', ja: 'レジスタンス', ko: '저항선' },
  { key: 'drawing.entry_point', namespace: 'drawing', zhCN: '入场点', en: 'Entry Point', zhHK: '入場點', zhTW: '入場點', ja: 'エントリーポイント', ko: '진입점' },
  { key: 'drawing.stop_loss', namespace: 'drawing', zhCN: '止损位', en: 'Stop Loss', zhHK: '止損位', zhTW: '止損位', ja: 'ストップロス', ko: '손절가' },
  { key: 'drawing.take_profit', namespace: 'drawing', zhCN: '止盈位', en: 'Take Profit', zhHK: '止盈位', zhTW: '止盈位', ja: 'テイクプロフィット', ko: '익절가' },
  { key: 'drawing.risk_reward', namespace: 'drawing', zhCN: '风险回报比', en: 'Risk/Reward Ratio', zhHK: '風險回報比', zhTW: '風險回報比', ja: 'リスクリワード比', ko: '리스크리워드비율' },
  { key: 'drawing.ai_analysis', namespace: 'drawing', zhCN: 'AI分析', en: 'AI Analysis', zhHK: 'AI分析', zhTW: 'AI分析', ja: 'AI分析', ko: 'AI분석' },
  { key: 'drawing.ai_drawing', namespace: 'drawing', zhCN: 'AI自动画线', en: 'AI Auto Drawing', zhHK: 'AI自動畫線', zhTW: 'AI自動畫線', ja: 'AI自動描画', ko: 'AI자동그리기' },
  { key: 'drawing.undo', namespace: 'drawing', zhCN: '撤销', en: 'Undo', zhHK: '撤銷', zhTW: '撤銷', ja: '元に戻す', ko: '실행취소' },
  { key: 'drawing.redo', namespace: 'drawing', zhCN: '重做', en: 'Redo', zhHK: '重做', zhTW: '重做', ja: 'やり直す', ko: '다시실행' },
  { key: 'drawing.delete', namespace: 'drawing', zhCN: '删除', en: 'Delete', zhHK: '刪除', zhTW: '刪除', ja: '削除', ko: '삭제' },
  { key: 'drawing.lock', namespace: 'drawing', zhCN: '锁定', en: 'Lock', zhHK: '鎖定', zhTW: '鎖定', ja: 'ロック', ko: '잠금' },
  { key: 'drawing.style', namespace: 'drawing', zhCN: '样式', en: 'Style', zhHK: '樣式', zhTW: '樣式', ja: 'スタイル', ko: '스타일' },
  { key: 'drawing.color', namespace: 'drawing', zhCN: '颜色', en: 'Color', zhHK: '顏色', zhTW: '顏色', ja: '色', ko: '색상' },
  { key: 'drawing.line_width', namespace: 'drawing', zhCN: '线宽', en: 'Line Width', zhHK: '線寬', zhTW: '線寬', ja: '線の太さ', ko: '선두께' },
  { key: 'drawing.dashed_line', namespace: 'drawing', zhCN: '虚线', en: 'Dashed Line', zhHK: '虛線', zhTW: '虛線', ja: '破線', ko: '점선' },
  { key: 'drawing.solid_line', namespace: 'drawing', zhCN: '实线', en: 'Solid Line', zhHK: '實線', zhTW: '實線', ja: '実線', ko: '실선' },
  { key: 'drawing.touches', namespace: 'drawing', zhCN: '触及次数', en: 'Touches', zhHK: '觸及次數', zhTW: '觸及次數', ja: 'タッチ回数', ko: '터치횟수' },
  { key: 'drawing.success_rate', namespace: 'drawing', zhCN: '成功率', en: 'Success Rate', zhHK: '成功率', zhTW: '成功率', ja: '成功率', ko: '성공률' },
  { key: 'drawing.breakout_prob', namespace: 'drawing', zhCN: '突破概率', en: 'Breakout Probability', zhHK: '突破概率', zhTW: '突破概率', ja: 'ブレイクアウト確率', ko: '돌파확률' },

  // ── indicator (技术指标) ──────────────────────────────────────────────────
  { key: 'indicator.ma', namespace: 'indicator', zhCN: '均线', en: 'MA', zhHK: '均線', zhTW: '均線', ja: '移動平均', ko: '이동평균' },
  { key: 'indicator.sma', namespace: 'indicator', zhCN: '简单移动平均', en: 'SMA', zhHK: '簡單移動平均', zhTW: '簡單移動平均', ja: '単純移動平均', ko: '단순이동평균' },
  { key: 'indicator.ema', namespace: 'indicator', zhCN: '指数移动平均', en: 'EMA', zhHK: '指數移動平均', zhTW: '指數移動平均', ja: '指数移動平均', ko: '지수이동평균' },
  { key: 'indicator.macd', namespace: 'indicator', zhCN: 'MACD', en: 'MACD' },
  { key: 'indicator.macd_dif', namespace: 'indicator', zhCN: 'DIF', en: 'DIF' },
  { key: 'indicator.macd_dea', namespace: 'indicator', zhCN: 'DEA', en: 'DEA' },
  { key: 'indicator.macd_histogram', namespace: 'indicator', zhCN: 'MACD柱', en: 'MACD Histogram', zhHK: 'MACD柱', zhTW: 'MACD柱', ja: 'MACDヒストグラム', ko: 'MACD히스토그램' },
  { key: 'indicator.golden_cross', namespace: 'indicator', zhCN: '金叉', en: 'Golden Cross', zhHK: '金叉', zhTW: '金叉', ja: 'ゴールデンクロス', ko: '골든크로스' },
  { key: 'indicator.death_cross', namespace: 'indicator', zhCN: '死叉', en: 'Death Cross', zhHK: '死叉', zhTW: '死叉', ja: 'デッドクロス', ko: '데드크로스' },
  { key: 'indicator.rsi', namespace: 'indicator', zhCN: '相对强弱指标', en: 'RSI', zhHK: '相對強弱指標', zhTW: '相對強弱指標', ja: 'RSI', ko: 'RSI' },
  { key: 'indicator.overbought', namespace: 'indicator', zhCN: '超买', en: 'Overbought', zhHK: '超買', zhTW: '超買', ja: '買われすぎ', ko: '과매수' },
  { key: 'indicator.oversold', namespace: 'indicator', zhCN: '超卖', en: 'Oversold', zhHK: '超賣', zhTW: '超賣', ja: '売られすぎ', ko: '과매도' },
  { key: 'indicator.boll', namespace: 'indicator', zhCN: '布林带', en: 'Bollinger Bands', zhHK: '布林帶', zhTW: '布林帶', ja: 'ボリンジャーバンド', ko: '볼린저밴드' },
  { key: 'indicator.boll_upper', namespace: 'indicator', zhCN: '上轨', en: 'Upper Band', zhHK: '上軌', zhTW: '上軌', ja: '上限バンド', ko: '상단밴드' },
  { key: 'indicator.boll_mid', namespace: 'indicator', zhCN: '中轨', en: 'Middle Band', zhHK: '中軌', zhTW: '中軌', ja: '中央バンド', ko: '중간밴드' },
  { key: 'indicator.boll_lower', namespace: 'indicator', zhCN: '下轨', en: 'Lower Band', zhHK: '下軌', zhTW: '下軌', ja: '下限バンド', ko: '하단밴드' },
  { key: 'indicator.kdj', namespace: 'indicator', zhCN: 'KDJ', en: 'KDJ' },
  { key: 'indicator.vwap', namespace: 'indicator', zhCN: '成交量加权均价', en: 'VWAP', zhHK: '成交量加權均價', zhTW: '成交量加權均價', ja: 'VWAP', ko: 'VWAP' },
  { key: 'indicator.sar', namespace: 'indicator', zhCN: '抛物线SAR', en: 'Parabolic SAR', zhHK: '拋物線SAR', zhTW: '拋物線SAR', ja: 'パラボリックSAR', ko: '파라볼릭SAR' },
  { key: 'indicator.ichimoku', namespace: 'indicator', zhCN: '一目均衡', en: 'Ichimoku Cloud', zhHK: '一目均衡', zhTW: '一目均衡', ja: '一目均衡表', ko: '일목균형표' },
  { key: 'indicator.adx', namespace: 'indicator', zhCN: '平均趋向指数', en: 'ADX', zhHK: '平均趨向指數', zhTW: '平均趨向指數', ja: 'ADX', ko: 'ADX' },
  { key: 'indicator.cci', namespace: 'indicator', zhCN: '商品通道指数', en: 'CCI', zhHK: '商品通道指數', zhTW: '商品通道指數', ja: 'CCI', ko: 'CCI' },
  { key: 'indicator.atr', namespace: 'indicator', zhCN: '平均真实波幅', en: 'ATR', zhHK: '平均真實波幅', zhTW: '平均真實波幅', ja: 'ATR', ko: 'ATR' },
  { key: 'indicator.obv', namespace: 'indicator', zhCN: '能量潮', en: 'OBV', zhHK: '能量潮', zhTW: '能量潮', ja: 'OBV', ko: 'OBV' },
  { key: 'indicator.williams_r', namespace: 'indicator', zhCN: '威廉指标', en: "Williams %R", zhHK: '威廉指標', zhTW: '威廉指標', ja: 'ウィリアムズ%R', ko: '윌리엄스%R' },
  { key: 'indicator.pivot', namespace: 'indicator', zhCN: '枢轴点', en: 'Pivot Points', zhHK: '樞軸點', zhTW: '樞軸點', ja: 'ピボットポイント', ko: '피봇포인트' },
  { key: 'indicator.mfi', namespace: 'indicator', zhCN: '资金流量指标', en: 'MFI', zhHK: '資金流量指標', zhTW: '資金流量指標', ja: 'MFI', ko: 'MFI' },
  { key: 'indicator.stoch_rsi', namespace: 'indicator', zhCN: '随机RSI', en: 'Stoch RSI', zhHK: '隨機RSI', zhTW: '隨機RSI', ja: 'ストキャスティクスRSI', ko: '스토캐스틱RSI' },
  { key: 'indicator.add_indicator', namespace: 'indicator', zhCN: '添加指标', en: 'Add Indicator', zhHK: '添加指標', zhTW: '添加指標', ja: '指標を追加', ko: '지표추가' },
  { key: 'indicator.period', namespace: 'indicator', zhCN: '周期', en: 'Period', zhHK: '週期', zhTW: '週期', ja: '期間', ko: '기간' },
  { key: 'indicator.param', namespace: 'indicator', zhCN: '参数', en: 'Parameters', zhHK: '參數', zhTW: '參數', ja: 'パラメータ', ko: '파라미터' },
  { key: 'indicator.remove', namespace: 'indicator', zhCN: '移除指标', en: 'Remove Indicator', zhHK: '移除指標', zhTW: '移除指標', ja: '指標を削除', ko: '지표제거' },
  { key: 'indicator.sub_pane', namespace: 'indicator', zhCN: '副图', en: 'Sub-pane', zhHK: '副圖', zhTW: '副圖', ja: 'サブペイン', ko: '보조창' },

  // ── factor (因子) ────────────────────────────────────────────────────────
  { key: 'factor.name', namespace: 'factor', zhCN: '因子', en: 'Factor', zhHK: '因子', zhTW: '因子', ja: 'ファクター', ko: '팩터' },
  { key: 'factor.ic', namespace: 'factor', zhCN: '信息系数', en: 'IC', zhHK: '信息係數', zhTW: '信息係數', ja: 'IC', ko: 'IC' },
  { key: 'factor.ir', namespace: 'factor', zhCN: '信息比率', en: 'IR', zhHK: '信息比率', zhTW: '信息比率', ja: 'IR', ko: 'IR' },
  { key: 'factor.sharpe', namespace: 'factor', zhCN: '夏普比率', en: 'Sharpe Ratio', zhHK: '夏普比率', zhTW: '夏普比率', ja: 'シャープレシオ', ko: '샤프비율' },
  { key: 'factor.max_drawdown', namespace: 'factor', zhCN: '最大回撤', en: 'Max Drawdown', zhHK: '最大回撤', zhTW: '最大回撤', ja: '最大ドローダウン', ko: '최대낙폭' },
  { key: 'factor.annual_return', namespace: 'factor', zhCN: '年化收益', en: 'Annual Return', zhHK: '年化收益', zhTW: '年化收益', ja: '年率リターン', ko: '연환산수익' },
  { key: 'factor.volatility', namespace: 'factor', zhCN: '波动率', en: 'Volatility', zhHK: '波動率', zhTW: '波動率', ja: 'ボラティリティ', ko: '변동성' },
  { key: 'factor.turnover', namespace: 'factor', zhCN: '换手率', en: 'Turnover Rate', zhHK: '換手率', zhTW: '換手率', ja: '売買回転率', ko: '회전율' },
  { key: 'factor.crowding', namespace: 'factor', zhCN: '拥挤度', en: 'Crowding', zhHK: '擁擠度', zhTW: '擁擠度', ja: '混雑度', ko: '혼잡도' },
  { key: 'factor.decay', namespace: 'factor', zhCN: '衰减速度', en: 'Decay Rate', zhHK: '衰減速度', zhTW: '衰減速度', ja: '減衰速度', ko: '감쇠율' },
  { key: 'factor.signal', namespace: 'factor', zhCN: '信号', en: 'Signal', zhHK: '信號', zhTW: '信號', ja: 'シグナル', ko: '시그널' },
  { key: 'factor.long', namespace: 'factor', zhCN: '做多', en: 'Long', zhHK: '做多', zhTW: '做多', ja: 'ロング', ko: '롱' },
  { key: 'factor.short', namespace: 'factor', zhCN: '做空', en: 'Short', zhHK: '做空', zhTW: '做空', ja: 'ショート', ko: '숏' },
  { key: 'factor.neutral', namespace: 'factor', zhCN: '中性', en: 'Neutral', zhHK: '中性', zhTW: '中性', ja: '中立', ko: '중립' },
  { key: 'factor.alarm', namespace: 'factor', zhCN: '因子闹钟', en: 'Factor Alarm', zhHK: '因子鬧鐘', zhTW: '因子鬧鐘', ja: 'ファクターアラーム', ko: '팩터알람' },
  { key: 'factor.combo', namespace: 'factor', zhCN: '因子组合', en: 'Factor Combo', zhHK: '因子組合', zhTW: '因子組合', ja: 'ファクターコンボ', ko: '팩터콤보' },
  { key: 'factor.backtest', namespace: 'factor', zhCN: '回测', en: 'Backtest', zhHK: '回測', zhTW: '回測', ja: 'バックテスト', ko: '백테스트' },
  { key: 'factor.value', namespace: 'factor', zhCN: '价值因子', en: 'Value Factor', zhHK: '價值因子', zhTW: '價值因子', ja: 'バリューファクター', ko: '가치팩터' },
  { key: 'factor.momentum', namespace: 'factor', zhCN: '动量因子', en: 'Momentum Factor', zhHK: '動量因子', zhTW: '動量因子', ja: 'モメンタムファクター', ko: '모멘텀팩터' },
  { key: 'factor.quality', namespace: 'factor', zhCN: '质量因子', en: 'Quality Factor', zhHK: '質量因子', zhTW: '質量因子', ja: 'クオリティファクター', ko: '퀄리티팩터' },
  { key: 'factor.size', namespace: 'factor', zhCN: '规模因子', en: 'Size Factor', zhHK: '規模因子', zhTW: '規模因子', ja: 'サイズファクター', ko: '사이즈팩터' },
  { key: 'factor.growth', namespace: 'factor', zhCN: '成长因子', en: 'Growth Factor', zhHK: '成長因子', zhTW: '成長因子', ja: 'グロースファクター', ko: '성장팩터' },
  { key: 'factor.volatility_factor', namespace: 'factor', zhCN: '波动因子', en: 'Volatility Factor', zhHK: '波動因子', zhTW: '波動因子', ja: 'ボラティリティファクター', ko: '변동성팩터' },
  { key: 'factor.recipe', namespace: 'factor', zhCN: '因子食谱', en: 'Factor Recipe', zhHK: '因子食譜', zhTW: '因子食譜', ja: 'ファクターレシピ', ko: '팩터레시피' },
  { key: 'factor.subscription', namespace: 'factor', zhCN: '因子订阅', en: 'Factor Subscription', zhHK: '因子訂閱', zhTW: '因子訂閱', ja: 'ファクター購読', ko: '팩터구독' },

  // ── market (市场) ────────────────────────────────────────────────────────
  { key: 'market.stock', namespace: 'market', zhCN: '股票', en: 'Stock', zhHK: '股票', zhTW: '股票', ja: '株式', ko: '주식' },
  { key: 'market.index', namespace: 'market', zhCN: '指数', en: 'Index', zhHK: '指數', zhTW: '指數', ja: '指数', ko: '지수' },
  { key: 'market.futures', namespace: 'market', zhCN: '期货', en: 'Futures', zhHK: '期貨', zhTW: '期貨', ja: '先物', ko: '선물' },
  { key: 'market.forex', namespace: 'market', zhCN: '外汇', en: 'Forex', zhHK: '外匯', zhTW: '外匯', ja: 'FX', ko: '외환' },
  { key: 'market.crypto', namespace: 'market', zhCN: '加密货币', en: 'Crypto', zhHK: '加密貨幣', zhTW: '加密貨幣', ja: '暗号資産', ko: '암호화폐' },
  { key: 'market.bond', namespace: 'market', zhCN: '债券', en: 'Bond', zhHK: '債券', zhTW: '債券', ja: '債券', ko: '채권' },
  { key: 'market.commodity', namespace: 'market', zhCN: '大宗商品', en: 'Commodity', zhHK: '大宗商品', zhTW: '大宗商品', ja: 'コモディティ', ko: '원자재' },
  { key: 'market.etf', namespace: 'market', zhCN: 'ETF', en: 'ETF' },
  { key: 'market.market_cap', namespace: 'market', zhCN: '市值', en: 'Market Cap', zhHK: '市值', zhTW: '市值', ja: '時価総額', ko: '시가총액' },
  { key: 'market.pe_ratio', namespace: 'market', zhCN: '市盈率', en: 'P/E Ratio', zhHK: '市盈率', zhTW: '市盈率', ja: 'PER', ko: 'PER' },
  { key: 'market.pb_ratio', namespace: 'market', zhCN: '市净率', en: 'P/B Ratio', zhHK: '市淨率', zhTW: '市淨率', ja: 'PBR', ko: 'PBR' },
  { key: 'market.dividend_yield', namespace: 'market', zhCN: '股息率', en: 'Dividend Yield', zhHK: '股息率', zhTW: '股息率', ja: '配当利回り', ko: '배당수익률' },
  { key: 'market.change', namespace: 'market', zhCN: '涨跌幅', en: 'Change', zhHK: '漲跌幅', zhTW: '漲跌幅', ja: '騰落率', ko: '등락률' },
  { key: 'market.up', namespace: 'market', zhCN: '上涨', en: 'Up', zhHK: '上漲', zhTW: '上漲', ja: '上昇', ko: '상승' },
  { key: 'market.down', namespace: 'market', zhCN: '下跌', en: 'Down', zhHK: '下跌', zhTW: '下跌', ja: '下落', ko: '하락' },
  { key: 'market.limit_up', namespace: 'market', zhCN: '涨停', en: 'Limit Up', zhHK: '漲停', zhTW: '漲停', ja: 'ストップ高', ko: '상한가' },
  { key: 'market.limit_down', namespace: 'market', zhCN: '跌停', en: 'Limit Down', zhHK: '跌停', zhTW: '跌停', ja: 'ストップ安', ko: '하한가' },
  { key: 'market.us_market', namespace: 'market', zhCN: '美股', en: 'US Market', zhHK: '美股', zhTW: '美股', ja: '米国市場', ko: '미국시장' },
  { key: 'market.hk_market', namespace: 'market', zhCN: '港股', en: 'HK Market', zhHK: '港股', zhTW: '港股', ja: '香港市場', ko: '홍콩시장' },
  { key: 'market.a_share', namespace: 'market', zhCN: 'A股', en: 'A-Share', zhHK: 'A股', zhTW: 'A股', ja: 'A株', ko: 'A주' },
  { key: 'market.jp_market', namespace: 'market', zhCN: '日股', en: 'JP Market', zhHK: '日股', zhTW: '日股', ja: '日本市場', ko: '일본시장' },
  { key: 'market.watchlist', namespace: 'market', zhCN: '自选股', en: 'Watchlist', zhHK: '自選股', zhTW: '自選股', ja: 'ウォッチリスト', ko: '관심종목' },
  { key: 'market.search_symbol', namespace: 'market', zhCN: '搜索股票代码', en: 'Search Symbol', zhHK: '搜索股票代碼', zhTW: '搜索股票代碼', ja: '銘柄コード検索', ko: '종목코드검색' },
  { key: 'market.pre_market', namespace: 'market', zhCN: '盘前', en: 'Pre-market', zhHK: '盤前', zhTW: '盤前', ja: 'プレマーケット', ko: '장전' },
  { key: 'market.after_hours', namespace: 'market', zhCN: '盘后', en: 'After Hours', zhHK: '盤後', zhTW: '盤後', ja: 'アフターマーケット', ko: '장후' },
  { key: 'market.bid', namespace: 'market', zhCN: '买一', en: 'Bid', zhHK: '買一', zhTW: '買一', ja: '買気配', ko: '매수호가' },
  { key: 'market.ask', namespace: 'market', zhCN: '卖一', en: 'Ask', zhHK: '賣一', zhTW: '賣一', ja: '売気配', ko: '매도호가' },
  { key: 'market.spread', namespace: 'market', zhCN: '价差', en: 'Spread', zhHK: '價差', zhTW: '價差', ja: 'スプレッド', ko: '스프레드' },
  { key: 'market.quote_source', namespace: 'market', zhCN: '行情源', en: 'Quote Source', zhHK: '行情源', zhTW: '行情源', ja: '相場ソース', ko: '시세소스' },

  // ── community (社区) ──────────────────────────────────────────────────────
  { key: 'community.share', namespace: 'community', zhCN: '分享', en: 'Share', zhHK: '分享', zhTW: '分享', ja: '共有', ko: '공유' },
  { key: 'community.publish', namespace: 'community', zhCN: '发布', en: 'Publish', zhHK: '發布', zhTW: '發布', ja: '公開', ko: '게시' },
  { key: 'community.like', namespace: 'community', zhCN: '点赞', en: 'Like', zhHK: '點讚', zhTW: '點讚', ja: 'いいね', ko: '좋아요' },
  { key: 'community.comment', namespace: 'community', zhCN: '评论', en: 'Comment', zhHK: '評論', zhTW: '評論', ja: 'コメント', ko: '댓글' },
  { key: 'community.follow', namespace: 'community', zhCN: '关注', en: 'Follow', zhHK: '關注', zhTW: '關注', ja: 'フォロー', ko: '팔로우' },
  { key: 'community.follower', namespace: 'community', zhCN: '粉丝', en: 'Follower', zhHK: '粉絲', zhTW: '粉絲', ja: 'フォロワー', ko: '팔로워' },
  { key: 'community.leaderboard', namespace: 'community', zhCN: '排行榜', en: 'Leaderboard', zhHK: '排行榜', zhTW: '排行榜', ja: 'ランキング', ko: '리더보드' },
  { key: 'community.creator', namespace: 'community', zhCN: '创作者', en: 'Creator', zhHK: '創作者', zhTW: '創作者', ja: 'クリエイター', ko: '크리에이터' },
  { key: 'community.reputation', namespace: 'community', zhCN: '信誉', en: 'Reputation', zhHK: '信譽', zhTW: '信譽', ja: '評価', ko: '평판' },
  { key: 'community.fork', namespace: 'community', zhCN: '复制', en: 'Fork', zhHK: '複製', zhTW: '複製', ja: 'フォーク', ko: '포크' },
  { key: 'community.made_with', namespace: 'community', zhCN: '由 QUANT MOO 生成', en: 'Made with QUANT MOO', zhHK: '由 QUANT MOO 生成', zhTW: '由 QUANT MOO 生成', ja: 'QUANT MOOで作成', ko: 'QUANT MOO 제작' },
  { key: 'community.invite', namespace: 'community', zhCN: '邀请好友', en: 'Invite Friends', zhHK: '邀請好友', zhTW: '邀請好友', ja: '友達を招待', ko: '친구초대' },
  { key: 'community.reward', namespace: 'community', zhCN: '奖励', en: 'Reward', zhHK: '獎勵', zhTW: '獎勵', ja: '報酬', ko: '보상' },
  { key: 'community.referral_bonus', namespace: 'community', zhCN: '双方各得 1 USDT 体验金', en: 'Both get 1 USDT trial credit', zhHK: '雙方各得 1 USDT 體驗金', zhTW: '雙方各得 1 USDT 體驗金', ja: '両者に1 USDTのトライアルクレジット', ko: '양쪽 모두 1 USDT 체험 크레딧' },

  // ── news (新闻) ───────────────────────────────────────────────────────────
  { key: 'news.title', namespace: 'news', zhCN: '新闻', en: 'News', zhHK: '新聞', zhTW: '新聞', ja: 'ニュース', ko: '뉴스' },
  { key: 'news.flash', namespace: 'news', zhCN: '快讯', en: 'Flash', zhHK: '快訊', zhTW: '快訊', ja: '速報', ko: '속보' },
  { key: 'news.breaking', namespace: 'news', zhCN: '重磅', en: 'Breaking', zhHK: '重磅', zhTW: '重磅', ja: '速報', ko: '긴급' },
  { key: 'news.sentiment', namespace: 'news', zhCN: '情绪', en: 'Sentiment', zhHK: '情緒', zhTW: '情緒', ja: 'センチメント', ko: '심리' },
  { key: 'news.sentiment_positive', namespace: 'news', zhCN: '正面', en: 'Positive', zhHK: '正面', zhTW: '正面', ja: 'ポジティブ', ko: '긍정적' },
  { key: 'news.sentiment_negative', namespace: 'news', zhCN: '负面', en: 'Negative', zhHK: '負面', zhTW: '負面', ja: 'ネガティブ', ko: '부정적' },
  { key: 'news.source', namespace: 'news', zhCN: '来源', en: 'Source', zhHK: '來源', zhTW: '來源', ja: 'ソース', ko: '출처' },
  { key: 'news.daily_briefing', namespace: 'news', zhCN: '每日简报', en: 'Daily Briefing', zhHK: '每日簡報', zhTW: '每日簡報', ja: 'デイリーブリーフィング', ko: '일일브리핑' },
  { key: 'news.relevance', namespace: 'news', zhCN: '相关度', en: 'Relevance', zhHK: '相關度', zhTW: '相關度', ja: '関連度', ko: '관련도' },
  { key: 'news.read_more', namespace: 'news', zhCN: '阅读全文', en: 'Read More', zhHK: '閱讀全文', zhTW: '閱讀全文', ja: '続きを読む', ko: '더보기' },

  // ── general (通用UI) ─────────────────────────────────────────────────────
  { key: 'general.save', namespace: 'general', zhCN: '保存', en: 'Save', zhHK: '保存', zhTW: '保存', ja: '保存', ko: '저장' },
  { key: 'general.cancel', namespace: 'general', zhCN: '取消', en: 'Cancel', zhHK: '取消', zhTW: '取消', ja: 'キャンセル', ko: '취소' },
  { key: 'general.confirm', namespace: 'general', zhCN: '确认', en: 'Confirm', zhHK: '確認', zhTW: '確認', ja: '確認', ko: '확인' },
  { key: 'general.close', namespace: 'general', zhCN: '关闭', en: 'Close', zhHK: '關閉', zhTW: '關閉', ja: '閉じる', ko: '닫기' },
  { key: 'general.back', namespace: 'general', zhCN: '返回', en: 'Back', zhHK: '返回', zhTW: '返回', ja: '戻る', ko: '뒤로' },
  { key: 'general.next', namespace: 'general', zhCN: '下一步', en: 'Next', zhHK: '下一步', zhTW: '下一步', ja: '次へ', ko: '다음' },
  { key: 'general.previous', namespace: 'general', zhCN: '上一步', en: 'Previous', zhHK: '上一步', zhTW: '上一步', ja: '前へ', ko: '이전' },
  { key: 'general.search', namespace: 'general', zhCN: '搜索', en: 'Search', zhHK: '搜索', zhTW: '搜索', ja: '検索', ko: '검색' },
  { key: 'general.filter', namespace: 'general', zhCN: '筛选', en: 'Filter', zhHK: '篩選', zhTW: '篩選', ja: 'フィルター', ko: '필터' },
  { key: 'general.sort', namespace: 'general', zhCN: '排序', en: 'Sort', zhHK: '排序', zhTW: '排序', ja: '並べ替え', ko: '정렬' },
  { key: 'general.edit', namespace: 'general', zhCN: '编辑', en: 'Edit', zhHK: '編輯', zhTW: '編輯', ja: '編集', ko: '편집' },
  { key: 'general.copy', namespace: 'general', zhCN: '复制', en: 'Copy', zhHK: '複製', zhTW: '複製', ja: 'コピー', ko: '복사' },
  { key: 'general.paste', namespace: 'general', zhCN: '粘贴', en: 'Paste', zhHK: '粘貼', zhTW: '粘貼', ja: '貼り付け', ko: '붙여넣기' },
  { key: 'general.export', namespace: 'general', zhCN: '导出', en: 'Export', zhHK: '導出', zhTW: '導出', ja: 'エクスポート', ko: '내보내기' },
  { key: 'general.import', namespace: 'general', zhCN: '导入', en: 'Import', zhHK: '導入', zhTW: '導入', ja: 'インポート', ko: '가져오기' },
  { key: 'general.download', namespace: 'general', zhCN: '下载', en: 'Download', zhHK: '下載', zhTW: '下載', ja: 'ダウンロード', ko: '다운로드' },
  { key: 'general.upload', namespace: 'general', zhCN: '上传', en: 'Upload', zhHK: '上傳', zhTW: '上傳', ja: 'アップロード', ko: '업로드' },
  { key: 'general.refresh', namespace: 'general', zhCN: '刷新', en: 'Refresh', zhHK: '刷新', zhTW: '刷新', ja: '更新', ko: '새로고침' },
  { key: 'general.reset', namespace: 'general', zhCN: '重置', en: 'Reset', zhHK: '重置', zhTW: '重置', ja: 'リセット', ko: '초기화' },
  { key: 'general.apply', namespace: 'general', zhCN: '应用', en: 'Apply', zhHK: '應用', zhTW: '應用', ja: '適用', ko: '적용' },
  { key: 'general.submit', namespace: 'general', zhCN: '提交', en: 'Submit', zhHK: '提交', zhTW: '提交', ja: '送信', ko: '제출' },
  { key: 'general.enable', namespace: 'general', zhCN: '启用', en: 'Enable', zhHK: '啟用', zhTW: '啟用', ja: '有効', ko: '활성화' },
  { key: 'general.disable', namespace: 'general', zhCN: '禁用', en: 'Disable', zhHK: '禁用', zhTW: '禁用', ja: '無効', ko: '비활성화' },
  { key: 'general.on', namespace: 'general', zhCN: '开', en: 'On', zhHK: '開', zhTW: '開', ja: 'オン', ko: '켜기' },
  { key: 'general.off', namespace: 'general', zhCN: '关', en: 'Off', zhHK: '關', zhTW: '關', ja: 'オフ', ko: '끄기' },
  { key: 'general.yes', namespace: 'general', zhCN: '是', en: 'Yes', zhHK: '是', zhTW: '是', ja: 'はい', ko: '예' },
  { key: 'general.no', namespace: 'general', zhCN: '否', en: 'No', zhHK: '否', zhTW: '否', ja: 'いいえ', ko: '아니오' },
  { key: 'general.all', namespace: 'general', zhCN: '全部', en: 'All', zhHK: '全部', zhTW: '全部', ja: 'すべて', ko: '전체' },
  { key: 'general.none', namespace: 'general', zhCN: '无', en: 'None', zhHK: '無', zhTW: '無', ja: 'なし', ko: '없음' },
  { key: 'general.more', namespace: 'general', zhCN: '更多', en: 'More', zhHK: '更多', zhTW: '更多', ja: 'もっと見る', ko: '더보기' },
  { key: 'general.less', namespace: 'general', zhCN: '收起', en: 'Less', zhHK: '收起', zhTW: '收起', ja: '折りたたむ', ko: '접기' },
  { key: 'general.expand', namespace: 'general', zhCN: '展开', en: 'Expand', zhHK: '展開', zhTW: '展開', ja: '展開', ko: '펼치기' },
  { key: 'general.collapse', namespace: 'general', zhCN: '折叠', en: 'Collapse', zhHK: '折疊', zhTW: '折疊', ja: '折りたたむ', ko: '접기' },
  { key: 'general.preview', namespace: 'general', zhCN: '预览', en: 'Preview', zhHK: '預覽', zhTW: '預覽', ja: 'プレビュー', ko: '미리보기' },
  { key: 'general.detail', namespace: 'general', zhCN: '详情', en: 'Details', zhHK: '詳情', zhTW: '詳情', ja: '詳細', ko: '상세' },
  { key: 'general.view', namespace: 'general', zhCN: '查看', en: 'View', zhHK: '查看', zhTW: '查看', ja: '表示', ko: '보기' },
  { key: 'general.hide', namespace: 'general', zhCN: '隐藏', en: 'Hide', zhHK: '隱藏', zhTW: '隱藏', ja: '非表示', ko: '숨기기' },
  { key: 'general.show', namespace: 'general', zhCN: '显示', en: 'Show', zhHK: '顯示', zhTW: '顯示', ja: '表示', ko: '표시' },
  { key: 'general.required', namespace: 'general', zhCN: '必填', en: 'Required', zhHK: '必填', zhTW: '必填', ja: '必須', ko: '필수' },
  { key: 'general.optional', namespace: 'general', zhCN: '可选', en: 'Optional', zhHK: '可選', zhTW: '可選', ja: '任意', ko: '선택' },
  { key: 'general.add', namespace: 'general', zhCN: '添加', en: 'Add', zhHK: '添加', zhTW: '添加', ja: '追加', ko: '추가' },
  { key: 'general.remove', namespace: 'general', zhCN: '移除', en: 'Remove', zhHK: '移除', zhTW: '移除', ja: '削除', ko: '제거' },
  { key: 'general.create', namespace: 'general', zhCN: '创建', en: 'Create', zhHK: '創建', zhTW: '創建', ja: '作成', ko: '생성' },
  { key: 'general.update', namespace: 'general', zhCN: '更新', en: 'Update', zhHK: '更新', zhTW: '更新', ja: '更新', ko: '업데이트' },
  { key: 'general.rename', namespace: 'general', zhCN: '重命名', en: 'Rename', zhHK: '重命名', zhTW: '重命名', ja: '名前変更', ko: '이름변경' },
  { key: 'general.duplicate', namespace: 'general', zhCN: '复制副本', en: 'Duplicate', zhHK: '複製副本', zhTW: '複製副本', ja: '複製', ko: '복제' },
  { key: 'general.select_all', namespace: 'general', zhCN: '全选', en: 'Select All', zhHK: '全選', zhTW: '全選', ja: 'すべて選択', ko: '전체선택' },
  { key: 'general.deselect_all', namespace: 'general', zhCN: '取消全选', en: 'Deselect All', zhHK: '取消全選', zhTW: '取消全選', ja: '選択解除', ko: '전체해제' },
  { key: 'general.loading', namespace: 'general', zhCN: '加载中', en: 'Loading', zhHK: '加載中', zhTW: '加載中', ja: '読み込み中', ko: '로딩중' },
  { key: 'general.no_data', namespace: 'general', zhCN: '暂无数据', en: 'No Data', zhHK: '暫無數據', zhTW: '暫無數據', ja: 'データなし', ko: '데이터없음' },
  { key: 'general.no_results', namespace: 'general', zhCN: '无结果', en: 'No Results', zhHK: '無結果', zhTW: '無結果', ja: '結果なし', ko: '결과없음' },
  { key: 'general.retry', namespace: 'general', zhCN: '重试', en: 'Retry', zhHK: '重試', zhTW: '重試', ja: '再試行', ko: '재시도' },
  { key: 'general.success', namespace: 'general', zhCN: '操作成功', en: 'Success', zhHK: '操作成功', zhTW: '操作成功', ja: '成功', ko: '성공' },
  { key: 'general.failed', namespace: 'general', zhCN: '操作失败', en: 'Failed', zhHK: '操作失敗', zhTW: '操作失敗', ja: '失敗', ko: '실패' },
  { key: 'general.processing', namespace: 'general', zhCN: '处理中...', en: 'Processing...', zhHK: '處理中...', zhTW: '處理中...', ja: '処理中...', ko: '처리중...' },
  { key: 'general.tip', namespace: 'general', zhCN: '提示', en: 'Tip', zhHK: '提示', zhTW: '提示', ja: 'ヒント', ko: '팁' },
  { key: 'general.warning', namespace: 'general', zhCN: '警告', en: 'Warning', zhHK: '警告', zhTW: '警告', ja: '警告', ko: '경고' },
  { key: 'general.info', namespace: 'general', zhCN: '信息', en: 'Info', zhHK: '資訊', zhTW: '資訊', ja: '情報', ko: '정보' },
  { key: 'general.total', namespace: 'general', zhCN: '合计', en: 'Total', zhHK: '合計', zhTW: '合計', ja: '合計', ko: '합계' },
  { key: 'general.average', namespace: 'general', zhCN: '平均', en: 'Average', zhHK: '平均', zhTW: '平均', ja: '平均', ko: '평균' },
  { key: 'general.max', namespace: 'general', zhCN: '最大', en: 'Max', zhHK: '最大', zhTW: '最大', ja: '最大', ko: '최대' },
  { key: 'general.min', namespace: 'general', zhCN: '最小', en: 'Min', zhHK: '最小', zhTW: '最小', ja: '最小', ko: '최소' },
  { key: 'general.count', namespace: 'general', zhCN: '数量', en: 'Count', zhHK: '數量', zhTW: '數量', ja: '数', ko: '개수' },
  { key: 'general.percent', namespace: 'general', zhCN: '百分比', en: 'Percentage', zhHK: '百分比', zhTW: '百分比', ja: 'パーセント', ko: '퍼센트' },
  { key: 'general.day', namespace: 'general', zhCN: '天', en: 'Day', zhHK: '天', zhTW: '天', ja: '日', ko: '일' },
  { key: 'general.hour', namespace: 'general', zhCN: '小时', en: 'Hour', zhHK: '小時', zhTW: '小時', ja: '時間', ko: '시간' },
  { key: 'general.minute', namespace: 'general', zhCN: '分钟', en: 'Minute', zhHK: '分鐘', zhTW: '分鐘', ja: '分', ko: '분' },
  { key: 'general.second', namespace: 'general', zhCN: '秒', en: 'Second', zhHK: '秒', zhTW: '秒', ja: '秒', ko: '초' },
  { key: 'general.name', namespace: 'general', zhCN: '名称', en: 'Name', zhHK: '名稱', zhTW: '名稱', ja: '名前', ko: '이름' },
  { key: 'general.description', namespace: 'general', zhCN: '描述', en: 'Description', zhHK: '描述', zhTW: '描述', ja: '説明', ko: '설명' },
  { key: 'general.type', namespace: 'general', zhCN: '类型', en: 'Type', zhHK: '類型', zhTW: '類型', ja: 'タイプ', ko: '유형' },
  { key: 'general.status', namespace: 'general', zhCN: '状态', en: 'Status', zhHK: '狀態', zhTW: '狀態', ja: 'ステータス', ko: '상태' },
  { key: 'general.date', namespace: 'general', zhCN: '日期', en: 'Date', zhHK: '日期', zhTW: '日期', ja: '日付', ko: '날짜' },
  { key: 'general.time', namespace: 'general', zhCN: '时间', en: 'Time', zhHK: '時間', zhTW: '時間', ja: '時間', ko: '시간' },
  { key: 'general.language', namespace: 'general', zhCN: '语言', en: 'Language', zhHK: '語言', zhTW: '語言', ja: '言語', ko: '언어' },
  { key: 'general.hotkey', namespace: 'general', zhCN: '快捷键', en: 'Hotkey', zhHK: '快捷鍵', zhTW: '快捷鍵', ja: 'ショートカット', ko: '단축키' },
  { key: 'general.theme', namespace: 'general', zhCN: '主题', en: 'Theme', zhHK: '主題', zhTW: '主題', ja: 'テーマ', ko: '테마' },
  { key: 'general.dark_mode', namespace: 'general', zhCN: '暗色模式', en: 'Dark Mode', zhHK: '暗色模式', zhTW: '暗色模式', ja: 'ダークモード', ko: '다크모드' },
  { key: 'general.light_mode', namespace: 'general', zhCN: '亮色模式', en: 'Light Mode', zhHK: '亮色模式', zhTW: '亮色模式', ja: 'ライトモード', ko: '라이트모드' },
  { key: 'general.color_blind', namespace: 'general', zhCN: '色盲模式', en: 'Color Blind Mode', zhHK: '色盲模式', zhTW: '色盲模式', ja: '色覚モード', ko: '색맹모드' },
  { key: 'general.version', namespace: 'general', zhCN: '版本', en: 'Version', zhHK: '版本', zhTW: '版本', ja: 'バージョン', ko: '버전' },
  { key: 'general.about', namespace: 'general', zhCN: '关于', en: 'About', zhHK: '關於', zhTW: '關於', ja: 'について', ko: '정보' },
  { key: 'general.help', namespace: 'general', zhCN: '帮助', en: 'Help', zhHK: '幫助', zhTW: '幫助', ja: 'ヘルプ', ko: '도움말' },
  { key: 'general.feedback', namespace: 'general', zhCN: '反馈', en: 'Feedback', zhHK: '反饋', zhTW: '回饋', ja: 'フィードバック', ko: '피드백' },

  // ── billing (付费) ────────────────────────────────────────────────────────
  { key: 'billing.free', namespace: 'billing', zhCN: '免费', en: 'Free', zhHK: '免費', zhTW: '免費', ja: '無料', ko: '무료' },
  { key: 'billing.paid', namespace: 'billing', zhCN: '付费', en: 'Paid', zhHK: '付費', zhTW: '付費', ja: '有料', ko: '유료' },
  { key: 'billing.price', namespace: 'billing', zhCN: '价格', en: 'Price', zhHK: '價格', zhTW: '價格', ja: '価格', ko: '가격' },
  { key: 'billing.buy', namespace: 'billing', zhCN: '购买', en: 'Buy', zhHK: '購買', zhTW: '購買', ja: '購入', ko: '구매' },
  { key: 'billing.subscribe', namespace: 'billing', zhCN: '订阅', en: 'Subscribe', zhHK: '訂閱', zhTW: '訂閱', ja: '購読', ko: '구독' },
  { key: 'billing.unlock', namespace: 'billing', zhCN: '解锁', en: 'Unlock', zhHK: '解鎖', zhTW: '解鎖', ja: 'ロック解除', ko: '잠금해제' },
  { key: 'billing.balance', namespace: 'billing', zhCN: '余额', en: 'Balance', zhHK: '餘額', zhTW: '餘額', ja: '残高', ko: '잔액' },
  { key: 'billing.top_up', namespace: 'billing', zhCN: '充值', en: 'Top Up', zhHK: '充值', zhTW: '充值', ja: 'チャージ', ko: '충전' },
  { key: 'billing.withdraw', namespace: 'billing', zhCN: '提现', en: 'Withdraw', zhHK: '提現', zhTW: '提現', ja: '出金', ko: '출금' },
  { key: 'billing.transaction', namespace: 'billing', zhCN: '交易记录', en: 'Transaction', zhHK: '交易記錄', zhTW: '交易記錄', ja: '取引履歴', ko: '거래내역' },
  { key: 'billing.revenue', namespace: 'billing', zhCN: '收益', en: 'Revenue', zhHK: '收益', zhTW: '收益', ja: '収益', ko: '수익' },
  { key: 'billing.commission', namespace: 'billing', zhCN: '佣金', en: 'Commission', zhHK: '佣金', zhTW: '佣金', ja: '手数料', ko: '수수료' },
  { key: 'billing.platform_fee', namespace: 'billing', zhCN: '平台抽成', en: 'Platform Fee', zhHK: '平台抽成', zhTW: '平台抽成', ja: 'プラットフォーム手数料', ko: '플랫폼수수료' },
  { key: 'billing.creator_share', namespace: 'billing', zhCN: '创作者分成', en: 'Creator Share', zhHK: '創作者分成', zhTW: '創作者分成', ja: 'クリエイター分配', ko: '크리에이터몫' },
  { key: 'billing.usdt', namespace: 'billing', zhCN: 'USDT', en: 'USDT' },
  { key: 'billing.paywall_title', namespace: 'billing', zhCN: '付费解锁完整功能', en: 'Pay to Unlock Full Features', zhHK: '付費解鎖完整功能', zhTW: '付費解鎖完整功能', ja: '全機能をアンロック', ko: '전체기능잠금해제' },
  { key: 'billing.trial_credit', namespace: 'billing', zhCN: '体验金', en: 'Trial Credit', zhHK: '體驗金', zhTW: '體驗金', ja: 'トライアルクレジット', ko: '체험크레딧' },
  { key: 'billing.monthly', namespace: 'billing', zhCN: '月付', en: 'Monthly', zhHK: '月付', zhTW: '月付', ja: '月額', ko: '월간' },
  { key: 'billing.annual', namespace: 'billing', zhCN: '年付', en: 'Annual', zhHK: '年付', zhTW: '年付', ja: '年額', ko: '연간' },
  { key: 'billing.lifetime', namespace: 'billing', zhCN: '永久', en: 'Lifetime', zhHK: '永久', zhTW: '永久', ja: '永久', ko: '평생' },

  // ── settings (设置) ──────────────────────────────────────────────────────
  { key: 'settings.title', namespace: 'settings', zhCN: '设置', en: 'Settings', zhHK: '設置', zhTW: '設置', ja: '設定', ko: '설정' },
  { key: 'settings.general', namespace: 'settings', zhCN: '通用设置', en: 'General', zhHK: '通用設置', zhTW: '通用設置', ja: '一般設定', ko: '일반설정' },
  { key: 'settings.chart', namespace: 'settings', zhCN: '图表设置', en: 'Chart Settings', zhHK: '圖表設置', zhTW: '圖表設置', ja: 'チャート設定', ko: '차트설정' },
  { key: 'settings.notification', namespace: 'settings', zhCN: '通知设置', en: 'Notification', zhHK: '通知設置', zhTW: '通知設置', ja: '通知設定', ko: '알림설정' },
  { key: 'settings.account', namespace: 'settings', zhCN: '账户设置', en: 'Account', zhHK: '賬戶設置', zhTW: '賬戶設置', ja: 'アカウント設定', ko: '계정설정' },
  { key: 'settings.api', namespace: 'settings', zhCN: 'API设置', en: 'API Settings', zhHK: 'API設置', zhTW: 'API設置', ja: 'API設定', ko: 'API설정' },
  { key: 'settings.data', namespace: 'settings', zhCN: '数据设置', en: 'Data Settings', zhHK: '數據設置', zhTW: '數據設置', ja: 'データ設定', ko: '데이터설정' },
  { key: 'settings.privacy', namespace: 'settings', zhCN: '隐私设置', en: 'Privacy', zhHK: '隱私設置', zhTW: '隱私設置', ja: 'プライバシー設定', ko: '개인정보설정' },
  { key: 'settings.restore_default', namespace: 'settings', zhCN: '恢复默认', en: 'Restore Default', zhHK: '恢復默認', zhTW: '恢復默認', ja: 'デフォルトに戻す', ko: '기본값복원' },
  { key: 'settings.saved', namespace: 'settings', zhCN: '设置已保存', en: 'Settings Saved', zhHK: '設置已保存', zhTW: '設置已保存', ja: '設定を保存しました', ko: '설정저장됨' },

  // ── error (错误) ──────────────────────────────────────────────────────────
  { key: 'error.network', namespace: 'error', zhCN: '网络错误，请检查网络连接后重试', en: 'Network error. Check your connection and retry.', zhHK: '網絡錯誤，請檢查網絡連接後重試', zhTW: '網絡錯誤，請檢查網絡連接後重試', ja: 'ネットワークエラー。接続を確認して再試行してください。', ko: '네트워크오류. 연결을 확인하고 다시 시도하세요.' },
  { key: 'error.timeout', namespace: 'error', zhCN: '请求超时', en: 'Request Timeout', zhHK: '請求超時', zhTW: '請求超時', ja: 'リクエストタイムアウト', ko: '요청시간초과' },
  { key: 'error.unauthorized', namespace: 'error', zhCN: '无权限访问', en: 'Unauthorized', zhHK: '無權限訪問', zhTW: '無權限訪問', ja: 'アクセス権限なし', ko: '권한없음' },
  { key: 'error.server_error', namespace: 'error', zhCN: '服务器错误', en: 'Server Error', zhHK: '服務器錯誤', zhTW: '服務器錯誤', ja: 'サーバーエラー', ko: '서버오류' },
  { key: 'error.data_not_available', namespace: 'error', zhCN: '数据不可用', en: 'Data Not Available', zhHK: '數據不可用', zhTW: '數據不可用', ja: 'データ利用不可', ko: '데이터사용불가' },
  { key: 'error.quote_failed', namespace: 'error', zhCN: '行情获取失败', en: 'Quote Failed', zhHK: '行情獲取失敗', zhTW: '行情獲取失敗', ja: '相場取得失敗', ko: '시세조회실패' },
  { key: 'error.symbol_not_found', namespace: 'error', zhCN: '股票代码未找到', en: 'Symbol Not Found', zhHK: '股票代碼未找到', zhTW: '股票代碼未找到', ja: '銘柄が見つかりません', ko: '종목코드를 찾을 수 없습니다' },

  // ── ai (AI分析) ───────────────────────────────────────────────────────────
  { key: 'ai.analyze', namespace: 'ai', zhCN: 'AI分析', en: 'AI Analyze', zhHK: 'AI分析', zhTW: 'AI分析', ja: 'AI分析', ko: 'AI분석' },
  { key: 'ai.analyzing', namespace: 'ai', zhCN: 'AI分析中...', en: 'Analyzing...', zhHK: 'AI分析中...', zhTW: 'AI分析中...', ja: '分析中...', ko: '분석중...' },
  { key: 'ai.result', namespace: 'ai', zhCN: 'AI分析结果', en: 'AI Analysis Result', zhHK: 'AI分析結果', zhTW: 'AI分析結果', ja: 'AI分析結果', ko: 'AI분석결과' },
  { key: 'ai.confidence', namespace: 'ai', zhCN: '置信度', en: 'Confidence', zhHK: '置信度', zhTW: '置信度', ja: '信頼度', ko: '신뢰도' },
  { key: 'ai.bullish', namespace: 'ai', zhCN: '看涨', en: 'Bullish', zhHK: '看漲', zhTW: '看漲', ja: '強気', ko: '강세' },
  { key: 'ai.bearish', namespace: 'ai', zhCN: '看跌', en: 'Bearish', zhHK: '看跌', zhTW: '看跌', ja: '弱気', ko: '약세' },
  { key: 'ai.pattern_recognition', namespace: 'ai', zhCN: '形态识别', en: 'Pattern Recognition', zhHK: '形態識別', zhTW: '形態識別', ja: 'パターン認識', ko: '패턴인식' },
  { key: 'ai.trade_setup', namespace: 'ai', zhCN: '交易设置', en: 'Trade Setup', zhHK: '交易設置', zhTW: '交易設置', ja: 'トレードセットアップ', ko: '트레이드셋업' },
  { key: 'ai.risk_assessment', namespace: 'ai', zhCN: '风险评估', en: 'Risk Assessment', zhHK: '風險評估', zhTW: '風險評估', ja: 'リスク評価', ko: '위험평가' },
  { key: 'ai.multi_tf', namespace: 'ai', zhCN: '多周期分析', en: 'Multi-timeframe', zhHK: '多週期分析', zhTW: '多週期分析', ja: 'マルチタイムフレーム', ko: '멀티타임프레임' },
  { key: 'ai.comprehensive', namespace: 'ai', zhCN: '综合分析', en: 'Comprehensive', zhHK: '綜合分析', zhTW: '綜合分析', ja: '総合分析', ko: '종합분석' },
  { key: 'ai.report', namespace: 'ai', zhCN: 'AI报告', en: 'AI Report', zhHK: 'AI報告', zhTW: 'AI報告', ja: 'AIレポート', ko: 'AI리포트' },
  { key: 'ai.report_export', namespace: 'ai', zhCN: '导出AI报告', en: 'Export AI Report', zhHK: '導出AI報告', zhTW: '導出AI報告', ja: 'AIレポートをエクスポート', ko: 'AI리포트내보내기' },
  { key: 'ai.disclaimer', namespace: 'ai', zhCN: 'AI分析仅供参考，不构成投资建议', en: 'AI analysis is for reference only. Not investment advice.', zhHK: 'AI分析僅供參考，不構成投資建議', zhTW: 'AI分析僅供參考，不構成投資建議', ja: 'AI分析は参考情報です。投資助言ではありません。', ko: 'AI분석은 참고용이며 투자 조언이 아닙니다.' },
  { key: 'ai.cost_per_use', namespace: 'ai', zhCN: '{{cost}} USDT/次', en: '{{cost}} USDT/use', zhHK: '{{cost}} USDT/次', zhTW: '{{cost}} USDT/次', ja: '{{cost}} USDT/回', ko: '{{cost}} USDT/회' },

  // ── strategy (策略) — placed in factor namespace ──────────────────────────
  { key: 'factor.strategy', namespace: 'factor', zhCN: '策略', en: 'Strategy', zhHK: '策略', zhTW: '策略', ja: '戦略', ko: '전략' },
  { key: 'factor.template', namespace: 'factor', zhCN: '模板', en: 'Template', zhHK: '模板', zhTW: '模板', ja: 'テンプレート', ko: '템플릿' },
  { key: 'factor.marketplace', namespace: 'factor', zhCN: '市场', en: 'Marketplace', zhHK: '市場', zhTW: '市場', ja: 'マーケットプレイス', ko: '마켓플레이스' },
  { key: 'factor.rating', namespace: 'factor', zhCN: '评分', en: 'Rating', zhHK: '評分', zhTW: '評分', ja: '評価', ko: '평점' },
  { key: 'factor.creator_tier', namespace: 'factor', zhCN: '创作者等级', en: 'Creator Tier', zhHK: '創作者等級', zhTW: '創作者等級', ja: 'クリエイターランク', ko: '크리에이터등급' },
];

// ═══════════════════════════════════════════════════════════════════════════
// I18nBridge Implementation
// ═══════════════════════════════════════════════════════════════════════════

export class I18nBridge {
  private _currentLocale: LocaleCode = 'zh-CN';
  /** translations[locale][namespace][key] = value */
  private _translations: Map<string, Map<string, Map<string, string>>> = new Map();
  /** Missing keys tracking: Set<locale.key> */
  private _missingKeys: Set<string> = new Set();
  /** Number of keys registered */
  private _totalKeys = 0;

  constructor() {
    this._initStore();
    this._registerPrebuilt();
  }

  // ── Store initialization ──────────────────────────────────────────────────

  private _initStore(): void {
    for (const loc of ALL_LOCALES) {
      const nsMap = new Map<string, Map<string, string>>();
      for (const ns of ALL_NAMESPACES) {
        nsMap.set(ns, new Map());
      }
      this._translations.set(loc, nsMap);
    }
  }

  // ── Pre-built translations ────────────────────────────────────────────────

  private _registerPrebuilt(): void {
    for (const entry of PREBUILT_TRANSLATIONS) {
      this._upsertEntry(entry);
    }
    this._totalKeys = PREBUILT_TRANSLATIONS.length;
  }

  private _upsertEntry(entry: TranslationEntry): void {
    const locMap: Record<string, string | undefined> = {
      'zh-CN': entry.zhCN,
      'zh-HK': entry.zhHK,
      'zh-TW': entry.zhTW,
      en: entry.en,
      ja: entry.ja,
      ko: entry.ko,
      fr: entry.fr,
      it: entry.it,
      de: entry.de,
      es: entry.es,
      ru: entry.ru,
    };

    for (const loc of ALL_LOCALES) {
      const val = locMap[loc];
      if (val && val.trim()) {
        this._translations.get(loc)!.get(entry.namespace)!.set(entry.key, val);
      } else if (loc !== 'zh-CN') {
        this._missingKeys.add(`${loc}.${entry.key}`);
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Get translation for key in current locale (with optional param interpolation) */
  getText(key: string, params?: Record<string, string | number>, locale?: LocaleCode): string {
    const loc = locale || this._currentLocale;
    // Try exact key match
    let text = this._lookup(loc, key);
    // Fallback to zh-CN
    if (!text) {
      text = this._lookup('zh-CN', key);
    }
    // Fallback to key itself
    if (!text) {
      text = key.includes('.') ? key.split('.').pop() || key : key;
    }
    // Param interpolation: {{param}} → value
    if (params) {
      text = text.replace(/\{\{(\w+)\}\}/g, (_, p) => String(params[p] ?? `{{${p}}}`));
    }
    return text;
  }

  /** Batch get translations */
  getTexts(keys: string[], locale?: LocaleCode): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = this.getText(key, undefined, locale);
    }
    return result;
  }

  private _lookup(locale: string, key: string): string | null {
    // Full key: "namespace.subkey"
    const dotIdx = key.indexOf('.');
    if (dotIdx > 0) {
      const ns = key.slice(0, dotIdx);
      const sub = key.slice(dotIdx + 1);
      const nsMap = this._translations.get(locale);
      if (nsMap) {
        const keyMap = nsMap.get(ns);
        if (keyMap && keyMap.has(sub)) return keyMap.get(sub)!;
        // Try full key in the namespace map (for flat keys)
        if (keyMap && keyMap.has(key)) return keyMap.get(key)!;
      }
    }
    // Search all namespaces
    const nsMap = this._translations.get(locale);
    if (nsMap) {
      for (const [, keyMap] of nsMap) {
        if (keyMap.has(key)) return keyMap.get(key)!;
      }
    }
    return null;
  }

  /** Set current locale */
  setLocale(locale: LocaleCode): void {
    this._currentLocale = locale;
  }

  /** Get current locale */
  getLocale(): LocaleCode {
    return this._currentLocale;
  }

  /** Get all supported locales */
  getLocales(): { code: LocaleCode; label: string }[] {
    const labels: Record<LocaleCode, string> = {
      'zh-CN': '简体中文',
      'zh-HK': '香港繁體',
      'zh-TW': '台灣繁體',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
      fr: 'Français',
      it: 'Italiano',
      de: 'Deutsch',
      es: 'Español',
      ru: 'Русский',
    };
    return ALL_LOCALES.map(code => ({ code, label: labels[code] }));
  }

  /** Register a single translation entry */
  register(entry: TranslationEntry): void {
    this._upsertEntry(entry);
    this._totalKeys = Math.max(this._totalKeys, PREBUILT_TRANSLATIONS.length + 1);
  }

  /** Batch register translations (for 23K migration) */
  registerBatch(entries: TranslationEntry[]): { registered: number; newKeys: number } {
    const before = this._totalKeys;
    for (const entry of entries) {
      this._upsertEntry(entry);
    }
    this._totalKeys += entries.length;
    return { registered: entries.length, newKeys: this._totalKeys - before };
  }

  /** Get missing keys for a locale, optionally filtered by namespace */
  getMissingKeys(locale: LocaleCode, namespace?: Namespace): { key: string; zhCN: string; namespace: string }[] {
    const prefix = namespace ? `${locale}.${namespace}.` : `${locale}.`;
    const result: { key: string; zhCN: string; namespace: string }[] = [];

    for (const mk of this._missingKeys) {
      if (mk.startsWith(prefix)) {
        const parts = mk.split('.');
        const loc = parts[0];
        const ns = namespace || parts[1] || '';
        const key = namespace ? parts.slice(2).join('.') : parts.slice(1).join('.');
        const zhCN = this._lookup('zh-CN', `${ns}.${key}`) || '';
        if (locale === loc) {
          result.push({ key: `${ns}.${key}`, zhCN, namespace: ns });
        }
      }
    }
    return result;
  }

  /** Get comprehensive translation stats */
  getStats(): I18nStats {
    const byLocale: I18nStats['byLocale'] = {};
    const nsTotals: Record<string, { total: number; translated: number }> = {};
    for (const ns of ALL_NAMESPACES) {
      nsTotals[ns] = { total: 0, translated: 0 };
    }

    // Count zh-CN keys per namespace
    const zhMap = this._translations.get('zh-CN')!;
    for (const [ns, keyMap] of zhMap) {
      nsTotals[ns].total += keyMap.size;
    }

    // Per locale stats
    for (const loc of ALL_LOCALES) {
      let translated = 0;
      const locMap = this._translations.get(loc)!;
      for (const [ns, keyMap] of locMap) {
        translated += keyMap.size;
        if (loc !== 'zh-CN') {
          // Track translated per namespace for non-source locales
        }
      }
      const total = this._totalKeys;
      byLocale[loc] = {
        total,
        translated: loc === 'zh-CN' ? total : translated,
        completionPercent: loc === 'zh-CN' ? 100 : total > 0 ? Math.round((translated / total) * 100) : 0,
      };
    }

    const byNamespace: NamespaceStats[] = [];
    const topMissing: I18nStats['topMissing'] = [];

    for (const [ns, counts] of Object.entries(nsTotals)) {
      let enTranslated = 0;
      const enMap = this._translations.get('en')?.get(ns);
      if (enMap) enTranslated = enMap.size;
      const missing = counts.total - enTranslated;
      byNamespace.push({
        namespace: ns as Namespace,
        total: counts.total,
        translated: enTranslated,
        missing,
        completionPercent: counts.total > 0 ? Math.round((enTranslated / counts.total) * 100) : 0,
      });
      if (missing > 0) {
        topMissing.push({ namespace: ns as Namespace, missing });
      }
    }

    topMissing.sort((a, b) => b.missing - a.missing);

    return { totalKeys: this._totalKeys, byLocale, byNamespace, topMissing: topMissing.slice(0, 5) };
  }

  /** Generate a stable i18n key from Chinese text (MD5 first 8 chars) */
  generateKey(zhText: string, namespace: Namespace): string {
    return generateKey(zhText, namespace);
  }

  /** Export translations for a locale as JSON */
  exportToJson(locale: LocaleCode): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    const locMap = this._translations.get(locale);
    if (!locMap) return result;
    for (const [ns, keyMap] of locMap) {
      if (keyMap.size === 0) continue;
      result[ns] = {};
      for (const [key, val] of keyMap) {
        result[ns][key] = val;
      }
    }
    return result;
  }

  /** Import translations from JSON */
  importFromJson(locale: LocaleCode, data: Record<string, Record<string, string>>): number {
    let count = 0;
    const locMap = this._translations.get(locale);
    if (!locMap) return count;
    for (const [ns, keyVals] of Object.entries(data)) {
      const nsMap = locMap.get(ns);
      if (!nsMap) continue;
      for (const [key, val] of Object.entries(keyVals)) {
        nsMap.set(key, val);
        // Remove from missing if now exists
        this._missingKeys.delete(`${locale}.${ns}.${key}`);
        this._missingKeys.delete(`${locale}.${key}`);
        count++;
      }
    }
    return count;
  }

  /** Save translations to locale JSON files */
  saveToFiles(dirPath: string): { saved: string[]; errors: string[] } {
    const saved: string[] = [];
    const errors: string[] = [];
    for (const loc of ALL_LOCALES) {
      if (loc === 'zh-CN') continue; // zh-CN is source, skip
      try {
        const data = this.exportToJson(loc);
        const filePath = path.join(dirPath, `${loc}.json`);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        saved.push(filePath);
      } catch (e: any) {
        errors.push(`${loc}: ${e.message}`);
      }
    }
    return { saved, errors };
  }

  /** Load translations from locale JSON files */
  loadFromFiles(dirPath: string): { loaded: number; errors: string[] } {
    let loaded = 0;
    const errors: string[] = [];
    for (const loc of ALL_LOCALES) {
      try {
        const filePath = path.join(dirPath, `${loc}.json`);
        if (!fs.existsSync(filePath)) continue;
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        loaded += this.importFromJson(loc, data);
      } catch (e: any) {
        if (e.code !== 'ENOENT') {
          errors.push(`${loc}: ${e.message}`);
        }
      }
    }
    return { loaded, errors };
  }

  /** Scan and register hardcoded Chinese strings from source code */
  scanHardcoded(filePath: string, content: string, namespace?: Namespace): ScanResult {
    const matches: ScanResult['matches'] = [];
    // Match Chinese characters in string literals (single/double quote, template literal)
    const chineseRegex = /['"`]([^'"`]*[\u4e00-\u9fff][^'"`]*)['"`]/g;
    // Also match JSX text: >中文< or >中文{
    const jsxRegex = />([^<{]*[\u4e00-\u9fff][^<{]*?)</g;

    let match: RegExpExecArray | null;
    const lineMap = content.split('\n');

    const processMatch = (text: string, line: number) => {
      const trimmed = text.trim();
      if (trimmed.length < 2) return; // Skip single-char
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) return; // Skip comments
      if (/^[0-9.,%+\-*/=<>!&|^~:;()\[\]{}@#$ ]+$/.test(trimmed)) return; // Skip pure symbols/numbers

      // Guess namespace from file path
      const ns = namespace || this._guessNamespace(filePath);

      const key = generateKey(trimmed, ns);
      const existing = this._lookup('zh-CN', `${ns}.${key.split('.').pop()}`);
      // Only add if not already registered
      if (!existing) {
        this.register({
          key: `${ns}.${key}`,
          namespace: ns,
          zhCN: trimmed,
          sourceFile: filePath,
          sourceLine: line,
        });
        matches.push({ line, text: trimmed, suggestedNamespace: ns });
      }
    };

    while ((match = chineseRegex.exec(content)) !== null) {
      const text = match[1];
      const beforePos = match.index;
      const line = lineMap.findIndex((l, i) => {
        const offset = lineMap.slice(0, i).reduce((s, l) => s + l.length + 1, 0);
        return offset > beforePos;
      });
      processMatch(text, line > 0 ? line : 1);
    }

    while ((match = jsxRegex.exec(content)) !== null) {
      const text = match[1];
      const beforePos = match.index;
      const line = lineMap.findIndex((l, i) => {
        const offset = lineMap.slice(0, i).reduce((s, l) => s + l.length + 1, 0);
        return offset > beforePos;
      });
      processMatch(text, line > 0 ? line : 1);
    }

    return { file: filePath, matches, totalMatches: matches.length };
  }

  private _guessNamespace(filePath: string): Namespace {
    const lower = filePath.toLowerCase();
    if (lower.includes('chart') || lower.includes('kline') || lower.includes('candle') || lower.includes('footprint')) return 'chart';
    if (lower.includes('drawing') || lower.includes('draw')) return 'drawing';
    if (lower.includes('indicator') || lower.includes('ta_')) return 'indicator';
    if (lower.includes('factor')) return 'factor';
    if (lower.includes('market') || lower.includes('stock') || lower.includes('quote') || lower.includes('ticker')) return 'market';
    if (lower.includes('community') || lower.includes('share') || lower.includes('social')) return 'community';
    if (lower.includes('news') || lower.includes('briefing') || lower.includes('telegraph')) return 'news';
    if (lower.includes('billing') || lower.includes('pay') || lower.includes('price') || lower.includes('subscription')) return 'billing';
    if (lower.includes('setting') || lower.includes('config') || lower.includes('preference')) return 'settings';
    if (lower.includes('error') || lower.includes('exception')) return 'error';
    if (lower.includes('ai') || lower.includes('llm') || lower.includes('gpt') || lower.includes('analy')) return 'ai';
    return 'general';
  }

  /** Estimate how many files still need i18n migration */
  estimateMigrationProgress(): { scannedFiles: number; estimatedTotal: number; percent: number } {
    const estimatedTotal = 23000; // ~9.7K frontend + ~13.7K backend
    const percent = Math.min(100, Math.round((this._totalKeys / estimatedTotal) * 100));
    return { scannedFiles: 0, estimatedTotal, percent };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════════

let _bridge: I18nBridge | null = null;

export function getI18nBridge(): I18nBridge {
  if (!_bridge) {
    _bridge = new I18nBridge();
  }
  return _bridge;
}

export function resetI18nBridge(): void {
  _bridge = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC Registration
// ═══════════════════════════════════════════════════════════════════════════

export const I18N_IPC_CHANNELS = {
  GET_TEXT: 'i18n:getText',
  GET_TEXTS: 'i18n:getTexts',
  GET_LOCALE: 'i18n:getLocale',
  SET_LOCALE: 'i18n:setLocale',
  GET_LOCALES: 'i18n:getLocales',
  REGISTER_BATCH: 'i18n:registerBatch',
  GET_MISSING_KEYS: 'i18n:getMissingKeys',
  GET_STATS: 'i18n:getStats',
  GENERATE_KEY: 'i18n:generateKey',
  EXPORT_FILE: 'i18n:exportFile',
  IMPORT_FILE: 'i18n:importFile',
  SCAN_HARDCODED: 'i18n:scanHardcoded',
} as const;

/**
 * Register all i18n IPC handlers. Called from Electron main process.
 * Gracefully degrades if ipcMain is unavailable (e.g., in test environments).
 */
export function registerI18nIpcHandlers(): void {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    // Test environment — skip IPC registration
    return;
  }

  const bridge = getI18nBridge();

  // i18n:getText (key, locale?, params?)
  ipcMain.handle(I18N_IPC_CHANNELS.GET_TEXT, (_event, key: string, locale?: LocaleCode, params?: Record<string, string | number>) => {
    return bridge.getText(key, params, locale);
  });

  // i18n:getTexts (keys[], locale?)
  ipcMain.handle(I18N_IPC_CHANNELS.GET_TEXTS, (_event, keys: string[], locale?: LocaleCode) => {
    return bridge.getTexts(keys, locale);
  });

  // i18n:getLocale
  ipcMain.handle(I18N_IPC_CHANNELS.GET_LOCALE, () => bridge.getLocale());

  // i18n:setLocale
  ipcMain.handle(I18N_IPC_CHANNELS.SET_LOCALE, (_event, locale: LocaleCode) => {
    bridge.setLocale(locale);
    return bridge.getLocale();
  });

  // i18n:getLocales
  ipcMain.handle(I18N_IPC_CHANNELS.GET_LOCALES, () => bridge.getLocales());

  // i18n:registerBatch
  ipcMain.handle(I18N_IPC_CHANNELS.REGISTER_BATCH, (_event, entries: TranslationEntry[]) => {
    return bridge.registerBatch(entries);
  });

  // i18n:getMissingKeys
  ipcMain.handle(I18N_IPC_CHANNELS.GET_MISSING_KEYS, (_event, locale: LocaleCode, namespace?: Namespace) => {
    return bridge.getMissingKeys(locale, namespace);
  });

  // i18n:getStats
  ipcMain.handle(I18N_IPC_CHANNELS.GET_STATS, () => bridge.getStats());

  // i18n:generateKey
  ipcMain.handle(I18N_IPC_CHANNELS.GENERATE_KEY, (_event, zhText: string, namespace: Namespace) => {
    return bridge.generateKey(zhText, namespace);
  });

  // i18n:exportFile
  ipcMain.handle(I18N_IPC_CHANNELS.EXPORT_FILE, (_event, dirPath: string) => {
    return bridge.saveToFiles(dirPath);
  });

  // i18n:importFile
  ipcMain.handle(I18N_IPC_CHANNELS.IMPORT_FILE, (_event, dirPath: string) => {
    return bridge.loadFromFiles(dirPath);
  });

  // i18n:scanHardcoded
  ipcMain.handle(I18N_IPC_CHANNELS.SCAN_HARDCODED, (_event, filePath: string, content: string, namespace?: Namespace) => {
    return bridge.scanHardcoded(filePath, content, namespace);
  });
}
