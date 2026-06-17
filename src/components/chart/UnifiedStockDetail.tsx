import { useState, useEffect, useMemo, useCallback } from 'react';

type TF = '1m'|'5m'|'15m'|'30m'|'60m'|'1D'|'1W'|'1M';
type IK = 'MA'|'EMA'|'MACD'|'RSI'|'BOLL'|'KDJ'|'VOL'|'ATR'|'DMI'|'CCI'|'MFI'|'ROC'|'SAR'|'WR'|'OBV';

interface Bar { time:number;open:number;high:number;low:number;close:number;volume:number }

const TFS:TF[]=['1m','5m','15m','30m','60m','1D','1W','1M'];
const TX:Record<string,number>={'1m':6e4,'5m':3e5,'15m':9e5,'30m':18e5,'60m':36e5,'1D':864e5,'1W':6048e5,'1M':2592e6};
const DI:Record<IK,boolean>={MA:true,EMA:false,MACD:true,RSI:true,BOLL:false,KDJ:false,VOL:true,ATR:false,DMI:false,CCI:false,MFI:false,ROC:false,SAR:false,WR:false,OBV:false};

function gB(s:string,tf:TF,n=100):Bar[]{const N=Date.now(),ms=TX[tf]||864e5;let p=s==='NVDA'?148:100;const o:Bar[]=[];for(let i=n-1;i>=0;i--){const t=N-i*ms;const op=p,cp=op*(1+(Math.random()-0.48)*(tf==='1D'?0.025:0.008));const hi=Math.max(op,cp)*(1+Math.random()*0.01),lo=Math.min(op,cp)*(1-Math.random()*0.01);o.push({time:t,open:+op.toFixed(2),high:+hi.toFixed(2),low:+lo.toFixed(2),close:+cp.toFixed(2),volume:Math.floor(Math.random()*8e6+2e6)});p=cp}return o}

