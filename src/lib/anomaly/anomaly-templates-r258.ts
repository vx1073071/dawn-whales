// ══ R258 QClaw Task 2: 异动人话模板50条 ══
// Anomaly human-readable templates — "what happened → what it means → what to do"
// Design: 不是推送"MACD金叉"，是推送"XX股票刚刚发出买入信号"

export interface AnomalyTemplate {
  id: string;
  category: 'PRICE' | 'VOLUME' | 'TECHNICAL' | 'BREAKOUT' | 'MONEY_FLOW' | 'MARKET_WIDE' | 'OPTIONS' | 'NEWS' | 'TIMING';
  severity: 'INFO' | 'WARNING' | 'ALERT' | 'CRITICAL';
  title: string;             // 一行标题
  whatHappened: string;      // 发生了什么 (通俗)
  whatItMeans: string;       // 意味着什么
  whatToDo: string;          // 建议做什么
  triggerSignal: string;     // 触发条件 (给引擎看的)
}

export const ANOMALY_TEMPLATES_50: AnomalyTemplate[] = [

  // ═══════════ PRICE (价格异动) — 8条 ═══════════

  {
    id: 'price-surge-5pct', category: 'PRICE', severity: 'WARNING',
    title: '{symbol} 突然拉升 {pct}% 🔥',
    whatHappened: '股价在短时间内快速拉升，涨幅偏离了近20日的正常波动范围。',
    whatItMeans: '可能是利好消息驱动（财报超预期、新产品发布、被大券商上调评级），也可能是游资短线炒作。涨太快的东西往往也会跌很快。',
    whatToDo: '看成交量——上涨放量+利好消息=真实拉升。上涨无量=可能是"诱多"的短线游资行为，追进去风险大。',
    triggerSignal: 'priceChange5m > 5% AND priceChange5m > 3 * avgDailyVolatility20',
  },
  {
    id: 'price-dump-5pct', category: 'PRICE', severity: 'ALERT',
    title: '{symbol} 突然跳水 {pct}% 📉',
    whatHappened: '股价短时间内急跌，跌幅远超近期正常波动。',
    whatItMeans: '三种可能：①财报/公告暴雷（基本面恶化）②大盘系统性下跌（被拖下水）③机构出货（有人在大单砸）。看成交量区分——放量暴跌=真出逃，无量下跌=可能是误杀。',
    whatToDo: '先别急着抄底——等K线走稳（至少等15分钟不再新低）。如果是系统性下跌（大盘也在跌），个股抄底风险翻倍。',
    triggerSignal: 'priceChange5m < -5% AND priceChange5m < -3 * avgDailyVolatility20',
  },
  {
    id: 'gap-up-open', category: 'PRICE', severity: 'WARNING',
    title: '{symbol} 跳空高开 {pct}% ⬆️',
    whatHappened: '开盘价就比昨天收盘价高出一大截——中间有段价格"跳过去了"。',
    whatItMeans: '盘前有重大利好消息（财报、并购、政策利好）——买方情绪高涨，开盘就抢。注意：跳空高开后可能"回补"（慢慢跌回原来的缺口位置）。',
    whatToDo: '如果手里有持仓→观察缺口是否回补。没持仓→别追——等回调到缺口上沿再考虑。',
    triggerSignal: 'openPrice > prevClose * 1.03 AND gapSize > 2%',
  },
  {
    id: 'gap-down-open', category: 'PRICE', severity: 'ALERT',
    title: '{symbol} 跳空低开 {pct}% ⬇️',
    whatHappened: '开盘价就比昨天低了很大一截。通常是"昨天收盘后"出了坏消息。',
    whatItMeans: '盘后有坏消息（财报miss、监管处罚、CEO突然离职）——持有者开盘就想卖出。跌幅小于3%=情绪宣泄后可能反弹。跌幅大于7%=机构在出逃，别挡路。',
    whatToDo: '第一时间看新闻——如果是实质性利空（基本面恶化），果断止损。如果是市场情绪（大盘跌带动），可以等等。',
    triggerSignal: 'openPrice < prevClose * 0.97 AND gapSize > 2%',
  },
  {
    id: 'intraday-reversal', category: 'PRICE', severity: 'INFO',
    title: '{symbol} 盘中反转 — 从{fromDir}变成了{toDir} 🔄',
    whatHappened: '今天先是{fromDir}，然后突然扭头{toDir}。盘中走势"掉头"了。',
    whatItMeans: '多空力量突然转换。如果是从跌转涨（V型反转）= 空头被"逼空"，很多做空的被迫买回来。从涨转跌（A型反转）= 多头获利了结，或者有什么坏消息在盘中被消化。',
    whatToDo: '别追反转的第一脚——反转初始阶段最不稳定。等势头确认（连续3根5分钟蜡烛朝同一方向）再考虑入场。',
    triggerSignal: 'abs(lowToHighIntraday) > 3% AND directionFlipped',
  },
  {
    id: 'new-52w-high', category: 'PRICE', severity: 'INFO',
    title: '{symbol} 创52周新高！📈',
    whatHappened: '股价超过了近一年的最高点——过去一年买这只股票的每个人现在都在赚钱。',
    whatItMeans: '创历史新高=没有"套牢盘"压力——所有持有者都是盈利状态，没有人在等"回本卖出"的阻力。但同时也意味着"不便宜"——已经在最高位了。',
    whatToDo: '新高之后经常有"回踩"（小回调确认支撑）。如果你看好，可以等回踩到前高位置再进场，而不是在创新高那一刻追。',
    triggerSignal: 'currentPrice >= 52WeekHigh',
  },
  {
    id: 'new-52w-low', category: 'PRICE', severity: 'ALERT',
    title: '{symbol} 创52周新低 ⚠️',
    whatHappened: '股价跌破了过去一年的最低点。持有一年的人全都亏钱了。',
    whatItMeans: '基本面可能出了问题——"便宜"是有原因的。但也可能是"被市场过度恐慌错杀"的优质公司。区分要点：负债率、现金流、行业地位有没有恶化。',
    whatToDo: '不要因为"便宜"就买——便宜的东西可能变得更便宜。等公司自身先企稳（至少1-2周不创新低）再考虑。',
    triggerSignal: 'currentPrice <= 52WeekLow',
  },
  {
    id: 'dead-cat-bounce', category: 'PRICE', severity: 'WARNING',
    title: '{symbol} 反弹了——但是"死猫反弹"吗？🐱',
    whatHappened: '大跌之后出现了短暂反弹——但这可能不是真正的反转。',
    whatItMeans: '"死猫反弹"=跌了太多之后，小资金抢反弹推高价格，但大趋势还是向下。特征是：反弹无力（涨幅小、无量、很快又跌回去）。',
    whatToDo: '判断标准：反弹有没有放量？有没有突破关键阻力位？如果两者都没有→大概是死猫反弹→别追。',
    triggerSignal: 'dropFromHigh > 20% AND lastBounce < 5% AND bounceVolume < avgVolume * 0.7',
  },

  // ═══════════ VOLUME (成交量异动) — 7条 ═══════════

  {
    id: 'volume-explosion', category: 'VOLUME', severity: 'WARNING',
    title: '{symbol} 成交量暴增 {multiple}倍 💥',
    whatHappened: '今天的成交量是平时的{multiple}倍——有"大钱"在进出。',
    whatItMeans: '放量上涨=机构在买（好事）。放量下跌=机构在卖（坏事）。放量但价格不动=多空分歧巨大（有人在大量买，也有人在大量卖——"换手率"高）。',
    whatToDo: '看方向——放量涨=跟，放量跌=跑，放量平=观望（神仙打架，凡人退让）。',
    triggerSignal: 'currentVolume > avgVolume20 * {multiple}',
  },
  {
    id: 'volume-dryup', category: 'VOLUME', severity: 'INFO',
    title: '{symbol} 成交量骤降至{ratio}% — 没人玩了 🦗',
    whatHappened: '今天的成交量只有平时的{ratio}%——没人买卖，市场"睡着了"。',
    whatItMeans: '低量=市场共识强——要么是持有者不想卖（看涨共识），要么是观望者不想买（看跌共识）。低量横盘后往往有一波大行情——宁静前的"蓄力"。',
    whatToDo: '缩量横盘=变盘前兆。别在缩量时开新仓位——等放量突破方向确认后跟。',
    triggerSignal: 'currentVolume < avgVolume20 * 0.3',
  },
  {
    id: 'climax-volume-top', category: 'VOLUME', severity: 'ALERT',
    title: '{symbol} 天量天价 — 看到大顶的信号？🏔️',
    whatHappened: '在一段大涨之后，成交量突然放大到极致（历史最高量），但股价涨幅很小甚至转跌。',
    whatItMeans: '"聪明钱在出货给追涨的散户"——机构用大成交量掩护自己悄悄地卖。价格涨不动但量巨大=不是好信号。',
    whatToDo: '如果你持仓一直在赚→分批止盈。如果你还没进→这种时候进去很可能"接盘"。',
    triggerSignal: 'volume = maxVolume90d AND priceChange < 1% AND priorRally > 20%',
  },
  {
    id: 'climax-volume-bottom', category: 'VOLUME', severity: 'WARNING',
    title: '{symbol} 恐慌放量 — 见底了吗？😱',
    whatHappened: '在一段大跌之后，成交量突然爆量——大量人在恐慌卖出，但也有大量人在下面接货。',
    whatItMeans: '恐慌性抛售+大量承接=市场在"换手"。旧的持有者投降割肉，新的买家在低位接盘。这是见底的典型信号之一——但不是100%。',
    whatToDo: '等第二天确认——如果第二天不再创新低+成交量萎缩=大概率见底。如果第二天继续大跌=恐慌还没结束。',
    triggerSignal: 'volume > avgVolume20 * 3 AND priceChange < -3% AND priorDecline > 15%',
  },
  {
    id: 'opening-volume-spike', category: 'VOLUME', severity: 'WARNING',
    title: '{symbol} 开盘巨量 — 有大事！🎬',
    whatHappened: '开盘前15分钟成交量极大——是平时同时段的{multiple}倍。',
    whatItMeans: '盘后有大消息/大单。开盘巨量上涨=机构在用开盘流动性"一口吃完"。开盘巨量下跌=有人急着出货（可能是被强平）。',
    whatToDo: '开盘15分钟不操作——等"开盘噪声"过去。真正的趋势在看盘15分钟之后才会明确。',
    triggerSignal: 'volumeFirst15min > avgFirst15min * {multiple}',
  },
  {
    id: 'closing-auction-spike', category: 'VOLUME', severity: 'INFO',
    title: '{symbol} 尾盘放量 — 收盘竞价有人"抢" 🏁',
    whatHappened: '收盘前几分钟成交量突然放大——尾盘竞价有人在大量买卖。',
    whatItMeans: '机构和大资金喜欢在收盘竞价操作（不影响日间走势+按收盘价成交）。尾盘放量拉升=看多（机构抢筹拿到第二天），尾盘放量砸盘=看空（机构急着卖出走人）。',
    whatToDo: '关注"尾盘方向"——尾盘是涨还是跌？如果尾盘涨+放量，第二天大概率高开。',
    triggerSignal: 'volumeLast15min > avgLast15min * 2',
  },
  {
    id: 'dark-pool-print', category: 'VOLUME', severity: 'WARNING',
    title: '{symbol} 暗池出现大单 — 机构在悄悄行动 🕶️',
    whatHappened: '在暗池（不在公开交易所显示的成交系统）中出现了一笔超大单——机构在"不让人看到"的情况下大量进出。',
    whatItMeans: '机构用暗池来避免影响公开市场价格。大单出现=有大资金在做方向性调整。如果连续出现同方向大单=机构在"建仓"或"清仓"。',
    whatToDo: '无法直接跟（你不知道具体价格+规模），但可以作为风向标——连续多日暗池买单=机构看涨。',
    triggerSignal: 'darkPoolBlockTradeSize > 1000000 AND sameDirectionCount3d >= 3',
  },

  // ═══════════ TECHNICAL (技术指标异动) — 10条 ═══════════

  {
    id: 'ma-golden-cross', category: 'TECHNICAL', severity: 'INFO',
    title: '{symbol} 金叉！50日均线上穿200日 📈',
    whatHappened: '短期均线（50日）从下方向上穿过了长期均线（200日）——"金叉"。',
    whatItMeans: '这是最经典的长期看多信号——短期趋势（50日）开始强于长期趋势（200日），说明市场情绪在转好。历史上金叉之后6个月的平均胜率约65%。',
    whatToDo: '金叉不是"现在立刻买"，是"未来一段时间偏多操作"。可以等一个回调（回踩50日线）时入场——性价比更高。',
    triggerSignal: 'MA50 crossedAbove MA200',
  },
  {
    id: 'ma-death-cross', category: 'TECHNICAL', severity: 'WARNING',
    title: '{symbol} 死叉！50日均线下穿200日 ⚠️',
    whatHappened: '短期均线（50日）从上方向下穿过了长期均线（200日）——"死叉"。',
    whatItMeans: '长期看空信号——短期趋势开始弱于长期趋势。注意：死叉是"滞后指标"——均线反映的是过去，不是未来。当死叉出现时，跌势可能已经过了一大半。',
    whatToDo: '不是"马上清仓"——是"暂停加仓，观察"。等大盘企稳+个股站回50日线再做多。',
    triggerSignal: 'MA50 crossedBelow MA200',
  },
  {
    id: 'rsi-overbought', category: 'TECHNICAL', severity: 'WARNING',
    title: '{symbol} RSI={rsi} — 涨太多可能要歇歇了 😤',
    whatHappened: 'RSI（相对强弱指标）飙到了{rsi}——统计上处于"超买"区间。',
    whatItMeans: '短期涨得太猛了——不是"马上要跌"，是"继续涨的动力在减弱"。强趋势中RSI可以在70以上维持很久（几周甚至几个月）。RSI高≠该卖，RSI自身掉头朝下才该警惕。',
    whatToDo: 'RSI>70→别追高。RSI从80跌回70→正常的获利回吐。RSI跌破50→趋势可能真的变了。',
    triggerSignal: 'RSI14 > 70',
  },
  {
    id: 'rsi-oversold', category: 'TECHNICAL', severity: 'INFO',
    title: '{symbol} RSI={rsi} — 跌太多了，超卖中 🥶',
    whatHappened: 'RSI跌到了{rsi}——统计上处于"超卖"区间。',
    whatItMeans: '短期跌得太多了——不是"马上要涨"，是"继续跌的动力在减弱"。但注意：熊市里RSI可以在30以下待很久——"便宜"不是"要涨"的理由。',
    whatToDo: 'RSI<30→列入观察名单。RSI<30+成交量萎缩=跌不动了，反弹概率上升。',
    triggerSignal: 'RSI14 < 30',
  },
  {
    id: 'rsi-divergence-bull', category: 'TECHNICAL', severity: 'WARNING',
    title: '{symbol} RSI底背离 — 价格新低但指标不跟 📈',
    whatHappened: '股价创了新低，但RSI没有跟着创更低——"底背离"。',
    whatItMeans: '价格在跌，但"跌的力度在衰减"——空头力量在消耗。底背离是最强的见底信号之一。但背离可以持续很久——不是背离出现=马上涨，需要价格自身的确认。',
    whatToDo: '列入"重点观察"名单。等价格突破最近的下降趋势线+出现一根大阳线=确认。',
    triggerSignal: 'price = newLow AND RSI14 > priorRSILow',
  },
  {
    id: 'rsi-divergence-bear', category: 'TECHNICAL', severity: 'WARNING',
    title: '{symbol} RSI顶背离 — 价格新高但指标不再新高 ⚠️',
    whatHappened: '股价创了新高，但RSI没有跟着创新高——"顶背离"。',
    whatItMeans: '价格在涨，但"涨的力度在衰减"——多头力量在消耗。顶背离是最强的见顶信号之一。注意：大牛市中顶背离可以维持很久（像"狼来了"），但真来的时候很猛。',
    whatToDo: '持仓→逐步止盈（分批卖，不是一口气全卖）。没持仓→别追高。',
    triggerSignal: 'price = newHigh AND RSI14 < priorRSIHigh',
  },
  {
    id: 'macd-golden-cross', category: 'TECHNICAL', severity: 'INFO',
    title: '{symbol} MACD金叉 — 短期动能转多 🟢',
    whatHappened: 'MACD线（短期趋势）从下方向上穿过了信号线——买入信号。',
    whatItMeans: '比均线金叉更灵敏——MACD金叉通常走在价格之前，能更早捕捉到趋势变化。但也更吵——在盘整行情中MACD会反复金叉死叉（"来回打脸"）。',
    whatToDo: '如果在0轴上方金叉=强多信号（趋势延续）。如果在0轴下方金叉=弱多信号（可能只是反弹）。',
    triggerSignal: 'MACD_line crossedAbove MACD_signal',
  },
  {
    id: 'macd-death-cross', category: 'TECHNICAL', severity: 'WARNING',
    title: '{symbol} MACD死叉 — 动能转空 🔴',
    whatHappened: 'MACD线从上方向下穿过了信号线——卖出信号。',
    whatItMeans: '比均线死叉更灵敏但噪音更多。在0轴上方死叉=可能只是横盘整理。在0轴下方死叉=空头加速。',
    whatToDo: '0轴上方死叉→可以等等（可能只是正常回调）。0轴下方死叉→减仓。',
    triggerSignal: 'MACD_line crossedBelow MACD_signal',
  },
  {
    id: 'bollinger-squeeze', category: 'TECHNICAL', severity: 'INFO',
    title: '{symbol} 布林带收窄 — 暴风雨前的宁静 🎯',
    whatHappened: '布林带的上下轨越收越窄——价格波动在"压缩"。',
    whatItMeans: '布林带收窄=市场共识在凝聚=大行情在酝酿。历史上布林带收窄越久，接下来爆发的行情越大。方向不确定——可能向上突破也可能向下突破。',
    whatToDo: '别在布林带收窄时开方向性仓位——你的胜率只有50%。等"突破"方向确认后再跟。突破+放量=真突破，突破+无量=假突破。',
    triggerSignal: 'BB_width < 20th_percentile_of_6m',
  },
  {
    id: 'bollinger-band-walk', category: 'TECHNICAL', severity: 'WARNING',
    title: '{symbol} 股价沿布林带上轨"爬行" — 强趋势中 🚀',
    whatHappened: '股价贴着布林带上轨连续走了好几根蜡烛——不是在"回调"，是沿着上轨在"爬"。',
    whatItMeans: '"布林带爬行"=最强的单边趋势——上涨能量极强，不给你回调进场的机会。但同时意味着超买——一旦停住，回调会很猛。',
    whatToDo: '如果在车上（已经持仓）→坐稳别被甩下车。如果没上车→追涨风险大（已经在"加速"阶段）。等一根阴线回调到布林带中轨再考虑。',
    triggerSignal: 'price close to BB_upper for 5+ consecutive candles',
  },

  // ═══════════ BREAKOUT (突破/破位) — 8条 ═══════════

  {
    id: 'resistance-breakout', category: 'BREAKOUT', severity: 'WARNING',
    title: '{symbol} 突破阻力位！上方空间打开🔓',
    whatHappened: '股价放量突破了之前多次被挡回来的价格位置（阻力位）。',
    whatItMeans: '"挡了很多次的墙终于被推倒了"——多头终于压过了空头的防守。突破后原来的阻力位=变成了新的支撑位。关键：必须放量突破，无量突破=假突破。',
    whatToDo: '别追——等价格回踩（回落到刚突破的位置确认支撑）。回踩不破+缩量=最佳入场点。',
    triggerSignal: 'price > lastResistanceLevel AND volume > avgVolume20 * 1.3',
  },
  {
    id: 'support-breakdown', category: 'BREAKOUT', severity: 'ALERT',
    title: '{symbol} 跌破支撑位！下方空间打开⚠️',
    whatHappened: '股价跌破了之前多次反弹的价格位置（支撑位）。',
    whatItMeans: '"地板被踩穿了"——空头力量压过了之前的所有买方防线。跌破后原来支撑位=变成了阻力位（之前没卖的人现在急着"回本卖"）。',
    whatToDo: '果断止损——支撑位破了=计划外的行情来了，别等"还能回来"（大多数时候回不来）。',
    triggerSignal: 'price < lastSupportLevel AND volume > avgVolume20',
  },
  {
    id: 'all-time-high', category: 'BREAKOUT', severity: 'INFO',
    title: '{symbol} 创历史新高！— 没有套牢盘了 🏆',
    whatHappened: '股价突破了有史以来的最高价——现在所有持有者全都在赚钱。',
    whatItMeans: '"蓝天行情"——上方没有历史套牢盘的阻力，空间理论上无限。但注意：新高之后必然有回调——获利盘总要兑现一部分。',
    whatToDo: '新高后的回调是最好的入场点（如果你真的长线看好这只股票）。别在创新高那一刻追——等获利盘消化完再说。',
    triggerSignal: 'price >= allTimeHigh',
  },
  {
    id: 'trendline-break-bull', category: 'BREAKOUT', severity: 'WARNING',
    title: '{symbol} 突破下降趋势线 — 趋势可能反转了 🔄',
    whatHappened: '股价突破了长期压制它的下降趋势线（一路在跌但突然向上突破）。',
    whatItMeans: '"压在身上的天花板被掀开了"——长期下跌趋势可能结束。突破趋势线+放量确认=反转概率高。突破但无量=可能是假突破。',
    whatToDo: '等回踩趋势线（现在的支撑位）确认后入场。趋势线突破后的回踩是最经典的买点之一。',
    triggerSignal: 'price crossedAbove descending_trendline AND volume > avgVolume20',
  },
  {
    id: 'trendline-break-bear', category: 'BREAKOUT', severity: 'ALERT',
    title: '{symbol} 跌破上升趋势线 — 上涨趋势可能结束了 ⚠️',
    whatHappened: '股价跌破了长期支撑它的上升趋势线（一直在涨但突然跌破）。',
    whatItMeans: '"地板裂了"——上涨趋势可能中断。跌破趋势线+放量=确认趋势变化。无量跌破=可能只是"假摔"。',
    whatToDo: '减仓观望——趋势线破了不是"一定完蛋"，但风险在升高。等趋势线重新站回去再说。',
    triggerSignal: 'price crossedBelow ascending_trendline AND volume > avgVolume20',
  },
  {
    id: 'pattern-head-shoulders', category: 'BREAKOUT', severity: 'ALERT',
    title: '{symbol} 检测到头肩顶形态 — 经典见顶信号 ⚠️',
    whatHappened: 'AI识别到了头肩顶形态——左肩→头部（最高点）→右肩（比头低）→跌破颈线。',
    whatItMeans: '头肩顶是顶级可信的看跌反转形态——统计胜率约70-80%。一个"涨→回→涨到更高→回→涨但没之前高"的过程，最后买方力量耗尽。',
    whatToDo: '如果持有→减仓或设止损（跌破颈线=形态确认）。颈线跌破后的目标跌幅≈从头部到颈线的距离。',
    triggerSignal: 'pattern head_and_shoulders_top detected AND neckline broken',
  },
  {
    id: 'pattern-double-bottom', category: 'BREAKOUT', severity: 'INFO',
    title: '{symbol} 双底形态 — "W底"正在形成 🏔️',
    whatHappened: '价格两次跌到差不多同一位置都反弹回来了——"跌不动了"。',
    whatItMeans: '两次测试底部都被守住=下方有强支撑。"W底"形态中突破颈线（两个底部之间的反弹高点）=形态确认=看多。',
    whatToDo: '等突破颈线+放量确认。不要在地板位置买（可能跌穿第二次）。等颈线突破后再动手。',
    triggerSignal: 'pattern double_bottom detected AND price approaching neckline',
  },
  {
    id: 'pattern-ascending-triangle', category: 'BREAKOUT', severity: 'INFO',
    title: '{symbol} 上升三角形 — 多方在蓄力 📐',
    whatHappened: '价格的高点被一条水平线压着，但低点不断抬高——形成一个"楔入"的形状。',
    whatItMeans: '空头死守一个价位（水平线=阻力），但多头力量在不断增强（低点抬高）。这是"即将突破"的形态——向上突破概率约75%。',
    whatToDo: '等突破水平线阻力位——一旦放量突破=形态确认=向上。如果迟迟不突破而跌破上升的下沿线=形态失败→出。',
    triggerSignal: 'pattern ascending_triangle detected AND price near resistance',
  },

  // ═══════════ MONEY_FLOW (资金流向) — 6条 ═══════════

  {
    id: 'big-order-buy', category: 'MONEY_FLOW', severity: 'WARNING',
    title: '{symbol} 出现超大买单 — 主力在吃货 🐋',
    whatHappened: '出现了特大单买盘——一笔买入量远超其他单子。通常来自机构。',
    whatItMeans: '"大鱼在吃"——机构在累积筹码。如果连续多日出现买盘大单=机构正在建仓。注意：大单也可能是"对倒"（左手倒右手制造交易量假象），所以要结合价格方向看。',
    whatToDo: '连续3天+出现买盘大单=强信号。单日出现=观察（可能是单一机构行为）。',
    triggerSignal: 'buyOrderSize > 10 * avgOrderSize OR consecutiveBigOrders >= 3',
  },
  {
    id: 'big-order-sell', category: 'MONEY_FLOW', severity: 'ALERT',
    title: '{symbol} 出现超大卖单 — 主力在撤退 🐻',
    whatHappened: '出现了特大单卖盘——机构在大量卖出。',
    whatItMeans: '"大鱼在跑"——可能是基金赎回/调仓/投行评级下调。如果同时伴随大宗交易（block trade）=主动型卖出，不是被动赎回。',
    whatToDo: '特大单卖出+价格跌破关键支撑=赶紧跑。特大单卖出但价格没跌=有其他机构在接盘→观望。',
    triggerSignal: 'sellOrderSize > 10 * avgOrderSize',
  },
  {
    id: 'institutional-buying', category: 'MONEY_FLOW', severity: 'INFO',
    title: '{symbol} 机构连续增持 — {consecutiveDays}天持续流入 💼',
    whatHappened: '机构级别资金连续{consecutiveDays}个交易日净流入。',
    whatItMeans: '机构在做"长期布局"——机构资金不像散户一天买一天卖，他们的建仓往往持续数周。连续净流入=这是"认可"的信号。',
    whatToDo: '机构净流入≠马上要涨——他们在"慢慢买"压低价格波动。但中长期是利好——机构的买入给了价格"地板"。',
    triggerSignal: 'institutionalNetInflow > 0 for {consecutiveDays} consecutive days',
  },
  {
    id: 'short-squeeze-warning', category: 'MONEY_FLOW', severity: 'CRITICAL',
    title: '{symbol} 空头挤压！大量空头被逼仓 🤯',
    whatHappened: '卖空比例极高（{shortPct}%）+股价突然快速拉升。大量做空的人现在都在亏钱，被迫买回来——"空头挤压"。',
    whatItMeans: '"空头踩踏"——做空的人亏多了必须止损（买回来平仓），这一买反而把价格推得更高，更多空头爆仓，形成恶性循环。这是最猛的短期上涨力量之一——曾经的GME暴涨就是这样。',
    whatToDo: '如果你在车上→hold住（空头挤压可能持续数日）。如果你没在车上→别追——空头挤压结束后价格通常大幅回落。',
    triggerSignal: 'shortRatio > 20% AND priceSurge > 10% in 1d',
  },
  {
    id: 'margin-call-risk', category: 'MONEY_FLOW', severity: 'CRITICAL',
    title: '{symbol} 融资盘风险！融资余额占比达 {marginPct}% ⚠️',
    whatHappened: '这只股票的融资买入（借钱买）占比极高——很多人是用杠杆在持有它。',
    whatItMeans: '高融资比例=高风险——一旦价格下跌，融资盘会被券商强平（券商强行卖出），进一步压低价格，形成"连锁强平→加速下跌"的死亡螺旋。',
    whatToDo: '如果你自己不是用融资买的→你的持股不受影响，但要知道"别人在卖"会拖累你。建议设好止损位。',
    triggerSignal: 'marginBalance > marketCap * 10% OR marginRatio increasing rapidly',
  },
  {
    id: 'north-bound-surge', category: 'MONEY_FLOW', severity: 'WARNING',
    title: '{symbol} 北向资金大幅流入 — 外资在扫货A股 🌏',
    whatHappened: '通过沪/深港通，外资单日净流入A股超过{hkFlow}亿——"外资在扫货"。',
    whatItMeans: '北向资金=外资通过香港进入A股的资金。被称为"聪明钱"——历史上其持续流入/流出方向准确预判了多次A股大波段。但注意：北向也有"交易型"资金(短期)和"配置型"资金(长期)。',
    whatToDo: '单日流入→不足为证。连续1周流入→聪明钱在加仓A股。连续流出→系统性风险在升高。',
    triggerSignal: 'dailyNorthBoundNetInflow > {hkFlow}B RMB',
  },

  // ═══════════ MARKET_WIDE (市场级异动) — 6条 ═══════════

  {
    id: 'vix-spike', category: 'MARKET_WIDE', severity: 'CRITICAL',
    title: 'VIX恐慌指数飙到 {vix} — 市场在恐慌！😱',
    whatHappened: 'VIX（恐慌指数/标普波动率预期）突然飙到了{vix}——正常在15-20之间。',
    whatItMeans: 'VIX>30="市场在恐慌"。VIX>40="市场在极度恐慌——历史上这通常意味着抛售快结束了"。VIX跟大盘是反向的——VIX飙=大盘跌。',
    whatToDo: 'VIX>30→别急着抄底（交易尚未平静）。VIX>40→开始寻找被误杀的优质公司。VIX开始回落→市场在冷静，可能是入场窗口。',
    triggerSignal: 'VIX > 30',
  },
  {
    id: 'sector-wide-meltdown', category: 'MARKET_WIDE', severity: 'ALERT',
    title: '{sector}板块集体下挫 — {dropPct}% 🚨',
    whatHappened: '整个{sector}板块几乎所有的股票都在跌——不是个别股票的问题，是板块系统性下跌。',
    whatItMeans: '板块集体下跌=有宏观/政策层面的利空（不是某家公司的个别问题）。区分：是政策打击（如反垄断）还是宏观（如利率上升）。政策→可能长期影响，宏观→可能是暂时的。',
    whatToDo: '不要在板块集体下跌时"捡便宜"——你不知道底在哪。等板块企稳（多数股票不再创新低）+选板块内最优质的公司。',
    triggerSignal: 'sectorDeclineBroad > 80%_stocks_in_sector AND avgDrop > 2%',
  },
  {
    id: 'sector-rotation', category: 'MARKET_WIDE', severity: 'INFO',
    title: '板块轮动中 — 钱从{fromSector}流向了{toSector} 🔄',
    whatHappened: '资金从{fromSector}板块流出，大量流入了{toSector}板块——市场在"换赛道"。',
    whatItMeans: '板块轮动=正常的市场行为——高位的获利了结+低位的布局。比如：科技涨太多→钱流向金融→银行涨。跟上板块轮动=跟上"聪明钱的节奏"。',
    whatToDo: '关注{toSector}中的龙头股——板块轮动中龙头先涨，后排才跟。{fromSector}的仓位→减仓观望等资金回流信号。',
    triggerSignal: 'sectorFlowDivergence > 2 * std AND fromSector outflow AND toSector inflow',
  },
  {
    id: 'circuit-breaker-watch', category: 'MARKET_WIDE', severity: 'CRITICAL',
    title: '熔断预警！标普接近一级熔断 (-{pct}%) 🚨',
    whatHappened: '标普500指数跌幅接近{level}级熔断阈值（-{pct}%）。这意味着如果继续跌到该位置，交易会被暂停15分钟。',
    whatItMeans: '熔断=市场情绪极度恐慌。一级熔断(-7%)=15分钟冷静期。二级(-13%)=再停15分钟。三级(-20%)=当天停盘。注意：熔断期间无法交易——如果你的止损单在熔断后还没成交，可能要以更低价格成交。',
    whatToDo: '如果在熔断发生前→提前设好"熔断后的可能成交价"的止损单。熔断期间→冷静。熔断恢复后→看市场是"继续跌"还是"反弹"。',
    triggerSignal: 'SPX decline approaching -7%',
  },
  {
    id: 'yield-curve-inversion', category: 'MARKET_WIDE', severity: 'ALERT',
    title: '美债收益率倒挂 — 2年>{tenYear}% > 10年={twoYear}% ⚠️',
    whatHappened: '短期国债收益率({twoYear}%)高于长期国债收益率({tenYear}%)——"利率倒挂"。',
    whatItMeans: '正常情况：长期债>短期债（因为锁死钱更久需要更多回报）。倒挂=市场预期未来经济要出问题，央行会降息救经济。历史上每次倒挂后12-24个月内都有经济衰退——但不是明天就衰退。',
    whatToDo: '倒挂=未来12-18个月谨慎——减少周期性行业仓位(能源/工业)，增加防御性配置(公用事业/消费必需品)。不等于是明天就清仓。',
    triggerSignal: 'US2Y_yield > US10Y_yield',
  },
  {
    id: 'usd-surge', category: 'MARKET_WIDE', severity: 'WARNING',
    title: '美元指数飙升到 {dxy} 💵',
    whatHappened: '美元指数(DXY)快速升值——美元正在强势走强。',
    whatItMeans: '美元涨=新兴市场受伤(美元债务更贵)+大宗商品受压(非美元买家买不起)+美股跨国企业盈利受损(海外营收折算美元少了)。对A股=北向资金可能流出(人民币贬值预期)。',
    whatToDo: '美元强势期→减少新兴市场(A股/港股)仓位+减少大宗商品相关仓位。美元强势期→美股中的内需型公司(不靠海外营收)相对抗跌。',
    triggerSignal: 'DXY > recentHigh OR DXY_change1m > 3%',
  },

  // ═══════════ OPTIONS (期权异动) — 3条 ═══════════

  {
    id: 'unusual-options-volume', category: 'OPTIONS', severity: 'WARNING',
    title: '{symbol} 期权成交量暴增 — "聪明钱"在赌方向 🎰',
    whatHappened: '这只股票的期权成交量是平时的{multiple}倍——有大资金在"赌"方向。',
    whatItMeans: '期权大单=机构在布局"大行情"。CALL（看涨期权）量飙升=赌大涨。PUT（看跌期权）量飙升=赌大跌或对冲风险。区分：对冲(持有股票买PUT保护) vs 方向性赌博(裸买CALL/PUT)。',
    whatToDo: '如果是CALL量暴增+股价在涨=市场在定价"好事情要发生"。PUT量暴增+股价在跌=预期"坏消息"。没有持仓不要去赌——你比机构晚一步进去。',
    triggerSignal: 'optionsVolume > avgOptionsVolume * 5',
  },
  {
    id: 'put-call-skew', category: 'OPTIONS', severity: 'WARNING',
    title: '{symbol} 看跌/看涨比飙升至 {putCallRatio} — 市场在害怕！😨',
    whatHappened: 'PUT（看跌期权）的成交量远比CALL（看涨期权）多——"大家都在买保险"。',
    whatItMeans: 'PCR=Put/Call Ratio。PCR>1=看跌压倒性多于看涨——市场极度恐惧。反向指标：当PCR极端高(>1.5)时，往往意味着"恐慌过头了"——所有人都买了保险了，真正的风险也就消化了。',
    whatToDo: 'PCR极高(>1.5)→反向思维——可能接近短期底部。PCR正常(0.7-1.0)→正常。PCR极低(<0.5)→过度乐观，也可能是顶部信号。',
    triggerSignal: 'putCallVolumeRatio > 1.2',
  },
  {
    id: 'max-pain-level', category: 'OPTIONS', severity: 'INFO',
    title: '{symbol} 期权到期日临近 — 最大痛点=\${maxPain} ⚖️',
    whatHappened: '期权到期日（每月第三个周五）快到了。最大痛点（让最多期权作废的价格）在${maxPain}。',
    whatItMeans: '期权到期日之前，股价往往会被"拉向"最大痛点——因为期权卖方（通常是大机构）想让你手里的期权变废纸。这不是阴谋论——是期权市场结构决定的"磁吸效应"。',
    whatToDo: '到期日前的最后两天→别开新的方向性仓位（价格可能被"拉偏"）。到期后→价格可以"自由"移动了。',
    triggerSignal: 'daysToOptionsExpiry <= 3',
  },

  // ═══════════ TIMING (时间窗口异动) — 2条 ═══════════

  {
    id: 'earnings-in-3d', category: 'TIMING', severity: 'WARNING',
    title: '{symbol} 财报在{day}天后发布 — IV正在升高 📅',
    whatHappened: '财报将在{day}天后发布。历史波动率显示，财报发布后股价平均波动{avgMove}%。',
    whatItMeans: '财报=高波动事件——公司公布业绩后股价可能大涨也可能大跌。财报前的"隐含波动率飙升"=期权变贵（买不起保护）。财报后的"波动率崩塌"=期权的赌博时间结束了。',
    whatToDo: '如果你不赌财报→提前减仓或买了PUT保护。如果你赌财报→看历史beat率：如果公司连续4次超预期=大概率继续超。',
    triggerSignal: 'days_to_earnings <= 5',
  },
  {
    id: 'pre-market-move', category: 'TIMING', severity: 'WARNING',
    title: '{symbol} 盘前涨/跌 {pct}% — 今天可能是个大日子 🌅',
    whatHappened: '盘前交易时段股价波动了{pct}%。盘前交易量只有正常盘中的5-10%，但也反映了"有信息的人抢先交易"。',
    whatItMeans: '盘前大涨=有明确利好+机构在抢筹（盘前流动性差，成本高也要买=非常看好）。盘前大跌=有明确利空。但盘前的方向不一定延续到盘中——9:30开盘后流动性恢复，价格可能被"纠正"。',
    whatToDo: '盘前交易→不做投资决策的最终依据，只做参考。等开盘后30分钟确认方向。',
    triggerSignal: 'preMarketChange > 3% OR preMarketChange < -3%',
  },
];

