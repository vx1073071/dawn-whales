// ── R206 ML P5: ScenarioPackV2 — 场景包升级版 (10场景+MarketState联动+DeepSeek计费) ──────────
// Upgraded from R185 ScenarioPackSelector: 8→10 scenarios (+港股窝轮 +美股财报)
// New: MarketStateEngine integration (4-state: Bull/Bear/Shock/Panic → recommend scenario)
// New: DeepSeek charge button per scenario (1U for AI backtest interpretation)
// Each scenario card: signal light + historical stats + factor list + charge button

import React, { useState, useMemo, useCallback } from 'react';
import { Button, Tag, Card, Tooltip } from 'antd';
import {
  ExperimentOutlined,
  DollarOutlined, BulbOutlined,
} from '@ant-design/icons';

type MarketState = 'bull' | 'bear' | 'shock' | 'panic' | 'unknown';
type SignalColor = 'green' | 'yellow' | 'red';

interface Scenario {
  id: string;
  name: string;
  nameCN: string;
  icon: string;
  level: 'L1'|'L2'|'L3';
  markets: string[];
  factorIds: string[];
  factorNames: string[];
  weights: Record<string,number>;
  story: string;
  signal: SignalColor;
  bestFor: MarketState[];
  sharpe?: number;
  maxDD?: number;
  bestYear?: string;
}

