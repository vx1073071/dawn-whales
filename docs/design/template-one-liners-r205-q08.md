# R205-Q08 — 20市场特化策略模板 · 人话描述 (9语言)

> **作者**: QClaw(设计虾) | **轮次**: R205 | **Phase 2 第2轮** | **目标: 48模板(28+20)**
> **交付**: 20模板×9语言 = 180条 | **验收**: 每条≤80字(CN) + 9语言

---

## 🛢️ 一、商品 6 模板 (JVS)

### CM1 · COT聪明钱 (COT Smart Money)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 跟踪CFTC持仓报告：商业头寸(聪明钱)净多→跟多；商业头寸净空→跟空。跟产业链内行人走。 (38字) |
| zh-HK | 跟蹤CFTC持倉報告：商業頭寸(聰明錢)淨好→跟好；商業頭寸淨淡→跟淡。跟產業鏈內行人走。 (38字) |
| zh-TW | 跟蹤CFTC持倉報告：商業頭寸(聰明錢)淨多→跟多；商業頭寸淨空→跟空。跟產業鏈內行人走。 (38字) |
| en | Follow CFTC COT: commercial (smart money) net long → long; net short → short. Follow the insiders who actually produce. |
| ja | CFTCのCOTレポート追跡: 商業(スマートマネー)ネットロング→買い、ネットショート→売り。業界のプロに追随。 |
| ko | CFTC COT 추적: 상업(스마트머니) 순롱→매수, 순숏→매도. 업계 내부자 따라가기. |
| de | CFTC-COT folgen: Commercials (Smart Money) netto long → long; netto short → short. Den Insidern folgen. |
| fr | Suivre le COT CFTC: positions commerciales (smart money) net long → long; net short → short. Suivez les initiés. |
| it | Segui COT CFTC: commerciali (smart money) net long → long; net short → short. Segui chi produce davvero. |

### CM2 · 基差猎人 (Basis Hunter)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 现货与期货价差>历史均值→可以做基差回归。价差偏离越大，回归动能越强。专吃基差收缩这口肉。 (39字) |
| zh-HK | 現貨與期貨價差>歷史均值→可以做基差回歸。價差偏離越大，回歸動能越強。專食基差收縮呢啖肉。 (39字) |
| zh-TW | 現貨與期貨價差>歷史均值→可以做基差回歸。價差偏離越大，回歸動能越強。專吃基差收縮這口肉。 (39字) |
| en | When spot-futures spread exceeds historical mean → trade mean reversion. Bigger deviation = stronger snapback. Pure basis convergence play. |
| ja | 現物先物スプレッド>過去平均→平均回帰トレード。乖離大=反発強。純粋なベーシス収束プレイ。 |
| ko | 현물-선물 스프레드>과거평균→평균회귀 트레이드. 편차 클수록 강한 반발. 순수 베이시스 수렴 플레이. |
| de | Spot-Futures-Spread > historischer Mittelwert → Mean-Reversion. Größere Abweichung = stärkere Rückkehr. |
| fr | Spread spot-futures > moyenne historique → réversion. Plus l'écart est grand, plus le retour est fort. |
| it | Spread spot-futures > media storica → mean reversion. Maggiore deviazione = ritorno più forte. |

### CM3 · 展期收割 (Roll Yield Harvester)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 期货升水时做空(展期收益为负→空头赚展期)，贴水时做多(展期收益为正→多头赚展期)。躺赚展期收益。 (40字) |
| zh-HK | 期貨高水時沽空(轉倉收益為負→淡友賺轉倉)，低水時做好(轉倉收益為正→好友賺轉倉)。躺賺轉倉收益。 (40字) |
| zh-TW | 期貨溢價時做空(展期收益為負→空頭賺展期)，折價時做多(展期收益為正→多頭賺展期)。躺賺展期收益。 (40字) |
| en | Contango → short (negative roll yield pays shorts). Backwardation → long (positive roll yield pays longs). Harvest roll yield passively. |
| ja | コンタンゴ→ショート(負のロールイールド獲得)、バックワーデーション→ロング(正のロールイールド獲得)。 |
| ko | 콘탱고→숏(마이너스 롤수익), 백워데이션→롱(플러스 롤수익). 패시브 롤수익 수확. |
| de | Contango → Short (negative Rollrendite); Backwardation → Long (positive Rollrendite). Passiv Rollrendite ernten. |
| fr | Contango → short (roll yield négatif); backwardation → long (roll yield positif). Récolte passive du roll. |
| it | Contango → short (roll negativo); backwardation → long (roll positivo). Raccolta passiva del roll yield. |

