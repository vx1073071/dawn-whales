/**
 * FactorUnificationEngine — R276 JVS-1 因子去重合并引擎
 * 合并: 4套calculator + 3套cache + 3套crowding + 2套preprocessor → 统一4 class
 */
export type FactorSignal = 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
export type FactorCategory = 'value'|'growth'|'momentum'|'size'|'volatility'|'liquidity'|'flow'|'macro'|'sentiment'|'quality'|'dividend';

export interface FactorCalcInput { symbol:string; market:string; price:number; volume:number; closeHistory:number[]; volumeHistory:number[]; fundamentals?:{pe?:number;pb?:number;roe?:number;eps?:number;revenueGrowth?:number;marketCap?:number;dividendYield?:number}; macro?:{northboundFlow?:number;institutionFlow?:number;majorFlow5D?:number;pmi?:number}; params?:Record<string,number> }
export interface FactorCalcResult { factorId:string; factorName:string; value:number; normalized:number; signal:FactorSignal; category:FactorCategory; timestamp:number }
export interface FactorCalcConfig { id:string; name:string; category:FactorCategory; formula:string; thresholds:{strongLong:number;long:number;short:number;strongShort:number}; enabled:boolean; requires?:('fundamentals'|'macro'|'closeHistory'|'volumeHistory')[] }

const FAC_REG:FactorCalcConfig[]=[
  {id:'pe_ttm',name:'PE_TTM',category:'value',formula:'1/(PE/15)',thresholds:{strongLong:0.8,long:0.6,short:0.3,strongShort:0.15},enabled:true,requires:['fundamentals']},
  {id:'pb_lf',name:'PB_LF',category:'value',formula:'1/(PB/1.5)',thresholds:{strongLong:0.8,long:0.6,short:0.3,strongShort:0.15},enabled:true,requires:['fundamentals']},
  {id:'dividend_yield',name:'Dividend',category:'dividend',formula:'DY*20',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.1},enabled:true,requires:['fundamentals']},
  {id:'ev_ebitda',name:'EV/EBITDA',category:'value',formula:'1/(EV_EBITDA/10)',thresholds:{strongLong:0.8,long:0.6,short:0.3,strongShort:0.15},enabled:true,requires:['fundamentals']},
  {id:'revenue_yoy',name:'Rev_YoY',category:'growth',formula:'RevYoY*5',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.1},enabled:true,requires:['fundamentals']},
  {id:'earnings_yoy',name:'EPS_YoY',category:'growth',formula:'EPSYoY*5',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.1},enabled:true,requires:['fundamentals']},
  {id:'roe_ttm',name:'ROE',category:'growth',formula:'ROE/20',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.1},enabled:true,requires:['fundamentals']},
  {id:'momentum_1m',name:'Mo1M',category:'momentum',formula:'ret_1M',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.1},enabled:true,requires:['closeHistory']},
  {id:'momentum_3m',name:'Mo3M',category:'momentum',formula:'ret_3M',thresholds:{strongLong:0.6,long:0.4,short:0.2,strongShort:0.1},enabled:true,requires:['closeHistory']},
  {id:'momentum_6m',name:'Mo6M',category:'momentum',formula:'ret_6M',thresholds:{strongLong:0.5,long:0.35,short:0.2,strongShort:0.1},enabled:true,requires:['closeHistory']},
  {id:'momentum_12m',name:'Mo12M',category:'momentum',formula:'ret_12M_skip1M',thresholds:{strongLong:0.5,long:0.3,short:0.15,strongShort:0.1},enabled:true,requires:['closeHistory']},
  {id:'market_cap',name:'MktCap',category:'size',formula:'1/log10(MC)',thresholds:{strongLong:0.6,long:0.4,short:0.2,strongShort:0.15},enabled:true,requires:['fundamentals']},
  {id:'volatility_20d',name:'Vol20D',category:'volatility',formula:'std20d/mean20d',thresholds:{strongLong:0.8,long:0.6,short:0.2,strongShort:0.15},enabled:true,requires:['closeHistory']},
  {id:'beta_60d',name:'Beta60D',category:'volatility',formula:'cov/var',thresholds:{strongLong:0.8,long:0.6,short:0.2,strongShort:0.15},enabled:true,requires:['closeHistory']},
  {id:'turnover_rate',name:'Turnover',category:'liquidity',formula:'vol/shares',thresholds:{strongLong:0.7,long:0.5,short:0.3,strongShort:0.2},enabled:true,requires:['volumeHistory']},
  {id:'amplitude_5d',name:'Ampl5D',category:'liquidity',formula:'(H-L)/avgC5d',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.15},enabled:true,requires:['closeHistory']},
  {id:'amihud',name:'Amihud',category:'liquidity',formula:'avg(|ret|/dolVol)',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.15},enabled:true,requires:['closeHistory','volumeHistory']},
  {id:'northbound',name:'Northbound',category:'flow',formula:'NB/shares',thresholds:{strongLong:0.7,long:0.5,short:0.3,strongShort:0.2},enabled:true,requires:['macro']},
  {id:'institution',name:'InstFlow',category:'flow',formula:'Inst/avgVol',thresholds:{strongLong:0.7,long:0.5,short:0.3,strongShort:0.2},enabled:true,requires:['macro']},
  {id:'major_flow_5d',name:'Major5D',category:'flow',formula:'sum5dMajor',thresholds:{strongLong:0.6,long:0.4,short:0.2,strongShort:0.15},enabled:true,requires:['macro']},
  {id:'pmi_sens',name:'PMI_Sens',category:'macro',formula:'(PMI-50)/50',thresholds:{strongLong:0.6,long:0.4,short:0.2,strongShort:0.15},enabled:true,requires:['macro']},
  {id:'dragon_tiger',name:'LongHu',category:'sentiment',formula:'net/(buy+sell)',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.1},enabled:true,requires:['macro']},
  {id:'debt_equity',name:'D/E',category:'quality',formula:'1/tanh(D/E)',thresholds:{strongLong:0.8,long:0.6,short:0.2,strongShort:0.15},enabled:true,requires:['fundamentals']},
  {id:'gross_margin',name:'GPM',category:'quality',formula:'(GPM-30)/30',thresholds:{strongLong:0.7,long:0.5,short:0.2,strongShort:0.1},enabled:true,requires:['fundamentals']},
  {id:'accruals_q',name:'Accruals',category:'quality',formula:'1-|accruals/A|',thresholds:{strongLong:0.8,long:0.65,short:0.2,strongShort:0.1},enabled:true,requires:['fundamentals']},
];