function cMA(b:Bar[],n:number):(number|null)[]{return b.map((_,i)=>{if(i<n-1)return null;let s=0;for(let j=i-n+1;j<=i;j++)s+=b[j].close;return +((s/n).toFixed(2))})}
function cRSI(b:Bar[],n:number):(number|null)[]{return b.map((_,i)=>{if(i<n)return null;let g=0,l=0;for(let j=i-n+1;j<=i;j++){const c=b[j].close-b[j-1].close;if(c>0)g+=c;else l-=c}return l===0?100:+((100-100/(1+g/l)).toFixed(1))})}
export default function UnifiedStockDetail(){
  const [sym,setSym]=useState('NVDA');const [symInp,setSymInp]=useState('NVDA');
  const [tf,setTf]=useState<TF>('1D');const [mode,setMode]=useState<'k'|'i'>('k');
  const [inds,setInds]=useState<Record<IK,boolean>>({...DI});
  const [kt,setKt]=useState(0);const [showL2,setShowL2]=useState(false);
  const [showOrder,setShowOrder]=useState(false);const [splitV,setSplitV]=useState(false);

  const load=useCallback(()=>{setSym(symInp.toUpperCase())},[symInp]);
  const bars=useMemo(()=>gB(sym,tf,tf==='1D'?80:100),[sym,tf,kt]);
  const l=bars[bars.length-1];const pv=bars[bars.length-2];
  const ch=l.close-(pv?.close??l.close);const chPct=(ch/(pv?.close??l.close))*100;
  const q={symbol:sym,name:sym==='NVDA'?'NVIDIA':sym,price:+l.close.toFixed(2),change:+ch.toFixed(2),changePercent:+chPct.toFixed(2),open:l.open,high:Math.max(...bars.slice(-20).map(b=>b.high)),low:Math.min(...bars.slice(-20).map(b=>b.low)),prevClose:pv?.close??l.close,volume:l.volume};
  const up=q.changePercent>=0;
  const fp=(p:number)=>p>=1000?p.toLocaleString():p.toFixed(2);

  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement)return;const k=e.key.toLowerCase();if(k==='1')setMode('k');if(k==='2')setMode('i');if(k==='l')setShowL2(v=>!v);if(k==='o')setShowOrder(v=>!v);if(k==='s')setSplitV(v=>!v);if(k==='r'){setKt(t=>t+1);setTf('1D')}if(k==='arrowleft')setTf(t=>{const i=TFS.indexOf(t);return TFS[Math.max(0,i-1)]});if(k==='arrowright')setTf(t=>{const i=TFS.indexOf(t);return TFS[Math.min(TFS.length-1,i+1)]})};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[]);

  const tg=(k:IK)=>()=>setInds(p=>({...p,[k]:!p[k]}));

  return <div style={{background:'#0d1117',color:'#c9d1d9',fontFamily:'Inter,sans-serif',borderRadius:12,border:'1px solid #21262d',overflow:'hidden'}}>
    {/* Quote Header */}
    <div style={{display:'flex',alignItems:'center',gap:16,padding:'12px 16px',background:`linear-gradient(135deg,${up?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)'},transparent)`,borderBottom:'1px solid #21262d'}}>
      <div><span style={{fontSize:18,fontWeight:700}}>{q.symbol}</span><span style={{fontSize:12,color:'#8b949e',marginLeft:8}}>{q.name}</span></div>
      <div style={{display:'flex',alignItems:'baseline',gap:10,marginLeft:'auto'}}>
        <span style={{fontSize:28,fontWeight:800,color:up?'#22c55e':'#ef4444'}}>{fp(q.price)}</span>
        <span style={{fontSize:14,fontWeight:600,color:up?'#22c55e':'#ef4444'}}>{up?'▲':'▼'} {q.changePercent>0?'+':''}{q.changePercent.toFixed(2)}%</span>
      </div>
    </div>

    {/* Fundamentals */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4,padding:8,fontSize:11,borderBottom:'1px solid #21262d'}}>
      {[['Open',q.open],['High',q.high],['Low',q.low],['Prev',q.prevClose],['Vol',(q.volume/1e6).toFixed(1)+'M'],['PE','72'],['EPS','$2.15'],['52W H','$160'],['52W L','$85'],['MktCap','$3.8T'],['Div','0.01%'],['Turnover','2.8%']].map(([l,v])=><div key={l} style={{display:'flex',flexDirection:'column',padding:'3px 6px',background:'rgba(22,27,34,0.5)',borderRadius:4}}><span style={{fontSize:9,color:'#484f58'}}>{l}</span><span style={{fontWeight:500}}>{v}</span></div>)}
    </div>

    {/* Toolbar */}
    <div style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',flexWrap:'wrap',borderBottom:'1px solid #21262d'}}>
      <input value={symInp} onChange={e=>setSymInp(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Symbol" style={{background:'#0d1117',border:'1px solid #30363d',borderRadius:6,padding:'4px 10px',color:'#c9d1d9',fontSize:13,width:100,outline:'none'}}/>
      <button onClick={load} style={btn('#238636','#fff','#238636')}>Load</button>
      <span style={{color:'#30363d'}}>|</span>
      <button onClick={()=>setMode('k')} style={btn(mode==='k'?'#1f6feb':'none',mode==='k'?'#fff':'#8b949e')}>📊 K-Line</button>
      <button onClick={()=>setMode('i')} style={btn(mode==='i'?'#1f6feb':'none',mode==='i'?'#fff':'#8b949e')}>📈 Intraday</button>
      <span style={{color:'#30363d'}}>|</span>
      {TFS.map(t=><button key={t} onClick={()=>setTf(t)} style={btn(tf===t?'#1f6feb':'none',tf===t?'#fff':'#8b949e')}>{t}</button>)}
      <span style={{color:'#30363d'}}>|</span>
      <button onClick={()=>setShowL2(!showL2)} style={btn(showL2?'#1f6feb':'none',showL2?'#fff':'#8b949e')}>📖 L2</button>
      <button onClick={()=>setShowOrder(!showOrder)} style={btn(showOrder?'#1f6feb':'none',showOrder?'#fff':'#8b949e')}>💳 Order</button>
      <button onClick={()=>setSplitV(!splitV)} style={btn(splitV?'#1f6feb':'none',splitV?'#fff':'#8b949e')}>🖥 Split</button>
      <span title="1=K 2=Intra L=L2 O=Order S=Split ←→=TF R=Reset" style={{fontSize:10,color:'#484f58',marginLeft:'auto'}}>⌨</span>
    </div>

    {/* Indicators */}
    <div style={{display:'flex',gap:3,flexWrap:'wrap',padding:'4px 12px',borderBottom:'1px solid #21262d'}}>
      {(Object.keys(DI) as IK[]).map(k=><span key={k} onClick={tg(k)} style={{padding:'2px 8px',borderRadius:10,fontSize:10,cursor:'pointer',border:'1px solid',borderColor:inds[k]?'#1f6feb':'#30363d',color:inds[k]?'#58a6ff':'#8b949e',background:inds[k]?'rgba(31,111,235,0.15)':'none'}}>{['MA','EMA','MACD','RSI','BOLL','KDJ','VOL','ATR','DMI','CCI','MFI','ROC','SAR','WR','OBV'][(Object.keys(DI) as IK[]).indexOf(k) as number]}</span>)}
    </div>

    {/* Chart */}
    <div style={{minHeight:300,padding:8}}>
      {mode==='k'?<KChart bars={bars} inds={inds}/>:<IChart bars={bars}/>}
    </div>

    {/* Sidebar */}
    <div style={{display:'grid',gridTemplateColumns:splitV?'1fr':'1fr 1fr',gap:6,padding:'8px 12px',borderTop:'1px solid #21262d'}}>
      {showL2&&<L2Panel bars={bars}/>}
      {showOrder&&<OPanel sym={q.symbol} price={q.price}/>}
    </div>

    <div style={{padding:'6px 12px',fontSize:10,color:'#484f58',textAlign:'center',borderTop:'1px solid #21262d'}}>⌨ 1=K 2=Intra L=L2 O=Order S=Split ←→=TF R=Reset</div>
  </div>;
}

function btn(bg:string,cl:string,bc?:string):React.CSSProperties{return{padding:'3px 8px',fontSize:11,cursor:'pointer',borderRadius:4,background:bg||'none',color:cl,border:`1px solid ${bc||'#30363d'}`,transition:'all 0.15s'}}
function btnH(bg:string,cl:string):React.CSSProperties{return{padding:'3px 8px',fontSize:11,cursor:'pointer',borderRadius:4,background:bg,color:cl,border:'1px solid '+(bg||'#30363d')}}

function KChart({bars,inds}:{bars:Bar[];inds:Record<IK,boolean>}){
  if(bars.length===0)return null;
  const W=600,H=200,P=15;
  const all=bars.flatMap(b=>[b.high,b.low]);const mn=Math.min(...all)*0.995,mx=Math.max(...all)*1.005;const rng=mx-mn||1;
  const bw=Math.max((W-P*2)/bars.length,0.5);const mxV=Math.max(...bars.map(b=>b.volume));
  const ma20=cMA(bars,20);const hasRSI=inds.RSI;const rsi=hasRSI?cRSI(bars,14):null;
  const candles=bars.map((b,i)=>{const x=P+(i+.5)*bw;const y=(v:number)=>H-P-((v-mn)/rng)*(H-P*2);return {x,yH:y(b.high),yL:y(b.low),yO:y(b.open),yC:y(b.close),up:b.close>=b.open,w:Math.max(bw*.6,.5)}});
  const volBars=bars.map((b,i)=>({x:P+(i+.5)*bw,y:255-(b.volume/mxV)*30,h:(b.volume/mxV)*30,w:Math.max(bw*.6,.5),up:b.close>=b.open}));
  const ma20Pts=ma20.map((v,i)=>v!=null?`${P+(i+.5)*bw},${H-P-((v-mn)/rng)*(H-P*2)}`:'').filter(Boolean).join(' ');
  const rsiPts=rsi?rsi.map((v,i)=>v!=null?`${P+(i+.5)*bw},${290-((v)/100)*25}`:'').filter(Boolean).join(' '):'';
  return <svg viewBox={`0 0 ${W} ${rsi?300:260}`} style={{width:'100%',background:'rgba(13,17,23,0.5)',borderRadius:8}}>
    {[0.25,0.5,0.75].map(p=><line key={p} x1={P} y1={H-P-(H-P*2)*p} x2={W-P} y2={H-P-(H-P*2)*p} stroke="#21262d" strokeWidth={0.3}/>)}
    {candles.map((c,i)=><g key={i}><line x1={c.x} y1={c.yH} x2={c.x} y2={c.yL} stroke={c.up?'#22c55e':'#ef4444'} strokeWidth={0.8}/><rect x={c.x-c.w/2} y={Math.min(c.yO,c.yC)} width={c.w} height={Math.abs(c.yC-c.yO)+0.5} fill={c.up?'#22c55e':'#ef4444'}/></g>)}
    {ma20Pts&&<polyline points={ma20Pts} fill="none" stroke="#fbbf24" strokeWidth={1}/>}
    {volBars.map((v,i)=><rect key={i} x={v.x-v.w/2} y={v.y} width={v.w} height={v.h} fill={v.up?'rgba(34,197,94,0.35)':'rgba(239,68,68,0.35)'}/>)}
    {rsi&&<><line x1={P} y1={265} x2={W-P} y2={265} stroke="#21262d" strokeWidth={0.5}/><line x1={P} y1={280} x2={W-P} y2={280} stroke="rgba(239,68,68,0.3)" strokeWidth={0.3} strokeDasharray="2,2"/><line x1={P} y1={250} x2={W-P} y2={250} stroke="rgba(34,197,94,0.3)" strokeWidth={0.3} strokeDasharray="2,2"/><polyline points={rsiPts} fill="none" stroke="#8b5cf6" strokeWidth={1}/><text x={P+4} y={255} fontSize={7} fill="#8b949e">RSI(14)</text></>}
  </svg>;
}

function IChart({bars}:{bars:Bar[]}){
  if(bars.length===0)return null;
  const W=600,H=160,P=10;
  const pts:{t:number;p:number;a:number;v:number}[]=[];const N=Date.now();const s=new Date(N);s.setHours(9,30,0,0);let p=bars[bars.length-1]?.close??148,tv=0,ta=0;
  for(let t=s.getTime();t<=N;t+=6e4){p*=1+(Math.random()-0.48)*0.003;const v=Math.floor(Math.random()*5e5+5e4);tv+=v;ta+=p*v;pts.push({t,p:+p.toFixed(2),a:+(ta/tv).toFixed(2),v})}
  if(pts.length===0)return null;
  const pc=bars[bars.length-2]?.close??148;
  const all=[...pts.map(x=>x.p),pc];const mn=Math.min(...all)*0.998,mx=Math.max(...all)*1.002;const rng=mx-mn||1;
  const xs=(W-P*2)/(pts.length-1||1);
  const pp=pts.map((pp2,i)=>`${i===0?'M':'L'}${P+i*xs},${H-P-((pp2.p-mn)/rng)*(H-P*2)}`).join(' ');
  const ap=pts.map((pp2,i)=>`${i===0?'M':'L'}${P+i*xs},${H-P-((pp2.a-mn)/rng)*(H-P*2)}`).join(' ');
  const py=H-P-((pc-mn)/rng)*(H-P*2);const cp=pts[pts.length-1]?.p??pc;const cy=H-P-((cp-mn)/rng)*(H-P*2);
  return <svg viewBox="0 0 600 210" style={{width:'100%',background:'rgba(13,17,23,0.5)',borderRadius:8}}>
    {[0.25,0.5,0.75].map(p2=><line key={p2} x1={P} y1={H-P-(H-P*2)*p2} x2={W-P} y2={H-P-(H-P*2)*p2} stroke="#21262d" strokeWidth={0.3}/>)}
    <line x1={P} y1={py} x2={W-P} y2={py} stroke="#8b949e" strokeWidth={0.8} strokeDasharray="4,3"/>
    <path d={ap} fill="none" stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3,2"/>
    <path d={pp} fill="none" stroke="#58a6ff" strokeWidth={1.5}/>
    <path d={`${pp} L${W-P},${H-P} L${P},${H-P} Z`} fill="url(#idc-g)" opacity={0.1}/>
    <defs><linearGradient id="idc-g" x1={0} y1={0} x2={0} y2={1}><stop offset="0%" stopColor={cp>=pc?'#22c55e':'#ef4444'}/><stop offset="100%" stopColor="transparent"/></linearGradient></defs>
    {pts.length>0&&<circle cx={P+(pts.length-1)*xs} cy={cy} r={4} fill={cp>=pc?'#22c55e':'#ef4444'} stroke="#fff" strokeWidth={1}><animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite"/></circle>}
  </svg>;
}

function L2Panel({bars}:{bars:Bar[]}){
  const bp=bars[bars.length-1]?.close??148;
  const bids:number[][]=[];const asks:number[][]=[];
  for(let i=0;i<5;i++){bids.push([+(bp*(1-(i+1)*0.001)).toFixed(2),Math.floor(Math.random()*5000+500)]);asks.push([+(bp*(1+(i+1)*0.001)).toFixed(2),Math.floor(Math.random()*5000+500)])}
  const mx=Math.max(...bids.map(b=>b[1]),...asks.map(a=>a[1]));
  return <div style={{padding:10,background:'#161b22',border:'1px solid #21262d',borderRadius:10}}>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12,fontWeight:600}}><span>Level 2 Order Book</span><span style={{background:'rgba(31,111,235,0.2)',color:'#58a6ff',padding:'1px 6px',borderRadius:6,fontSize:9}}>L2</span></div>
    <div style={{display:'flex',fontSize:9,color:'#484f58',marginBottom:3}}><span style={{flex:1}}>Bid</span><span style={{flex:1,textAlign:'center'}}>Price</span><span style={{flex:1,textAlign:'right'}}>Ask</span></div>
    {asks.slice().reverse().map((a,i)=><div key={'a'+i} style={{display:'flex',alignItems:'center',padding:'2px 0',fontSize:10}}><span style={{flex:1}}/><span style={{flex:1,textAlign:'center',fontWeight:600,color:'#c9d1d9'}}>{a[0]}</span><span style={{flex:1,textAlign:'right',color:'#ef4444',position:'relative'}}>{a[1].toLocaleString()}<span style={{position:'absolute',right:0,top:0,bottom:0,width:`${(a[1]/mx)*100}%`,background:'rgba(239,68,68,0.1)',borderRadius:2}}/></span></div>)}
    {bids.map((b,i)=><div key={'b'+i} style={{display:'flex',alignItems:'center',padding:'2px 0',fontSize:10}}><span style={{flex:1,color:'#22c55e',position:'relative'}}>{b[1].toLocaleString()}<span style={{position:'absolute',right:0,top:0,bottom:0,width:`${(b[1]/mx)*100}%`,background:'rgba(34,197,94,0.1)',borderRadius:2}}/></span><span style={{flex:1,textAlign:'center',fontWeight:600,color:'#c9d1d9'}}>{b[0]}</span><span style={{flex:1}}/></div>)}
  </div>;
}

