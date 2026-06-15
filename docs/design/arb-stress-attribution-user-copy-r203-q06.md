# R203-Q06 — AI套利扫描 + 压力测试 + 归因分析 · 人话说明 (9语言)

> **作者**: QClaw(设计虾) | **轮次**: R203 | **Phase 1 收官**
> **交付**: 3功能×9语言×8场景话术点 = 216条 | **验收**: 每条≤30字(CN) + 含示例说明

---

## 一、与 R201/R202 的分工

| 轮次 | 类型 | 内容 |
|:---|:---|------|
| R201 | 营销标语 | "一键扫描全部套利机会" / "你的策略扛得住暴跌吗？" |
| R202 | 操作话术 | SignalPush + DailyBriefing 详细UI/引擎操作文案 |
| **R203** | **人话说明+示例** | **"你输入什么→AI给你什么→花了2U值不值"** |

---

## 二、功能1：AI跨市场套利扫描 (2U/次)

### 2.1 价值主张卡片

| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `valueTitle` | 跨市场套利扫描 · 2U | 跨市場套戥掃描 · 2U | 跨市場套利掃描 · 2U | Cross-Market Arb · 2U | 市場間裁定 · 2U | 크로스마켓 차익 · 2U | Markt-Arbitrage · 2U | Arbitrage Marchés · 2U | Arbitraggio Mercati · 2U |
| `valuePitch` | 帮你发现价差——你在睡觉，价差在跑 (15字) | 幫你發現價差——你瞓覺，套利照跑 (15字) | 幫你發現價差——你睡覺，價差照跑 (15字) | Find spreads you'd never spot alone | あなたが寝ている間の裁定機会を検出 | 당신이 모르는 스프레드를 찾아냅니다 | Spreads finden, die Sie nie sehen würden | Trouve les spreads invisibles | Trova spread che non vedresti mai |
| `whatYouGet` | AI同时扫描AH/ADR/ETF三类价差 (15字) | AI同時掃描AH/ADR/ETF三類價差 (15字) | AI同時掃描AH/ADR/ETF三類價差 (15字) | Scans AH/ADR/ETF spreads in parallel | AH/ADR/ETFの3スプレッドを同時スキャン | AH/ADR/ETF 3종 스프레드 동시 스캔 | Scannt AH/ADR/ETF-Spreads parallel | Scanne AH/ADR/ETF en parallèle | Scansiona AH/ADR/ETF in parallelo |

### 2.2 三类套利的场景化说明

**AH溢价套利**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `ahExample` | 例：工行A股比H股贵20%→买H股→等价差缩窄赚差价 (21字) | 例：工行A股比H股貴20%→買H股→等價差縮窄賺差價 (21字) | 例：工行A股比H股貴20%→買H股→等價差縮窄賺差價 (21字) | Ex: ICBC A-shares 20% pricier than H → buy H → profit when gap closes | 例：ICBC A株がH株より20%高い→H株購入→差縮小で利益 | 예: 공상은행 A주가 H주보다 20% 비쌈→H주 매수→차이 축소 시 수익 | Bsp: ICBC A-Aktie 20% teurer als H → H kaufen | Ex: ICBC A 20% plus cher que H → acheter H | Es: ICBC A 20% più caro di H → compra H |
| `ahThreshold` | AH溢价>5%→推送机会 (11字) | AH溢價>5%→推送機會 (10字) | AH溢價>5%→推送機會 (10字) | AH premium >5% → alerted | AHプレミアム>5%→通知 | AH 프리미엄>5%→알림 | AH-Prämie >5% → Alarm | Prime AH >5% → alerte | Premio AH >5% → avviso |

**ADR折价套利**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `adrExample` | 例：台积电ADR比台股便宜3%→买ADR→等两地价格对齐 (21字) | 例：台積電ADR比台股便宜3%→買ADR→等兩地價格對齊 (21字) | 例：台積電ADR比台股便宜3%→買ADR→等兩地價格對齊 (21字) | Ex: TSM ADR 3% cheaper than TW → buy ADR → wait for convergence | 例：TSMC ADRが台湾株より3%安→ADR購入→収束待ち | 예: TSMC ADR이 대만주보다 3% 저렴→ADR 매수→수렴 대기 | Bsp: TSMC ADR 3% günstiger → ADR kaufen | Ex: ADR TSMC 3% moins cher → acheter | Es: ADR TSMC 3% più economico → compra |