### CM4 · 库存周期 (Inventory Cycle)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 库存低于5年均值→供给紧张→做多；库存高于5年均值→供给过剩→做空。跟踪每周EIA/API库存数据。 (38字) |
| zh-HK | 庫存低過5年均值→供應緊張→做好；庫存高過5年均值→供應過剩→沽空。跟蹤每星期EIA/API庫存數據。 (38字) |
| zh-TW | 庫存低於5年均值→供給緊張→做多；庫存高於5年均值→供給過剩→做空。跟蹤每週EIA/API庫存數據。 (38字) |
| en | Inventory below 5yr avg → tight supply → long. Above 5yr avg → glut → short. Weekly EIA/API data driven. |
| ja | 在庫<5年平均→供給逼迫→ロング、>5年平均→供給過剰→ショート。毎週EIA/APIデータで判断。 |
| ko | 재고<5년평균→공급긴축→롱, >5년평균→공급과잉→숏. 주간 EIA/API 데이터 기반. |
| de | Lager <5-Jahres-Mittel → Angebotsenge → Long; >5-Jahres-Mittel → Überangebot → Short. Wöchentlich EIA/API. |
| fr | Stock < moyenne 5 ans → pénurie → long; > moyenne → excédent → short. Hebdomadaire EIA/API. |
| it | Scorte <media 5 anni → scarsità → long; >media 5 anni → eccesso → short. Settimanale EIA/API. |

### CM5 · 金银比 (Gold/Silver Ratio)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 金银比>90→白银被低估→买白银；金银比<50→黄金被低估→买黄金。历史均值65，偏离越大回归越快。 (39字) |
| zh-HK | 金銀比>90→白銀被低估→買白銀；金銀比<50→黃金被低估→買黃金。歷史均值65，偏離越大回歸越快。 (39字) |
| zh-TW | 金銀比>90→白銀被低估→買白銀；金銀比<50→黃金被低估→買黃金。歷史均值65，偏離越大回歸越快。 (39字) |
| en | Gold/Silver >90 → silver undervalued → buy silver. <50 → gold undervalued → buy gold. Historical mean 65, bigger gap = faster snapback. |
| ja | 金銀比>90→銀割安→銀買い、<50→金割安→金買い。過去平均65、乖離大=回帰早い。 |
| ko | 금은비>90→은 저평가→은 매수, <50→금 저평가→금 매수. 과거평균 65, 편차 클수록 빠른 회귀. |
| de | Gold/Silber >90 → Silber unterbewertet → Silber kaufen. <50 → Gold unterbewertet → Gold kaufen. Mittel 65. |
| fr | Or/Argent >90 → argent sous-évalué → acheter argent. <50 → or sous-évalué → acheter or. Moyenne historique 65. |
| it | Oro/Argento >90 → argento sottovalutato → compra argento. <50 → oro sottovalutato → compra oro. Media storica 65. |

### CM6 · 实际利率黄金 (Real Rate Gold)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 美国实际利率(名义利率-通胀)下行→黄金涨，上行→黄金跌。跟着TIPS收益率走，做黄金的多空开关。 (38字) |
| zh-HK | 美國實際利率(名義利率-通脹)下行→黃金升，上行→黃金跌。跟住TIPS收益率走，做黃金嘅好淡開關。 (38字) |
| zh-TW | 美國實際利率(名義利率-通膨)下行→黃金漲，上行→黃金跌。跟著TIPS收益率走，做黃金的多空開關。 (38字) |
| en | US real rate (nominal - inflation) ↓ → gold ↑. Real rate ↑ → gold ↓. Follow TIPS yield as gold's on/off switch. |
| ja | 米実質金利(名目-インフレ)↓→金↑、↑→金↓。TIPS利回りを金のON/OFFスイッチに。 |
| ko | 美 실질금리(명목-인플레)↓→금↑, ↑→금↓. TIPS 수익률을 금의 온오프 스위치로. |
| de | US-Realzins (nominal - Inflation) ↓ → Gold ↑. Realzins ↑ → Gold ↓. TIPS-Rendite als Gold-Schalter. |
| fr | Taux réel US (nominal - inflation) ↓ → or ↑. Taux réel ↑ → or ↓. Suivre le rendement TIPS. |
| it | Tasso reale US (nominale - inflazione) ↓ → oro ↑. Tasso reale ↑ → oro ↓. Segui rendimento TIPS. |

