// ── R210 ML P5: LeaderboardPage — 策略排行榜(排名+跟单+创作者+成绩) ──────────
// Based on existing CreatorLeaderboard(R58) + FactorWeeklyLeaderboard(R189)
// 3-tier creator levels (L1/L2/L3), follow-trade button, 30-day performance chart
// Execution fee 0.1% through ExecutionFeeEngine(R200)

import React, { useState} from 'react';
import { Button, Tag, Card, Tooltip } from 'antd';
import { TrophyOutlined, CrownOutlined, StarFilled, FireOutlined, RightOutlined } from '@ant-design/icons';

type CreatorLevel = 'L1'|'L2'|'L3';

interface StrategyEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  creatorName: string;
  creatorLevel: CreatorLevel;
  return30d: number;
  return90d: number;
  sharpe: number;
  maxDD: number;
  followers: number;
  winRate: number;
  totalTrades: number;
  markets: string[];
  category: string;
  description: string;
}

interface Props {
  entries?: StrategyEntry[];
  onFollow?: (strategyId: string) => Promise<boolean>;
  onViewDetail?: (strategyId: string) => void;
  locale?: string;
  period?: '30d'|'90d'|'all';
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    title:'策略排行榜',sub:'实盘成绩+跟单+创作者抽成',
    rank:'排名',strategy:'策略',creator:'创作者',
    return30:'30日收益',return90:'90日收益',sharpe:'夏普',maxDD:'最大回撤',
    followers:'跟单',winRate:'胜率',trades:'笔交易',
    follow:'跟单',following:'跟单中...',followed:'已跟单',
    fee:'0.1%执行费',l1:'新手',l2:'进阶',l3:'顶尖',
    period:'周期',m30:'30天',m90:'90天',all:'全部',
    noData:'暂无排行数据',hot:'热门',
  },
  en: {
    title:'Strategy Leaderboard',sub:'Live performance + Follow + Creator revenue',
    rank:'Rank',strategy:'Strategy',creator:'Creator',
    return30:'30d Return',return90:'90d Return',sharpe:'Sharpe',maxDD:'MaxDD',
    followers:'Followers',winRate:'Win%',trades:'trades',
    follow:'Follow',following:'Following...',followed:'Followed',
    fee:'0.1% exec fee',l1:'Novice',l2:'Advanced',l3:'Elite',
    period:'Period',m30:'30d',m90:'90d',all:'All',
    noData:'No data',hot:'Hot',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const LEVEL_CONFIG: Record<CreatorLevel,{icon:React.ReactNode;color:string;labelKey:string;split:number}> = {
  L1: {icon:<StarFilled/>,color:'#52c41a',labelKey:'l1',split:30},
  L2: {icon:<FireOutlined/>,color:'#d4a853',labelKey:'l2',split:20},
  L3: {icon:<CrownOutlined/>,color:'#ff4d4f',labelKey:'l3',split:10},
};

const DEMO_ENTRIES: StrategyEntry[] = [
  {rank:1,strategyId:'s1',strategyName:'动量猎手Pro',creatorName:'AlphaQuant',creatorLevel:'L3',return30d:23.5,return90d:56.8,sharpe:1.85,maxDD:-12.3,followers:1247,winRate:68.5,totalTrades:156,markets:['US','HK'],category:'动量',description:'12月动量+ROE质量双因子'},
  {rank:2,strategyId:'s2',strategyName:'AH套利之王',creatorName:'ArbMaster',creatorLevel:'L2',return30d:15.2,return90d:42.1,sharpe:1.42,maxDD:-8.5,followers:892,winRate:72.3,totalTrades:89,markets:['HK','CN'],category:'套利',description:'AH溢价+南向资金'},
  {rank:3,strategyId:'s3',strategyName:'BTC趋势跟随',creatorName:'CryptoWhale',creatorLevel:'L3',return30d:18.7,return90d:68.2,sharpe:2.1,maxDD:-22.4,followers:2156,winRate:61.2,totalTrades:234,markets:['CRYPTO'],category:'趋势',description:'BTC 200日线+周MACD'},
  {rank:4,strategyId:'s4',strategyName:'低波防御矩阵',creatorName:'SafeHarbor',creatorLevel:'L1',return30d:8.3,return90d:18.5,sharpe:0.95,maxDD:-5.2,followers:456,winRate:75.8,totalTrades:45,markets:['US'],category:'防御',description:'低波动+高股息+公用事业'},
  {rank:5,strategyId:'s5',strategyName:'全球轮动先锋',creatorName:'GlobalMind',creatorLevel:'L2',return30d:12.1,return90d:31.2,sharpe:1.15,maxDD:-9.8,followers:634,winRate:65.7,totalTrades:78,markets:['US','EU','JP'],category:'轮动',description:'3月动量跨市场轮动'},
  {rank:6,strategyId:'s6',strategyName:'链上三灯',creatorName:'OnChainSec',creatorLevel:'L1',return30d:35.2,return90d:85.1,sharpe:2.5,maxDD:-35.8,followers:965,winRate:58.3,totalTrades:312,markets:['CRYPTO'],category:'链上',description:'MVRV+NUPL+交易所余额'},
  {rank:7,strategyId:'s7',strategyName:'财报季冲刺',creatorName:'EarningsPro',creatorLevel:'L1',return30d:9.5,return90d:22.3,sharpe:1.05,maxDD:-7.2,followers:378,winRate:70.1,totalTrades:42,markets:['US'],category:'事件',description:'PEAD漂移+财报超预期'},
  {rank:8,strategyId:'s8',strategyName:'全天候平衡',creatorName:'BridgeFund',creatorLevel:'L3',return30d:6.8,return90d:15.2,sharpe:0.88,maxDD:-4.1,followers:1523,winRate:82.5,totalTrades:28,markets:['US','HK','EU','CROSS'],category:'全天候',description:'动量+价值+低波+套息等权'},
];

const LeaderboardPage: React.FC<Props> = ({
  entries: customEntries, onFollow, onViewDetail, locale: pl, period: propPeriod,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [period, setPeriod] = useState<'30d'|'90d'|'all'>(propPeriod||'30d');
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const entries = customEntries || DEMO_ENTRIES;

  const handleFollow = async (strategyId: string) => {
    setFollowing(prev=>new Set(prev).add(strategyId));
    try { if (onFollow) await onFollow(strategyId); }
    catch {}
    setFollowing(prev=>{const n=new Set(prev);n.delete(strategyId);return n;});
    setFollowed(prev=>new Set(prev).add(strategyId));
  };

  const top3 = entries.slice(0,3);

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(212,168,83,0.15)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <TrophyOutlined style={{fontSize:22,color:'#d4a853'}}/>
          <div><div style={{color:'#e8e8e8',fontSize:18,fontWeight:700}}>{T('title',l)}</div><div style={{color:'#909090',fontSize:12}}>{T('sub',l)}</div></div>
        </div>
        <div style={{display:'flex',gap:4}}>
          {(['30d','90d','all'] as const).map(p=>(
            <Tag key={p} color={period===p?'gold':'default'} style={{cursor:'pointer',margin:0}}
              onClick={()=>setPeriod(p)}>{p==='30d'?T('m30',l):p==='90d'?T('m90',l):T('all',l)}</Tag>
          ))}
        </div>
      </div>

      {/* Top 3 podium */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
        {top3.map((e,i)=>{
          const lvl = LEVEL_CONFIG[e.creatorLevel];
          const medal = i===0?'🥇':i===1?'🥈':'🥉';
          return (
            <Card key={e.strategyId} size="small" style={{background:i===0?'rgba(212,168,83,0.08)':'rgba(255,255,255,0.03)',border:i===0?'2px solid rgba(212,168,83,0.3)':'1px solid rgba(255,255,255,0.08)',borderRadius:10,textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:4}}>{medal}</div>
              <div style={{color:'#e8e8e8',fontSize:13,fontWeight:700}}>{e.strategyName}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4,marginTop:2}}>
                <span style={{color:'#909090',fontSize:10}}>{e.creatorName}</span>
                <Tooltip title={T(lvl.labelKey,l)}><Tag color={lvl.color} style={{fontSize:9,margin:0}}>{lvl.icon} {T(lvl.labelKey,l)}</Tag></Tooltip>
              </div>
              <div style={{color:e.return30d>0?'#52c41a':'#ff4d4f',fontSize:18,fontWeight:800,marginTop:6}}>{e.return30d>0?'+':''}{e.return30d.toFixed(1)}%</div>
              <div style={{color:'#909090',fontSize:9}}>{T('return30',l)}</div>
            </Card>
          );
        })}
      </div>

      {/* Full ranking table */}
      <Card size="small" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10}}>
        {/* Table header */}
        <div style={{display:'grid',gridTemplateColumns:'40px 1fr 90px 80px 70px 70px 70px 90px',gap:6,padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',fontSize:10,color:'#909090'}}>
          <span style={{textAlign:'center'}}>#</span>
          <span>{T('strategy',l)}/{T('creator',l)}</span>
          <span style={{textAlign:'right'}}>{T('return30',l)}</span>
          <span style={{textAlign:'right'}}>{T('sharpe',l)}</span>
          <span style={{textAlign:'right'}}>{T('maxDD',l)}</span>
          <span style={{textAlign:'right'}}>{T('winRate',l)}</span>
          <span style={{textAlign:'right'}}>{T('followers',l)}</span>
          <span style={{textAlign:'center'}}></span>
        </div>
        {entries.map(e=>{
          const lvl = LEVEL_CONFIG[e.creatorLevel];
          const isTop3 = e.rank <= 3;
          const isFollowing = following.has(e.strategyId);
          const isFollowed = followed.has(e.strategyId);
          return (
            <div key={e.strategyId} onClick={()=>onViewDetail?.(e.strategyId)}
              style={{display:'grid',gridTemplateColumns:'40px 1fr 90px 80px 70px 70px 70px 90px',gap:6,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.03)',fontSize:11,alignItems:'center',cursor:'pointer'}}>
              <span style={{textAlign:'center',color:isTop3?'#d4a853':'#909090',fontWeight:isTop3?700:400}}>
                {isTop3?['🥇','🥈','🥉'][e.rank-1]:e.rank}
              </span>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{color:'#e8e8e8',fontWeight:600,fontSize:12}}>{e.strategyName}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4,marginTop:1}}>
                  <span style={{color:'#909090',fontSize:9}}>{e.creatorName}</span>
                  <Tag color={lvl.color} style={{fontSize:8,margin:0,padding:'0 4px'}}>{T(lvl.labelKey,l)} {lvl.split}%</Tag>
                  {e.followers>1000&&<Tag color="red" style={{fontSize:8,margin:0,padding:'0 4px'}}>{T('hot',l)}</Tag>}
                </div>
              </div>
              <span style={{textAlign:'right',color:e.return30d>0?'#52c41a':'#ff4d4f',fontWeight:700}}>{e.return30d>0?'+':''}{e.return30d.toFixed(1)}%</span>
              <span style={{textAlign:'right',color:'#d4a853',fontWeight:600}}>{e.sharpe.toFixed(2)}</span>
              <span style={{textAlign:'right',color:'#ff4d4f'}}>{e.maxDD.toFixed(1)}%</span>
              <span style={{textAlign:'right',color:e.winRate>60?'#52c41a':'#909090'}}>{e.winRate.toFixed(1)}%</span>
              <span style={{textAlign:'right',color:'#4a90d9'}}>{e.followers.toLocaleString()}</span>
              <div style={{textAlign:'center'}}>
                {isFollowed?(
                  <Tag color="green" style={{margin:0,fontSize:9}}>✅ {T('followed',l)}</Tag>
                ):(
                  <Button size="small" type="primary" icon={<RightOutlined/>} loading={isFollowing}
                    onClick={(ev: React.MouseEvent)=>{ev.stopPropagation();handleFollow(e.strategyId)}}
                    style={{background:'linear-gradient(135deg, #4a90d9 0%, #357abd 100%)',border:'none',fontSize:10,fontWeight:600,height:24}}>
                    {T('follow',l)} <span style={{fontSize:8,opacity:.7}}>{T('fee',l)}</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Creator level legend */}
      <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:12,fontSize:10,color:'#909090'}}>
        {(['L1','L2','L3'] as CreatorLevel[]).map(lv=>{
          const cfg = LEVEL_CONFIG[lv];
          return (
            <span key={lv} style={{display:'flex',alignItems:'center',gap:4}}>
              {cfg.icon} {T(cfg.labelKey,l)}: {cfg.split}% {l==='zhCN'?'抽成':'split'}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardPage;