export class UnifiedFactorCalculator {
  private configs = [...FAC_REG]; private calcHist = new Map<string,number[]>();
  getRegistry(): FactorCalcConfig[] {return [...this.configs]}
  registerFactor(c:FactorCalcConfig):void {const i=this.configs.findIndex(x=>x.id===c.id);if(i>=0)this.configs[i]=c;else this.configs.push(c)}
  unregisterFactor(id:string):boolean {const i=this.configs.findIndex(x=>x.id===id);if(i<0)return false;this.configs.splice(i,1);return true}
  getByCategory(cat:FactorCategory):FactorCalcConfig[] {return this.configs.filter(x=>x.category===cat&&x.enabled)}
  calcFactor(fid:string,inp:FactorCalcInput):FactorCalcResult|null {
    const c=this.configs.find(x=>x.id===fid&&x.enabled);if(!c)return null;
    const raw=this.computeRaw(c,inp);if(raw===null||!isFinite(raw))return null;
    const n=Math.tanh(raw);const sig=this.signal(n,c.thresholds);
    if(!this.calcHist.has(fid))this.calcHist.set(fid,[]);
    const h=this.calcHist.get(fid)!;h.push(raw);if(h.length>252)h.shift();
    return {factorId:c.id,factorName:c.name,value:raw,normalized:n,signal:sig,category:c.category,timestamp:Date.now()};
  }
  calcAll(inp:FactorCalcInput):FactorCalcResult[] {return this.configs.filter(x=>x.enabled).map(x=>this.calcFactor(x.id,inp)).filter((r):r is FactorCalcResult=>r!==null)}
  calcByCategory(cat:FactorCategory,inp:FactorCalcInput):FactorCalcResult[] {return this.getByCategory(cat).map(x=>this.calcFactor(x.id,inp)).filter((r):r is FactorCalcResult=>r!==null)}
  getHistory(fid:string):number[] {return [...(this.calcHist.get(fid)||[])]}
  getCoverage() {const e=this.configs.filter(x=>x.enabled).length;const bc:Record<string,number>={};for(const c of this.configs){if(c.enabled)bc[c.category]=(bc[c.category]||0)+1}return {total:this.configs.length,enabled:e,byCategory:bc}}
  private computeRaw(cfg:FactorCalcConfig,inp:FactorCalcInput):number|null {
    const f=inp.fundamentals,m=inp.macro;
    switch(cfg.id){
      case 'pe_ttm':return f?.pe?1/(f.pe/15):null; case 'pb_lf':return f?.pb?1/(f.pb/1.5):null;
      case 'dividend_yield':return f?.dividendYield?f.dividendYield*20:null; case 'ev_ebitda':return null;
      case 'revenue_yoy':return f?.revenueGrowth?f.revenueGrowth*5:null; case 'earnings_yoy':return f?.eps?f.eps*5:null;
      case 'roe_ttm':return f?.roe?f.roe/20:null;
      case 'momentum_1m':return inp.closeHistory.length>=21?(inp.price-inp.closeHistory[20])/inp.closeHistory[20]:null;
      case 'momentum_3m':return inp.closeHistory.length>=63?(inp.price-inp.closeHistory[62])/inp.closeHistory[62]:null;
      case 'momentum_6m':return inp.closeHistory.length>=126?(inp.price-inp.closeHistory[125])/inp.closeHistory[125]:null;
      case 'momentum_12m':return inp.closeHistory.length>=252?(inp.closeHistory[21]-inp.closeHistory[251])/inp.closeHistory[251]:null;
      case 'market_cap':return f?.marketCap?1/Math.log10(f.marketCap):null;
      case 'volatility_20d':{if(inp.closeHistory.length<20)return null;const r=inp.closeHistory.slice(0,19).map((c,i)=>(inp.closeHistory[i]-c)/c);const m20=r.reduce((a,b)=>a+b,0)/r.length;return Math.sqrt(r.reduce((s,x)=>{return s+(x-m20)**2},0)/r.length)}
      case 'beta_60d':return null;
      case 'turnover_rate':{if(inp.volumeHistory.length<5)return null;const a5=inp.volumeHistory.slice(0,5).reduce((a,b)=>a+b,0)/5;return inp.volume/a5}
      case 'amplitude_5d':{if(inp.closeHistory.length<5)return null;return (Math.max(...inp.closeHistory.slice(0,5))-Math.min(...inp.closeHistory.slice(0,5)))/(inp.closeHistory.slice(0,5).reduce((a,b)=>a+b,0)/5)}
      case 'amihud':{if(inp.closeHistory.length<5)return null;let s=0;for(let i=0;i<4;i++){const rt=Math.abs((inp.closeHistory[i]-inp.closeHistory[i+1])/inp.closeHistory[i+1]);const dv=inp.closeHistory[i]*inp.volumeHistory[i];if(dv>0)s+=rt/dv}return s/4*1e6}
      case 'northbound':return m?.northboundFlow?Math.tanh(m.northboundFlow/1e9):null;
      case 'institution':return m?.institutionFlow?Math.tanh(m.institutionFlow/1e8):null;
      case 'major_flow_5d':return m?.majorFlow5D?Math.tanh(m.majorFlow5D/1e8):null;
      case 'pmi_sens':return m?.pmi?(m.pmi-50)/50:null;
      default:return null;
    }
  }
  private signal(n:number,t:FactorCalcConfig['thresholds']):FactorSignal {if(n>=t.strongLong)return 'STRONG_LONG';if(n>=t.long)return 'LONG';if(n<=t.strongShort)return 'STRONG_SHORT';if(n<=t.short)return 'SHORT';return 'NEUTRAL'}
  reset():void {this.calcHist.clear();this.configs=[...FAC_REG]}
}