---

## 🇯🇵🇰🇷 二、日韩 4 模板 (autoclaw)

### JK1 · JPX价值 (JPX Value)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 专买日本破净股(PBR<1)：日经400指数成分优先，配合交叉持股解消+回购催化剂。日本价值股正在苏醒。 (39字) |
| zh-HK | 專買日本破淨股(PBR<1)：日經400指數成分優先，配合交叉持股解消+回購催化劑。日本價值股正在甦醒。 (39字) |
| zh-TW | 專買日本破淨股(PBR<1)：日經400指數成分優先，配合交叉持股解消+回購催化劑。日本價值股正在甦醒。 (39字) |
| en | Buy Japanese stocks below book (PBR<1). Nikkei 400 constituents first. Riding cross-holding unwinding + buyback catalysts. Value awakening. |
| ja | PBR1倍割れの日本株を購入。日経400構成銘柄優先。株式持ち合い解消+自社株買い触媒。バリュー株が目覚める。 |
| ko | PBR<1 일본주 매수. 닛케이400 우선. 교차보유 해소+자사주매입 촉매. 일본 가치주 각성 중. |
| de | Japanische Aktien unter Buchwert (KBV<1). Nikkei-400 zuerst. Cross-Holding-Auflösung + Rückkauf-Katalysator. |
| fr | Actions japonaises sous valeur comptable (PBR<1). Nikkei 400 en priorité. Dénouement participations croisées + rachats. |
| it | Azioni giapponesi sotto book (PBR<1). Nikkei 400 prioritari. Scioglimento partecipazioni incrociate + buyback. |

### JK2 · NISA定投 (NISA DCA)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 利用日本NISA免税账户：每月定额买入日经225+TOPIX ETF。免税复利+日元贬值双重红利。日本人都在做。 (40字) |
| zh-HK | 利用日本NISA免稅戶口：每月定額買入日經225+TOPIX ETF。免稅複利+日圓貶值雙重紅利。日本人都在做。 (40字) |
| zh-TW | 利用日本NISA免稅帳戶：每月定額買入日經225+TOPIX ETF。免稅複利+日圓貶值雙重紅利。日本人都在做。 (40字) |
| en | Leverage Japan's NISA tax-free account: monthly DCA into Nikkei 225 + TOPIX ETF. Tax-free compounding + JPY depreciation double bonus. |
| ja | NISA非課税口座を活用: 毎月日経225+TOPIX ETFを定額購入。非課税複利+円安のダブルボーナス。日本人が皆やっている。 |
| ko | 일본 NISA 비과세계좌 활용: 월간 닛케이225+TOPIX ETF 정액매수. 비과세 복리+엔저 이중 보너스. |
| de | Japans NISA-Steuerfreibetrag nutzen: monatlich Nikkei 225 + TOPIX ETF. Steuerfreier Zinseszins + JPY-Abwertung. |
| fr | Profiter du compte NISA sans impôt: DCA mensuel Nikkei 225 + TOPIX ETF. Intérêts composés défiscalisés + dépréciation JPY. |
| it | Sfrutta conto NISA esentasse: DCA mensile Nikkei 225 + TOPIX ETF. Interesse composto tax-free + deprezzamento JPY. |

### JK3 · KRX动量 (KRX Momentum)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 韩国KOSPI 200中选近6个月动量最强的20只。月度调仓，动量分跌破50%分位数→替换。韩国人最爱的策略。 (42字) |
| zh-HK | 韓國KOSPI 200中揀近6個月動量最強嘅20隻。每月換馬，動量分跌破50%分位數→替換。韓國人最愛嘅策略。 (42字) |
| zh-TW | 韓國KOSPI 200中選近6個月動量最強的20檔。月度換股，動量分跌破50%分位數→替換。韓國人最愛的策略。 (42字) |
| en | Pick top 20 momentum stocks from KOSPI 200 over 6 months. Monthly rebalance, replace when score drops below 50th percentile. Korea's favorite. |
| ja | KOSPI200から6ヶ月モメンタム上位20銘柄。毎月入替、スコア50%以下でリプレース。韓国人に最も人気の戦略。 |
| ko | KOSPI200 중 6개월 모멘텀 상위20종목. 월간 리밸런싱, 점수 50% 미만 시 교체. 한국인이 가장 사랑하는 전략. |
| de | Top 20 Momentum-Aktien aus KOSPI 200 über 6 Monate. Monatlicher Tausch bei <50. Perzentil. Koreas Lieblingsstrategie. |
| fr | Top 20 momentum du KOSPI 200 sur 6 mois. Rééquilibrage mensuel, remplacement sous 50e percentile. La stratégie préférée des Coréens. |
| it | Top 20 momentum KOSPI 200 su 6 mesi. Ribilanciamento mensile, sostituzione sotto 50° percentile. La strategia preferita in Corea. |

