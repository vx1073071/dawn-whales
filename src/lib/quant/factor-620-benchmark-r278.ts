// ══ R278 LOBEHUB P1: 620因子全量基准 ══
export interface Factor620 {
  id:string; name:string; nameCn:string; category:string; subcategory:string;
  source:'classic'|'academic'|'esg'|'alt'|'options'|'fixed_income'|'global'|'china'|'macro';
  icValue:number; irValue:number; sharpe:number; maxDrawdown:number;
  coveragePct:number; freshnessMs:number;
  status:'PASS'|'WARNING'|'FAIL'; issues:string[];
}
export interface Factor620Report {
  timestamp:number; totalFactors:number; summary:{pass:number;warn:number;fail:number;passRate:number};
  bySource: Record<string,{total:number;pass:number;avgIC:number;avgIR:number;avgSharpe:number}>;
  byCategory: Record<string,{total:number;pass:number;avgIC:number}>;
  topByIC: {name:string;source:string;ic:number;ir:number}[];
  topBySharpe: {name:string;source:string;sharpe:number}[];
  worstFactors: {name:string;source:string;reason:string}[];
  recommendations: string[];
}
export function benchmark620(
  factors:Factor620[]
):Factor620Report{
  if(factors.length===0)return{timestamp:Date.now(),totalFactors:0,summary:{pass:0,warn:0,fail:0,passRate:0},bySource:{},byCategory:{},topByIC:[],topBySharpe:[],worstFactors:[],recommendations:['数据为空']};
  const pass=factors.filter(f=>f.status==='PASS');
  const warn=factors.filter(f=>f.status==='WARNING');
  const fail=factors.filter(f=>f.status==='FAIL');
  const bySource:Record<string,any>={};
  const byCategory:Record<string,any>={};
  for(const f of factors){
    if(!bySource[f.source])bySource[f.source]={total:0,pass:0,sumIC:0,sumIR:0,sumSharpe:0};
    bySource[f.source].total++;if(f.status==='PASS')bySource[f.source].pass++;
    bySource[f.source].sumIC+=f.icValue;bySource[f.source].sumIR+=f.irValue;bySource[f.source].sumSharpe+=f.sharpe;
    if(!byCategory[f.category])byCategory[f.category]={total:0,pass:0,sumIC:0};
    byCategory[f.category].total++;if(f.status==='PASS')byCategory[f.category].pass++;
    byCategory[f.category].sumIC+=f.icValue;
  }
  for(const s of Object.keys(bySource)){bySource[s].avgIC=Math.round(bySource[s].sumIC/bySource[s].total*10000)/10000;bySource[s].avgIR=Math.round(bySource[s].sumIR/bySource[s].total*1000)/1000;bySource[s].avgSharpe=Math.round(bySource[s].sumSharpe/bySource[s].total*100)/100;delete bySource[s].sumIC;delete bySource[s].sumIR;delete bySource[s].sumSharpe}
  for(const c of Object.keys(byCategory)){byCategory[c].avgIC=Math.round(byCategory[c].sumIC/byCategory[c].total*10000)/10000;delete byCategory[c].sumIC}
  const topIC=[...factors].sort((a,b)=>Math.abs(b.icValue)-Math.abs(a.icValue)).slice(0,10).map(f=>({name:f.nameCn||f.name,source:f.source,ic:f.icValue,ir:f.irValue}));
  const topSharpe=[...factors].sort((a,b)=>b.sharpe-a.sharpe).slice(0,10).map(f=>({name:f.nameCn||f.name,source:f.source,sharpe:f.sharpe}));
  const worst=fail.slice(0,8).map(f=>({name:f.nameCn||f.name,source:f.source,reason:f.issues.join('; ')||'质量不达标'}));
  const recs:string[]=[];
  const failSources=[...new Set(fail.map(f=>f.source))];
  if(failSources.length>0)recs.push(`源FAIL: ${failSources.join(',')}——共${fail.length}个因子`);
  if(factors.length<620)recs.push(`当前${factors.length}/620——缺${620-factors.length}个`);
  return{timestamp:Date.now(),totalFactors:factors.length,summary:{pass:pass.length,warn:warn.length,fail:fail.length,passRate:Math.round(pass.length/factors.length*100)},bySource,byCategory,topByIC:topIC,topBySharpe:topSharpe,worstFactors:worst,recommendations:recs};
}
export default Factor620Report;
