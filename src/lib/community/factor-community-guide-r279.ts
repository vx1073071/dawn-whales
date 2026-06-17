// ══ R279 QClaw Task 3: 社区引导文案 (3h) ══
// 交付: src/lib/community/factor-community-guide-r279.ts
//
// 覆盖: 因子社区全体验——欢迎/规则/因子PK/模板市场/创作者体系/引导漏斗

export const FACTOR_COMMUNITY_GUIDE = {

  // ═══════════ 社区总览 ═══════════
  overview: {
    name: "因子公会",
    nameEn: "Factor Guild",
    tagline: "切磋因子的地方——不是喊单的地方",
    description: "因子公会是 QUANT MOO 用户创建、分享、PK、销售因子策略的地方。这里有模板市场、因子对决、策略讨论——用数据说服人，不用嗓门。",

    valueProps: [
      { emoji: "🏆", title: "水平说话", desc: "你的准确率＞你的粉丝数。等级由实盘信号准确率决定，不是点赞数。" },
      { emoji: "📊", title: "数据PK", desc: "「我觉得这个因子好」不算数。拿出IC、夏普、回撤来对决。" },
      { emoji: "💰", title: "知识变现", desc: "好因子模板可以上架市场卖钱。创作者最高拿90%分成。" },
      { emoji: "🐋", title: "Whaley裁判", desc: "所有PK由Whaley公正裁决——数据说话，不站队。" },
    ],
  },

  // ═══════════ 新用户引导 — 5分钟上手 ═══════════
  onboarding: {
    welcome: {
      title: "👋 欢迎来到因子公会！",
      body: "你不是一个人在研究因子了。这里有上千人用同样的工具，你可以：偷学别人的因子配方、拿自己的因子和别人PK、把你的看家本领打包卖钱。",
      steps: [
        { step: 1, emoji: "👀", title: "逛一逛模板市场", desc: "看看别人在用什么因子组合。免费模板可以直接导入你的工作区。每个模板都有真实回测数据。" },
        { step: 2, emoji: "⚔️", title: "围观一场因子对决", desc: "比如「ROE vs PE哪个选股更准？」——看双方拿数据怎么吵。这是最快的学习方式。" },
        { step: 3, emoji: "📤", title: "分享你自己的因子", desc: "把你常用的因子组合发到讨论区。哪怕最简单的，也会有人给你建议。" },
        { step: 4, emoji: "🏆", title: "升级你的公会等级", desc: "每赚1点准确率分=离创作者更近一步。模板买的人多了=自动升级=分成高到90%。" },
      ],
    },

    quickStart: {
      title: "⚡ 3分钟创建你的第一个因子帖子",
      steps: [
        { action: "点击「+ 分享因子」", detail: "在顶部导航栏。或在任何因子卡片上点「分享到公会」。" },
        { action: "选一个因子或因子组合", detail: "可以是一个单因子（如ROE），也可以是一组（如PE+ROE+F-Score=深度价值筛选）。" },
        { action: "Whaley自动生成回测数据", detail: "你的因子过去5年的表现——IC/夏普/最大回撤/胜率——会自动附在你的帖子里。" },
        { action: "加一句人话解释", detail: "「我用这个因子筛A股金融股，因为……」——这就够了。不需要论文。" },
        { action: "发布", detail: "你的处女帖现在会被整个公会看到。别紧张——大家都是从零开始的。" },
      ],
    },

    firstPostPrompt: {
      title: "不知道发什么？Whaley给你几个开头：",
      prompts: [
        "「我最近发现{行业}板块用{因子}特别好用——IC 0.045，比全市场高50%。有人一起验证吗？」",
        "「{因子A}和{因子B}在{市场}里谁更有效？我跑了回测结果是A赢，但我的数据可能有问题，求挑刺。」",
        "「这是我的{场景}因子组合，回测年化超额4.2%。求高手看看有没有过拟合陷阱。」",
        "「求助：为什么{因子}在{市场环境}下就失效了？学术论文说应该有效啊。附图回测对比。」",
      ],
    },
  },

  // ═══════════ 因子对决 (Factor PK) ═══════════
  pk: {
    title: "⚔️ 因子对决",
    tagline: "两个因子（或组合），一场数据对决。Whaley当裁判。",
    description: "因子对决不是比谁喊得响——是比谁的因子在回测中表现更好。量化投资的精髓就是用数据替代直觉。",

    howToStart: {
      title: "如何发起对决",
      steps: [
        { icon: "1️⃣", text: "选两个因子或组合——可以是你自己的 vs 别人的" },
        { icon: "2️⃣", text: "Whaley自动拉取双方回测数据——IC、夏普、最大回撤、胜率、信息比" },
        { icon: "3️⃣", text: "设定PK维度——总回报？风险调整？特定市场环境？" },
        { icon: "4️⃣", text: "发布对决——公会投票+评论。7天后Whaley宣布胜者。" },
      ],
    },

    dimensions: [
      { id: "total_return", name: "总回报", desc: "5年年化超额收益（相对基准）", meaning: "分高者胜" },
      { id: "sharpe", name: "夏普比率", desc: "风险调整后收益", meaning: "回报相同下谁更稳" },
      { id: "max_drawdown", name: "最大回撤", desc: "5年内最大跌幅", meaning: "谁更扛揍" },
      { id: "win_rate", name: "胜率", desc: "月度跑赢基准的比例", meaning: "谁更稳定赢" },
      { id: "ic_stability", name: "IC稳定性", desc: "IC的标准差——因子信号是否稳定", meaning: "今年好明年差的不行" },
      { id: "regime_robust", name: "全周期稳健性", desc: "牛市/熊市/震荡市的平均表现", meaning: "换个市场还能用才是真功夫" },
    ],

    voting: {
      title: "投票规则",
      rules: [
        "每人每局一票。",
        "投票时须附理由——「我觉得」不算有效理由，需要引用至少一个数据维度。",
        "纯情绪投票（无数据理由）会被Whaley标记但不扣分——只是显得不专业。",
        "投票公开显示——你的投票记录是你公会声誉的一部分。",
      ],
      copy: {
        voteButton: "🗳️ 投一票",
        votePlaced: "✅ 已投票",
        reasonPlaceholder: "为什么你认为这个因子更好？（需要提到至少一个数据维度，如「IC更稳定」）",
        voteTip: "有效投票=数据理由。无效投票=「我觉得这个好」——会被 Whaley 打上「感性票」标签。",
      },
    },

    result: {
      winAnnounce: "🏆 胜者：{winner}！详细比分：{votes_for}:{votes_against} 票。",
      drawAnnounce: "🤝 平局！双方各得{votes}票。这说明两个因子在不同的应用场景各有优劣。",
      whaleyVerdict: "🐋 Whaley的裁判意见：{verdict_text}",
      verdictExamples: [
        "「两个因子在回测中旗鼓相当。但因子A的IC稳定性明显更好——标准差0.02 vs 因子B的0.05。稳定性在实盘中比峰值表现重要得多。所以我判A胜。」",
        "「因子B的总回报更高，但这主要是2020年一年打出来的。剔除2020年，因子B的年化超额就只剩1.1%了。不能靠一年数据给冠军。」",
        "「这场对决揭示了一个有趣现象：因子A在低波动环境下表现好，因子B在高波动环境下表现好。它们不矛盾——是互补的。建议同时使用。」",
      ],
    },

    challenge: {
      title: "发起挑战",
      prompt: "看到有人分享了一个因子组合你觉得不认同？不要吵，用数据对决。",
      button: "⚔️ 发起因子对决",
      message: "{challenger} 向你发起因子对决！接受还是拒绝？有24小时回应。",
      accept: "🤝 接受挑战",
      decline: "🙅 婉拒（不扣分——也许你正在优化中）",
    },
  },

  // ═══════════ 模板市场 ═══════════
  marketplace: {
    title: "🏪 模板市场",
    tagline: "好策略不应该寂寞——上架、被买、赚钱",
    description: "将你的因子组合打包成策略模板，在市场中出售。创作者按销量升级：L1新手(30%分成)→L2进阶(20%)→L3旗舰(10%)。最低9.9 USDT/件。无需KYC，纯USDT内部钱包。",

    seller: {
      title: "🎨 卖什么？",
      categories: [
        { name: "单因子模板", example: "「我的PE_ROE筛选模板」——把你验证过的因子参数和用法打包" },
        { name: "策略组合", example: "「A股银行股深度价值6因子」——多因子组合+行业特定参数" },
        { name: "场景打包", example: "「抄底工具箱：F-Score+Z-Score+内部人+PB」——完整的决策流程" },
      ],
      quality: {
        mustHave: [
          "✅ 至少2年回测数据（IC/夏普/最大回撤/胜率）",
          "✅ 清晰的使用说明——什么时候用、什么时候不用",
          "✅ 因子权重和参数的具体数值",
          "✅ 已知的弱点/失败场景（诚实=信任=更多购买）",
        ],
        niceToHave: [
          "⭐ 不同市场的回测对比",
          "⭐ 实时更新的信号样例",
          "⭐ 与其他因子的对比分析",
          "⭐ 回答购买者的提问(每条回答+0.1准确率分)",
        ],
        redFlags: [
          "🚫 只说好的、不说坏的——全赢的策略=藏了实话",
          "🚫 回测数据太少(<1年)——没有说服力",
          "🚫 因子来源不透明——黑箱配方没人敢买",
          "🚫 保证收益——任何保证都是必须举报的红线",
        ],
      },
    },

    buyer: {
      title: "🛍️ 买模板的正确姿势",
      tips: [
        "先看回测数据——IC和夏普是最关键的。不要被标题党的「年化80%」忽悠。",
        "看作者等级——L3旗舰创作者平均质量更高。但L1新手也有黑马。",
        "读评论——尤其是低分评论。好评可能是刷的，差评通常是真的。",
        "注意回测区间——2020-2021年的回测数据极度乐观(放水)。看2022年熊市表现才是真功夫。",
        "买之前问问题——如果创作者不回，说明售后不负责。",
        "Whaley帮你交叉验证——购买后可以用你自己的数据跑一遍回测。结果差距>20%？可以发起退款仲裁。",
      ],
      purchase: {
        button: "🛒 购买 (9.9 USDT)",
        confirm: "确认用9.9 USDT积分购买「{templateName}」？积分从你的钱包直接扣。不满意7天内可发起仲裁。",
        success: "✅ 购买成功！模板已添加到你的工作区。去「我的模板」查看。",
        refund: {
          title: "申请退款",
          reason: "为什么想退？（Whaley会验证你的回测数据是否与模板声称的有显著差距）",
          result: "Whaley验证后,{outcome}。{detail}",
        },
      },
    },
  },

  // ═══════════ 创作者等级体系 ═══════════
  creatorLevels: {
    title: "🏅 创作者等级",
    tagline: "你的销量决定你的地位——不是粉丝数、不是注册时间、不是充了多少钱。",
    levels: [
      {
        level: 1, name: "新手", emoji: "🌱",
        condition: "注册即可上架",
        revenueShare: "70%你拿，30%平台",
        unlock: "上架权限+基本统计数据",
        tip: "每个L3都是从第一条模板开始的。别怕——没人第一次就完美。",
      },
      {
        level: 2, name: "进阶", emoji: "🌿",
        condition: "累计销量 ≥ 100笔",
        revenueShare: "80%你拿，20%平台",
        unlock: "解锁社区徽章+优先推荐+专属数据分析",
        tip: "100笔不是小数目——你需要至少2-3个高质量模板+持续维护和回答购买者问题。",
      },
      {
        level: 3, name: "旗舰", emoji: "🌳",
        condition: "累计销量 ≥ 1,000笔",
        revenueShare: "90%你拿，10%平台",
        unlock: "专属创作者页面+首页推荐位+Whaley定制分析+策略审计服务",
        tip: "L3是你作为因子创作者的最高荣誉。从这里开始，你在公会里说话的分量和国家队分析师一样重。",
      },
    ],
    progress: "{current}/{target}销量。加油！",
    noHandshake: "⚠️ 等级只看销量，不看粉丝数/点赞/好评率。刷单行为将被人工审核——发现刷单直接降回L1。",
  },

  // ═══════════ 公会礼仪和防作弊 ═══════════
  etiquette: {
    title: "📜 公会守则",
    principles: [
      { icon: "📊", rule: "数据＞意见", detail: "你可以说「我认为这个因子好」，但必须跟上「因为它的IC是0.04」。纯意见帖会被沉底。" },
      { icon: "🤝", rule: "争对错＝一起学习", detail: "因子对决不是为了赢口气，是为了让围观者学到东西。赢家不炫耀，输家不记仇。" },
      { icon: "🔍", rule: "质疑但要给证据", detail: "你认为别人的回测有问题？拿出你的数据。一句「你这个回测有问题」是噪音。" },
      { icon: "🌱", rule: "善待新手", detail: "每个人都是从PE是什么都不知道过来的。对新手的简单问题，耐心解释的人获得「公会导师」徽章。" },
      { icon: "🚫", rule: "绝对禁止", detail: "喊单、保证收益、人身攻击、恶意刷票。犯一次警告，犯两次永久禁言。" },
      { icon: "🐋", rule: "Whaley掌舵", detail: "所有争议由Whaley依据数据裁决。Whaley的判决是最终判决——因为它的算法比任何人都更了解回测和统计。" },
    ],
    antiCheat: {
      title: "🛡️ 防作弊系统",
      items: [
        "销量审计：异常购买模式（同一IP秒购多份/自买自卖/对刷）自动标记人工审核",
        "刷票检测：PK投票异常分布（一方突然在凌晨3点获得50票）自动冻结",
        "小号检测：新注册账号只给别人的模板打5星好评=自动标记",
        "数据伪造：Whaley会验证你声称的回测结果。数据差距>20%=模板下架+降级",
        "申诉通道：如果你被误判，可以在「申诉专区」提交证据。Whaley会重新审查。",
      ],
    },
  },

  // ═══════════ 推送/通知文案 ═══════════
  notifications: {
    yourTemplateBought: "💰 {buyer} 购买了你的模板「{template}」！你获得了 {amount} USDT 分成。",
    levelUp: "🎉 恭喜升级到 L{level}《{levelName}》！你的分成比例现在是{share}%。继续加油！",
    pkInvited: "⚔️ {challenger} 向你发起了因子对决！面对「{rivalFactor}」，你的「{yourFactor}」敢应战吗？",
    pkResult: "🏆 你的因子在「{pkTitle}」对决中{result}！票数：{yourVotes}:{opponentVotes}。去看Whaley的裁决。",
    newComment: "💬 {commenter} 评论了你的模板「{template}」：「{preview}」",
    templateMilestone: "🎯 你的模板「{template}」刚刚达到 {sales} 笔销量里程碑！",
    communityTrending: "🔥 因子公会正在热议：「{topic}」。去看看大家都在讨论什么。",
  },

  // ═══════════ Whaley 的角色 ═══════════
  whaleyRole: {
    title: "🐋 Whaley在公会里的角色",
    roles: [
      { icon: "⚖️", role: "PK裁判", desc: "所有因子对决的最终裁决者。只看数据不看人。同一评判标准一视同仁。" },
      { icon: "🔬", role: "回测审计", desc: "验证模板市场所有产品的回测数据。差距>20%=下架。" },
      { icon: "📖", role: "社区助教", desc: "新人提问时自动补全学术背景和定义。让新手不用另外查论文。" },
      { icon: "🎯", role: "推荐引擎", desc: "根据你的交易风格和历史，推荐你可能感兴趣的模板和讨论。" },
      { icon: "🛡️", role: "秩序维护", desc: "检测刷票/刷单/人身攻击。不是警察——是裁判。" },
    ],
    disclaimer: "⚠️ Whaley不提供投资建议、不推荐任何特定模板、不背书任何创作者的策略。Whaley只做三件事：①验证数据 ②裁决对决 ③说明因子定义。",
  },

  // ═══════════ 权益保护 ═══════════
  rights: {
    title: "🔒 你的权利",
    ip: {
      title: "你的因子配方是你的知识产权",
      body: [
        "模板出售时，购买者获得的是**使用权**，不是所有权。",
        "购买者不能转售你的模板。转售=盗版=封号+赔偿。",
        "Whaley会检测模板市场的重复/抄袭。相似度>80%的模板自动标记+通知原创者。",
        "如果别人用你在讨论区免费分享的因子组合做了模板卖钱——这不违规。讨论区默认是公开知识。想卖钱就上架模板市场。",
      ],
    },
    refund: {
      title: "退款保护",
      body: "购买后7天内，如果Whaley验证你的回测与模板声称表现差距>20%，可以全额退款。但你不能退款的理由是「我用了没赚钱」——因子的表现有波动是正常的。",
    },
  },

  // ── 工具方法 ──
  getLevelInfo(level: number) {
    return this.creatorLevels.levels.find(l => l.level === level) ?? null;
  },
  getPKDimension(id: string) {
    return this.pk.dimensions.find(d => d.id === id) ?? null;
  },
  getNotification(type: string, params: Record<string, string>) {
    let tmpl = (this.notifications as any)[type];
    if (!tmpl) return '';
    for (const [k, v] of Object.entries(params)) {
      tmpl = tmpl.replace(`{${k}}`, v);
    }
    return tmpl;
  },
};

export default FACTOR_COMMUNITY_GUIDE;
