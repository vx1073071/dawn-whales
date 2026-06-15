// ── R205 ML P6: MarketFilterTab — 11市场过滤Tab + 模板计数 ──────────
// 11 market tabs: US HK CN JP KR TW SG AU IN EU Cross
// Template count badges per market, ALL tab with total

import React, { useState, useCallback } from 'react';
import { Badge, Tooltip } from 'antd';

export type MarketCode = 'US'|'HK'|'CN'|'JP'|'KR'|'TW'|'SG'|'AU'|'IN'|'EU'|'CROSS';

interface MarketDef {
  code: MarketCode;
  flag: string;
  name: string;
  nameCN: string;
  nameShort: string;
  color: string;
}

interface Props {
  markets?: MarketDef[];
  activeMarket?: MarketCode | 'ALL';
  onMarketChange?: (market: MarketCode | 'ALL') => void;
  templateCounts?: Partial<Record<MarketCode, number>>;
  totalTemplates?: number;
  locale?: string;
  compact?: boolean;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: { all:'全部',allDesc:'48款策略模板',t:'个模板',
    us:'美股',hk:'港股',cn:'A股',jp:'日股',kr:'韩股',
    tw:'台股',sg:'新加坡',au:'澳洲',i:'印度',eu:'欧洲',cross:'跨市场' },
  en: { all:'All',allDesc:'48 strategy templates',t:'templates',
    us:'US',hk:'HK',cn:'CN',jp:'JP',kr:'KR',
    tw:'TW',sg:'SG',au:'AU',i:'IN',eu:'EU',cross:'Cross' },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const DEFAULT_MARKETS: MarketDef[] = [
  {code:'US',flag:'🇺🇸',name:'US Market',nameCN:'美股',nameShort:'US',color:'#4a90d9'},
  {code:'HK',flag:'🇭🇰',name:'HK Market',nameCN:'港股',nameShort:'HK',color:'#d73027'},
  {code:'CN',flag:'🇨🇳',name:'A-Share',nameCN:'A股',nameShort:'CN',color:'#e83929'},
  {code:'JP',flag:'🇯🇵',name:'JPX/TSE',nameCN:'日股',nameShort:'JP',color:'#bc002d'},
  {code:'KR',flag:'🇰🇷',name:'KRX',nameCN:'韩股',nameShort:'KR',color:'#0064a4'},
  {code:'TW',flag:'🇹🇼',name:'TWSE',nameCN:'台股',nameShort:'TW',color:'#0077b6'},
  {code:'SG',flag:'🇸🇬',name:'SGX',nameCN:'新加坡',nameShort:'SG',color:'#ed2939'},
  {code:'AU',flag:'🇦🇺',name:'ASX',nameCN:'澳洲',nameShort:'AU',color:'#00843d'},
  {code:'IN',flag:'🇮🇳',name:'NSE/BSE',nameCN:'印度',nameShort:'IN',color:'#ff9933'},
  {code:'EU',flag:'🇪🇺',name:'STOXX/Euronext',nameCN:'欧洲',nameShort:'EU',color:'#003399'},
  {code:'CROSS',flag:'🌐',name:'Cross-Market',nameCN:'跨市场',nameShort:'X',color:'#9b59b6'},
];

const MarketFilterTab: React.FC<Props> = ({
  markets: customMarkets, activeMarket = 'ALL', onMarketChange,
  templateCounts = {}, totalTemplates = 48, locale: pl, compact = false,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const markets = customMarkets || DEFAULT_MARKETS;
  const [active, setActive] = useState<MarketCode|'ALL'>(activeMarket);

  const handleSelect = useCallback((code: MarketCode|'ALL') => {
    setActive(code); onMarketChange?.(code);
  }, [onMarketChange]);

  const allCount = totalTemplates;
  const getCount = (code: MarketCode): number => templateCounts[code] || 0;

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:compact?12:16,border:'1px solid rgba(255,255,255,0.08)'}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:compact?6:8,alignItems:'center'}}>
        {/* ALL tab */}
        <button
          onClick={()=>handleSelect('ALL')}
          style={{display:'flex',alignItems:'center',gap:6,padding:compact?'6px 12px':'8px 16px',borderRadius:20,border:active==='ALL'?'2px solid rgba(74,144,217,0.6)':'1px solid rgba(255,255,255,0.1)',background:active==='ALL'?'rgba(74,144,217,0.15)':'rgba(255,255,255,0.03)',cursor:'pointer',transition:'all .2s',color:active==='ALL'?'#e8e8e8':'#909090',fontWeight:active==='ALL'?700:500,fontSize:compact?12:13}}>
          <Tooltip title={T('allDesc',l)}><span>{T('all',l)}</span></Tooltip>
          <Badge count={allCount} size="small" style={{backgroundColor:active==='ALL'?'#4a90d9':'rgba(255,255,255,0.12)',color:active==='ALL'?'#fff':'#909090',fontSize:10}}/>
        </button>
        {/* Market tabs */}
        {markets.map(m=>{
          const act = active===m.code;
          const c = getCount(m.code);
          return (
            <button key={m.code} onClick={()=>handleSelect(m.code)}
              style={{display:'flex',alignItems:'center',gap:4,padding:compact?'5px 10px':'6px 14px',borderRadius:20,border:act?'2px solid rgba(74,144,217,0.5)':'1px solid rgba(255,255,255,0.08)',background:act?'rgba(74,144,217,0.12)':'rgba(255,255,255,0.02)',cursor:'pointer',transition:'all .2s',color:act?'#e8e8e8':'#909090',fontWeight:act?700:500,fontSize:compact?11:12}}>
              <span style={{fontSize:compact?14:16}}>{m.flag}</span>
              <span>{l==='zhCN'?m.nameCN:m.nameShort}</span>
              {c>0&&(<span style={{backgroundColor:act?m.color:'rgba(255,255,255,0.08)',color:act?'#fff':'#909090',borderRadius:10,padding:'0 6px',fontSize:9,fontWeight:600,lineHeight:'16px',minWidth:16,textAlign:'center'}}>{c}</span>)}
            </button>
          );
        })}
      </div>

      {/* Summary bar */}
      <div style={{marginTop:compact?8:12,padding:compact?'6px 10px':'8px 12px',background:'rgba(74,144,217,0.05)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11,color:'#909090'}}>
        <div>
          {active==='ALL'
            ? allCount+' '+T('t',l)+' · 11 markets'
            : getCount(active)+' '+T('t',l)+' in '+active}
        </div>
        {active!=='ALL'&&(<span style={{color:'#4a90d9',cursor:'pointer',fontSize:11}} onClick={()=>handleSelect('ALL')}>← {T('all',l)}</span>)}
      </div>
    </div>
  );
};

export default MarketFilterTab;