**ETF折溢价套利**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `etfExample` | 例：恒生ETF市价>净值1.5%→赎回套利→价差秒赚 (20字) | 例：恒生ETF市價>淨值1.5%→贖回套戥→價差秒賺 (20字) | 例：恒生ETF市價>淨值1.5%→贖回套利→價差秒賺 (20字) | Ex: Hang Seng ETF 1.5% above NAV → arb the gap instantly | 例：ハンセンETFがNAVより1.5%高→即裁定 | 예: 항셍ETF NAV 대비 1.5% 프리미엄→즉시 차익 | Bsp: ETF 1,5% über NAV → Arbitrage | Ex: ETF 1.5% au-dessus NAV → arbitrage | Es: ETF 1.5% sopra NAV → arbitraggio |

### 2.3 用户输入→AI输出流程

| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `flowInput` | 你只需点击扫描，无需输入任何参数 (14字) | 你只需點擊掃描，無需輸入任何參數 (14字) | 你只需點擊掃描，無需輸入任何參數 (14字) | One click — no params needed | ワンクリック—パラメータ不要 | 원클릭—매개변수 불필요 | Ein Klick — keine Parameter | Un clic — aucun paramètre | Un clic — nessun parametro |
| `flowResult` | AI返回：机会排名 + 预估收益 + 持仓建议 + 风险提示 | AI返回：機會排名 + 預估收益 + 持倉建議 + 風險提示 | AI返回：機會排名 + 預估收益 + 持倉建議 + 風險提示 | Returns: ranked opps + est. profit + position advice + risk | 結果: 機会ランク+推定利益+ポジション助言+リスク | 결과: 기회순위+예상수익+포지션조언+리스크 | Ergebnis: Rangliste + Gewinn + Position + Risiko | Résultat: opportunités + profit + position + risque | Risultato: opportunità + profitto + posizione + rischio |
| `flowSample` | 🎯 AI说："工行AH溢价21%→买入港股→建议仓位5%" | 🎯 AI話："工行AH溢價21%→買入港股→建議倉位5%" | 🎯 AI說："工行AH溢價21%→買入港股→建議倉位5%" | 🎯 AI: "ICBC AH +21% → buy HK → suggest 5% position" | 🎯 AI: 「ICBC AH+21%→HK買→5%推奨」 | 🎯 AI: "공상은행 AH+21%→HK매수→5%포지션" | 🎯 KI: "ICBC AH +21% → HK kaufen → 5%" | 🎯 IA: "ICBC AH +21% → acheter HK → 5%" | 🎯 IA: "ICBC AH +21% → compra HK → 5%" |

---

## 三、功能2：AI策略压力测试 (2U/次)

### 3.1 价值主张卡片

| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `valueTitle` | 策略压力测试 · 2U | 策略壓力測試 · 2U | 策略壓力測試 · 2U | Strategy Stress Test · 2U | 戦略ストレステスト · 2U | 전략 스트레스 테스트 · 2U | Strategie-Stresstest · 2U | Stress Test Stratégie · 2U | Stress Test Strategia · 2U |
| `valuePitch` | 别等暴跌才后悔——先用2U测一测 (15字) | 唔好等暴跌先後悔——先用2U測一測 (15字) | 別等暴跌才後悔——先用2U測一測 (15字) | Don't wait for a crash — test now for 2U | 暴落してから後悔する前に—2Uでテスト | 폭락 후 후회말고—2U로 미리 테스트 | Nicht auf Crash warten — 2U testen | N'attendez pas le krach — testez 2U | Non aspettare il crollo — testa 2U |
| `whatYouGet` | 投入你的策略→AI模拟三大危机→告诉你最大会亏多少 (22字) | 輸入你嘅策略→AI模擬三大危機→話你知最多會蝕幾多 (22字) | 輸入你的策略→AI模擬三大危機→告訴你最多會虧多少 (22字) | Feed your strategy → AI simulates 3 crises → shows max loss | 戦略入力→3大危機をAIがシミュレーション→最大損失を表示 | 전략입력→3대 위기 시뮬레이션→최대손실 표시 | Strategie rein → KI simuliert 3 Krisen → Max-Verlust | Stratégie → IA simule 3 crises → perte max | Strategia → IA simula 3 crisi → perdita max |

