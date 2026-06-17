// ══ R277 LOBEHUB P1: 84全球因子质量基准 ══
export interface Global84Factor {
  id:string; name:string; nameCn:string; market:string; category:string;
  value:number; expectedRange:[number,number]; accuracy:number; freshnessMs:number;
  source:string; status:'PASS'|'WARNING'|'FAIL'; issues:string[];
}
export interface Global84Report {
  timestamp:number; totalFactors:number; passRate:number;
  byMarket: Record<string,{total:number;pass:number;avgAccuracy:number;coverage:number}>;
  byCategory: Record<string,{total:number;pass:number;avgAccuracy:number}>;
  worstFactors: {name:string;market:string;reason:string}[];
  marketRanking: {market:string;score:number;factors:number;status:string}[];
  overall: 'PASS'|'WARNING'|'FAIL'; recommendations:string[];
}
export function benchmarkGlobal84(
  factors:Global84Factor[],
  targetMarkets:string[]=['JP','IN','KR','TW','EU','BR','SA','SG','AU','HK','CN','US','GB','CA']
):Global84Report{
  if(factors.length===0)return{timestamp:Date.now(),totalFactors:0,passRate:0,byMarket:{},byCategory:{},worstFactors:[],marketRanking:[],overall:'FAIL',recommendations:['数据为空']};
  const pass=factors.filter(f=>f.status==='PASS');
  const fail=factors.filter(f=>f.status==='FAIL');
  const passRate=Math.round(pass.length/factors.length*100);
  const byMarket:Record<string,any>={};
  const byCategory:Record<string,any>={};
  for(const f of factors){
    if(!byMarket[f.market])byMarket[f.market]={total:0,pass:0,sumAcc:0,sumCov:0};
    byMarket[f.market].total++;if(f.status==='PASS')byMarket[f.market].pass++;
    byMarket[f.market].sumAcc+=f.accuracy;byMarket[f.market].sumCov+=1;
    if(!byCategory[f.category])byCategory[f.category]={total:0,pass:0,sumAcc:0};
    byCategory[f.category].total++;if(f.status==='PASS')byCategory[f.category].pass++;
    byCategory[f.category].sumAcc+=f.accuracy;
  }
  for(const m of Object.keys(byMarket)){
    byMarket[m].avgAccuracy=Math.round(byMarket[m].sumAcc/byMarket[m].total*100)/100;
    byMarket[m].coverage=Math.round(byMarket[m].total/targetMarkets.length*100)/100;
    delete byMarket[m].sumAcc;delete byMarket[m].sumCov;
  }
  for(const c of Object.keys(byCategory)){
    byCategory[c].avgAccuracy=Math.round(byCategory[c].sumAcc/byCategory[c].total*100)/100;
    delete byCategory[c].sumAcc;
  }
  const worst=fail.slice(0,5).map(f=>({name:f.nameCn||f.name,market:f.market,reason:f.issues.join('; ')||'精度不达标'}));
  const ranking=Object.entries(byMarket).map(([market,info])=>({market,score:Math.round((info.pass/info.total*0.7+info.avgAccuracy/100*0.3)*100),factors:info.total,status:info.pass/info.total>=0.8?'PASS':info.pass/info.total>=0.6?'WARNING':'FAIL'})).sort((a,b)=>b.score-a.score);
  let o:'PASS'|'WARNING'|'FAIL';
  if(passRate>=85&&fail.length<=5)o='PASS';
  else if(passRate>=65)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  const failMarkets=ranking.filter(r=>r.status==='FAIL').map(r=>r.market);
  if(failMarkets.length>0)recs.push(`市场FAIL: ${failMarkets.join(',')}——需补充数据源`);
  if(fail.length>5)recs.push(`${fail.length}个因子不达标——优先修复`);
  return{timestamp:Date.now(),totalFactors:factors.length,passRate,byMarket,byCategory,worstFactors:worst,marketRanking:ranking,overall:o,recommendations:recs};
}
export default Global84Report;
