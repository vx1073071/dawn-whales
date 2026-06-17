// ══ R261 QClaw Task 1: 热力图板块文案 ══
// 10 sector heatmap labels × market state × interactive copy
// Design: 热力图不是"哪个涨了"的颜色块——是\"一眼判断钱在哪\"的视觉决策工具

export interface HeatmapSectorBlock {
  sectorId: string; sectorName: string; shortName: string; emoji: string;
  colorRule: string;                          // 颜色规则描述
  defaultTooltip: string;                     // 悬停工具提示
  expandedTooltip: string;                    // 点击展开后的完整文案
  emptyState: string;                         // 该板块无数据时的文案
  marketStates: Record<string, HeatmapStateCopy>;  // 不同行情状态下的文案
}

export interface HeatmapStateCopy {
  label: string;                              // 状态标签
  color: string;                              // 颜色hex
  shortVerbat: string;                        // 方块内短文字(≤8字)
  headerLine: string;                         // 点击后标题行
  bodyLine: string;                           // 点击后正文
  topStocksHint: string;                      // 领涨龙头提示
  caution?: string;                           // 注意事项
}

// ═══════════════ 10板块定义 ═══════════════

export const HEATMAP_SECTORS: HeatmapSectorBlock[] = [
  // ── 1. 科技 ──
  {
    sectorId: 'TECHNOLOGY', sectorName: '科技', shortName: '科技', emoji: '💻',
    colorRule: '涨幅>2%=深绿, 0-2%=浅绿, -2%~0=浅红, <-2%=深红。AI/芯片子行业单独标注。',
    defaultTooltip: '💻 点击查看科技板块详情 — {stockCount}只股票 · 市值{marketCap}',
    expandedTooltip: '科技板块含4个子行业：半导体、软件、硬件、IT服务。当前领涨：AI芯片链。利率是科技板块的"定价锚"——10年美债收益率每降0.25%，科技股估值平均上升约3%。',
    emptyState: '科技板块数据暂未更新。通常Yahoo Finance在每个交易日10:00前完成板块数据推送。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853',
        shortVerbat: '领涨🔥',
        headerLine: '科技板块今天领涨全场',
        bodyLine: '涨幅{changePct}% — 科技股今天是市场的"发动机"。{topMover}以{topPct}%的涨幅领跑。如果10年美债收益率也在下降→这是"双引擎驱动"（估值提升+业绩驱动）。',
        topStocksHint: '{topStocks} — 板块内领涨龙头',
        caution: 'RSI={rsi}，如果>75→短期过热，警惕技术性回调。',
      },
      warm: {
        label: '温和上涨', color: '#69F0AE',
        shortVerbat: '温和📈',
        headerLine: '科技板块稳步上行',
        bodyLine: '+{changePct}% — 不是爆发式上涨，但趋势健康。科技板块最怕的不是"涨得慢"——是"涨得快跌得也快"。稳步上行=机构在悄悄建仓。',
        topStocksHint: '当前最强的子行业：{topSubSector}',
      },
      neutral: {
        label: '横盘整理', color: '#EEEEEE',
        shortVerbat: '横盘➡️',
        headerLine: '科技板块在横盘 — 在等方向',
        bodyLine: '涨跌幅在±1%内 — 科技板块在\"消化\"最近的行情。横盘期看资金流向——如果资金在悄悄流入=横盘后向上突破的概率>向下。',
        topStocksHint: '突破方向看{symbol} — 它是板块\"风向标\"',
      },
      cool: {
        label: '温和回调', color: '#FF8A80',
        shortVerbat: '回调📉',
        headerLine: '科技板块在回调',
        bodyLine: '{changePct}% — 这是正常的\"获利回吐\"。关键是跌幅是否\"有序\"（每天跌得差不多）还是\"加速\"（跌幅在放大）。有序回调=健康。加速下跌=警惕。',
        topStocksHint: '主要拖累：{topLoser} {topLoserPct}% — 是它自己的问题还是行业问题？',
      },
      cold: {
        label: '重挫领跌', color: '#D50000',
        shortVerbat: '重挫🆘',
        headerLine: '科技板块今天被重锤',
        bodyLine: '{changePct}% — 当前跌幅在科技板块历史上属于{pctRank}分位（即历史上只有{rankPct}的交易日比今天更差）。触发因素：{trigger}。历史上类似跌幅后的5个交易日：平均反弹{avgRebound}%。',
        topStocksHint: '别在恐慌中做决策——收盘后看\"空头回补\"数据，如果空头在平仓=可能接近短期底。',
        caution: '如果跌幅伴随利率急涨→这是\"利率炸弹\"伤害科技估值。需要更长时间恢复。',
      },
    },
  },

  // ── 2. 金融 ──
  {
    sectorId: 'FINANCIAL', sectorName: '金融', shortName: '金融', emoji: '🏦',
    colorRule: '涨幅>2%=深绿, 0-2%=浅绿, -2%~0=浅红, <-2%=深红。银行/保险/券商/资管子分类标注。',
    defaultTooltip: '🏦 点击查看金融板块详情 — 银行+保险+券商+资管 · 对利率最敏感',
    expandedTooltip: '金融板块的\"心跳\"=利率。利率上升→银行息差扩大→金融板块利好。利率下降→银行收入承压→金融板块承压。关注10年美债收益率和FOMC会议。',
    emptyState: '金融板块数据暂未更新。Yahoo Finance板块分类数据每交易日更新一次。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853',
        shortVerbat: '领涨🔥',
        headerLine: '金融板块今天大放异彩',
        bodyLine: '+{changePct}% — 金融板块的\"牛市\"通常意味着市场认为\"经济很强\"（贷款需求上升+违约率低）。{topMover}领涨——看它是银行(利率驱动)还是券商(成交量驱动)。',
        topStocksHint: '龙头：{topStocks} — 如果是银行领涨=利率预期在变化',
      },
      warm: {
        label: '温和上涨', color: '#69F0AE', shortVerbat: '温和📈',
        headerLine: '金融板块稳步上行', bodyLine: '+{changePct}% — 温和上涨是金融板块最好的状态——\"慢慢涨\"说明利率在稳定上升而非急涨（急涨=经济恐慌）。',
        topStocksHint: '子行业：{topSubSector}表现最好',
      },
      neutral: {
        label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️',
        headerLine: '金融板块在观望', bodyLine: '金融板块的横盘=市场在等利率方向。下次FOMC会议前的横盘是正常现象。',
        topStocksHint: '关注{symbol} — 它是板块\"定调者\"',
      },
      cool: {
        label: '回调', color: '#FF8A80', shortVerbat: '回调📉',
        headerLine: '金融板块在回吐涨幅', bodyLine: '{changePct}% — 金融板块回调通常和利率预期变化有关。检查10年美债收益率——如果它也在跌→利率预期在转向。',
        topStocksHint: '拖累源：{topLoser} — 是个股问题还是系统性？',
      },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '重挫🆘',
        headerLine: '金融板块遭到抛售', bodyLine: '{changePct}% — 金融板块暴跌=市场在\"定价经济衰退\"。银行股领跌=市场担心坏账。保险/资管领跌=可能是个别事件。别把\"熊市恐慌\"当成\"板块末日\"——历史上每次金融板块暴跌后的2年，板块都回到了更高的位置。',
        topStocksHint: '如果是{riskSymbol}领跌→系统性风险。如果只是个别银行→个别风险。',
        caution: '金融板块暴跌+信贷利差暴增=金融市场在\"冻结\"。这是最高级别的风险信号。',
      },
    },
  },

  // ── 3. 医疗健康 ──
  {
    sectorId: 'HEALTHCARE', sectorName: '医疗健康', shortName: '医疗', emoji: '🏥',
    colorRule: '涨幅>2%=深绿, 0-2%=浅绿, -2%~0=浅红, <-2%=深红。制药/生物科技/医疗器械/医疗服务分开标注。',
    defaultTooltip: '🏥 点击查看医疗板块详情 — 制药+生物科技+器械+服务 · 防御属性',
    expandedTooltip: '医疗是\"双面人\"：大盘制药=防御（无论经济好坏人们都吃药），生物科技=进攻（融资环境和FDA审批驱动）。看医疗板块的\"细分\"比看\"整体\"更重要。',
    emptyState: '医疗板块数据暂未加载。请稍后再试 — Yahoo数据通常在美国市场开盘后更新。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853', shortVerbat: '领涨🔥',
        headerLine: '医疗板块领涨 — 是制药还是生物科技？',
        bodyLine: '+{changePct}% — 如果是制药股领涨→防御性轮动（资金在\"避险\"）。如果是生物科技领涨→进攻性（融资环境改善或FDA关键批文）。两者的含义完全不同。',
        topStocksHint: '领涨子行业：{topSubSector} — 决定今天医疗上涨的性质',
      },
      warm: {
        label: '温和上涨', color: '#69F0AE', shortVerbat: '温和📈',
        headerLine: '医疗板块温和上行', bodyLine: '+{changePct}% — 医疗板块上涨往往\"安静\"——不喧嚣，但持续性高。历史上医疗板块是少数\"连续上涨不停歇\"的板块。',
        topStocksHint: '{topSubSector}领涨',
      },
      neutral: {
        label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️',
        headerLine: '医疗板块在休息', bodyLine: '医疗板块横盘通常是\"等消息\"——FDA审批、药物试验结果、政策变化。横盘期=没有大风险也没有大机会。',
        topStocksHint: '近期催化剂：{pendingCatalyst}',
      },
      cool: {
        label: '回调', color: '#FF8A80', shortVerbat: '回调📉',
        headerLine: '医疗板块在回调', bodyLine: '{changePct}% — 医疗板块的回调通常和\"政策风险\"（药价谈判）或\"生化板块的融资收紧\"相关。确认是哪一种——前者影响整个板块，后者只影响生物科技。',
        topStocksHint: '{topLoser} — 是个股FDA/试验失败？',
      },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '重挫🆘',
        headerLine: '医疗板块遭遇恐慌', bodyLine: '{changePct}% — 医疗板块的大跌通常不会\"莫名其妙\"。检查：①是不是有政策利空(药价法案) ②是不是生物科技融资崩了 ③是不是某只大盘制药出了问题。医疗板块是\"防御中的防御\"——如果它也大跌=市场真的有问题了。',
        topStocksHint: '如果是大盘制药(JNJ/PFE)领跌→系统性风险。生物科技领跌→融资环境。',
        caution: '如果医疗+公用事业同时大跌=防御板块\"失效\"=市场极端恐慌。',
      },
    },
  },

  // ── 4. 能源 ──
  {
    sectorId: 'ENERGY', sectorName: '能源', shortName: '能源', emoji: '🛢️',
    colorRule: '涨幅>2%=深绿, 0-2%=浅绿, -2%~0=浅红, <-2%=深红。同步显示WTI原油价格标签。',
    defaultTooltip: '🛢️ 点击查看能源板块详情 — 石油+天然气+新能源 · 原油价格=风向标',
    expandedTooltip: '能源板块的\"心脏\"=原油价格。WTI>80=能源板块在\"旺季\"。WTI<50=能源板块在\"寒冬\"。但新能源（太阳能/风能）不完全跟随油价——它们有自己的逻辑。',
    emptyState: '能源板块数据暂未加载。WTI价格可在商品行情中实时查看。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853', shortVerbat: '领涨🔥',
        headerLine: '能源板块爆发 — WTI {wtiPrice}',
        bodyLine: '+{changePct}% — WTI今天{WTI_DIR}。能源板块的上涨=\"跟着油价走\"。如果油价>90→能源板块涨幅通常会被放大。注意：能源股的上涨滞后于油价——油价涨完后能源股还能追涨一段时间。',
        topStocksHint: '龙头：{topStocks} — 关注它们的\"自由现金流\"（油价高=FCF爆炸好）',
      },
      warm: {
        label: '温和上涨', color: '#69F0AE', shortVerbat: '温和📈',
        headerLine: '能源板块稳步上行 — WTI {wtiPrice}', bodyLine: '+{changePct}% — 温和上涨=油价在\"合理区间\"（60-80）内。这是能源板块最\"可持续\"的状态。',
        topStocksHint: '{topStocks}领涨',
      },
      neutral: {
        label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️',
        headerLine: '能源板块在等油价方向 — WTI {wtiPrice}', bodyLine: '能源板块横盘=油价在横盘。等OPEC消息或库存数据——这些会决定下一个方向。',
        topStocksHint: '下一个催化：{nextEvent}',
      },
      cool: {
        label: '回调', color: '#FF8A80', shortVerbat: '回调📉',
        headerLine: '能源板块随油价回调', bodyLine: '{changePct}% — WTI跌了{WTI_CHANGE}%。能源板块的回调100%和油价有关。看WTI是真破位还是技术性回调（支撑位在哪）。',
        topStocksHint: '{topLoser} — WTI每跌$1，这些股票可能再跌{pctPerDollar}%。',
      },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '重挫🆘',
        headerLine: '能源板块被油价拖下水', bodyLine: '{changePct}% — WTI暴跌{WTI_CHANGE}%。能源股是\"油价放大器\"——油价跌1%，能源股可能跌2-3%。但历史上每次油价暴跌后，幸存下来的能源股都在下一次油价回升中创了新高。',
        topStocksHint: '抗跌能力看负债率——负债率<50%的能源股大概率能扛过去。>100%的可能有生存危机。',
        caution: '如果WTI暴跌+全球经济数据恶化→需求端危机。如果只是OPEC增产→供给端冲击（通常恢复更快）。',
      },
    },
  },

  // ── 5. 消费 ──
  {
    sectorId: 'CONSUMER', sectorName: '消费', shortName: '消费', emoji: '🛒',
    colorRule: '必需品(浅色)/可选品(深色)分开显示。必需品涨幅>1%=绿，可选品需要>2%才绿。',
    defaultTooltip: '🛒 点击查看消费板块详情 — 必需品+可选品 · \"人们口袋里的钱\"晴雨表',
    expandedTooltip: '消费板块分两半：必需消费(食品/饮料/日用品)——永远有人在买，防御属性。可选消费(汽车/旅游/奢侈品)——经济好才买，进攻属性。两者的差距=消费者的\"信心差\"。',
    emptyState: '消费板块数据暂未加载。消费品公司财报季通常更集中。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853', shortVerbat: '领涨🔥',
        headerLine: '消费板块大涨 — 是必需品还是可选品？',
        bodyLine: '+{changePct}% — {which}。如果是可选消费领涨→市场在\"定价经济好\"（人们开始花\"非必需\"的钱）。如果是必需消费领涨→防御性轮动（人们只花\"必花的\"钱）。这两个信号一正一反。',
        topStocksHint: '{which}领涨 — {topStocks}',
      },
      warm: { label: '温和', color: '#69F0AE', shortVerbat: '温和📈', headerLine: '消费板块温和上行', bodyLine: '消费板块温和上涨通常是\"必需品在涨，可选品在观望\"——消费者\"在花钱但不是很舍得花\"。', topStocksHint: '{topSubSector}领涨' },
      neutral: { label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️', headerLine: '消费板块在观望', bodyLine: '消费横盘=消费者在\"等方向\"。关注零售数据和消费者信心指数——它们是消费板块的\"先行指标\"。', topStocksHint: '下个催化：{nextRetailData}' },
      cool: { label: '回调', color: '#FF8A80', shortVerbat: '回调📉', headerLine: '消费板块在回调', bodyLine: '{changePct}% — 如果可选消费跌幅>必需品→消费者在\"降级\"（从\"买好的\"变成\"买够用的\"）。这是经济放缓的信号。', topStocksHint: '{topLoser} — 是需求下滑还是库存问题？' },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '重挫🆘',
        headerLine: '消费板块暴跌 — 消费者在\"捂紧钱包\"',
        bodyLine: '{changePct}% — 消费板块全线下跌=最直接的\"经济衰退恐惧\"信号。消费者是经济的\"最后一道防线\"——如果连消费都在萎缩，经济下行是大概率事件。但这不代表你的消费股该卖——必需消费在衰退中反而是\"避风港\"。',
        topStocksHint: '必需消费跌幅如果>可选消费=恐慌性\"全卖\"，非理性。可选消费跌幅>必需=理性防御。',
        caution: '如果可选消费+工业同时暴跌=市场在定价\"深度衰退\"。需要重新评估整个投资组合。',
      },
    },
  },

  // ── 6. 工业 ──
  {
    sectorId: 'INDUSTRIALS', sectorName: '工业', shortName: '工业', emoji: '🏭',
    colorRule: '涨幅>2%=深绿, 0-2%=浅绿, -2%~0=浅红, <-2%=深红。标注PMI数据标签。',
    defaultTooltip: '🏭 点击查看工业板块详情 — 制造业+运输+航空+建筑 · PMI=晴雨表',
    expandedTooltip: '工业=\"实体经济的心脏\"。PMI>50=工业在扩张→工业股受益。PMI<50=在收缩→工业股承压。关注全球PMI（不光美国）——中国PMI对美国工业板块有\"先导\"作用。',
    emptyState: '工业板块数据暂未加载。PMI数据通常在每月第1个交易日发布。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853', shortVerbat: '领涨🔥',
        headerLine: '工业板块大涨 — PMI {pmi}',
        bodyLine: '+{changePct}% — PMI{pmiDir}。工业大涨=\"全球贸易在加速\"。看{topMover}——如果是航空/运输领涨=全球出行/贸易复苏。如果是制造业=产能扩张。两者信号不同但都正面。',
        topStocksHint: '龙头：{topStocks} — 看细分行业',
      },
      warm: { label: '温和', color: '#69F0AE', shortVerbat: '温和📈', headerLine: '工业板块稳步上行', bodyLine: '工业温和上涨=经济在\"缓慢扩张\"。这是最健康的牛市状态——不是过热，不是衰退。', topStocksHint: '{topSubSector}领涨' },
      neutral: { label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️', headerLine: '工业板块在等PMI', bodyLine: '工业横盘=市场在等下个月PMI数据。如果PMI>50→横盘后大概率向上。PMI<50→可能向下。', topStocksHint: '下个PMI：{nextPmiDate}' },
      cool: { label: '回调', color: '#FF8A80', shortVerbat: '回调📉', headerLine: '工业板块在回调', bodyLine: '{changePct}% — 工业回调=市场在\"打折买\"。看下跌是否和\"新订单\"数据相关——如果新订单也在跌→谨慎。如果只是获利回吐→机会。', topStocksHint: '{topLoser} — 检查新订单数据' },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '重挫🆘',
        headerLine: '工业板块被抛售 — PMI {pmi}',
        bodyLine: '{changePct}% — 工业暴跌=最直接的\"衰退定价\"。PMI{pmiDir}。工业板块是\"经济先行指标\"——它跌=市场认为未来6个月经济会变差。但历史上工业板块的底部通常比经济底部早3-6个月出现。',
        topStocksHint: '运输板块({transportSymbol})是工业的\"金丝雀\"——运输先跌先涨。',
        caution: '如果工业+原材料同时暴跌=全球需求崩溃。如果只是工业跌→可能是美国自己的问题。',
      },
    },
  },

  // ── 7. 原材料 ──
  {
    sectorId: 'MATERIALS', sectorName: '原材料', shortName: '原材料', emoji: '⛏️',
    colorRule: '涨幅>2%=深绿, 0-2%=浅绿, -2%~0=浅红, <-2%=深红。显示美元指数标签。',
    defaultTooltip: '⛏️ 点击查看原材料板块详情 — 矿业+化工+钢铁+建材 · 美元强弱=反向指标',
    expandedTooltip: '原材料板块=\"全球需求+美元\"的双重函数。美元强→大宗商品贵→原材料板块跌。美元弱→大宗商品便宜→原材料板块涨。中国PMI是原材料板块的\"最强领先指标\"。',
    emptyState: '原材料板块数据暂未加载。商品期货价格可在行情页实时查看。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853', shortVerbat: '领涨🔥',
        headerLine: '原材料板块爆发 — 美元指数 {dxy}',
        bodyLine: '+{changePct}% — {why}。原材料大涨通常=通胀预期上升 或 全球需求旺盛。看美元——如果美元在跌=这是\"美元弱\"驱动。如果美元在涨=这是\"真需求\"驱动（更强）。',
        topStocksHint: '龙头：{topStocks} — 看铜价是原材料的风向标',
      },
      warm: { label: '温和', color: '#69F0AE', shortVerbat: '温和📈', headerLine: '原材料板块稳步上行', bodyLine: '原材料温和上涨=全球需求在\"健康增长\"，不是\"紧急补库\"。这是可持续的上涨。', topStocksHint: '{topSubSector}领涨' },
      neutral: { label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️', headerLine: '原材料板块在等方向', bodyLine: '横盘=美元和大宗商品在\"拉锯\"。看美元指数——如果美元破位→原材料板块大概率向上。', topStocksHint: '美元指数：{dxy}' },
      cool: { label: '回调', color: '#FF8A80', shortVerbat: '回调📉', headerLine: '原材料板块在回调', bodyLine: '{changePct}% — 原材料回调通常=美元走强。看美元指数——如果美元在\"加速上涨\"→原材料可能还有更多下跌。', topStocksHint: '{topLoser} — 看大宗商品价格' },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '重挫🆘',
        headerLine: '原材料板块暴跌 — 全球需求在\"熄火\"',
        bodyLine: '{changePct}% — 原材料暴跌=市场在定价\"全球经济放缓\"。中国PMI={chinaPmi}。原材料是\"最强周期\"——它在衰退中跌得最深，在复苏中涨得最猛。现在你在见证\"最深\"的阶段。',
        topStocksHint: '铜价({copperPrice})是原材料的\"博士指标\"——铜价先见底=板块见底。',
        caution: '如果原材料+工业同时暴跌+美元飙升=全球经济\"三重打击\"。历史上这种组合意味着深度衰退。',
      },
    },
  },

  // ── 8. 公用事业 ──
  {
    sectorId: 'UTILITIES', sectorName: '公用事业', shortName: '公用', emoji: '⚡',
    colorRule: '涨幅>1%=深绿, 0-1%=浅绿, -1%~0=浅红, <-1%=深红。公用事业波动小，颜色阈值收紧。',
    defaultTooltip: '⚡ 点击查看公用事业板块详情 — 电力+水务+天然气 · 防御之王 · 债券替代品',
    expandedTooltip: '公用事业=\"股票的债券\"。利率降→公用事业涨（\"分红>债券利息\"）。利率升→公用事业跌（\"债券利息>分红\"）。在利率下降周期中，公用事业是\"躺着赚\"的板块。',
    emptyState: '公用事业板块数据暂未加载。通常板块波动较小，数据延迟不影响判断。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853', shortVerbat: '大涨⚡',
        headerLine: '公用事业大涨 — 资金在\"避险\"',
        bodyLine: '+{changePct}% — 公用事业大涨={pct}分位（即比{pctRank}%的历史交易日涨幅更大）。公用事业罕见大涨=资金在大规模\"切换到防御\"。通常意味着：①市场预期利率下降 或 ②其他板块出现了恐慌。',
        topStocksHint: '{topStocks} — 电力公司是利率敏感度最高的',
      },
      warm: { label: '温和', color: '#69F0AE', shortVerbat: '温和📈', headerLine: '公用事业温和上行', bodyLine: '{changePct}%对公用事业来说已经是\"不错\"的一天了。这个板块天生波动小，温和上涨=\"在收租\"。', topStocksHint: '{topStocks}领涨' },
      neutral: { label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️', headerLine: '公用事业在横盘', bodyLine: '公用事业横盘=市场在\"等利率方向\"。下次FOMC会议前后公用事业价格会有方向。', topStocksHint: '10年美债收益率：{t10y}%' },
      cool: { label: '回调', color: '#FF8A80', shortVerbat: '回调📉', headerLine: '公用事业在回调', bodyLine: '{changePct}% — 公用事业的回调通常=利率在上升。如果10年美债收益率在涨→这是\"债券竞品\"效应。如果利率没涨→可能是获利回吐。', topStocksHint: '{topLoser}' },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '大跌⚠️',
        headerLine: '公用事业大跌 — 不寻常', bodyLine: '{changePct}% — 公用事业大幅下跌是罕见的。通常=利率急涨（10年美债收益率飙升）。如果在利率没涨的情况下大跌→可能是系统性抛售（恐慌中所有人\"全卖\"）。这种下跌通常不可持续——防御型板块的暴跌=最终会被买回来。',
        topStocksHint: '检查10年美债收益率——它是公用事业\"暴跌\"的来源。',
        caution: '如果公用事业暴跌+10年美债被抛售=\"无风险利率\"在飙升。这是对所有\"收息资产\"的打击。',
      },
    },
  },

  // ── 9. 房地产 ──
  {
    sectorId: 'REAL_ESTATE', sectorName: '房地产', shortName: '房地产', emoji: '🏘️',
    colorRule: '涨幅>2%=深绿, 0-2%=浅绿, -2%~0=浅红, <-2%=深红。标注30年房贷利率标签。',
    defaultTooltip: '🏘️ 点击查看房地产板块详情 — REITs+开发商 · 利率=生死的命脉',
    expandedTooltip: '房地产=\"利率放大器\"。利率降→房贷便宜→地产涨。利率升→房贷贵→地产跌。数据中心REITs是特例(AI驱动需求独立于利率)。不要用住宅逻辑理解REITs——REITs持有的是\"收租物业\"，不是\"炒房\"。',
    emptyState: '房地产板块数据暂未加载。30年房贷利率每周四更新。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853', shortVerbat: '领涨🔥',
        headerLine: '房地产板块大涨 — 30年房贷 {mortgageRate}%',
        bodyLine: '+{changePct}% — 利率在降=房地产的\"春天\"。{topMover}领涨。看它是传统REIT(利率驱动)还是数据中心REIT(AI驱动)——后者涨不靠利率降。',
        topStocksHint: '龙头：{topStocks} — 看利率方向',
      },
      warm: { label: '温和', color: '#69F0AE', shortVerbat: '温和📈', headerLine: '房地产板块温和上行', bodyLine: '房地产温和上涨=利率在缓慢下降。缓慢降=稳定涨。这是最好的节奏。', topStocksHint: '{topSubSector}领涨' },
      neutral: { label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️', headerLine: '房地产板块在等利率', bodyLine: '房地产横盘=利率没方向。等FOMC——每次FOMC是房地产板块的\"方向选择点\"。', topStocksHint: '30年房贷：{mortgageRate}%' },
      cool: { label: '回调', color: '#FF8A80', shortVerbat: '回调📉', headerLine: '房地产板块在回调', bodyLine: '{changePct}% — 利率在上=房地产在\"承压\"。看30年房贷利率——如果它突破了{keyLevel}%=房地产可能还有更多下跌。', topStocksHint: '{topLoser}' },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '重挫🆘',
        headerLine: '房地产板块暴跌 — 利率\"炸弹\"', bodyLine: '{changePct}% — 利率飙升=房地产被\"血洗\"。30年房贷利率={mortgageRate}%。但记住：REITs不是\"房子\"——即使房价跌，REITs的\"租金收入\"还在(除非租客违约)。办公REITs最危险(WFH压力)，数据中心REITs最安全(AI需求)。',
        topStocksHint: '看REIT类型——办公REIT最危险，数据中心/工业REIT最安全。',
        caution: '如果房地产暴跌+利率急涨+信贷市场冻结=2008式系统性风险。这是极低概率但极高破坏力的事件。',
      },
    },
  },

  // ── 10. 通信服务 ──
  {
    sectorId: 'COMMUNICATION', sectorName: '通信服务', shortName: '通信', emoji: '📡',
    colorRule: '涨幅>2%=深绿, 0-2%=浅绿, -2%~0=浅红, <-2%=深红。电信/媒体/平台三个子分类分开显示。',
    defaultTooltip: '📡 点击查看通信板块详情 — 电信+媒体+平台 · 科技\"近亲\"，但有自己的逻辑',
    expandedTooltip: '通信板块是\"混血儿\"：电信=防御(人们不取消手机套餐)。平台(Google/Meta)=进攻(广告预算驱动)。两者的走势经常相反——看子行业比看整个板块更有意义。',
    emptyState: '通信板块数据暂未加载。平台类公司财报季通常在科技板块之后。',
    marketStates: {
      hot: {
        label: '强势领涨', color: '#00C853', shortVerbat: '领涨🔥',
        headerLine: '通信板块大涨 — 是平台还是电信？',
        bodyLine: '+{changePct}% — {which}。如果是平台(Google/Meta/Netflix)领涨→和科技板块逻辑一致(增长+AI)。如果是电信(Verizon/AT&T)领涨→防御性轮动(分红吸引)。两者对投资组合的\"定位\"完全不同。',
        topStocksHint: '{which}领涨 — {topStocks}',
      },
      warm: { label: '温和', color: '#69F0AE', shortVerbat: '温和📈', headerLine: '通信板块温和上行', bodyLine: '电信稳定涨+平台温和涨=通信板块最好的节奏。', topStocksHint: '{topSubSector}领涨' },
      neutral: { label: '横盘', color: '#EEEEEE', shortVerbat: '横盘➡️', headerLine: '通信板块在横盘', bodyLine: '平台横盘=在等广告数据。电信横盘=在等利率方向。两半的逻辑不一样。', topStocksHint: '下个催化：{nextCatalyst}' },
      cool: { label: '回调', color: '#FF8A80', shortVerbat: '回调📉', headerLine: '通信板块在回调', bodyLine: '{changePct}% — 如果是平台在跌(和科技同步)→获利回吐正常。如果是电信在跌→利率上升压力。', topStocksHint: '{topLoser}' },
      cold: {
        label: '重挫', color: '#D50000', shortVerbat: '重挫🆘',
        headerLine: '通信板块被抛售', bodyLine: '{changePct}% — 如果平台+科技同步暴跌→AI/广告预期\"退潮\"。如果只有电信跌→利率冲击。如果平台跌但科技不跌→平台自己的问题(监管/竞争)。三种情境，三种应对。',
        topStocksHint: '看是{telecomSymbol}在跌还是{platformSymbol}在跌——含义完全不同。',
        caution: '如果是某个平台暴跌(>10%)+其他平台不跟→个股问题，不是板块问题。',
      },
    },
  },
];