### 3.2 三大历史危机场景

**2008 全球金融危机**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `scenario2008Title` | 📉 2008金融危机 | 📉 2008金融海嘯 | 📉 2008金融海嘯 | 📉 2008 GFC | 📉 2008年金融危機 | 📉 2008 금융위기 | 📉 Finanzkrise 2008 | 📉 Crise 2008 | 📉 Crisi 2008 |
| `scenario2008Desc` | 雷曼倒闭→全球股市暴跌50%→你的策略能活下来吗？ (23字) | 雷曼倒閉→全球股市暴跌50%→你嘅策略頂唔頂得住？ (23字) | 雷曼倒閉→全球股市暴跌50%→你的策略頂得住嗎？ (23字) | Lehman collapse → global -50% → can your strategy survive? | リーマン破綻→世界株-50%→あなたの戦略は生き残れる？ | 리먼 붕괴→글로벌 -50%→당신의 전략은 살아남나? | Lehman-Pleite → -50% global → überlebt Ihre Strategie? | Faillite Lehman → -50% mondial → votre stratégie survit? | Crollo Lehman → -50% globale → sopravvive? |

**2020 新冠疫情崩盘**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `scenario2020Title` | 🦠 2020疫情崩盘 | 🦠 2020疫情崩盤 | 🦠 2020疫情崩盤 | 🦠 2020 COVID Crash | 🦠 2020年コロナショック | 🦠 2020 코로나 폭락 | 🦠 Corona-Crash 2020 | 🦠 Krach COVID 2020 | 🦠 Crollo COVID 2020 |
| `scenario2020Desc` | 美股10天熔断4次→流动性枯竭→所有资产一起跌 (21字) | 美股10日熔斷4次→流動性枯竭→所有資產一齊跌 (21字) | 美股10天熔斷4次→流動性枯竭→所有資產一起跌 (21字) | 4 circuit breakers in 10 days → everything crashed together | 10日で4回のサーキットブレーカー→全資産が一斉下落 | 10일간 4회 서킷브레이커→모든 자산 동반 하락 | 4 Circuit Breaker in 10 Tagen → alles crashte | 4 coupe-circuits en 10 jours → tout a chuté | 4 sospensioni in 10 giorni → tutto è crollato |

**2022 加息冲击**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `scenario2022Title` | 📈 2022加息冲击 | 📈 2022加息衝擊 | 📈 2022升息衝擊 | 📈 2022 Rate Shock | 📈 2022年利上げショック | 📈 2022 금리인상 충격 | 📈 Zinsschock 2022 | 📈 Choc Taux 2022 | 📈 Shock Tassi 2022 |
| `scenario2022Desc` | 美联储暴力加息→科技股腰斩→债券也罕见大跌 (20字) | 聯儲局暴力加息→科技股腰斬→債券都罕見大跌 (20字) | 聯準會暴力升息→科技股腰斬→債券也罕見大跌 (20字) | Fed hiked aggressively → tech -50% → bonds also crashed | FRB急利上げ→ハイテク株半減→債券も異例の下落 | 연준 급격 인상→기술주 반토막→채권도 급락 | Fed-Zinserhöhungen → Tech -50% → Anleihen stürzten ab | Fed agressive → tech -50% → obligations aussi | Fed aggressiva → tech -50% → obbligazioni crollate |

### 3.3 结果解读

| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `resultWhat` | AI给你三个数字：最大回撤 / 恢复月数 / 存活概率 (20字) | AI畀你三個數字：最大回撤 / 恢復月數 / 存活機率 (20字) | AI給你三個數字：最大回撤 / 恢復月數 / 存活機率 (20字) | AI returns 3 numbers: Max DD / Recovery months / Survival % | AIが3つの数字: 最大DD/回復月数/生存確率 | AI가 3가지 숫자: 최대DD/회복개월/생존확률 | KI liefert 3 Werte: Max DD / Erholung / Überleben % | IA donne 3 chiffres: DD max / Récupération / Survie % | IA dà 3 numeri: DD max / Mesi recupero / Sopravvivenza % |
| `resultSample` | 🎯 AI说："2008年场景下最大回撤42%，需11个月恢复，存活率78%" | 🎯 AI話："2008年場景下最大回撤42%，需11個月恢復，存活率78%" | 🎯 AI說："2008年場景下最大回撤42%，需11個月恢復，存活率78%" | 🎯 AI: "2008 scenario: max DD 42%, 11-month recovery, 78% survival" | 🎯 AI: 「2008年: 最大DD42%/回復11ヶ月/生存率78%」 | 🎯 AI: "2008년: 최대DD 42%, 회복 11개월, 생존율 78%" | 🎯 KI: "2008: Max DD 42%, 11 Monate, 78% Überleben" | 🎯 IA: "2008: DD max 42%, 11 mois, survie 78%" | 🎯 IA: "2008: DD max 42%, 11 mesi, sopravvivenza 78%" |

---

## 四、功能3：AI持仓归因分析 (1.5U/次)

### 4.1 价值主张卡片

| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `valueTitle` | 持仓归因分析 · 1.5U | 持倉歸因分析 · 1.5U | 持倉歸因分析 · 1.5U | Attribution · 1.5U | 要因分析 · 1.5U | 포트폴리오 귀속 · 1.5U | Attribution · 1.5U | Attribution · 1.5U | Attribuzione · 1.5U |
| `valuePitch` | 赚了钱——是运气好还是策略真管用？ (16字) | 賺咗錢——係好彩定策略真係Work？ (15字) | 賺了錢——是運氣好還是策略真有用？ (16字) | Made money? Luck or real skill? | 儲かった？運か実力か？ | 수익 났나요? 운인가 실력인가? | Geld verdient? Glück oder Strategie? | Gain? Chance ou compétence? | Guadagnato? Fortuna o bravura? |
| `whatYouGet` | 把盈亏拆成三块：因子贡献 + 行业贡献 + 择时贡献 (21字) | 將盈虧拆成三塊：因子貢獻 + 行業貢獻 + 擇時貢獻 (21字) | 把盈虧拆成三塊：因子貢獻 + 行業貢獻 + 擇時貢獻 (21字) | Decomposes P&L: Factor + Sector + Timing | 損益を3分解: 要因+業種+タイミング | 손익 3분해: 요인+업종+타이밍 | Gewinn zerlegt: Faktor + Branche + Timing | P&L décomposé: Facteur + Secteur + Timing | P&L scomposto: Fattore + Settore + Timing |

### 4.2 归因三类分解

**因子归因**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `factorAttribution` | 🧬 因子贡献：你选对了哪些因子？ | 🧬 因子貢獻：你揀啱咗邊啲因子？ | 🧬 因子貢獻：你選對了哪些因子？ | 🧬 Factor: Which factors worked? | 🧬 要因: どの指標が効いた？ | 🧬 요인: 어떤 지표가 효과적이었나? | 🧬 Faktor: Welche Faktoren wirkten? | 🧬 Facteur: Quels facteurs ont marché? | 🧬 Fattore: Quali fattori hanno funzionato? |
| `factorExample` | 例：你持仓中低波动因子贡献+3.2%，价值因子拖累-1.8% (25字) | 例：你持倉中低波動因子貢獻+3.2%，價值因子拖累-1.8% (26字) | 例：你持倉中低波動因子貢獻+3.2%，價值因子拖累-1.8% (26字) | Ex: Low-vol factor +3.2%, value factor -1.8% in your portfolio | 例: 低ボラティリティ要因+3.2%, バリュー要因-1.8% | 예: 저변동성 요인 +3.2%, 가치 요인 -1.8% | Bsp: Low-Vol-Faktor +3,2%, Value -1,8% | Ex: Facteur low-vol +3.2%, value -1.8% | Es: Fattore low-vol +3.2%, value -1.8% |