// ============================================================
// 统一缓存层 (合并 3套)
// ============================================================
export type CacheEvictionPolicy = 'lru'|'ttl'|'both';
export class UnifiedFactorCache<T=any> {
  private store=new Map<string,{key:string;value:T;createdAt:number;ttl:number;accessCount:number;lastAccessed:number}>();
  private maxSize:number;private dttl:number;private pol:CacheEvictionPolicy;
  private hits=0;private misses=0;
  constructor(maxSize=10000,dttl=300000,pol:CacheEvictionPolicy='both'){this.maxSize=maxSize;this.dttl=dttl;this.pol=pol}
  get(key:string):T|undefined {
    const e=this.store.get(key);if(!e){this.misses++;return undefined;}
    if((this.pol==='ttl'||this.pol==='both')&&Date.now()-e.createdAt>e.ttl){this.store.delete(key);this.misses++;return undefined;}
    e.accessCount++;e.lastAccessed=Date.now();this.hits++;
    if(this.pol==='lru'||this.pol==='both'){this.store.delete(key);this.store.set(key,e)}
    return e.value;
  }
  set(key:string,value:T,ttl?:number):void {if(this.store.size>=this.maxSize)this.evict();this.store.set(key,{key,value,createdAt:Date.now(),ttl:ttl||this.dttl,accessCount:0,lastAccessed:Date.now()})}
  has(key:string):boolean{return this.get(key)!==undefined}
  delete(key:string):boolean{return this.store.delete(key)}
  clear():void{this.store.clear();this.hits=0;this.misses=0}
  getStats(){const t=this.hits+this.misses;return{size:this.store.size,maxSize:this.maxSize,hits:this.hits,misses:this.misses,hitRate:t>0?this.hits/t:0}}
  warmup(entries:{key:string;value:T;ttl?:number}[]):void{for(const e of entries)this.set(e.key,e.value,e.ttl)}
  private evict():void{if(this.store.size===0)return;let ok='',ot=Infinity;for(const[k,e]of Array.from(this.store.entries())){const t=(this.pol==='lru'||this.pol==='both')?e.lastAccessed:e.createdAt;if(t<ot){ot=t;ok=k}}if(ok)this.store.delete(ok)}
}