// ═══════════════════════════════════════
// 热力图整体UI文案
// ═══════════════════════════════════════

export const HEATMAP_UI_COPY = {
  title: '🗺️ 板块热力图',
  subtitle: '1屏10块 — 看懂钱在哪',
  colorLegend: {
    title: '颜色=涨跌',
    items: [
      { color: '#00C853', label: '涨幅>2%', description: '强势领涨 — 钱在涌入' },
      { color: '#69F0AE', label: '0~2%', description: '温和上涨 — 趋势健康' },
      { color: '#EEEEEE', label: '±1%', description: '横盘整理 — 在等方向' },
      { color: '#FF8A80', label: '-2%~0', description: '温和回调 — 正常获利回吐' },
      { color: '#D50000', label: '<-2%', description: '重挫领跌 — 需关注' },
    ],
  },
  sizeRule: '方块大小=板块市值占比。科技≈28%，金融≈13%，医疗≈14%... 大块头的颜色变化=更重要的信号。',
  interaction: '点击任意板块→看详细分析。拖拽对比两个板块→看\"谁在吸谁的血\"。',

  emptyStates: {
    allLoading: '🔄 正在从Yahoo Finance获取10大板块实时数据...',
    partialLoading: '🔄 已加载{loadedCount}/10板块数据 — 剩余板块正从Yahoo Finance推送中...',
    allStale: '⚠️ 板块数据已超过{staleness}分钟未更新 — 可能Yahoo数据源延迟。等待自动重连...',
    error: '❌ 无法获取板块数据。Yahoo Finance服务可能临时不可用。系统会在30秒后自动重试。',
  },

  lastUpdated: '最后更新：{time} · 数据源：Yahoo Finance实时板块行情',
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getSectorBlock(sectorId: string): HeatmapSectorBlock | undefined {
  return HEATMAP_SECTORS.find(s => s.sectorId === sectorId);
}

export function getStateCopy(sectorId: string, state: string): HeatmapStateCopy | undefined {
  const sector = getSectorBlock(sectorId);
  return sector?.marketStates[state];
}

export function getStateByChange(sectorId: string, changePct: number): string {
  const sector = getSectorBlock(sectorId);
  if (!sector) return 'neutral';
  // 公用事业阈值收紧
  if (sectorId === 'UTILITIES') {
    if (changePct > 1) return 'hot';
    if (changePct > 0) return 'warm';
    if (changePct > -1) return 'neutral';
    if (changePct > -2) return 'cool';
    return 'cold';
  }
  if (changePct > 2) return 'hot';
  if (changePct > 0) return 'warm';
  if (changePct > -2) return 'neutral';
  if (changePct > -5) return 'cool';
  return 'cold';
}

export default HEATMAP_SECTORS;