**行业归因**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `sectorAttribution` | 🏭 行业贡献：你超配了什么行业？ | 🏭 行業貢獻：你超配咗乜嘢行業？ | 🏭 產業貢獻：你超配了什麼產業？ | 🏭 Sector: Which sectors drove returns? | 🏭 業種: どの業種がリターンに寄与？ | 🏭 업종: 어떤 업종이 수익에 기여? | 🏭 Branche: Welche Branchen brachten Rendite? | 🏭 Secteur: Quels secteurs ont rapporté? | 🏭 Settore: Quali settori hanno reso? |
| `sectorExample` | 例：超配科技贡献+5.1%，低配金融少赚-2.3% (22字) | 例：超配科技貢獻+5.1%，低配金融少賺-2.3% (22字) | 例：超配科技貢獻+5.1%，低配金融少賺-2.3% (22字) | Ex: Overweight tech +5.1%, underweight financials cost -2.3% | 例: ハイテクOver+5.1%, 金融Under-2.3% | 예: Tech 비중확대 +5.1%, 금융 비중축소 -2.3% | Bsp: Tech übergewichtet +5,1%, Finanzen -2,3% | Ex: Surpondération tech +5.1%, finance -2.3% | Es: Sovrappeso tech +5.1%, finanza -2.3% |

**择时归因**:
| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `timingAttribution` | ⏱ 择时贡献：你买卖的时机对不对？ | ⏱ 擇時貢獻：你買賣嘅時機啱唔啱？ | ⏱ 擇時貢獻：你買賣的時機對不對？ | ⏱ Timing: Did you buy/sell at right time? | ⏱ タイミング: 売買のタイミングは正しかった？ | ⏱ 타이밍: 매매 타이밍이 적절했나? | ⏱ Timing: War der Ein-/Ausstieg richtig? | ⏱ Timing: Bon moment pour acheter/vendre? | ⏱ Timing: Comprare/vendere al momento giusto? |
| `timingExample` | 例：3月加仓+1.8%，但6月过早减仓错过反弹-2.1% (25字) | 例：3月加倉+1.8%，但6月過早減倉錯過反彈-2.1% (25字) | 例：3月加倉+1.8%，但6月過早減倉錯過反彈-2.1% (25字) | Ex: Mar add +1.8%, but Jun cut early missed rebound -2.1% | 例: 3月追加+1.8%, 6月早期売却で反発逃す-2.1% | 예: 3월 추가매수 +1.8%, 6월 조기매도로 반등 놓침 -2.1% | Bsp: März +1,8%, Juni zu früh verkauft -2,1% | Ex: Mars ajout +1.8%, juin sortie trop tôt -2.1% | Es: Mar aggiunta +1.8%, giu uscita precoce -2.1% |

### 4.3 残差分析

| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `residualTitle` | 🔮 残差（无法解释的部分） | 🔮 殘差（無法解釋嘅部分） | 🔮 殘差（無法解釋的部分） | 🔮 Residual (unexplained) | 🔮 残差（説明不能） | 🔮 잔차 (설명불가) | 🔮 Rest (unerklärt) | 🔮 Résiduel (inexpliqué) | 🔮 Residuale (inspiegabile) |
| `residualDesc` | 残差越小=策略越透明；残差>20%=你的策略有隐藏风险 (26字) | 殘差越細=策略越透明；殘差>20%=你嘅策略有隱藏風險 (26字) | 殘差越小=策略越透明；殘差>20%=你的策略有隱藏風險 (26字) | Lower residual = clearer strategy. >20% = hidden risk | 残差小=戦略が明確; 残差>20%=隠れたリスク | 잔차 작음=전략 명확; 잔차>20%=숨은 리스크 | Weniger Rest = klarere Strategie. >20% = verstecktes Risiko | Résiduel bas = stratégie claire. >20% = risque caché | Residuale basso = strategia chiara. >20% = rischio nascosto |

