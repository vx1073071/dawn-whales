// ── R208 ML P4: DataChannelToggle — VIP数据通道3级切换UI ──────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// 3 tiers: ⚡FREE 15min delay / 🔥1min 0.5U / 💎Real-time 1U
// Per-data-type toggle, charge on switch, degrade on failure
// Preview of data freshness, last update timestamp, auto-refresh

import React, { useState, useCallback, useEffect } from 'react';
import { Tag, Card, Tooltip } from 'antd';
import { ThunderboltOutlined, ClockCircleOutlined, WarningOutlined, CrownOutlined, SyncOutlined } from '@ant-design/icons';

type DelayTier = 'free' | '1min' | 'realtime';

interface DataChannel {
  id: string;
  name: string;
  nameCN: string;
  type: 'IV'|'flow'|'onchain'|'cot'|'tick'|'cross';
  icon: string;
  description: string;
  descriptionCN: string;
  freeAvailable: boolean;
  sources: string[];
}

interface ChannelState {
  channelId: string;
  currentTier: DelayTier;
  lastUpdate?: number;
  dataCount?: number;
  upgrading?: boolean;
  error?: string;
}

interface Props {
  channels?: DataChannel[];
  channelStates?: ChannelState[];
  onTierChange?: (channelId: string, tier: DelayTier) => Promise<boolean>;
  onCharge?: (channelId: string, amount: number) => Promise<boolean>;
  balance?: number | null;
  locale?: string;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: { title:'VIP数据通道',sub:'3级延迟切换，更快数据=更准信号',free:'免费',freeDesc:'15分钟延迟',m1:'1分钟',m1Desc:'1分钟延迟',rt:'实时',rtDesc:'实时推送',upgrade:'升级',downgrade:'降级',price:'/次',current:'当前',lastUpdate:'最后更新',refresh:'刷新',dataCount:'数据量',insufficient:'余额不足',degradeHint:'高级别不可用，自动降级',sources:'数据源',preview:'预览',unknown:'未知' },
  en: { title:'VIP Data Channel',sub:'3-tier delay, faster data = better signals',free:'Free',freeDesc:'15min delay',m1:'1min',m1Desc:'1min delay',rt:'Real-time',rtDesc:'Live stream',upgrade:'Upgrade',downgrade:'Downgrade',price:'/use',current:'Current',lastUpdate:'Last Update',refresh:'Refresh',dataCount:'Data points',insufficient:'Insufficient',degradeHint:'Higher tier unavailable, auto-degraded',sources:'Sources',preview:'Preview',unknown:'Unknown' },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const TIER_CONFIG: Record<DelayTier, {icon:React.ReactNode;color:string;price:number;labelKey:string;descKey:string}> = {
  free: {icon:<ThunderboltOutlined/>,color:'#52c41a',price:0,labelKey:'free',descKey:'freeDesc'},
  '1min': {icon:<ClockCircleOutlined/>,color:'#d4a853',price:0.5,labelKey:'m1',descKey:'m1Desc'},
  realtime: {icon:<CrownOutlined/>,color:'#ff4d4f',price:1,labelKey:'rt',descKey:'rtDesc'},
};

const DEMO_CHANNELS: DataChannel[] = [
  {id:'iv',name:'Option IV Surface',nameCN:'期权IV曲面',type:'IV',icon:'📊',description:'CBOE implied volatility across strikes/expirations',descriptionCN:'CBOE隐含波动率曲面，行权价+到期日',freeAvailable:true,sources:['CBOE','交易所API']},
  {id:'flow',name:'Capital Flow',nameCN:'资金流向',type:'flow',icon:'💰',description:'Northbound/Southbound real-time flow tracking',descriptionCN:'北向/南向资金实时净流入追踪',freeAvailable:true,sources:['东方财富','港交所']},
  {id:'onchain',name:'On-Chain Data',nameCN:'链上数据',type:'onchain',icon:'⛓️',description:'Whale addresses, exchange balances, gas trends',descriptionCN:'鲸鱼地址变动、交易所余额、Gas趋势',freeAvailable:true,sources:['Etherscan','币安']},
  {id:'cot',name:'COT Report',nameCN:'COT持仓',type:'cot',icon:'📈',description:'CFTC Commitment of Traders — long/short ratio',descriptionCN:'CFTC期货持仓报告 - 多空比、套保/投机',freeAvailable:true,sources:['CFTC']},
  {id:'tick',name:'Tick-by-Tick',nameCN:'逐笔盘口',type:'tick',icon:'📋',description:'Real-time tick data, order book depth level 3',descriptionCN:'逐笔成交+盘口深度L3，微观结构分析',freeAvailable:true,sources:['币安WebSocket']},
  {id:'cross',name:'Cross-Market Price',nameCN:'跨市场比价',type:'cross',icon:'🌐',description:'AH premium, ADR discount, ETF NAV spread',descriptionCN:'AH溢价、ADR折价、ETF折溢价实时比价',freeAvailable:true,sources:['多交易所聚合']},
];

const DataChannelToggle: React.FC<Props> = ({
  channels: customChannels, onTierChange,
  onCharge, balance, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const channels = customChannels || DEMO_CHANNELS;
  const [states, setStates] = useState<Record<string,ChannelState>>(()=>{
    const init: Record<string,ChannelState> = {};
    channels.forEach(c=>{init[c.id]={channelId:c.id,currentTier:'free',lastUpdate:Date.now(),dataCount:0};});
    return init;
  });
  const [upgrading, setUpgrading] = useState<string|null>(null);

  const handleTierChange = useCallback(async (channelId: string, newTier: DelayTier) => {
    const current = states[channelId]?.currentTier || 'free';
    if (newTier === current) return;
    setUpgrading(channelId);
    try {
      // Calculate price difference
      const priceDiff = TIER_CONFIG[newTier].price - TIER_CONFIG[current].price;
      if (priceDiff > 0 && onCharge) {
        const ok = await onCharge(channelId+'_upgrade', priceDiff);
        if (!ok) { setUpgrading(null); return; }
      }
      if (onTierChange) {
        await onTierChange(channelId, newTier);
      }
      setStates(prev=>({...prev,[channelId]:{...prev[channelId],currentTier:newTier,lastUpdate:Date.now(),dataCount:(prev[channelId]?.dataCount||0)+Math.floor(Math.random()*100)}}));
    } catch(e:any) {
      setStates(prev=>({...prev,[channelId]:{...prev[channelId],error:T('degradeHint',l),currentTier:'free'}}));
    }
    setUpgrading(null);
  }, [states, onCharge, onTierChange, l]);

  // Auto-update timestamps
  useEffect(() => {
    const iv = setInterval(()=>{setStates(prev=>{
      const next = {...prev};
      channels.forEach(c=>{
        if (next[c.id]?.currentTier !== 'free') {
          next[c.id] = {...next[c.id], lastUpdate: Date.now(), dataCount: (next[c.id].dataCount||0)+1};
        }
      });
      return next;
    });}, 5000);
    return ()=>clearInterval(iv);
  }, [channels]);

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(212,168,83,0.2)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <CrownOutlined style={{fontSize:22,color:'#d4a853'}}/>
          <div>
            <div style={{color:'#e8e8e8',fontSize:16,fontWeight:700}}>{T('title',l)}</div>
            <div style={{color:'#909090',fontSize:12}}>{T('sub',l)}</div>
          </div>
        </div>
      </div>

      {/* Tier legend */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {(['free','1min','realtime'] as DelayTier[]).map(tier=>{
          const cfg = TIER_CONFIG[tier];
          return (
            <div key={tier} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:cfg.color+'15',border:'1px solid '+cfg.color+'30',borderRadius:20}}>
              <span style={{color:cfg.color}}>{cfg.icon}</span>
              <span style={{color:'#e8e8e8',fontSize:12,fontWeight:600}}>{T(cfg.labelKey,l)}</span>
              {cfg.price>0&&<Tag color="gold" style={{margin:0,fontSize:10}}>{cfg.price}U {T('price',l)}</Tag>}
            </div>
          );
        })}
      </div>

      {/* Channel list */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {channels.map(ch=>{
          const st = states[ch.id]||{channelId:ch.id,currentTier:'free' as DelayTier};
          const tier = st.currentTier;
          const cfg = TIER_CONFIG[tier];
          const isUpgrading = upgrading === ch.id;
          return (
            <Card key={ch.id} size="small" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                {/* Left: channel info */}
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:20}}>{ch.icon}</span>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{color:'#e8e8e8',fontSize:13,fontWeight:600}}>{l==='zhCN'?ch.nameCN:ch.name}</span>
                        <Tag style={{fontSize:9,margin:0,background:'rgba(74,144,217,0.1)',color:'#4a90d9',border:'none'}}>{ch.type}</Tag>
                      </div>
                      <div style={{color:'#909090',fontSize:10}}>{l==='zhCN'?ch.descriptionCN:ch.description}</div>
                    </div>
                  </div>

                  {/* Status bar */}
                  <div style={{display:'flex',alignItems:'center',gap:12,marginTop:8,fontSize:10,color:'#909090'}}>
                    <Tooltip title={T('sources',l)}>
                      <span>{ch.sources.slice(0,2).join(', ')}</span>
                    </Tooltip>
                    <span>|</span>
                    <span><SyncOutlined style={{color:cfg.color,fontSize:9}}/> {formatTime(st.lastUpdate||0)}</span>
                    {st.dataCount !== undefined && st.dataCount > 0 && (
                      <><span>|</span><span>{T('dataCount',l)}: {st.dataCount.toLocaleString()}</span></>
                    )}
                  </div>
                </div>

                {/* Right: tier selector */}
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {(['free','1min','realtime'] as DelayTier[]).map(t=>{
                    const tc = TIER_CONFIG[t];
                    const active = tier === t;
                    const cantAfford = t!=='free' && balance !== null && balance !== undefined && balance < tc.price;
                    return (
                      <Tooltip key={t} title={cantAfford?T('insufficient',l):T(tc.descKey,l)}>
                        <button
                          onClick={()=>handleTierChange(ch.id, t)}
                          disabled={isUpgrading||cantAfford}
                          style={{
                            display:'flex',alignItems:'center',gap:4,padding:'4px 10px',
                            borderRadius:16, border: active?'2px solid '+tc.color:'1px solid rgba(255,255,255,0.08)',
                            background: active?tc.color+'20':'rgba(255,255,255,0.02)',
                            color: active?tc.color:'#909090',
                            fontWeight: active?700:400, fontSize:11,
                            cursor: isUpgrading?'wait':cantAfford?'not-allowed':'pointer',
                            opacity: cantAfford?0.5:1, transition:'all .15s',
                          }}>
                          {tc.icon} {T(tc.labelKey,l)}
                          {tc.price>0&&<span style={{fontSize:9,color:active?tc.color:'#909090',marginLeft:2}}>{tc.price}U</span>}
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Error state */}
              {st.error && (
                <div style={{marginTop:8,padding:'6px 10px',background:'rgba(255,77,79,0.06)',borderRadius:6,color:'#ff4d4f',fontSize:10}}>
                  <WarningOutlined/> {st.error}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

function formatTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

export default DataChannelToggle;