// ═══════════════ 分类组织 ═══════════════

export const ANOMALY_CATEGORIES = [
  { id: 'PRICE', name: '💰 价格异动', count: 8, description: '涨跌超预期——跳空、反转、新高低' },
  { id: 'VOLUME', name: '📊 量能异动', count: 7, description: '成交量异常——放量、缩量、天量' },
  { id: 'TECHNICAL', name: '🔧 技术信号', count: 10, description: '金叉死叉、RSI极值、背离、形态' },
  { id: 'BREAKOUT', name: '💥 突破/破位', count: 8, description: '支撑阻力突破、新高新低' },
  { id: 'MONEY_FLOW', name: '💹 资金异动', count: 6, description: '大单、机构、空头挤压、北向资金' },
  { id: 'MARKET_WIDE', name: '🌍 市场系统', count: 6, description: 'VIX、板块轮动、熔断、利率倒挂' },
  { id: 'OPTIONS', name: '🎯 期权信号', count: 3, description: '期权异动、PCR、到期日' },
  { id: 'TIMING', name: '📅 时间窗口', count: 2, description: '财报临近、盘前异动' },
];

// ═══════════════ 工具函数 ═══════════════

export function getAnomalyTemplate(id: string): AnomalyTemplate | undefined {
  return ANOMALY_TEMPLATES_50.find(t => t.id === id);
}

export function getAnomaliesByCategory(cat: string): AnomalyTemplate[] {
  return ANOMALY_TEMPLATES_50.filter(t => t.category === cat);
}

export function getAnomaliesBySeverity(sev: string): AnomalyTemplate[] {
  return ANOMALY_TEMPLATES_50.filter(t => t.severity === sev);
}

export function formatAnomalyPush(template: AnomalyTemplate, vars: Record<string, string>): { title: string; body: string; severity: string } {
  let title = template.title;
  let whatHappened = template.whatHappened;
  let whatItMeans = template.whatItMeans;
  let whatToDo = template.whatToDo;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{${k}\\}`, 'g');
    title = title.replace(re, v);
    whatHappened = whatHappened.replace(re, v);
    whatItMeans = whatItMeans.replace(re, v);
    whatToDo = whatToDo.replace(re, v);
  }
  return {
    title,
    body: `${whatHappened}\n\n💡 ${whatItMeans}\n\n🎯 ${whatToDo}`,
    severity: template.severity,
  };
}

export default ANOMALY_TEMPLATES_50;