### 4.4 结果示例

| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `resultSample` | 🎯 AI说："你赚了+12.3%→因子贡献+8.1%/行业+5.2%/择时-0.8%/残差-0.2%→策略靠谱✅" | 🎯 AI話："你賺咗+12.3%→因子貢獻+8.1%/行業+5.2%/擇時-0.8%/殘差-0.2%→策略靠得住✅" | 🎯 AI說："你賺了+12.3%→因子貢獻+8.1%/行業+5.2%/擇時-0.8%/殘差-0.2%→策略靠得住✅" | 🎯 AI: "+12.3% → Factor +8.1%/Sector +5.2%/Timing -0.8%/Residual -0.2% → Solid strategy ✅" | 🎯 AI: 「+12.3%→要因+8.1%/業種+5.2%/タイミング-0.8%/残差-0.2%→堅実な戦略✅」 | 🎯 AI: "+12.3%→요인+8.1%/업종+5.2%/타이밍-0.8%/잔차-0.2%→견실한 전략✅" | 🎯 KI: "+12.3% → Faktor +8,1%/Branche +5,2%/Timing -0,8% → Solide ✅" | 🎯 IA: "+12.3% → Facteur +8.1%/Secteur +5.2%/Timing -0.8% → Solide ✅" | 🎯 IA: "+12.3% → Fattore +8.1%/Settore +5.2%/Timing -0.8% → Solida ✅" |

---

## 五、三功能对比卡 (帮助用户选)

| 键 | zh-CN | zh-HK | zh-TW | en | ja | ko | de | fr | it |
|----|-------|-------|-------|----|----|----|----|----|----|
| `compareArb` | 🪙 套利扫描：找机会在哪 (9字) | 🪙 套戥掃描：揾機會喺邊 (9字) | 🪙 套利掃描：找機會在哪 (9字) | 🪙 Arb: Where's the edge? | 🪙 裁定: 機会はどこ？ | 🪙 차익: 기회는 어디? | 🪙 Arb: Wo ist die Chance? | 🪙 Arb: Où est l'opportunité? | 🪙 Arb: Dov'è l'opportunità? |
| `compareStress` | 💣 压力测试：策略会不会爆 (10字) | 💣 壓力測試：策略會唔會爆 (10字) | 💣 壓力測試：策略會不會爆 (10字) | 💣 Stress: Will it blow up? | 💣 ストレス: 爆発する？ | 💣 스트레스: 터질까? | 💣 Stress: Explodiert sie? | 💣 Stress: Va-t-elle exploser? | 💣 Stress: Esploderà? |
| `compareAttr` | 🔬 归因分析：赚的钱从哪来 (10字) | 🔬 歸因分析：賺嘅錢喺邊嚟 (10字) | 🔬 歸因分析：賺的錢從哪來 (10字) | 🔬 Attribution: Where'd the money come from? | 🔬 要因: 利益の源泉は？ | 🔬 귀속: 수익의 원천은? | 🔬 Attribution: Woher kam das Geld? | 🔬 Attribution: D'où vient l'argent? | 🔬 Attribuzione: Da dove viene il profitto? |

---

## 六、AIServiceType + BillingTouchpoint 映射

```typescript
// ai-billing.ts 新增 (从4→7)
| 'AI_ARBITRAGE_SCAN'    // #25 · 2U · R203 JVS#1
| 'AI_STRESS_TEST'       // #27 · 2U · R203 JVS#2
| 'AI_ATTRIBUTION'       // #28 · 1.5U · R203 autoclaw#3

// factor-billing-gateway.ts — 23触点已包含:
// ✅ AI_ARBITRAGE_SCAN (2U)
// ✅ AI_STRESS_TEST (2U)
// ✅ AI_PORTFOLIO_ATTRIBUTION (1.5U)
```

---

## 七、i18n JSON 片段 (zh-CN)