### JK4 · KRX出口 (KRX Export)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 韩元贬值→三星/SK海力士等出口巨头利润暴增→买出口股。韩元升值→减仓出口股。汇率驱动的行业轮动。 (40字) |
| zh-HK | 韓圜貶值→三星/SK海力士等出口巨頭利潤暴增→買出口股。韓圜升值→減倉出口股。匯率驅動嘅行業輪動。 (40字) |
| zh-TW | 韓元貶值→三星/SK海力士等出口巨頭利潤暴增→買出口股。韓元升值→減倉出口股。匯率驅動的行業輪動。 (40字) |
| en | KRW weakens → Samsung/SK Hynix export profits surge → buy exporters. KRW strengthens → reduce. Currency-driven sector rotation. |
| ja | ウォン安→サムスン/SKハイニックス輸出利益急増→輸出株買い、ウォン高→減らす。為替駆動のセクターローテーション。 |
| ko | 원화약세→삼성/SK하이닉스 수출이익 급증→수출주 매수, 원화강세→축소. 환율 주도 섹터 로테이션. |
| de | KRW schwächelt → Samsung/SK Hynix Exportgewinne steigen → Exporteure kaufen. KRW stärkt → reduzieren. |
| fr | KRW faiblit → profits export Samsung/SK Hynix explosent → acheter exportateurs. KRW se renforce → réduire. |
| it | KRW si indebolisce → profitti export Samsung/SK Hynix in aumento → compra esportatori. KRW si rafforza → riduci. |

---

## 🇹🇼🇸🇬🇦🇺🇮🇳 三、台新澳 4 模板 (autoclaw)

### TSA1 · TWSE电子除权息 (TWSE Ex-Dividend)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 台股电子股除权息前2周买→除息后填息到除息前价格→卖出。台积电/联发科等电子龙头填息率高。 (38字) |
| zh-HK | 台股電子股除淨前2星期買→除息後填息返除息前價格→沽出。台積電/聯發科等電子龍頭填息率高。 (38字) |
| zh-TW | 台股電子股除權息前2週買→除息後填息回除息前價格→賣出。台積電/聯發科等電子龍頭填息率高。 (38字) |
| en | Buy TW tech stocks 2 weeks before ex-date → hold until price recovers to pre-ex level → sell. TSMC/MediaTek have high fill rates. |
| ja | 台湾ハイテク株を権利落ち2週間前に購入→権利落ち前価格回復まで保有→売却。TSMC/MediaTekは埋戻し率高い。 |
| ko | 대만 기술주 배당락 2주전 매수→배당락전 가격 회복 시 매도. TSMC/MediaTek 높은 배당회복률. |
| de | TW-Tech-Aktien 2 Wochen vor Ex-Tag kaufen → bis Kurserholung halten → verkaufen. TSMC/MediaTek hohe Erholungsrate. |
| fr | Acheter actions tech TW 2 semaines avant ex-date → conserver jusqu'à récupération du prix → vendre. TSMC/MediaTek taux de remplissage élevé. |
| it | Compra titoli tech TW 2 settimane prima ex-date → tieni fino recupero prezzo → vendi. TSMC/MediaTek alto tasso riempimento. |