// ============================================================
// 统一拥挤度引擎 (合并 3套)
// ============================================================
export type CrowdingLevel='low'|'moderate'|'elevated'|'high'|'extreme';
export interface CrowdingSnapshot {factorId:string;factorName:string;crowdingScore:number;level:CrowdingLevel;longCrowdingPct:number;shortCrowdingPct:number;zScore:number;reversalRisk:number;alerts:{id:string;type:'crowding_breach'|'crowding_easing'|'position_limit'|'reversal_risk';severity:'info'|'warning'|'critical';message:string;threshold:number;actualValue:number}[];timestamp:number}

export class UnifiedCrowdingEngine {
  private cfg={lookbackDays:60,thresholds:{moderate:30,elevated:50,high:70,extreme:85},alertCooldownMs:1800000};
  private hist=new Map<string,number[]>();private lastAlt=new Map<string,number>();
  constructor(cfg?:Partial<typeof this.cfg>){if(cfg)Object.assign(this.cfg,cfg)}
  record(fid:string,fname:string,longPct:number,shortPct:number,totalPct:number):CrowdingSnapshot {
    const s=Math.min(Math.tanh(totalPct*5)*50+Math.min(Math.abs(longPct-shortPct)*100,30)+Math.min(totalPct*100,20),100);
    if(!this.hist.has(fid))this.hist.set(fid,[]);const h=this.hist.get(fid)!;h.push(s);if(h.length>this.cfg.lookbackDays)h.shift();
    const z=h.length>1?(()=>{const m=h.reduce((a,b)=>a+b,0)/h.length;const sd=Math.sqrt(h.reduce((a,v)=>a+(v-m)**2,0)/h.length);return sd===0?0:(s-m)/sd})():0;
    const lvl=s>=this.cfg.thresholds.extreme?'extreme':s>=this.cfg.thresholds.high?'high':s>=this.cfg.thresholds.elevated?'elevated':s>=this.cfg.thresholds.moderate?'moderate':'low';
    const alts=this.alerts(fid,fname,s,lvl,z);
    return {factorId:fid,factorName:fname,crowdingScore:+s.toFixed(2),level:lvl,longCrowdingPct:+longPct.toFixed(4),shortCrowdingPct:+shortPct.toFixed(4),zScore:+z.toFixed(2),reversalRisk:+Math.min(s*1.2,100).toFixed(2),alerts:alts,timestamp:Date.now()}
  }
  getMostCrowded(n=10):CrowdingSnapshot[] {
    const entries = Array.from(this.hist.entries());
    return entries.map(([id,h])=>{const s=h[h.length-1];const z=this.zs(s,h);
      return {factorId:id,factorName:id,crowdingScore:s,level:this.lvl(s),longCrowdingPct:0,shortCrowdingPct:0,zScore:z,reversalRisk:Math.min(s*1.2,100),alerts:[],timestamp:Date.now()}}).sort((a,b)=>b.crowdingScore-a.crowdingScore).slice(0,n)
  }
  getHistory(fid:string):number[]{return [...(this.hist.get(fid)||[])]}
  private zs(v:number,h:number[]):number{if(h.length<2)return 0;const m=h.reduce((a,b)=>a+b,0)/h.length;const sd=Math.sqrt(h.reduce((a,x)=>a+(x-m)**2,0)/h.length);return sd===0?0:(v-m)/sd}
  private lvl(s:number):CrowdingLevel{const t=this.cfg.thresholds;if(s>=t.extreme)return'extreme';if(s>=t.high)return'high';if(s>=t.elevated)return'elevated';if(s>=t.moderate)return'moderate';return'low'}
  private alerts(fid:string,fname:string,s:number,lvl:CrowdingLevel,z:number):CrowdingSnapshot['alerts']{
    const r:CrowdingSnapshot['alerts']=[];const now=Date.now();if(now-(this.lastAlt.get(fid)||0)<this.cfg.alertCooldownMs)return r;
    if(lvl==='extreme'){r.push({id:`cr-${fid}-ext`,type:'crowding_breach',severity:'critical',message:`${fname}: extreme ${s.toFixed(1)}`,threshold:this.cfg.thresholds.extreme,actualValue:s});this.lastAlt.set(fid,now)}
    else if(lvl==='high'){r.push({id:`cr-${fid}-hi`,type:'position_limit',severity:'warning',message:`${fname}: high ${s.toFixed(1)}`,threshold:this.cfg.thresholds.high,actualValue:s});this.lastAlt.set(fid,now)}
    if(z>2)r.push({id:`cr-${fid}-z`,type:'crowding_breach',severity:'warning',message:`${fname}: Z=${z.toFixed(1)}`,threshold:2,actualValue:z});
    return r
  }
  reset():void{this.hist.clear();this.lastAlt.clear()}
}