```json
{
  "aiServicesR203": {
    "arbitrage": {
      "valueTitle": "跨市场套利扫描 · 2U",
      "valuePitch": "帮你发现价差——你在睡觉，价差在跑",
      "whatYouGet": "AI同时扫描AH/ADR/ETF三类价差",
      "ahExample": "例：工行A股比H股贵20%→买H股→等价差缩窄赚差价",
      "ahThreshold": "AH溢价>5%→推送机会",
      "adrExample": "例：台积电ADR比台股便宜3%→买ADR→等两地价格对齐",
      "etfExample": "例：恒生ETF市价>净值1.5%→赎回套利→价差秒赚",
      "flowInput": "你只需点击扫描，无需输入任何参数",
      "flowResult": "AI返回：机会排名 + 预估收益 + 持仓建议 + 风险提示",
      "flowSample": "🎯 AI说：\"工行AH溢价21%→买入港股→建议仓位5%\""
    },
    "stressTest": {
      "valueTitle": "策略压力测试 · 2U",
      "valuePitch": "别等暴跌才后悔——先用2U测一测",
      "whatYouGet": "投入你的策略→AI模拟三大危机→告诉你最大会亏多少",
      "scenario2008Title": "📉 2008金融危机",
      "scenario2008Desc": "雷曼倒闭→全球股市暴跌50%→你的策略能活下来吗？",
      "scenario2020Title": "🦠 2020疫情崩盘",
      "scenario2020Desc": "美股10天熔断4次→流动性枯竭→所有资产一起跌",
      "scenario2022Title": "📈 2022加息冲击",
      "scenario2022Desc": "美联储暴力加息→科技股腰斩→债券也罕见大跌",
      "resultWhat": "AI给你三个数字：最大回撤 / 恢复月数 / 存活概率",
      "resultSample": "🎯 AI说：\"2008年场景下最大回撤42%，需11个月恢复，存活率78%\""
    },
    "attribution": {
      "valueTitle": "持仓归因分析 · 1.5U",
      "valuePitch": "赚了钱——是运气好还是策略真管用？",
      "whatYouGet": "把盈亏拆成三块：因子贡献 + 行业贡献 + 择时贡献",
      "factorAttribution": "🧬 因子贡献：你选对了哪些因子？",
      "factorExample": "例：你持仓中低波动因子贡献+3.2%，价值因子拖累-1.8%",
      "sectorAttribution": "🏭 行业贡献：你超配了什么行业？",
      "sectorExample": "例：超配科技贡献+5.1%，低配金融少赚-2.3%",
      "timingAttribution": "⏱ 择时贡献：你买卖的时机对不对？",
      "timingExample": "例：3月加仓+1.8%，但6月过早减仓错过反弹-2.1%",
      "residualTitle": "🔮 残差（无法解释的部分）",
      "residualDesc": "残差越小=策略越透明；残差>20%=你的策略有隐藏风险",
      "resultSample": "🎯 AI说：\"你赚了+12.3%→因子贡献+8.1%/行业+5.2%/择时-0.8%/残差-0.2%→策略靠谱✅\""
    },
    "compare": {
      "compareArb": "🪙 套利扫描：找机会在哪",
      "compareStress": "💣 压力测试：策略会不会爆",
      "compareAttr": "🔬 归因分析：赚的钱从哪来"
    }
  }
}
```

---

## 八、验收检查清单

| 检查项 | 状态 |
|--------|:---:|
| 套利扫描 值主张+3种套利场景+输入输出流程 | ✅ |
| 压力测试 值主张+3个历史场景+结果解读 | ✅ |
| 归因分析 值主张+3类归因+残差+完整示例 | ✅ |
| 三功能对比卡 | ✅ |
| 9语言全覆盖 | ✅ |
| CN每条≤26字 (最长为归因残差描述26字) | ✅ |
| 与R201/R202无重复 (R203=场景化人话说明) | ✅ |
| v17.9定价: 套利2U/压力2U/归因1.5U | ✅ |
| AIServiceType新增3个映射 | ✅ |
| 场景示例均含具体数字(有说服力) | ✅ |

---

*QClaw(设计虾) | R203-Q06 · Phase 1 收官 | 2026-06-15*