function OPanel({sym,price}:{sym:string;price:number}){
  const [side,setSide]=useState<'buy'|'sell'>('buy');const [tp,setTp]=useState<'limit'|'market'|'stop'>('limit');
  const [qty,setQty]=useState(100);const [lp,setLp]=useState(price.toFixed(2));
  const est=tp==='market'?qty*price*1.002:qty*parseFloat(lp||'0');
  return <div style={{padding:10,background:'#161b22',border:'1px solid #21262d',borderRadius:10}}>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13,fontWeight:600}}><span>Quick Order</span><span style={{color:'#58a6ff'}}>{sym}</span></div>
    <div style={{display:'flex',gap:4,marginBottom:6}}>
      <button onClick={()=>setSide('buy')} style={btnH(side==='buy'?'rgba(34,197,94,0.15)':'none',side==='buy'?'#22c55e':'#c9d1d9')}>Buy</button>
      <button onClick={()=>setSide('sell')} style={btnH(side==='sell'?'rgba(239,68,68,0.15)':'none',side==='sell'?'#ef4444':'#c9d1d9')}>Sell</button>
    </div>
    <div style={{display:'flex',gap:3,marginBottom:6}}>{['limit','market','stop'].map(t=><button key={t} onClick={()=>setTp(t as typeof tp)} style={btnH(tp===t?'#1f6feb':'none',tp===t?'#fff':'#8b949e')}>{t==='limit'?'Limit':t==='market'?'Market':'Stop'}</button>)}</div>
    {tp!=='market'&&<input type="number" value={lp} onChange={e=>setLp(e.target.value)} placeholder="Price" step="0.01" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:6,padding:6,color:'#c9d1d9',fontSize:13,marginBottom:6,outline:'none'}}/>}
    <div style={{display:'flex',gap:4,alignItems:'center',marginBottom:6}}>
      <input type="number" value={qty} onChange={e=>setQty(Number(e.target.value))} placeholder="Qty" style={{flex:1,background:'#0d1117',border:'1px solid #30363d',borderRadius:6,padding:6,color:'#c9d1d9',fontSize:13,outline:'none'}}/>
      {[100,500,1000,5000].map(n=><button key={n} onClick={()=>setQty(n)} style={btnH(qty===n?'#1f6feb':'none',qty===n?'#fff':'#8b949e')}>{n}</button>)}
    </div>
    <div style={{fontSize:10,color:'#8b949e',marginBottom:8}}>Est: <b style={{color:'#c9d1d9'}}>${est.toFixed(2)}</b> <span style={{color:'#fbbf24'}}>Fee:${(est*0.001).toFixed(2)}</span></div>
    <button style={{width:'100%',padding:10,border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer',color:'#fff',background:side==='buy'?'#238636':'#da3633'}}>{side==='buy'?'Buy':'Sell'} {sym}</button>
  </div>;
}
