// ── R205 ML P7: WeightSlider — 因子权重滑块交互组件 ──────────
// Drag adjust factor weights, real-time validation to 100%
// Lock/unlock individual factors, auto-balance, reset defaults
// Visual: colored progress bars, direction tags L/S, allocation preview

import React, { useState, useCallback, useEffect } from 'react';
import { Button, Progress, Tooltip, InputNumber } from 'antd';
import { LockOutlined, UnlockOutlined, UndoOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';

interface FactorWeight {
  factorId: string;
  factorName: string;
  factorNameCN: string;
  weight: number;
  color: string;
  direction: 'long' | 'short';
  locked?: boolean;
  description?: string;
}

interface Props {
  factors?: FactorWeight[];
  onChange?: (factors: FactorWeight[]) => void;
  onValidate?: (isValid: boolean, total: number) => void;
  readOnly?: boolean;
  locale?: string;
  defaultValue?: FactorWeight[];
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: { title:'因子权重配置',sub:'拖拽滑块调整权重，总和必须为100%',total:'总和',valid:'✅ 已达标',invalid:'权重和不等于100%',remaining:'剩余',over:'超配',lock:'锁定',unlock:'解锁',reset:'重置默认',ab:'自动平衡',long:'做多',short:'做空',preview:'预览' },
  en: { title:'Factor Weights',sub:'Drag to adjust, must sum to 100%',total:'Total',valid:'✅ Valid',invalid:'Must sum to 100%',remaining:'Remaining',over:'Over',lock:'Lock',unlock:'Unlock',reset:'Reset',ab:'Auto Balance',long:'Long',short:'Short',preview:'Preview' },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const DEMO_FACTORS: FactorWeight[] = [
  {factorId:'MOM_12M',factorName:'12M Momentum',factorNameCN:'12M动量',weight:35,color:'#4a90d9',direction:'long',locked:false},
  {factorId:'ROE',factorName:'Quality ROE',factorNameCN:'ROE质量',weight:25,color:'#52c41a',direction:'long',locked:false},
  {factorId:'PE',factorName:'Value PE',factorNameCN:'PE价值',weight:20,color:'#d4a853',direction:'long',locked:false},
  {factorId:'LOW_VOL',factorName:'Low Volatility',factorNameCN:'低波动',weight:20,color:'#9b59b6',direction:'short',locked:false},
];

const WeightSlider: React.FC<Props> = ({
  factors: propFactors, onChange, onValidate, readOnly, locale: pl, defaultValue,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [weights, setWeights] = useState<FactorWeight[]>(propFactors || defaultValue || DEMO_FACTORS);

  useEffect(() => { if (propFactors) setWeights(propFactors); }, [propFactors]);

  const total = weights.reduce((s,f)=>s+f.weight,0);
  const isValid = Math.abs(total-100) < 0.5;
  const remaining = 100 - total;

  useEffect(() => { onValidate?.(isValid, total); }, [isValid, total, onValidate]);

  const handleWeightChange = useCallback((idx: number, v: number) => {
    setWeights(prev=>{
      const n = [...prev];
      n[idx] = {...n[idx], weight: Math.max(0, Math.min(100, v))};
      onChange?.(n); return n;
    });
  }, [onChange]);

  const handleLock = useCallback((idx: number) => {
    setWeights(prev=>{
      const n = [...prev]; n[idx] = {...n[idx], locked: !n[idx].locked}; return n;
    });
  }, []);

  const handleReset = useCallback(() => {
    const def = defaultValue || DEMO_FACTORS;
    setWeights(def.map(d=>({...d}))); onChange?.(def.map(d=>({...d})));
  }, [defaultValue, onChange]);

  const handleAutoBalance = useCallback(() => {
    setWeights(prev=>{
      const lockedTotal = prev.filter(f=>f.locked).reduce((s,f)=>s+f.weight,0);
      const unlocked = prev.map((f,i)=>f.locked?-1:i).filter(i=>i>=0);
      if (unlocked.length===0) return prev;
      const each = Math.floor((100-lockedTotal)/unlocked.length);
      let rem = 100 - lockedTotal - each*unlocked.length;
      const n = [...prev];
      unlocked.forEach(idx=>{
        n[idx] = {...n[idx], weight: each + (rem>0?1:0)};
        if (rem>0) rem--;
      });
      onChange?.(n); return n;
    });
  }, [onChange]);

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:20,border:'1px solid rgba(74,144,217,0.15)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <div style={{color:'#e8e8e8',fontSize:15,fontWeight:700}}>{T('title',l)}</div>
          <div style={{color:'#909090',fontSize:11,marginTop:2}}>{T('sub',l)}</div>
        </div>
        <div style={{display:'flex',gap:6}}>
          <Tooltip title={T('reset',l)}><Button size="small" icon={<UndoOutlined/>} onClick={handleReset} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',color:'#909090'}}/></Tooltip>
          <Tooltip title={T('ab',l)}><Button size="small" icon={<CheckCircleOutlined/>} onClick={handleAutoBalance} style={{background:'rgba(74,144,217,0.1)',border:'1px solid rgba(74,144,217,0.2)',color:'#4a90d9'}}/></Tooltip>
        </div>
      </div>

      {/* Total bar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:8,background:isValid?'rgba(82,196,26,0.08)':'rgba(255,77,79,0.08)',border:isValid?'1px solid rgba(82,196,26,0.2)':'1px solid rgba(255,77,79,0.2)',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {isValid?<CheckCircleOutlined style={{color:'#52c41a'}}/>:<WarningOutlined style={{color:'#ff4d4f'}}/>}
          <span style={{color:'#ccc',fontSize:13}}>{T('total',l)}:</span>
          <span style={{color:isValid?'#52c41a':'#ff4d4f',fontSize:20,fontWeight:800}}>{total.toFixed(0)}%</span>
        </div>
        <div style={{textAlign:'right'}}>
          {isValid?<span style={{color:'#52c41a',fontSize:12}}>{T('valid',l)}</span>:<span style={{color:'#ff4d4f',fontSize:12}}>{remaining>0?T('remaining',l)+': +'+remaining.toFixed(0)+'%':T('over',l)+': '+Math.abs(remaining).toFixed(0)+'%'}</span>}
        </div>
      </div>

      {/* Factor weight sliders */}
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {weights.map((f,idx)=>{
          const lk = f.locked||false;
          return (
            <div key={f.factorId} style={{padding:'12px 14px',background:'rgba(255,255,255,0.02)',borderRadius:10,border:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:24,height:24,borderRadius:6,background:f.direction==='long'?'rgba(82,196,26,0.15)':'rgba(255,77,79,0.15)',color:f.direction==='long'?'#52c41a':'#ff4d4f',fontSize:12,fontWeight:700}}>{f.direction==='long'?'L':'S'}</span>
                  <div>
                    <span style={{color:'#e8e8e8',fontSize:13,fontWeight:600}}>{l==='zhCN'?f.factorNameCN:f.factorName}</span>
                    {f.description&&<div style={{color:'#909090',fontSize:10}}>{f.description}</div>}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <InputNumber min={0} max={100} value={f.weight} onChange={v=>handleWeightChange(idx,v||0)} disabled={lk||readOnly} size="small" style={{width:60,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',color:'#e8e8e8',fontWeight:700,fontSize:13}} suffix="%"/>
                  <Tooltip title={lk?T('unlock',l):T('lock',l)}>
                    <Button type="text" size="small" icon={lk?<LockOutlined/>:<UnlockOutlined/>} onClick={()=>handleLock(idx)} style={{color:lk?'#d4a853':'#909090',fontSize:12}}/>
                  </Tooltip>
                </div>
              </div>

              {/* Progress + drag */}
              <div style={{position:'relative',cursor:lk||readOnly?'not-allowed':'ew-resize'}} onClick={(e)=>{
                if (lk||readOnly) return;
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                handleWeightChange(idx,Math.round(((e.clientX-r.left)/r.width)*100));
              }}>
                <Progress percent={f.weight} strokeColor={lk?'#888':f.color} trailColor="rgba(255,255,255,0.05)" showInfo={false} size="small" style={{filter:lk?'grayscale(0.5)':undefined}}/>
                {!lk&&!readOnly&&(
                  <div style={{position:'absolute',top:-4,left:Math.min(f.weight,97)+'%',width:10,height:10,borderRadius:5,background:f.color,boxShadow:'0 0 8px '+f.color,cursor:'ew-resize',transition:'left .15s ease-out'}}/>
                )}
              </div>

              <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:10,color:'#909090'}}>
                <span>{f.direction==='long'?'🟢 '+T('long',l):'🔴 '+T('short',l)}</span>
                <span style={{color:f.color}}>{f.weight}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invalid state */}
      {!isValid&&(
        <div style={{marginTop:16,padding:'10px 14px',background:'rgba(255,77,79,0.06)',borderRadius:8,border:'1px solid rgba(255,77,79,0.15)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}><WarningOutlined style={{color:'#ff4d4f'}}/><span style={{color:'#ff4d4f',fontSize:12}}>{T('invalid',l)}</span></div>
          <Button size="small" type="primary" onClick={handleAutoBalance} style={{background:'linear-gradient(135deg, #4a90d9 0%, #357abd 100%)',border:'none'}}>{T('ab',l)}</Button>
        </div>
      )}

      {/* Preview: stacked bar */}
      <div style={{marginTop:16}}>
        <div style={{color:'#909090',fontSize:11,marginBottom:6,fontWeight:600}}>{T('preview',l)}</div>
        <div style={{display:'flex',height:24,borderRadius:12,overflow:'hidden',background:'rgba(255,255,255,0.03)'}}>
          {weights.map(f=>(
            <Tooltip key={f.factorId} title={(l==='zhCN'?f.factorNameCN:f.factorName)+': '+f.weight+'%'}>
              <div style={{width:f.weight+'%',minWidth:f.weight>0?'4px':0,background:f.color,transition:'width .3s ease'}}/>
            </Tooltip>
          ))}
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:4,marginTop:6}}>
          {weights.map(f=>(
            <Tooltip key={f.factorId} title={(l==='zhCN'?f.factorNameCN:f.factorName)+': '+f.weight+'%'}>
              <span style={{width:8,height:8,borderRadius:4,background:f.color,display:'inline-block'}}/>
            </Tooltip>
          ))}
        </div>
      </div>

      <style>{'.ant-input-number{background:rgba(255,255,255,0.04)!important;border-color:rgba(255,255,255,0.1)!important;color:#e8e8e8!important}.ant-input-number input{color:#e8e8e8!important;font-weight:700}'}</style>
    </div>
  );
};

export default WeightSlider;
export type { FactorWeight };