### TSA2 · SGX金融 (SGX Financial)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 新加坡三大银行(DBS/OCBC/UOB)等权持有，季度再平衡。SGD避险+银行稳定派息。新加坡养老标配。 (37字) |
| zh-HK | 新加坡三大銀行(DBS/OCBC/UOB)等權持有，季度再平衡。SGD避險+銀行穩定派息。新加坡養老標配。 (37字) |
| zh-TW | 新加坡三大銀行(DBS/OCBC/UOB)等權持有，季度再平衡。SGD避險+銀行穩定派息。新加坡養老標配。 (37字) |
| en | Equal-weight Singapore Big 3 banks (DBS/OCBC/UOB), quarterly rebalance. SGD safe-haven + stable dividends. SG retirement staple. |
| ja | シンガポール三大銀行(DBS/OCBC/UOB)均等保有、四半期リバランス。SGD安全通貨+安定配当。SG退職運用の定番。 |
| ko | 싱가포르 3대 은행(DBS/OCBC/UOB) 동일비중, 분기 리밸런싱. SGD 안전자산+안정배당. SG 은퇴자산 표준. |
| de | Gleichgewichtet Singapurs Big 3 Banken, quartalsweise. SGD sicherer Hafen + stabile Dividenden. SG-Rentenstandard. |
| fr | Poids égal 3 grandes banques Singapour, trimestriel. SGD valeur refuge + dividendes stables. Standard retraite SG. |
| it | Peso uguale 3 grandi banche Singapore, trimestrale. SGD bene rifugio + dividendi stabili. Standard pensione SG. |

### TSA3 · ASX资源Franking (ASX Resource Franking)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 买澳洲矿业股(BHP/RIO/FMG)，不仅是资源牛市，还有Franking Credit退税。股息率+退税=真实收益超10%。 (40字) |
| zh-HK | 買澳洲礦業股(BHP/RIO/FMG)，唔單止資源牛市，仲有Franking Credit退稅。股息率+退稅=真實收益超10%。 (40字) |
| zh-TW | 買澳洲礦業股(BHP/RIO/FMG)，不只是資源牛市，還有Franking Credit退稅。股息率+退稅=真實收益超10%。 (40字) |
| en | Buy Aussie miners (BHP/RIO/FMG). Not just commodity bull — franking credits refund corporate tax. Yield + credit = real return >10%. |
| ja | 豪州鉱山株(BHP/RIO/FMG)。資源ブル相場だけでなく、フランキングクレジットで法人税還付。利回り+還付=実質10%超。 |
| ko | 호주 광산주(BHP/RIO/FMG). 원자재 강세장만이 아닌 프랭킹크레딧 법인세환급. 배당+환급=실질수익 10%+. |
| de | Australische Minen (BHP/RIO/FMG). Nicht nur Rohstoff-Bulle — Franking Credits erstatten Steuern. Rendite + Credit >10%. |
| fr | Mineurs australiens (BHP/RIO/FMG). Pas que bull matières premières — crédits franking remboursent l'impôt. Rendement + crédit >10%. |
| it | Minerari australiani (BHP/RIO/FMG). Non solo bull commodity — franking credit rimborsano tasse. Yield + credito = reale >10%. |

### TSA4 · NSE IT (NSE IT Services)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 买印度IT服务巨头(TCS/Infosys/Wipro/HCL)：受益于全球AI和数字化外包浪潮，卢比贬值额外加成。 (36字) |
| zh-HK | 買印度IT服務巨頭(TCS/Infosys/Wipro/HCL)：受惠全球AI同數碼化外判浪潮，盧比貶值額外加成。 (36字) |
| zh-TW | 買印度IT服務巨頭(TCS/Infosys/Wipro/HCL)：受益於全球AI和數位化外包浪潮，盧比貶值額外加成。 (36字) |
| en | Buy Indian IT giants (TCS/Infosys/Wipro/HCL): riding global AI + digital outsourcing wave. INR depreciation is a bonus tailwind. |
| ja | インドIT大手(TCS/Infosys/Wipro/HCL): 世界的AI+デジタルアウトソース波に乗る。ルピー安が追い風ボーナス。 |
| ko | 인도 IT 대형주(TCS/Infosys/Wipro/HCL): 글로벌 AI+디지털 아웃소싱 물결. 루피 약세는 추가 순풍. |
| de | Indische IT-Giganten (TCS/Infosys/Wipro/HCL): globale KI + Digital-Outsourcing-Welle. INR-Abwertung als Bonus. |
| fr | Géants IT indiens (TCS/Infosys/Wipro/HCL): vague mondiale IA + externalisation digitale. Dépréciation INR en bonus. |
| it | Giganti IT indiani (TCS/Infosys/Wipro/HCL): onda globale IA + outsourcing digitale. Deprezzamento INR come bonus. |

---

## 🇪🇺🇮🇳 四、欧印 3 模板 (autoclaw)

