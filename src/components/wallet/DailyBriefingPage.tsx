// ── R209 ML P4: DailyBriefingPage — 龙虎榜日报付页面 (升级自R202 DailyBriefingCard) ──────────
// 3-tier funnel: FREE weekly Top20 → 🔥1U daily briefing → 💎0.5U real-time push
// Upgraded: full-page layout, upgrade funnel, paid features unlock flow

import React, { useState, useCallback } from 'react';
import { Button, Tag, Card, Tooltip, Empty } from 'antd';
import {
  CalendarOutlined, ThunderboltOutlined,
  LockOutlined, StarFilled,
  RiseOutlined, FallOutlined, BellOutlined, CrownOutlined,
} from '@ant-design/icons';

type Tier = 'free' | 'daily' | 'realtime';

interface FactorRanking {
  rank: number;
  id: string;
  name: string;
  ic: number;
  prevIC: number;
  signal: 'green'|'yellow'|'red';
  category: string;
}

interface DailyBriefing {
  date: string;
  tier: Tier;
  marketSummary: string;
  topFactors: FactorRanking[];
  anomalies: { factorId:string;factorName:string;type:string;severity:string;message:string }[];
  aiCommentary: string;
}

interface Props {
  briefing?: DailyBriefing|null;
  currentTier?: Tier;
  onUpgrade?: (tier: Tier) => Promise<boolean>;
  onTogglePush?: (enabled: boolean) => void;
  pushEnabled?: boolean;
  onCharge?: (serviceId: string, amount: number) => Promise<boolean>;
  locale?: string;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    title:'每日龙虎榜',sub:'因子IC排名+AI解读+实时推送',
    free:'免费',freeTitle:'周榜TOP20',freeDesc:'每周一更新，基础因子排名',
    daily:'日报',dailyTitle:'日报TOP5',dailyDesc:'每日更新+异常检测+AI解读',
    realtime:'实时',rtTitle:'实时推送',rtDesc:'因子触发阈值立即通知',
    upgrade:'升级',downgrade:'降级',
    priceDay:'1U',pricePush:'0.5U/条',
    current:'当前等级',locked:'付费解锁',
    push:'推送',pushOn:'推送已开启',pushOff:'推送已关闭',
    rank:'排名',ic:'IC',change:'变化',
    signal:'信号',anomaly:'异常',
    aiComment:'AI解读',noBriefing:'暂无简报',
    unlockDaily:'解锁日报 1U',unlockPush:'开通实时推送 0.5U/条',
    today:'今日',
  },
  en: {
    title:'Daily Rankings',sub:'Factor IC Ranking + AI + Real-time Push',
    free:'Free',freeTitle:'Weekly Top20',freeDesc:'Every Monday, basic ranking',
    daily:'Daily',dailyTitle:'Daily Top5',dailyDesc:'Daily update + anomaly + AI',
    realtime:'Realtime',rtTitle:'Live Push',rtDesc:'Instant notification on trigger',
    upgrade:'Upgrade',downgrade:'Downgrade',
    priceDay:'1U',pricePush:'0.5U/push',
    current:'Current Tier',locked:'Unlock',
    push:'Push',pushOn:'Push ON',pushOff:'Push OFF',
    rank:'Rank',ic:'IC',change:'Chg',
    signal:'Signal',anomaly:'Anomaly',
    aiComment:'AI Insight',noBriefing:'No briefing yet',
    unlockDaily:'Unlock Daily 1U',unlockPush:'Enable Push 0.5U/push',
    today:'Today',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const TIER_CONFIG: Record<Tier,{icon:React.ReactNode;color:string;price:number;labelKey:string;descKey:string;titleKey:string}> = {
  free: {icon:<CalendarOutlined/>,color:'#52c41a',price:0,labelKey:'free',descKey:'freeDesc',titleKey:'freeTitle'},
  daily: {icon:<StarFilled/>,color:'#d4a853',price:1,labelKey:'daily',descKey:'dailyDesc',titleKey:'dailyTitle'},
  realtime: {icon:<CrownOutlined/>,color:'#ff4d4f',price:0.5,labelKey:'realtime',descKey:'rtDesc',titleKey:'rtTitle'},
};

function generateBriefing(tier: Tier): DailyBriefing {
  const top5: FactorRanking[] = [
    {rank:1,id:'MOM_12M',name:'12M动量',ic:0.042,prevIC:0.038,signal:'green',category:'动量'},
    {rank:2,id:'ROE',name:'ROE质量',ic:0.031,prevIC:0.035,signal:'yellow',category:'质量'},
    {rank:3,id:'LOW_VOL',name:'低波动',ic:-0.018,prevIC:-0.012,signal:'red',category:'防御'},
    {rank:4,id:'PE',name:'PE价值',ic:0.028,prevIC:0.022,signal:'green',category:'价值'},
    {rank:5,id:'TURN',name:'换手率',ic:0.019,prevIC:0.025,signal:'yellow',category:'情绪'},
  ];
  return {
    date: new Date().toISOString().slice(0,10),
    tier,
    marketSummary: tier==='free'?'本周因子整体偏多，动量因子持续领跑。':'今日市场震荡，动量因子IC创新高，低波动因子承压。',
    topFactors: tier==='free'? top5.concat([...Array(15)].map((_,i)=>({rank:i+6,id:'F'+i,name:'因子'+i,ic:0.01+(Math.random()-0.5)*0.03,prevIC:0.01,signal:(['green','yellow','red'] as Array<'green'|'yellow'|'red'>)[i%3],category:'综合'}))) : top5,
    anomalies: tier==='daily'?[{factorId:'LOW_VOL',factorName:'低波动',type:'flip',severity:'high',message:'低波动因子IC反转，从正转负，防御配置失效'}] : [],
    aiCommentary: tier==='daily'?'当前动量因子处于强有效区间(IC=0.042,近3年85分位)，建议维持高配。低波动因子IC转负显示市场风险偏好回升，可适度降低防御仓位。ROE质量因子边际走弱，建议关注个股财报风险。':'',
  };
}

const DailyBriefingPage: React.FC<Props> = ({
  briefing: customBriefing, currentTier: propTier, onUpgrade,
  onTogglePush, pushEnabled: propPush, onCharge, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [tier, setTier] = useState<Tier>(propTier||'free');
  const [push, setPush] = useState(propPush||false);
  const [upgrading, setUpgrading] = useState(false);
  const [briefing, setBriefing] = useState(customBriefing||generateBriefing(tier));

  const handleUpgrade = useCallback(async (targetTier: Tier) => {
    setUpgrading(true);
    try {
      if (onUpgrade) { await onUpgrade(targetTier); }
      else if (onCharge) {
        const price = TIER_CONFIG[targetTier].price;
        if (price>0) { const ok=await onCharge('briefing_upgrade_'+targetTier, price); if (!ok) { setUpgrading(false); return; } }
      }
      setTier(targetTier);
      setBriefing(generateBriefing(targetTier));
    } catch {}
    setUpgrading(false);
  }, [onUpgrade, onCharge]);

  const handleTogglePush = useCallback(async () => {
    const next = !push;
    if (next && onCharge) {
      const ok = await onCharge('push_toggle', 0.5);
      if (!ok) return;
    }
    setPush(next);
    onTogglePush?.(next);
  }, [push, onCharge, onTogglePush]);

  const SIG: Record<string,string> = {green:'🟢',yellow:'🟡',red:'🔴'};

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(212,168,83,0.15)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <StarFilled style={{fontSize:22,color:'#d4a853'}}/>
          <div>
            <div style={{color:'#e8e8e8',fontSize:18,fontWeight:700}}>{T('title',l)}</div>
            <div style={{color:'#909090',fontSize:12}}>{T('sub',l)} · {briefing?.date||T('today',l)}</div>
          </div>
        </div>
        <Tag color={TIER_CONFIG[tier].color} style={{fontWeight:600}}>
          {TIER_CONFIG[tier].icon} {T(TIER_CONFIG[tier].labelKey,l)}
        </Tag>
      </div>

      {/* 3-tier funnel cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
        {(['free','daily','realtime'] as Tier[]).map(t=>{
          const cfg = TIER_CONFIG[t];
          const active = tier===t;
          const locked = t!=='free' && tier==='free';
          return (
            <Card key={t} size="small" style={{background:active?'rgba(212,168,83,0.08)':'rgba(255,255,255,0.03)',border:active?'2px solid rgba(212,168,83,0.4)':'1px solid rgba(255,255,255,0.08)',borderRadius:10,textAlign:'center',opacity:locked?0.7:1}}>
              <div style={{fontSize:24,marginBottom:6}}>{cfg.icon}</div>
              <div style={{color:'#e8e8e8',fontSize:13,fontWeight:700}}>{T(cfg.titleKey,l)}</div>
              <div style={{color:'#909090',fontSize:10,marginBottom:8}}>{T(cfg.descKey,l)}</div>
              {active?(
                <Tag color={cfg.color} style={{margin:0}}>{T('current',l)}</Tag>
              ):locked?(
                <Button size="small" type="primary" icon={<LockOutlined/>} loading={upgrading}
                  onClick={()=>handleUpgrade(t)}
                  style={{background:'linear-gradient(135deg, #d4a853 0%, #b8960f 100%)',border:'none',fontSize:11,fontWeight:600}}>
                  {t==='daily'?T('unlockDaily',l):T('unlockPush',l)}
                </Button>
              ):(
                <Button size="small" onClick={()=>handleUpgrade(t)}
                  style={{color:cfg.color,borderColor:cfg.color+'40'}}>
                  {T('upgrade',l)}
                </Button>
              )}
              {t!=='free'&&<div style={{color:'#d4a853',fontSize:10,marginTop:4,fontWeight:600}}>{t==='daily'?T('priceDay',l):T('pricePush',l)}</div>}
            </Card>
          );
        })}
      </div>

      {/* Ranking Table (FREE tier shows Top 20, Daily shows Top 5 + anomaly + AI) */}
      {briefing ? (
        <>
          {/* Factor Ranking */}
          <Card size="small" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,marginBottom:12}}>
            <div style={{color:'#e8e8e8',fontSize:13,fontWeight:600,marginBottom:10}}>
              {TIER_CONFIG[tier].icon} {T(TIER_CONFIG[tier].titleKey,l)} ({briefing.topFactors.length})
            </div>
            {/* Table header */}
            <div style={{display:'grid',gridTemplateColumns:'40px 1fr 70px 60px 50px',gap:8,padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',fontSize:10,color:'#909090'}}>
              <span style={{textAlign:'center'}}>#</span><span>{T('rank',l)}</span><span style={{textAlign:'right'}}>{T('ic',l)}</span><span style={{textAlign:'right'}}>{T('change',l)}</span><span>{T('signal',l)}</span>
            </div>
            {briefing.topFactors.map(f=>{
              const icChg = f.ic - f.prevIC;
              return (
                <div key={f.id} style={{display:'grid',gridTemplateColumns:'40px 1fr 70px 60px 50px',gap:8,padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.03)',fontSize:11,alignItems:'center'}}>
                  <span style={{textAlign:'center',color:f.rank<=3?'#d4a853':'#909090',fontWeight:f.rank<=3?700:400}}>{f.rank<=3?['🥇','🥈','🥉'][f.rank-1]:f.rank}</span>
                  <span>
                    <span style={{color:'#e8e8e8',fontWeight:600}}>{f.name}</span>
                    <span style={{color:'#909090',fontSize:9,marginLeft:4}}>{f.category}</span>
                  </span>
                  <span style={{textAlign:'right',color:f.ic>0?'#52c41a':'#ff4d4f',fontWeight:600}}>{f.ic.toFixed(3)}</span>
                  <span style={{textAlign:'right',color:icChg>0?'#52c41a':icChg<0?'#ff4d4f':'#909090'}}>{icChg>0?<RiseOutlined style={{fontSize:9}}/>:icChg<0?<FallOutlined style={{fontSize:9}}/>:'—'} {Math.abs(icChg).toFixed(3)}</span>
                  <span>{SIG[f.signal]}</span>
                </div>
              );
            })}
            {/* Blur overlay for locked tiers */}
            {tier==='free' && briefing.topFactors.length > 5 && (
              <div style={{position:'relative',marginTop:-(briefing.topFactors.length-5)*32}}>
                <div style={{height:80,background:'linear-gradient(transparent, #1a1a2e)',borderRadius:'0 0 10px 10px',display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:12}}>
                  <Button type="primary" icon={<LockOutlined/>} size="small"
                    onClick={()=>handleUpgrade('daily')}
                    style={{background:'linear-gradient(135deg, #d4a853 0%, #b8960f 100%)',border:'none',fontWeight:600}}>
                    {T('unlockDaily',l)}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Anomalies (daily tier only) */}
          {tier==='daily' && briefing.anomalies.length > 0 && (
            <Card size="small" style={{background:'rgba(255,77,79,0.05)',border:'1px solid rgba(255,77,79,0.15)',borderRadius:10,marginBottom:12}}>
              <div style={{color:'#ff4d4f',fontSize:12,fontWeight:600,marginBottom:6}}>⚠️ {T('anomaly',l)}</div>
              {briefing.anomalies.map(a=>(
                <div key={a.factorId} style={{color:'#ff7875',fontSize:11,padding:'4px 0'}}>
                  {a.factorName}: {a.message}
                </div>
              ))}
            </Card>
          )}

          {/* AI Commentary (daily tier only) */}
          {tier==='daily' && briefing.aiCommentary && (
            <Card size="small" style={{background:'rgba(212,168,83,0.05)',border:'1px solid rgba(212,168,83,0.15)',borderRadius:10,marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                <ThunderboltOutlined style={{color:'#d4a853'}}/>
                <span style={{color:'#d4a853',fontSize:12,fontWeight:600}}>{T('aiComment',l)}</span>
              </div>
              <div style={{color:'#d0d0d0',fontSize:12,lineHeight:1.6}}>{briefing.aiCommentary}</div>
            </Card>
          )}

          {/* Push toggle (realtime tier can activate) */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:tier==='realtime'?'rgba(82,196,26,0.05)':'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <BellOutlined style={{color:push?'#52c41a':tier==='realtime'?'#d4a853':'#909090',fontSize:16}}/>
              <div>
                <div style={{color:'#e8e8e8',fontSize:12,fontWeight:600}}>{T('push',l)}</div>
                <div style={{color:'#909090',fontSize:10}}>{push?T('pushOn',l):T('pushOff',l)}</div>
              </div>
            </div>
            {tier==='realtime'?(
              <Button size="small" type={push?'default':'primary'}
                onClick={handleTogglePush}
                style={push?{color:'#52c41a'}:{background:'linear-gradient(135deg, #d73027 0%, #b71c1c 100%)',border:'none',fontWeight:600}}>
                {push?T('pushOn',l):push?T('pushOn',l):'🔔 '+T('push',l)+' '+T('pricePush',l)}
              </Button>
            ):(
              <Tooltip title={T('pricePush',l)}>
                <Button size="small" icon={<LockOutlined/>}
                  onClick={()=>handleUpgrade('realtime')}
                  style={{color:'#d4a853',borderColor:'rgba(212,168,83,0.3)'}}>
                  {T('unlockPush',l)}
                </Button>
              </Tooltip>
            )}
          </div>
        </>
      ) : (
        <Empty description={<span style={{color:'#909090'}}>{T('noBriefing',l)}</span>} image={Empty.PRESENTED_IMAGE_SIMPLE}/>
      )}
    </div>
  );
};

export default DailyBriefingPage;
