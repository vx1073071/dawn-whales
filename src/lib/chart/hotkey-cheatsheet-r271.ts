// ══ R271 QClaw Task 3: 快捷键提示卡 (2h) ══
// 可打印/可嵌入的完整快捷键参考卡
// 按?键弹出的帮助面板文案

export const HOTKEY_CHEATSHEET = {

  title: "⌨️ 快捷键速查",
  subtitle: "按 ? 随时打开此面板",
  tip: "记住6个招牌键——其他的按?再看",

  // ══ 6组分类 ══
  groups: [

    // ── 招牌6键 — 最常用，首次弹窗优先展示 ──
    {
      name: "招牌键",
      emoji: "⭐",
      intro: "记住这6个——够用了",
      keys: [
        { key: "T",    action: "画趋势线",       detail: "在图表上两点连线" },
        { key: "H",    action: "画水平线",       detail: "点击价格位画水平线" },
        { key: "V",    action: "画竖线",         detail: "标记关键时间点" },
        { key: "I",    action: "指标面板",       detail: "打开93个指标库" },
        { key: "1-5",  action: "加载指标模板",    detail: "1小白 2MACD 3BOLL 4KDJ 5进阶" },
        { key: "?",    action: "快捷键帮助",     detail: "你正在看的这个面板" },
      ],
    },

    // ── 图表操作 ──
    {
      name: "图表",
      emoji: "📊",
      keys: [
        { key: "←→",      action: "前后移动",      detail: "移动K线时间轴" },
        { key: "↑↓",      action: "缩放",          detail: "上下缩放价格轴" },
        { key: "Shift+滚轮", action: "水平滚动",     detail: "快速浏览历史K线" },
        { key: "Ctrl+滚轮",  action: "时间缩放",     detail: "放大/缩小K线周期" },
        { key: "R",          action: "恢复默认",     detail: "回到最新K线" },
        { key: "F",          action: "全屏图表",     detail: "隐藏所有面板" },
        { key: "空格",       action: "切换十字光标",  detail: "精确读K线数据" },
      ],
    },

    // ── 画线工具 ──
    {
      name: "画线",
      emoji: "✏️",
      keys: [
        { key: "T",       action: "趋势线",       detail: "两点连线" },
        { key: "H",       action: "水平线",       detail: "关键价位" },
        { key: "V",       action: "竖线",         detail: "时间标注" },
        { key: "F2",      action: "斐波那契回调",  detail: "0.382/0.5/0.618" },
        { key: "F3",      action: "斐波那契扩展",  detail: "1.272/1.618目标" },
        { key: "F4",      action: "矩形",         detail: "框交易区间" },
        { key: "F5",      action: "三角形",       detail: "三角整理" },
        { key: "F6",      action: "文字标注",     detail: "在图表上写文字" },
        { key: "Shift+T", action: "测量工具",     detail: "量价格差+K线数" },
        { key: "F7",      action: "安德鲁叉",     detail: "三点中线" },
        { key: "F8",      action: "回归趋势",     detail: "最小二乘趋势线" },
      ],
    },

    // ── 画线时操作 ──
    {
      name: "画线中",
      emoji: "🎯",
      keys: [
        { key: "Shift",    action: "吸附水平/垂直",  detail: "按住Shift=线条自动水平或垂直" },
        { key: "Ctrl",     action: "吸附OHLC",       detail: "吸附到K线的开/高/低/收价格" },
        { key: "ESC",      action: "取消",           detail: "取消正在画的线" },
        { key: "双击",     action: "完成",           detail: "双击完成画线" },
        { key: "右键",     action: "转成策略",        detail: "把画线变成交易策略" },
        { key: "Delete",   action: "删除",           detail: "删除选中的画线" },
        { key: "Ctrl+Z",   action: "撤销",           detail: "撤销上一步操作" },
      ],
    },

    // ── 指标/视图 ──
    {
      name: "指标",
      emoji: "📈",
      keys: [
        { key: "I",       action: "打开指标库",     detail: "93个指标在这里" },
        { key: "1",       action: "模板1: 小白",    detail: "SMA+EMA+成交量" },
        { key: "2",       action: "模板2: 散户",    detail: "MACD+RSI+成交量" },
        { key: "3",       action: "模板3: 波段",    detail: "BOLL+MACD+ATR" },
        { key: "4",       action: "模板4: A股",     detail: "KDJ+BBI+主力控盘" },
        { key: "5",       action: "模板5: 进阶",    detail: "Supertrend+ADX+CMF" },
        { key: "0",       action: "清空指标",       detail: "移除图表上所有指标" },
        { key: "D",       action: "切换暗色/亮色",   detail: "日间/夜间模式" },
      ],
    },

    // ── 面板/Panel ──
    {
      name: "面板",
      emoji: "🗂️",
      keys: [
        { key: "W",       action: "自选列表",       detail: "你关注的股票" },
        { key: "M",       action: "主力追踪",       detail: "资金流向面板" },
        { key: "N",       action: "新闻面板",       detail: "相关新闻+公告" },
        { key: "P",       action: "策略列表",       detail: "你的所有策略" },
        { key: "S",       action: "信号广场",       detail: "社区分析面板" },
        { key: "Ctrl+F",  action: "搜索股票",       detail: "快速切换股票" },
        { key: "Ctrl+K",  action: "全局搜索",       detail: "搜股票/指标/策略" },
      ],
    },
  ],

  // ── 提示卡底部 ──
  footer: {
    close: "按 ESC 或 ? 关闭",
    more: "更多快捷键: 设置 → 快捷键 → 自定义",
    printable: "本页面可打印 — 贴屏幕旁边",
  },
};

// ── 首次弹窗引导 (只展示招牌6键) ──
export const HOTKEY_FIRST_TIME = {
  title: "⌨️ 记住6个键 — 够用了",
  subtitle: "QUANT MOO完全可以用键盘操作",
  keys: [
    { key: "T",  desc: "画趋势线" },
    { key: "I",  desc: "打开指标库" },
    { key: "1-5", desc: "加载指标模板" },
    { key: "空格", desc: "十字光标" },
    { key: "D",  desc: "暗色模式" },
    { key: "?",  desc: "看全部快捷键" },
  ],
  dismiss: "知道了",
  neverShow: "不再提示",
};

export default HOTKEY_CHEATSHEET;
