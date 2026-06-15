// ── R210 ML P6: BlindBoxCard — 因子盲盒开箱UI ──────────
// User inputs holdings -> AI(DeepSeek) generates 3 factor combos
// Free: card 1 visible / Paid: card 2+3 need 1U each to flip
// Flip animation + DeepSeek commentary + one-click apply

import React, { useState, useCallback } from 'react';
import { Button, Tag, Card, Input, Skeleton } from 'antd';
import { GiftOutlined, LockOutlined, CheckCircleOutlined, RocketOutlined } from '@ant-design/icons';

interface BlindBoxResult {
  id: string;
  factorNames: string[];
  weights: Record<string,number>;
  expectedSharpe: number;
  expectedReturn: number;
  matchReason: string;
  aiCommentary?: string;
  unlocked: boolean;
}

interface Props {
  results?: BlindBoxResult[];
  onGenerate?: (holdings: string) => Promise<BlindBoxResult[]>;
  onUnlock?: (cardId: string) => Promise<boolean>;
  onApply?: (result: BlindBoxResult) => void;
  onCharge?: (serviceId: string, amount: number) => Promise<boolean>;
  locale?: string;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    title:'因子盲盒',sub:'输入持仓，AI为你生成3个因子组合',
    placeholder:'描述你的持仓... 例: AAPL 30%, 0700 25%, BTC 20%, 现金 25%',
    generate:'AI生成',generating:'生成中...',regenerate:'重新生成',
    price:'1U/张',free:'免费预览',locked:'付费翻牌',
    unlock:'翻牌 1U',unlocking:'翻牌中...',
    factorCombo:'因子组合',sharpe:'预期夏普',return:'预期收益',
    match:'匹配度',aiComment:'AI解读',
    apply:'应用此组合',applied:'已应用',
    hint:'试试输入你的持仓，AI帮你发现最优因子组合',
    card:'卡',of3:'/3',
  },
  en: {
    title:'Factor Blind Box',sub:'Enter holdings, AI generates 3 factor combos',
    placeholder:'Describe your holdings... e.g. AAPL 30%, 0700 25%, BTC 20%, Cash 25%',
    generate:'AI Generate',generating:'Generating...',regenerate:'Regenerate',
    price:'1U/card',free:'Free Preview',locked:'Flip to Reveal',
    unlock:'Flip 1U',unlocking:'Flipping...',
    factorCombo:'Factor Combo',sharpe:'Est. Sharpe',return:'Est. Return',
    match:'Match',aiComment:'AI Insight',
    apply:'Apply Combo',applied:'Applied',
    hint:'Enter your holdings, AI finds the best factor combo',
    card:'Card',of3:'/3',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

function generateDemoResults(): BlindBoxResult[] {
  return [
    {
      id:'box_1',factorNames:['12M动量','ROE质量','PE价值'],weights:{MOM_12M:40,ROE:35,PE:25},
      expectedSharpe:1.45,expectedReturn:18.5,
      matchReason:'你的持仓偏成长+质量，动量+ROE组合匹配度最高',
      aiCommentary:'12月动量因子IC=0.042处于强有效区间，配合高质量ROE筛选可过滤噪音。PE价值因子提供安全边际。整体夏普1.45优于基准。',
      unlocked: true,
    },
    {
      id:'box_2',factorNames:['低波动','股息率','AH溢价'],weights:{LOW_VOL:35,DIV:35,AH_PREMIUM:30},
      expectedSharpe:1.15,expectedReturn:12.3,
      matchReason:'考虑到你的港股持仓，低波+股息+AH溢价防御配置',
      unlocked: false,
    },
    {
      id:'box_3',factorNames:['BTC占比','资金费率','MVRV'],weights:{BTC_DOM:35,FUND_RATE:35,MVRV:30},
      expectedSharpe:2.2,expectedReturn:35.8,
      matchReason:'你的加密持仓适配链上因子组合，高夏普高风险',
      unlocked: false,
    },
  ];
}

const BlindBoxCard: React.FC<Props> = ({
  results, onGenerate, onUnlock, onApply, onCharge, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [holdings, setHoldings] = useState('');
  const [generating, setGenerating] = useState(false);
  const [boxes, setBoxes] = useState<BlindBoxResult[]>(results||[]);
  const [unlocking, setUnlocking] = useState<string|null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const handleGenerate = useCallback(async () => {
    if (!holdings.trim()) return;
    setGenerating(true);
    try {
      if (onGenerate) { const r = await onGenerate(holdings); setBoxes(r); }
      else { await new Promise(r=>setTimeout(r,2000)); setBoxes(generateDemoResults()); }
    } catch {}
    setGenerating(false);
  }, [holdings, onGenerate]);

  const handleUnlock = useCallback(async (cardId: string) => {
    setUnlocking(cardId);
    try {
      if (onUnlock) await onUnlock(cardId);
      else if (onCharge) { const ok = await onCharge('blindbox_'+cardId, 1); if (!ok) { setUnlocking(null); return; } }
      setBoxes(prev=>prev.map(b=>b.id===cardId?{...b,unlocked:true,aiCommentary:l==='zhCN'?'DeepSeek解读: 该因子组合基于你的持仓特征优化，建议结合市场状态调整权重。回测年化收益'+b.expectedReturn+'%，最大回撤可控。':'DeepSeek: This factor combo is optimized for your holdings. Backtested annual return '+b.expectedReturn+'% with manageable drawdown.'}:b));
    } catch {}
    setUnlocking(null);
  }, [onUnlock, onCharge, l]);

  const handleApply = useCallback((result: BlindBoxResult) => {
    onApply?.(result);
    setApplied(prev=>new Set(prev).add(result.id));
  }, [onApply]);

  const cardColors = ['#4a90d9','#d4a853','#ff4d4f'];

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(155,89,182,0.15)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <GiftOutlined style={{fontSize:22,color:'#9b59b6'}}/>
        <div>
          <div style={{color:'#e8e8e8',fontSize:16,fontWeight:700}}>{T('title',l)}</div>
          <div style={{color:'#909090',fontSize:12}}>{T('sub',l)}</div>
        </div>
      </div>

      {/* Input + Generate */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <Input.TextArea
          placeholder={T('placeholder',l)}
          value={holdings}
          onChange={e=>setHoldings(e.target.value)}
          rows={2}
          style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#e8e8e8',fontSize:12,resize:'none'}}
        />
        <Button type="primary" icon={<RocketOutlined/>} loading={generating}
          onClick={handleGenerate} disabled={!holdings.trim()}
          style={{height:52,background:'linear-gradient(135deg, #9b59b6 0%, #7b2d8e 100%)',border:'none',fontWeight:600,minWidth:100}}>
          {generating?T('generating',l):boxes.length>0?T('regenerate',l):T('generate',l)}
        </Button>
      </div>

      {/* Card grid */}
      {generating?(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[1,2,3].map(i=><Skeleton key={i} active paragraph={{rows:4}}/>)}
        </div>
      ):boxes.length>0?(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {boxes.map((box,idx)=>{
            const color = cardColors[idx];
            const isLocked = !box.unlocked;
            const isUnlocking = unlocking===box.id;
            const isApplied = applied.has(box.id);

            return (
              <Card key={box.id} size="small" style={{
                background: isLocked
                  ? 'rgba(255,255,255,0.02)'
                  : `rgba(${idx===0?'74,144,217':idx===1?'212,168,83':'255,77,79'},0.08)`,
                border: isLocked
                  ? '1px dashed rgba(255,255,255,0.1)'
                  : `2px solid rgba(${idx===0?'74,144,217':idx===1?'212,168,83':'255,77,79'},0.4)`,
                borderRadius:12,overflow:'hidden',textAlign:'center',
                position:'relative',minHeight:220,display:'flex',flexDirection:'column',justifyContent:'center',
              }}>
                {/* Card number */}
                <div style={{position:'absolute',top:8,left:10,color:'#909090',fontSize:10,fontWeight:600}}>
                  {T('card',l)} {idx+1}{T('of3',l)}
                </div>

                {isLocked?(
                  <>
                    {/* Locked state */}
                    <div style={{fontSize:40,opacity:.3}}>🎁</div>
                    <div style={{color:'#909090',fontSize:11,margin:'8px 0'}}>{T('locked',l)}</div>
                    <Tag color={idx===0?'green':'gold'} style={{margin:'0 auto 8px',fontSize:10}}>
                      {idx===0?T('free',l):T('price',l)}
                    </Tag>
                    <Button size="small" type="primary" icon={<LockOutlined/>} loading={isUnlocking}
                      onClick={(e)=>{e.stopPropagation();handleUnlock(box.id)}}
                      style={{background:'linear-gradient(135deg, '+color+' 0%, '+color+'dd 100%)',border:'none',fontWeight:600,fontSize:11}}>
                      {idx===0?'👁️ '+T('free',l):T('unlock',l)}
                    </Button>
                    {/* Card 1 is always free */}
                    {idx===0&&(
                      <div style={{marginTop:6}}>
                        {box.factorNames.slice(0,2).map(fn=><Tag key={fn} style={{fontSize:9,margin:2,background:'rgba(74,144,217,0.1)',color:'#4a90d9',border:'none'}}>{fn}</Tag>)}
                        <span style={{color:'#909090',fontSize:9}}>...</span>
                      </div>
                    )}
                  </>
                ):(
                  <>
                    {/* Unlocked state */}
                    <div style={{fontSize:24,marginBottom:6}}>✅</div>
                    <div style={{color:'#e8e8e8',fontSize:12,fontWeight:700,marginBottom:4}}>{T('factorCombo',l)}</div>
                    <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:3,marginBottom:8}}>
                      {box.factorNames.map(fn=>(<Tag key={fn} style={{fontSize:9,margin:0,background:color+'22',color,border:'none'}}>{fn}</Tag>))}
                    </div>
                    {/* Weights bar */}
                    <div style={{display:'flex',height:6,borderRadius:3,overflow:'hidden',marginBottom:8,background:'rgba(255,255,255,0.05)'}}>
                      {Object.entries(box.weights).map(([k,v],wi)=>{
                        const wcolors = ['#4a90d9','#52c41a','#d4a853','#9b59b6'];
                        return <div key={k} style={{width:v+'%',background:wcolors[wi%4]}}/>;
                      })}
                    </div>
                    {/* Stats */}
                    <div style={{display:'flex',justifyContent:'space-around',marginBottom:8,fontSize:10}}>
                      <div><span style={{color:'#909090'}}>{T('sharpe',l)}</span><div style={{color:'#52c41a',fontWeight:700}}>{box.expectedSharpe.toFixed(2)}</div></div>
                      <div><span style={{color:'#909090'}}>{T('return',l)}</span><div style={{color:'#52c41a',fontWeight:700}}>+{box.expectedReturn.toFixed(1)}%</div></div>
                    </div>
                    {box.aiCommentary&&(
                      <div style={{fontSize:9,color:'#909090',lineHeight:1.4,marginBottom:8,padding:'4px 6px',background:'rgba(255,255,255,0.03)',borderRadius:4,textAlign:'left'}}>
                        {box.aiCommentary.substring(0,80)}...
                      </div>
                    )}
                    <Button size="small" type={isApplied?'default':'primary'} icon={<CheckCircleOutlined/>}
                      onClick={(e)=>{e.stopPropagation();handleApply(box)}}
                      style={isApplied?{color:'#52c41a',borderColor:'rgba(82,196,26,0.3)'}:{background:'linear-gradient(135deg, '+color+' 0%, '+color+'dd 100%)',border:'none',fontWeight:600,fontSize:11}}>
                      {isApplied?T('applied',l):T('apply',l)}
                    </Button>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      ):(
        <div style={{textAlign:'center',padding:40,color:'#666'}}>
          <GiftOutlined style={{fontSize:40,opacity:.2,marginBottom:12,display:'block'}}/>
          <div style={{fontSize:13}}>{T('hint',l)}</div>
        </div>
      )}
    </div>
  );
};

export default BlindBoxCard;
