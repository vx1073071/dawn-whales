// ── R207 ML P8: TemplateOverview — 88模板总览仪表板 ──────────
// All 88 templates at a glance: market distribution chart + hot ranking Top 10 + stats
// ECharts-style simple SVG charts (no external deps for now)
// Summary: total/markets/factors/AI count + progress to 88

import React, { useMemo } from 'react';
import { Card, Tag, Progress } from 'antd';
import { TrophyOutlined, PieChartOutlined, BarChartOutlined, FireOutlined, StarFilled } from '@ant-design/icons';

interface TemplateSummary {
  id: string;
  name: string;
  nameCN: string;
  category: string;
  market: string;
  difficulty: string;
  factorCount: number;
  isAI: boolean;
  useCount?: number;
  rating?: number;
}

interface MarketDistribution {
  market: string;
  flag: string;
  count: number;
  color: string;
  percentage: number;
}

interface Props {
  templates?: TemplateSummary[];
  totalTemplates?: number;
  onSelectTemplate?: (templateId: string) => void;
  locale?: string;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    title:'88模板总览',sub:'Phase 2 策略模板全景仪表板',
    total:'模板总数',markets:'覆盖市场',factors:'使用因子',aiTemplates:'AI模板',
    progress:'完成度',distribution:'市场分布',
    hotRanking:'热门排行',top10:'TOP 10',
    uses:'次使用',factors_:'个因子',
    viewAll:'查看全部',coming:'即将上线',
    diff_beginner:'入门',diff_intermediate:'进阶',diff_advanced:'高级',
  },
  en: {
    title:'88 Templates Overview',sub:'Phase 2 Strategy Template Dashboard',
    total:'Total Templates',markets:'Markets',factors:'Factors Used',aiTemplates:'AI Templates',
    progress:'Progress',distribution:'Market Distribution',
    hotRanking:'Hot Ranking',top10:'TOP 10',
    uses:'uses',factors_:'factors',
    viewAll:'View All',coming:'Coming Soon',
    diff_beginner:'Beginner',diff_intermediate:'Intermediate',diff_advanced:'Advanced',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const MARKET_CONFIG: MarketDistribution[] = [
  {market:'美股',flag:'🇺🇸',count:15,color:'#4a90d9',percentage:0},
  {market:'港股',flag:'🇭🇰',count:8,color:'#d73027',percentage:0},
  {market:'A股',flag:'🇨🇳',count:0,color:'#e83929',percentage:0},
  {market:'日股',flag:'🇯🇵',count:2,color:'#bc002d',percentage:0},
  {market:'韩股',flag:'🇰🇷',count:2,color:'#0064a4',percentage:0},
  {market:'台股',flag:'🇹🇼',count:1,color:'#0077b6',percentage:0},
  {market:'新加坡',flag:'🇸🇬',count:1,color:'#ed2939',percentage:0},
  {market:'澳洲',flag:'🇦🇺',count:1,color:'#00843d',percentage:0},
  {market:'印度',flag:'🇮🇳',count:3,color:'#ff9933',percentage:0},
  {market:'欧洲',flag:'🇪🇺',count:3,color:'#003399',percentage:0},
  {market:'加密',flag:'₿',count:12,color:'#f7931a',percentage:0},
  {market:'跨市场',flag:'🌐',count:16,color:'#9b59b6',percentage:0},
  {market:'AI专属',flag:'🤖',count:13,color:'#d4a853',percentage:0},
  {market:'商品',flag:'🛢️',count:9,color:'#ff8c00',percentage:0},
];

const HOT_TEMPLATES: TemplateSummary[] = [
  {id:'us_mag7',name:'MAG7 Momentum',nameCN:'MAG7动量',category:'美股',market:'US',difficulty:'intermediate',factorCount:4,isAI:false,useCount:2847,rating:4.8},
  {id:'cr_btc',name:'BTC Trend',nameCN:'BTC趋势',category:'加密',market:'CRYPTO',difficulty:'advanced',factorCount:4,isAI:false,useCount:2156,rating:4.6},
  {id:'us_earn',name:'Earnings Hunter',nameCN:'财报猎人',category:'美股',market:'US',difficulty:'intermediate',factorCount:4,isAI:false,useCount:1893,rating:4.5},
  {id:'hk_ah',name:'AH Premium Arb',nameCN:'AH溢价套利',category:'港股',market:'HK',difficulty:'intermediate',factorCount:4,isAI:false,useCount:1542,rating:4.7},
  {id:'xm_gr',name:'Global Rotation',nameCN:'全球轮动',category:'跨市场',market:'CROSS',difficulty:'advanced',factorCount:4,isAI:false,useCount:1231,rating:4.3},
  {id:'ai_momentum',name:'AI Momentum',nameCN:'AI动量扫描',category:'AI专属',market:'US',difficulty:'intermediate',factorCount:3,isAI:true,useCount:1087,rating:4.9},
  {id:'cr_3l',name:'OnChain 3 Lights',nameCN:'链上三灯',category:'加密',market:'CRYPTO',difficulty:'advanced',factorCount:3,isAI:false,useCount:965,rating:4.4},
  {id:'sc_bull',name:'Bull Charge',nameCN:'牛市进攻',category:'美股',market:'US',difficulty:'beginner',factorCount:3,isAI:false,useCount:892,rating:4.2},
  {id:'us_val',name:'Deep Value',nameCN:'价值挖掘',category:'美股',market:'US',difficulty:'intermediate',factorCount:4,isAI:false,useCount:756,rating:4.5},
  {id:'xm_ct',name:'Carry Trade',nameCN:'套息交易',category:'跨市场',market:'CROSS',difficulty:'advanced',factorCount:4,isAI:false,useCount:634,rating:4.1},
];

const DIFF_COLORS: Record<string,string> = {beginner:'#52c41a',intermediate:'#d4a853',advanced:'#ff4d4f'};

const TemplateOverview: React.FC<Props> = ({
  templates, totalTemplates = 88, onSelectTemplate, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';

  const dist = useMemo(() => {
    return MARKET_CONFIG.map(m=>({...m, percentage: +(m.count/totalTemplates*100).toFixed(1)}));
  }, [totalTemplates]);

  const totalFactors = 258;
  const aiCount = dist.find(d=>d.market==='AI专属')?.count||13;
  const progressPct = +(totalTemplates/88*100).toFixed(0);
  const hotList: TemplateSummary[] = templates && templates.length > 0 ? templates : HOT_TEMPLATES;

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(74,144,217,0.15)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <PieChartOutlined style={{fontSize:24,color:'#4a90d9'}}/>
          <div>
            <div style={{color:'#e8e8e8',fontSize:18,fontWeight:800}}>{T('title',l)}</div>
            <div style={{color:'#909090',fontSize:12}}>{T('sub',l)}</div>
          </div>
        </div>
        <Progress type="circle" percent={progressPct} width={56} strokeColor="#52c41a" format={p=>p+'%'} style={{margin:0}}/>
      </div>

      {/* Summary stat cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
        {[
          {k:'total',v:totalTemplates,icon:<PieChartOutlined/>,color:'#4a90d9'},
          {k:'markets',v:11,icon:<BarChartOutlined/>,color:'#52c41a'},
          {k:'factors',v:totalFactors,icon:<StarFilled/>,color:'#d4a853'},
          {k:'aiTemplates',v:aiCount,icon:<FireOutlined/>,color:'#ff4d4f'},
        ].map(s=>(
          <Card key={s.k} size="small" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,textAlign:'center'}}>
            <div style={{color:s.color,fontSize:20,marginBottom:4}}>{s.icon}</div>
            <div style={{color:'#e8e8e8',fontSize:22,fontWeight:800}}>{s.v}</div>
            <div style={{color:'#909090',fontSize:10}}>{T(s.k,l)}</div>
          </Card>
        ))}
      </div>

      {/* Market distribution chart */}
      <Card size="small" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
          <BarChartOutlined style={{color:'#4a90d9'}}/>
          <span style={{color:'#e8e8e8',fontSize:13,fontWeight:600}}>{T('distribution',l)}</span>
        </div>
        {/* SVG bar chart */}
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {dist.filter(d=>d.count>0).sort((a,b)=>b.count-a.count).map(d=>(
            <div key={d.market} style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:24,fontSize:14,textAlign:'right'}}>{d.flag}</span>
              <span style={{width:55,fontSize:10,color:'#909090',textAlign:'right'}}>{d.market}</span>
              <div style={{flex:1,height:18,borderRadius:9,background:'rgba(255,255,255,0.04)',overflow:'hidden'}}>
                <div style={{height:'100%',width:d.percentage+'%',background:`linear-gradient(90deg, ${d.color}aa, ${d.color})`,borderRadius:9,transition:'width .5s ease',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:6}}>
                  <span style={{color:'#fff',fontSize:9,fontWeight:600}}>{d.count}</span>
                </div>
              </div>
              <span style={{width:36,fontSize:9,color:'#909090',textAlign:'left'}}>{d.percentage}%</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.04)'}}>
          {dist.filter(d=>d.count>0).map(d=>(
            <span key={d.market} style={{display:'flex',alignItems:'center',gap:3,fontSize:10,color:'#909090'}}>
              <span style={{width:8,height:8,borderRadius:4,background:d.color,display:'inline-block'}}/>
              {d.flag} {d.count}
            </span>
          ))}
        </div>
      </Card>

      {/* Hot Ranking Top 10 */}
      <Card size="small" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
          <TrophyOutlined style={{color:'#d4a853'}}/>
          <span style={{color:'#e8e8e8',fontSize:13,fontWeight:600}}>{T('hotRanking',l)} {T('top10',l)}</span>
        </div>
        <div style={{display:'flex',flexDirection:'column'}}>
          {hotList.map((t,i)=>{
            const rankEmoji = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
            return (
              <div key={t.id} onClick={()=>onSelectTemplate?.(t.id)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderBottom:i<9?'1px solid rgba(255,255,255,0.04)':'none',cursor:'pointer',borderRadius:6}}>
                {/* Rank */}
                <span style={{width:28,textAlign:'center',fontSize:rankEmoji?18:13,fontWeight:800,color:i<3?'#d4a853':'#909090'}}>
                  {rankEmoji||(i+1)}
                </span>
                {/* Info */}
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{color:'#e8e8e8',fontSize:12,fontWeight:600}}>{l==='zhCN'?t.nameCN:t.name}</span>
                    <Tag style={{fontSize:9,margin:0,background:DIFF_COLORS[t.difficulty]+'22',borderColor:DIFF_COLORS[t.difficulty]+'33',color:DIFF_COLORS[t.difficulty]}}>{T('diff_'+t.difficulty,l)}</Tag>
                    {t.isAI&&<Tag color="gold" style={{fontSize:9,margin:0}}>🤖 AI</Tag>}
                  </div>
                  <div style={{color:'#909090',fontSize:9}}>{t.category} · {t.factorCount} {T('factors_',l)}</div>
                </div>
                {/* Stats */}
                <div style={{textAlign:'right',display:'flex',alignItems:'center',gap:10}}>
                  {t.rating&&(
                    <div style={{color:'#d4a853',fontSize:11,fontWeight:600}}>
                      <StarFilled style={{fontSize:10}}/> {t.rating}
                    </div>
                  )}
                  <div style={{color:'#909090',fontSize:10}}>
                    <span style={{color:'#4a90d9',fontWeight:600}}>{t.useCount?.toLocaleString()||0}</span> {T('uses',l)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Footer */}
      <div style={{marginTop:16,textAlign:'center'}}>
        <Tag style={{background:'rgba(82,196,26,0.08)',border:'1px solid rgba(82,196,26,0.15)',color:'#52c41a',fontSize:11,padding:'4px 16px'}}>
          {progressPct}% {T('progress',l)} — {totalTemplates}/88
        </Tag>
      </div>
    </div>
  );
};

export default TemplateOverview;