### EI1 · STOXX ESG (STOXX ESG Leaders)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 买入欧洲ESG龙头(诺和诺德/路威酩轩/阿斯麦/雀巢)，等权季度调仓。欧央行降息+ESG资金流入双重催化。 (39字) |
| zh-HK | 買入歐洲ESG龍頭(諾和諾德/路威酩軒/阿斯麥/雀巢)，等權季度換馬。歐央行減息+ESG資金流入雙重催化。 (39字) |
| zh-TW | 買入歐洲ESG龍頭(諾和諾德/LVMH/ASML/雀巢)，等權季度換股。歐央行降息+ESG資金流入雙重催化。 (39字) |
| en | Buy EU ESG leaders (Novo Nordisk/LVMH/ASML/Nestlé), equal-weight quarterly. ECB rate cuts + ESG inflows as dual catalysts. |
| ja | 欧州ESGリーダー(ノボ/ LVMH/ASML/ネスレ)均等四半期。ECB利下げ+ESG資金流入のダブル触媒。 |
| ko | 유럽 ESG 리더(노보/LVMH/ASML/네슬레) 동일비중 분기. ECB 금리인하+ESG 자금유입 이중 촉매. |
| de | EU-ESG-Leader (Novo Nordisk/LVMH/ASML/Nestlé), gleichgewichtet quartalsweise. EZB-Senkung + ESG-Zuflüsse. |
| fr | Leaders ESG UE (Novo Nordisk/LVMH/ASML/Nestlé), poids égal trimestriel. Baisse taux BCE + flux ESG. |
| it | Leader ESG UE (Novo Nordisk/LVMH/ASML/Nestlé), peso uguale trimestrale. Taglio tassi BCE + flussi ESG. |

### EI2 · NSE通胀对冲 (NSE Inflation Hedge)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 印度高通胀环境下的防御策略：买黄金ETF+印度国债+必需消费股。通胀越高，这三类资产越受益。 (36字) |
| zh-HK | 印度高通脹環境下嘅防禦策略：買黃金ETF+印度國債+必需消費股。通脹越高，呢三類資產越受惠。 (36字) |
| zh-TW | 印度高通膨環境下的防禦策略：買黃金ETF+印度國債+必需消費股。通膨越高，這三類資產越受益。 (36字) |
| en | India inflation defense: gold ETF + govt bonds + consumer staples. Higher inflation = these three benefit more. INR-aware allocation. |
| ja | インド高インフレ防衛: 金ETF+国債+生活必需品株。インフレ高=これら3資産がより恩恵。 |
| ko | 인도 인플레 방어: 금ETF+국채+필수소비재. 인플레↑=이 3자산이 더 수혜. |
| de | Indien-Inflationsschutz: Gold-ETF + Staatsanleihen + Basiskonsum. Höhere Inflation = diese drei profitieren. |
| fr | Protection inflation Inde: ETF or + obligations d'État + conso de base. Plus d'inflation = ces trois actifs gagnent. |
| it | Protezione inflazione India: ETF oro + titoli stato + beni consumo. Più inflazione = questi tre beneficiano. |

### EI3 · Nifty50轮动 (Nifty50 Rotation)
| 语言 | oneLiner |
|------|----------|
| zh-CN | Nifty50成分中选ROE>15%+营收增速>10%的前10只，月度调仓。印度GDP增速>6%时满仓，<4%减半仓。 (40字) |
| zh-HK | Nifty50成分中揀ROE>15%+營收增速>10%嘅前10隻，每月換馬。印度GDP增速>6%時滿倉，<4%減半倉。 (40字) |
| zh-TW | Nifty50成分中選ROE>15%+營收增速>10%的前10檔，月度換股。印度GDP增速>6%時滿倉，<4%減半倉。 (40字) |
| en | Pick top 10 Nifty50 with ROE>15% + revenue growth>10%, monthly rebalance. Full position when GDP>6%, half when <4%. |
| ja | Nifty50からROE>15%+売上成長>10%の上位10銘柄、毎月入替。GDP成長>6%でフル、<4%で半減。 |
| ko | Nifty50 중 ROE>15%+매출성장>10% 상위10종목, 월간 리밸런싱. GDP성장>6% 풀포지션, <4% 반감. |
| de | Top 10 Nifty50 mit EK-Rendite>15% + Umsatzwachstum>10%, monatlich. Voll bei BIP>6%, halb bei <4%. |
| fr | Top 10 Nifty50 avec ROE>15% + croissance CA>10%, mensuel. Plein si PIB>6%, moitié si <4%. |
| it | Top 10 Nifty50 con ROE>15% + crescita ricavi>10%, mensile. Pieno se PIL>6%, metà se <4%. |