// ============================================================
// 统一预处理器 (合并 2套)
// ============================================================
export type WinsorMethod='none'|'percentile'|'mad';export type FillMethod='none'|'forward'|'linear'|'zero';export type ScaleMethod='none'|'zscore'|'minmax'|'rank';

export class UnifiedFactorPreprocessor {
  private cfg:{winsor:WinsorMethod;winsorLo:number;winsorHi:number;fill:FillMethod;scale:ScaleMethod;rmOutliers:boolean;outZ:number}=
    {winsor:'percentile',winsorLo:0.01,winsorHi:0.99,fill:'forward',scale:'zscore',rmOutliers:false,outZ:3};
  constructor(cfg?:Partial<typeof this.cfg>){if(cfg)Object.assign(this.cfg,cfg)}

  process(vals:number[]):number[] {
    let r=[...vals];
    if(this.cfg.fill==='forward'){let lv=0;for(let i=0;i<r.length;i++){if(isNaN(r[i]))r[i]=lv;else lv=r[i]}}
    else if(this.cfg.fill==='zero'){for(let i=0;i<r.length;i++)if(isNaN(r[i]))r[i]=0}
    if(this.cfg.winsor==='percentile'){const s=[...r].filter(v=>!isNaN(v)).sort((a,b)=>a-b);if(s.length>0){const lo=s[Math.floor(s.length*this.cfg.winsorLo)];const hi=s[Math.min(Math.floor(s.length*this.cfg.winsorHi),s.length-1)];for(let i=0;i<r.length;i++){if(r[i]<lo)r[i]=lo;else if(r[i]>hi)r[i]=hi}}}
    else if(this.cfg.winsor==='mad'){const m=[...r].filter(v=>!isNaN(v)).sort((a,b)=>a-b)[Math.floor(r.length/2)];if(m!==undefined){const ads=[...r].filter(v=>!isNaN(v)).map(v=>Math.abs(v-m)).sort((a,b)=>a-b);const mad=(ads[Math.floor(ads.length/2)]||0)*1.4826;const lo=m-3*mad;const hi=m+3*mad;for(let i=0;i<r.length;i++){if(r[i]<lo)r[i]=lo;else if(r[i]>hi)r[i]=hi}}}
    if(this.cfg.scale==='zscore'){const v=r.filter(x=>!isNaN(x));if(v.length>0){const mn=v.reduce((a,b)=>a+b,0)/v.length;const sd=Math.sqrt(v.reduce((a,x)=>a+(x-mn)**2,0)/v.length);r=r.map(x=>isNaN(x)?0:sd===0?0:(x-mn)/sd)}}
    else if(this.cfg.scale==='minmax'){const v=r.filter(x=>!isNaN(x));if(v.length>0){const min=Math.min(...v);const max=Math.max(...v);r=r.map(x=>isNaN(x)?0.5:max===min?0.5:(x-min)/(max-min))}}
    return r
  }

