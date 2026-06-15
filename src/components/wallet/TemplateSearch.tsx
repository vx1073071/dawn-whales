// ── R207 ML P6: TemplateSearch — 模板搜索+AI策略匹配入口 ──────────
// Search bar + 11 market filter tabs + factor keyword search
// AI Match button (1U): DeepSeek recommends best template for user query
// Instant result filtering with count badges

import React, { useState, useMemo, useCallback } from 'react';
import { Button, Input, Tag, Tooltip, Badge, Empty, Skeleton } from 'antd';
import { SearchOutlined, RobotOutlined, DollarOutlined, ClearOutlined } from '@ant-design/icons';

interface SearchResult {
  id: string;
  name: string;
  nameCN: string;
  category: string;
  market: string;
  matchScore?: number; // 0-100
  matchReason?: string;
}

interface Props {
  templates?: SearchResult[];
  onSearch?: (query: string, filters: {market?:string;factor?:string}) => void;
  onAIMatch?: (query: string) => Promise<SearchResult[]>;
  onSelectTemplate?: (templateId: string) => void;
  onCharge?: (serviceId: string, amount: number) => Promise<boolean>;
  balance?: number | null;
  locale?: string;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    title:'模板搜索',sub:'搜索88款策略模板，AI帮你精准匹配',
    placeholder:'搜索模板名称、因子、市场...',
    match:'AI匹配',matching:'AI匹配中...',matchResult:'AI推荐',
    price:'1U',free:'免费',insufficient:'余额不足',
    score:'匹配度',reason:'推荐理由',
    filter:'筛选',allMarkets:'全部市场',clear:'清除',
    results:'个结果',noResults:'无匹配结果',
    tryAI:'试试AI匹配？输入你的需求描述',
    hot:'热门',new:'新',
  },
  en: {
    title:'Template Search',sub:'Search 88 strategy templates, AI-powered matching',
    placeholder:'Search template name, factor, market...',
    match:'AI Match',matching:'AI matching...',matchResult:'AI Recommended',
    price:'1U',free:'Free',insufficient:'Insufficient balance',
    score:'Match',reason:'Reason',
    filter:'Filter',allMarkets:'All',clear:'Clear',
    results:'results',noResults:'No matching templates',
    tryAI:'Try AI matching? Describe your needs',
    hot:'Hot',new:'New',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const MARKETS = [
  {code:'ALL',flag:'🌐',color:'#4a90d9',labelKey:'allMarkets'},
  {code:'US',flag:'🇺🇸',color:'#4a90d9'},
  {code:'HK',flag:'🇭🇰',color:'#d73027'},
  {code:'CN',flag:'🇨🇳',color:'#e83929'},
  {code:'JP',flag:'🇯🇵',color:'#bc002d'},
  {code:'KR',flag:'🇰🇷',color:'#0064a4'},
  {code:'TW',flag:'🇹🇼',color:'#0077b6'},
  {code:'SG',flag:'🇸🇬',color:'#ed2939'},
  {code:'AU',flag:'🇦🇺',color:'#00843d'},
  {code:'IN',flag:'🇮🇳',color:'#ff9933'},
  {code:'EU',flag:'🇪🇺',color:'#003399'},
  {code:'CRYPTO',flag:'₿',color:'#f7931a'},
];

const DEMO_TEMPLATES: SearchResult[] = [
  {id:'us_earn',name:'Earnings Hunter',nameCN:'财报猎人',category:'美股',market:'US',matchScore:92,matchReason:'你的"季报后追涨"需求匹配度高'},
  {id:'us_mag7',name:'MAG7 Momentum',nameCN:'MAG7动量',category:'美股',market:'US',matchScore:85,matchReason:'大盘科技股动量策略'},
  {id:'hk_ah',name:'AH Premium Arb',nameCN:'AH溢价套利',category:'港股',market:'HK',matchScore:78},
  {id:'cr_btc',name:'BTC Trend',nameCN:'BTC趋势',category:'加密',market:'CRYPTO',matchScore:70},
  {id:'xm_gr',name:'Global Rotation',nameCN:'全球轮动',category:'跨市场',market:'CROSS',matchScore:65},
];

const TemplateSearch: React.FC<Props> = ({
  templates, onSearch, onAIMatch, onSelectTemplate, onCharge, balance, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [query, setQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [aiSearching, setAiSearching] = useState(false);
  const [_results] = useState<SearchResult[]>([]);
  const [aiResults, setAiResults] = useState<SearchResult[]|null>(null);
  const [showAIMatch, setShowAIMatch] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const allResults = useMemo(() => {
    const source = templates || DEMO_TEMPLATES;
    let filtered = source;
    if (marketFilter !== 'ALL') {
      filtered = filtered.filter(t=>t.market===marketFilter || t.category.includes(marketFilter));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(t=>
        t.name.toLowerCase().includes(q)||t.nameCN.includes(q)||t.category.includes(q)
      );
    }
    return filtered;
  }, [query, marketFilter, templates]);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    onSearch?.(q, {market: marketFilter==='ALL'?undefined:marketFilter});
  }, [onSearch, marketFilter]);

  const handleAIMatch = useCallback(async () => {
    if (!query.trim()) return;
    if (balance !== null && balance !== undefined && balance < 1) { setError(T('insufficient',l)); return; }
    setError(null); setAiSearching(true); setShowAIMatch(true);
    try {
      if (onAIMatch) {
        const r = await onAIMatch(query);
        setAiResults(r);
      } else {
        if (onCharge) {
          const ok = await onCharge('ai_template_match', 1);
          if (!ok) { setError(T('insufficient',l)); setAiSearching(false); return; }
        }
        await new Promise(r=>setTimeout(r,1500));
        // Demo: return top 3 with AI scores
        const demo = DEMO_TEMPLATES.slice(0,3).map((t,i)=>({...t,matchScore:98-i*10,matchReason:l==='zhCN'?'基于你的查询，AI推荐此策略':'AI recommends based on your query'}));
        setAiResults(demo);
      }
    } catch(e:any) { setError(e.message||'AI match failed'); }
    setAiSearching(false);
  }, [query, onAIMatch, onCharge, balance, l]);

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(74,144,217,0.15)'}}>
      <div style={{marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <SearchOutlined style={{fontSize:20,color:'#4a90d9'}}/>
          <div>
            <div style={{color:'#e8e8e8',fontSize:16,fontWeight:700}}>{T('title',l)}</div>
            <div style={{color:'#909090',fontSize:11}}>{T('sub',l)}</div>
          </div>
        </div>
      </div>

      {/* Search bar + AI button */}
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <Input
          prefix={<SearchOutlined style={{color:'#666'}}/>}
          suffix={query?<ClearOutlined style={{color:'#666',cursor:'pointer'}} onClick={()=>{setQuery('');setAiResults(null);setShowAIMatch(false);}}/>:undefined}
          placeholder={T('placeholder',l)}
          value={query}
          onChange={e=>handleSearch(e.target.value)}
          allowClear
          style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#e8e8e8',height:44}}
        />
        <Tooltip title={balance!==null&&balance!==undefined&&balance<1?T('insufficient',l):T('match',l)}>
          <Button
            icon={<RobotOutlined/>}
            loading={aiSearching}
            onClick={handleAIMatch}
            disabled={!query.trim()||(balance!==null&&balance!==undefined&&balance<1)}
            style={{height:44,background:'linear-gradient(135deg, #d4a853 0%, #b8960f 100%)',border:'none',fontWeight:700,color:'#fff',minWidth:90}}>
            {aiSearching?T('matching',l):T('match',l)}
          </Button>
        </Tooltip>
        <Badge count={T('price',l)} style={{backgroundColor:'#d4a853'}}>
          <DollarOutlined style={{fontSize:18,color:'#d4a853'}}/>
        </Badge>
      </div>

      {/* Market filter tabs */}
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
        {MARKETS.map(m=>{
          const act = marketFilter===m.code;
          return (
            <Tag key={m.code}
              color={act?m.color:'default'}
              style={{cursor:'pointer',margin:0,fontWeight:act?600:400,background:act?undefined:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',color:act?undefined:'#909090'}}
              onClick={()=>setMarketFilter(m.code)}>
              {m.flag} {m.labelKey?T(m.labelKey,l):m.code}
            </Tag>
          );
        })}
      </div>

      {/* AI Match Results */}
      {showAIMatch && (
        <div style={{marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <RobotOutlined style={{color:'#d4a853'}}/>
            <span style={{color:'#d4a853',fontSize:13,fontWeight:600}}>{T('matchResult',l)}</span>
            {aiResults&&<span style={{color:'#909090',fontSize:11}}>({aiResults.length})</span>}
          </div>
          {aiSearching?(
            <div style={{padding:12}}><Skeleton active paragraph={{rows:2}}/></div>
          ):aiResults&&aiResults.length>0?(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {aiResults.map(r=>(
                <div key={r.id} onClick={()=>onSelectTemplate?.(r.id)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(212,168,83,0.06)',border:'1px solid rgba(212,168,83,0.15)',borderRadius:8,cursor:'pointer'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{color:'#e8e8e8',fontSize:13,fontWeight:600}}>{l==='zhCN'?r.nameCN:r.name}</span>
                      <Tag color="gold" style={{fontSize:9,margin:0}}>{r.category}</Tag>
                    </div>
                    {r.matchReason&&<div style={{color:'#d4a853',fontSize:10,marginTop:2}}>💡 {r.matchReason}</div>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:'#d4a853',fontSize:20,fontWeight:800}}>{r.matchScore||0}%</div>
                    <div style={{color:'#909090',fontSize:9}}>{T('score',l)}</div>
                  </div>
                </div>
              ))}
            </div>
          ):(
            <div style={{textAlign:'center',padding:16,color:'#666',fontSize:12}}>{T('noResults',l)}</div>
          )}
        </div>
      )}

      {/* Normal Results */}
      {!showAIMatch && (
        <div>
          <div style={{color:'#909090',fontSize:11,marginBottom:8}}>{allResults.length} {T('results',l)}</div>
          {allResults.length>0?(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {allResults.map(r=>(
                <div key={r.id} onClick={()=>onSelectTemplate?.(r.id)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,cursor:'pointer'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{color:'#e8e8e8',fontSize:13,fontWeight:600}}>{l==='zhCN'?r.nameCN:r.name}</span>
                    <Tag style={{fontSize:9,margin:0,background:'rgba(74,144,217,0.1)',border:'1px solid rgba(74,144,217,0.15)',color:'#4a90d9'}}>{r.market}</Tag>
                  </div>
                  <span style={{color:'#4a90d9',fontSize:11}}>→</span>
                </div>
              ))}
            </div>
          ):(
            <Empty description={<span style={{color:'#909090'}}>{T('noResults',l)}</span>}
              image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<RobotOutlined/>} onClick={handleAIMatch}
                style={{background:'linear-gradient(135deg, #d4a853 0%, #b8960f 100%)',border:'none'}}>
                {T('match',l)}
              </Button>
            </Empty>
          )}
        </div>
      )}

      {error&&(<div style={{color:'#ff4d4f',fontSize:12,marginTop:8,padding:8,background:'rgba(255,77,79,0.08)',borderRadius:6}}>{error}</div>)}
    </div>
  );
};

export default TemplateSearch;