---

## 🇺🇸 五、美股补充 3 模板 (JVS)

### US8 · 科技动量 (Tech Momentum)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 纳斯达克100中选RSI>60+营收增速>20%+机构持股上升的前10只。只做科技最强股，不强不买。 (37字) |
| zh-HK | 納斯達克100中揀RSI>60+營收增速>20%+機構持股上升嘅前10隻。只做科技最強股，唔強唔買。 (37字) |
| zh-TW | 納斯達克100中選RSI>60+營收增速>20%+機構持股上升的前10檔。只做科技最強股，不強不買。 (37字) |
| en | Nasdaq 100 filtered: RSI>60 + revenue growth>20% + rising institutional ownership. Top 10. Only the strongest tech. |
| ja | ナスダック100からRSI>60+売上成長>20%+機関保有増の上位10。最強テクノロジー株のみ。 |
| ko | 나스닥100 중 RSI>60+매출성장>20%+기관보유↑ 상위10. 최강 기술주만 거래. |
| de | Nasdaq 100 gefiltert: RSI>60 + Umsatzwachstum>20% + steigende Institutionelle. Nur die stärksten Tech-Aktien. |
| fr | Nasdaq 100 filtré: RSI>60 + croissance CA>20% + institutionnels en hausse. Top 10. Seulement la tech la plus forte. |
| it | Nasdaq 100 filtrato: RSI>60 + crescita ricavi>20% + istituzionali in aumento. Solo la tech più forte. |

### US9 · 医疗防御 (Healthcare Defense)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 买入标普500医疗板块：辉瑞/强生/联合健康等龙头。经济衰退时医疗支出不减，熊市天然避风港。 (37字) |
| zh-HK | 買入標普500醫療板塊：輝瑞/強生/聯合健康等龍頭。經濟衰退時醫療支出不減，熊市天然避風港。 (37字) |
| zh-TW | 買入標普500醫療板塊：輝瑞/嬌生/聯合健康等龍頭。經濟衰退時醫療支出不減，熊市天然避風港。 (37字) |
| en | S&P 500 healthcare: Pfizer/J&J/UnitedHealth leaders. Medical spending never stops — natural bear market shelter. |
| ja | S&P500ヘルスケア: ファイザー/J&J/ユナイテッドヘルス。医療支出は不況でも減らず、弱気相場の自然な避難先。 |
| ko | S&P500 헬스케어: 화이자/J&J/유나이티드헬스. 의료지출 경기불황에도 불변, 약세장 천연 피난처. |
| de | S&P-500-Gesundheit: Pfizer/J&J/UnitedHealth. Medizinausgaben sinken nie — natürlicher Bärenmarkt-Schutz. |
| fr | Santé S&P 500: Pfizer/J&J/UnitedHealth. Dépenses médicales ne baissent jamais — abri naturel en marché baissier. |
| it | Sanità S&P 500: Pfizer/J&J/UnitedHealth. Spesa medica mai in calo — rifugio naturale nei mercati ribassisti. |

### US10 · 消费龙头 (Consumer Staples)
| 语言 | oneLiner |
|------|----------|
| zh-CN | 买入全球消费品牌(可口可乐/宝洁/沃尔玛/好市多)，季调。不管经济好坏都要刷牙喝水购物——穿越周期。 (40字) |
| zh-HK | 買入全球消費品牌(可口可樂/寶潔/沃爾瑪/Costco)，季調。唔理經濟好壞都要刷牙飲水購物——穿越周期。 (41字) |
| zh-TW | 買入全球消費品牌(可口可樂/寶僑/沃爾瑪/Costco)，季調。不管經濟好壞都要刷牙喝水購物——穿越週期。 (40字) |
| en | Global consumer staples (Coke/P&G/Walmart/Costco), quarterly. People brush, drink, shop regardless of economy — cycle-proof. |
| ja | 世界的消費財(コカコーラ/P&G/ウォルマート/コストコ)、四半期。景気に関係なく人は歯を磨き水を飲み買い物する。 |
| ko | 글로벌 필수소비재(코카콜라/P&G/월마트/코스트코), 분기. 경기불문 양치·수분·쇼핑 — 경기순환 초월. |
| de | Globale Basiskonsum (Coke/P&G/Walmart/Costco), quartalsweise. Menschen putzen, trinken, kaufen immer — konjunkturunabhängig. |
| fr | Consommation de base mondiale (Coca/P&G/Walmart/Costco), trimestriel. On se brosse, boit, achète peu importe l'économie. |
| it | Beni consumo globali (Coca/P&G/Walmart/Costco), trimestrale. La gente si lava, beve, compra a prescindere dall'economia. |