interface Props {
  scenarios?: Scenario[];
  activeScenarioId?: string;
  onSelect: (scenario: Scenario) => void;
  onApply: (scenario: Scenario) => void;
  marketState?: MarketState;
  onCharge?: (serviceId: string, amount: number) => Promise<boolean>;
  locale?: string;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    title:'策略场景包',sub:'基于市场状态智能推荐场景',marketState:'当前市场',
    bull:'牛市',bear:'熊市',shock:'震荡',panic:'恐慌',unknown:'未检测',
    bestFor:'适用',scenarios:'个场景',recommend:'推荐',
    sharpe:'夏普',maxDD:'最大回撤',bestYear:'最佳年份',
    apply:'应用场景',charge:'AI回测解读',
    chargePrice:'1U',locked:'解锁AI解读',
    signal:'信号',
    new:'新',
  },
  en: {
    title:'Strategy Scenarios',sub:'AI-recommended scenarios based on market state',
    marketState:'Market',bull:'Bull',bear:'Bear',shock:'Shock',panic:'Panic',unknown:'Unknown',
    bestFor:'Best for',scenarios:'scenarios',recommend:'Recommended',
    sharpe:'Sharpe',maxDD:'MaxDD',bestYear:'Best Year',
    apply:'Apply',charge:'AI Backtest',
    chargePrice:'1U',locked:'Unlock AI',
    signal:'Signal',
    new:'New',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const STATE_COLORS: Record<string,string> = {
  bull:'#52c41a',bear:'#ff4d4f',shock:'#d4a853',panic:'#ff4d4f',unknown:'#909090',
};

const DEFAULT_SCENARIOS: Scenario[] = [
  // L1 (4)
  {id:'sc_bull',name:'Bull Charge',nameCN:'牛市进攻',icon:'🐂',level:'L1',markets:['US','HK'],factorIds:['MOM_12M','ROE','SIZE'],factorNames:['动量','ROE','市值'],weights:{MOM_12M:40,ROE:30,SIZE:30},story:'做多动量+质量，牛市标准配置',signal:'green',bestFor:['bull'],sharpe:1.35,maxDD:-0.22,bestYear:'2024'},
  {id:'sc_bear',name:'Bear Defense',nameCN:'熊市防御',icon:'🐻',level:'L1',markets:['US','HK'],factorIds:['LOW_VOL','DIV','PE'],factorNames:['低波','股息','价值'],weights:{LOW_VOL:40,DIV:35,PE:25},story:'低波+高股息+低估值三重防御',signal:'red',bestFor:['bear','panic'],sharpe:0.85,maxDD:-0.15,bestYear:'2022'},
  {id:'sc_shock',name:'Shock Rotation',nameCN:'震荡轮动',icon:'🌪️',level:'L1',markets:['US','HK','JP'],factorIds:['MOM_3M','TURN','CORR'],factorNames:['短动量','换手','相关'],weights:{MOM_3M:35,TURN:35,CORR:30},story:'震荡市3月动量+高换手轮动',signal:'yellow',bestFor:['shock'],sharpe:0.95,maxDD:-0.18,bestYear:'2023'},
  {id:'sc_growth',name:'Growth Hunter',nameCN:'成长猎手',icon:'🚀',level:'L1',markets:['US'],factorIds:['ROE','REV_GROWTH','MOM'],factorNames:['ROE','营收增长','动量'],weights:{ROE:40,REV_GROWTH:35,MOM:25},story:'高增长+高质量选股',signal:'green',bestFor:['bull'],sharpe:1.15,maxDD:-0.25,bestYear:'2020'},
  // L2 (4)
  {id:'sc_crypto',name:'Crypto Trend',nameCN:'加密趋势',icon:'📈',level:'L2',markets:['CRYPTO'],factorIds:['BTC_DOM','FUND_RATE','MVRV'],factorNames:['BTC占比','资金费率','MVRV'],weights:{BTC_DOM:35,FUND_RATE:35,MVRV:30},story:'链上指标+费率判断加密趋势',signal:'green',bestFor:['bull','shock'],sharpe:1.8,maxDD:-0.45,bestYear:'2024'},
  {id:'sc_value',name:'Value Miners',nameCN:'价值挖掘',icon:'⛏️',level:'L2',markets:['US','HK','EU'],factorIds:['PE','PB','DIV'],factorNames:['PE','PB','股息'],weights:{PE:40,PB:30,DIV:30},story:'低PE+低PB+高股息三重价值',signal:'yellow',bestFor:['bear','shock'],sharpe:0.8,maxDD:-0.20,bestYear:'2022'},
  {id:'sc_all_weather',name:'All Weather',nameCN:'全天候',icon:'🌍',level:'L2',markets:['US','HK','CN','EU','CROSS'],factorIds:['MOM','VALUE','LOW_VOL','CARRY'],factorNames:['动量','价值','低波','套息'],weights:{MOM:25,VALUE:25,LOW_VOL:25,CARRY:25},story:'桥水全天候理念，四因子等权',signal:'yellow',bestFor:['shock'],sharpe:1.05,maxDD:-0.12,bestYear:'2023'},
  {id:'sc_dual_signal',name:'Dual Signal',nameCN:'双信号',icon:'⚡',level:'L2',markets:['US','HK'],factorIds:['MOM_12M','LOW_VOL'],factorNames:['动量','低波'],weights:{MOM_12M:50,LOW_VOL:50},story:'动量+低波双信号，任一强势即入场',signal:'green',bestFor:['bull','shock'],sharpe:1.2,maxDD:-0.19,bestYear:'2024'},
  // L3 (2) — NEW additions
  {id:'sc_hk_warrant',name:'HK Warrant Flow',nameCN:'港股窝轮',icon:'🎰',level:'L3',markets:['HK'],factorIds:['TURN','MOM_20D','AH_PREMIUM'],factorNames:['换手率','20日动量','AH溢价'],weights:{TURN:35,MOM_20D:35,AH_PREMIUM:30},story:'港股窝轮资金流向+正股突破信号',signal:'yellow',bestFor:['shock','bull'],sharpe:1.5,maxDD:-0.35,bestYear:'2023'},
  {id:'sc_us_earn',name:'US Earnings Season',nameCN:'美股财报季',icon:'📊',level:'L3',markets:['US'],factorIds:['PEAD','ROE','REV_GROWTH'],factorNames:['PEAD漂移','ROE','营收增长'],weights:{PEAD:40,ROE:30,REV_GROWTH:30},story:'财报季超额漂移+ROE筛选+营收增速',signal:'green',bestFor:['bull'],sharpe:1.1,maxDD:-0.28,bestYear:'2024'},
];

const LEVEL_COLORS: Record<string,string> = {L1:'#52c41a',L2:'#3b82f6',L3:'#a855f7'};
const SIGNAL_COLORS: Record<string,string> = {green:'#52c41a',yellow:'#d4a853',red:'#ff4d4f'};

const ScenarioPackV2: React.FC<Props> = ({
  scenarios: customScenarios, activeScenarioId, onSelect, onApply,
  marketState: curState, onCharge, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const scenarios = customScenarios || DEFAULT_SCENARIOS;
  const [active, setActive] = useState(activeScenarioId||'');
  const [charging, setCharging] = useState<string|null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  // Filter: show scenarios matching current market state
  const filtered = useMemo(() => {
    if (!curState || curState==='unknown') return scenarios;
    const matching = scenarios.filter(s=>s.bestFor.includes(curState));
    const rest = scenarios.filter(s=>!s.bestFor.includes(curState));
    return [...matching, ...rest];
  }, [scenarios, curState]);

  const recommendedIds = useMemo(() => {
    if (!curState||curState==='unknown') return new Set<string>();
    return new Set(scenarios.filter(s=>s.bestFor.includes(curState)).map(s=>s.id));
  }, [scenarios, curState]);

  const handleSelect = useCallback((scenario: Scenario) => {
    setActive(scenario.id); onSelect(scenario);
  }, [onSelect]);

  const handleCharge = useCallback(async (scenarioId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCharging(scenarioId);
    try {
      if (onCharge) {
        const ok = await onCharge('scenario_ai_'+scenarioId, 1);
        if (!ok) { setCharging(null); return; }
      } else { await new Promise(r=>setTimeout(r,1200)); }
      setUnlocked(prev=>new Set(prev).add(scenarioId));
    } catch {}
    setCharging(null);
  }, [onCharge]);

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(74,144,217,0.15)',minHeight:500}}>
      {/* Header + Market State */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <ExperimentOutlined style={{fontSize:22,color:'#4a90d9'}}/>
          <div>
            <div style={{color:'#e8e8e8',fontSize:16,fontWeight:700}}>{T('title',l)}</div>
            <div style={{color:'#909090',fontSize:12}}>{T('sub',l)}</div>
          </div>
        </div>
        {curState && (
          <Tooltip title={T('marketState',l)}>
            <Tag color={STATE_COLORS[curState]} style={{fontWeight:600}}>
              {curState==='unknown'?'🔍':curState==='bull'?'🐂':curState==='bear'?'🐻':curState==='shock'?'🌪️':'🆘'}
              {' '}{T(curState,l)}{' '}
              {scenarios.filter(s=>s.bestFor.includes(curState!)).length}{' '}{T('scenarios',l)}
            </Tag>
          </Tooltip>
        )}
      </div>

      {/* Scenario Grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',gap:12}}>
        {filtered.map(s=>{
          const isActive = active===s.id;
          const isRecommended = recommendedIds.has(s.id);
          const isNew = s.id==='sc_hk_warrant'||s.id==='sc_us_earn';
          const lvColor = LEVEL_COLORS[s.level];
          return (
            <Card key={s.id} size="small"
              onClick={()=>handleSelect(s)}
              style={{
                background: isActive?'rgba(74,144,217,0.08)':'rgba(255,255,255,0.03)',
                border: isActive
                  ? '2px solid rgba(74,144,217,0.5)'
                  : isRecommended
                    ? `1px solid ${lvColor}40`
                    : '1px solid rgba(255,255,255,0.08)',
                borderRadius:10,cursor:'pointer',transition:'all .2s',
                position:'relative',
              }}>
              {/* Signal + Level + NEW badge */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:24}}>{s.icon}</span>
                  <div>
                    <span style={{color:'#e8e8e8',fontSize:13,fontWeight:700}}>{l==='zhCN'?s.nameCN:s.name}</span>
                    <div style={{color:'#909090',fontSize:10}}>{s.markets.join('·')}</div>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                  {isNew && <Tag color="purple" style={{fontSize:9,margin:0,padding:'0 4px'}}>{T('new',l)}</Tag>}
                  {isRecommended && <Tag color="green" style={{fontSize:9,margin:0}}>{T('recommend',l)}</Tag>}
                  <Tag color={LEVEL_COLORS[s.level]} style={{fontSize:9,margin:0}}>{s.level}</Tag>
                </div>
              </div>

              {/* Signal + Stats */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                <Tooltip title={T('signal',l)}>
                  <span style={{width:10,height:10,borderRadius:5,background:SIGNAL_COLORS[s.signal],display:'inline-block'}}/>
                </Tooltip>
                {s.sharpe&&<span style={{color:'#52c41a',fontSize:10}}>{T('sharpe',l)} {s.sharpe.toFixed(2)}</span>}
                {s.maxDD&&<span style={{color:'#ff4d4f',fontSize:10}}>{T('maxDD',l)} -{(s.maxDD*100).toFixed(0)}%</span>}
                {s.bestYear&&<span style={{color:'#909090',fontSize:10}}>{s.bestYear}</span>}
              </div>

              {/* Story */}
              <div style={{color:'#ccc',fontSize:11,lineHeight:1.5,marginBottom:10,padding:'6px 8px',background:'rgba(255,255,255,0.03)',borderRadius:6}}>{s.story}</div>

              {/* Factor tags */}
              <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:10}}>
                {s.factorNames.map((fn,i)=>(<Tag key={i} style={{fontSize:9,margin:0,background:'rgba(74,144,217,0.1)',border:'1px solid rgba(74,144,217,0.15)',color:'#4a90d9'}}>{fn} {s.weights[s.factorIds[i]]||0}%</Tag>))}
              </div>

              {/* Actions */}
              <div style={{display:'flex',gap:6}}>
                <Button type="primary" size="small" block
                  onClick={e=>{e.stopPropagation();onApply(s)}}
                  style={{background:isActive?'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)':'linear-gradient(135deg, #4a90d9 0%, #357abd 100%)',border:'none',fontWeight:600}}>
                  {T('apply',l)}
                </Button>
                {!unlocked.has(s.id) && (
                  <Button size="small" icon={<DollarOutlined/>} loading={charging===s.id}
                    onClick={e=>handleCharge(s.id,e)}
                    style={{background:'rgba(212,168,83,0.1)',border:'1px solid rgba(212,168,83,0.2)',color:'#d4a853',fontWeight:600,fontSize:11,whiteSpace:'nowrap'}}>
                    {T('charge',l)} {T('chargePrice',l)}
                  </Button>
                )}
                {unlocked.has(s.id)&&(
                  <Button size="small" icon={<BulbOutlined/>}
                    style={{background:'rgba(82,196,26,0.1)',border:'1px solid rgba(82,196,26,0.2)',color:'#52c41a',fontSize:11}}>
                    ✅
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ScenarioPackV2;
export type { Scenario, MarketState, SignalColor };