  processMulti(data:Map<string,number[]>):Map<string,number[]> {const out=new Map<string,number[]>();for(const[k,v]of Array.from(data.entries()))out.set(k,this.process(v));return out}
  crossSectional(vals:Map<string,number>):Map<string,number> {const v=Array.from(vals.values());const m=v.reduce((a,b)=>a+b,0)/v.length;const sd=Math.sqrt(v.reduce((a,x)=>a+(x-m)**2,0)/v.length);const out=new Map<string,number>();for(const[k,x]of Array.from(vals.entries()))out.set(k,sd===0?0:(x-m)/sd);return out}
  reset():void{}
}

// ============================================================
// Singleton
// ============================================================
let _factorCalc: UnifiedFactorCalculator | undefined;
let _factorCache: UnifiedFactorCache | undefined;
let _crowding: UnifiedCrowdingEngine | undefined;
let _preprocessor: UnifiedFactorPreprocessor | undefined;

export function getUnifiedFactorCalculator(): UnifiedFactorCalculator {
  if (!_factorCalc) _factorCalc = new UnifiedFactorCalculator();
  return _factorCalc;
}

export function getUnifiedFactorCache(): UnifiedFactorCache {
  if (!_factorCache) _factorCache = new UnifiedFactorCache();
  return _factorCache;
}

export function getUnifiedCrowdingEngine(): UnifiedCrowdingEngine {
  if (!_crowding) _crowding = new UnifiedCrowdingEngine();
  return _crowding;
}

export function getUnifiedFactorPreprocessor(): UnifiedFactorPreprocessor {
  if (!_preprocessor) _preprocessor = new UnifiedFactorPreprocessor();
  return _preprocessor;
}

export function resetUnification(): void {
  _factorCalc?.reset();
  _factorCache?.clear();
  _crowding?.reset();
  _preprocessor?.reset();
  _factorCalc = undefined;
  _factorCache = undefined;
  _crowding = undefined;
  _preprocessor = undefined;
}