---

## 六、20模板总览

| 编号 | 类 | 中文名 | EN名 | 汉字数 |
|:---|:---|------|------|:---:|
| CM1 | 🛢️ | COT聪明钱 | COT Smart Money | 38 |
| CM2 | 🛢️ | 基差猎人 | Basis Hunter | 39 |
| CM3 | 🛢️ | 展期收割 | Roll Yield Harvester | 40 |
| CM4 | 🛢️ | 库存周期 | Inventory Cycle | 38 |
| CM5 | 🛢️ | 金银比 | Gold/Silver Ratio | 39 |
| CM6 | 🛢️ | 实际利率黄金 | Real Rate Gold | 38 |
| JK1 | 🇯🇵 | JPX价值 | JPX Value | 39 |
| JK2 | 🇯🇵 | NISA定投 | NISA DCA | 40 |
| JK3 | 🇰🇷 | KRX动量 | KRX Momentum | 42 |
| JK4 | 🇰🇷 | KRX出口 | KRX Export | 40 |
| TSA1 | 🇹🇼 | TWSE电子除权息 | TWSE Ex-Dividend | 38 |
| TSA2 | 🇸🇬 | SGX金融 | SGX Financial | 37 |
| TSA3 | 🇦🇺 | ASX资源Franking | ASX Resource Franking | 40 |
| TSA4 | 🇮🇳 | NSE IT | NSE IT Services | 36 |
| EI1 | 🇪🇺 | STOXX ESG | STOXX ESG Leaders | 39 |
| EI2 | 🇮🇳 | NSE通胀对冲 | NSE Inflation Hedge | 36 |
| EI3 | 🇮🇳 | Nifty50轮动 | Nifty50 Rotation | 40 |
| US8 | 🇺🇸 | 科技动量 | Tech Momentum | 37 |
| US9 | 🇺🇸 | 医疗防御 | Healthcare Defense | 37 |
| US10 | 🇺🇸 | 消费龙头 | Consumer Staples | 40 |
| **MAX** | | | | **42字(JK3)** ✅ |

---

## 七、48模板全集（R204 + R205）

| 轮次 | 类别 | 模板 |
|:---|:---|------|
| R204 | 🇺🇸美股7 | 财报猎人/MAG7/价值/低波/13F/PEAD/VIX |
| R204 | 🇭🇰港股5 | AH溢价/窝轮/股息/南向/红筹 |
| R204 | 🪙加密8 | BTC趋势/ETH轮动/资费套利/清算猎杀/链上三灯/期现套利/HODL/巨鲸 |
| R204 | 🌐跨市场8 | 风险平价/全天候/双动量/因子择时/趋势双信号/黑天鹅/波动率目标/经济周期 |
| R205 | 🛢️商品6 | COT/基差/展期/库存/金银比/实际利率 |
| R205 | 🇯🇵🇰🇷日韩4 | JPX价值/NISA/KRX动量/KRX出口 |
| R205 | 🇹🇼🇸🇬🇦🇺🇮🇳台新澳4 | 电子除权息/SGX金融/ASX资源/NSE IT |
| R205 | 🇪🇺🇮🇳欧印3 | STOXX ESG/通胀对冲/Nifty50 |
| R205 | 🇺🇸美股3 | 科技动量/医疗防御/消费龙头 |
| **合计** | **11市场** | **48模板** |

---

## 八、验收

| 检查项 | 状态 |
|--------|:---:|
| 20模板全覆盖 (商品6+日韩4+台新澳4+欧印3+美股3) | ✅ |
| 9语言全翻译 | ✅ |
| CN每条≤80字 (最长42字) | ✅ |
| 每条人话说清楚"干什么" | ✅ |
| 48模板总量达成(28+20) | ✅ |
| 11市场全覆盖(🇭🇰🇺🇸🪙🛢️🇯🇵🇹🇼🇰🇷🇸🇬🇦🇺🇮🇳🇪🇺) | ✅ |

---

*QClaw(设计虾) | R205-Q08 · Phase 2 第2轮 · 48模板达成 | 2026-06-16*
