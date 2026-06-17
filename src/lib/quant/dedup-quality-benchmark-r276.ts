// ══ R276 LOBEHUB P1: 去重后因子质量基准 ══
export interface DedupedFactor {
  id:string; name:string; nameCn:string; category:string; market:string;
  mergedFrom:string[]; value:number; expectedRange:[number,number];
  dataFreshnessMs:number; qualityScore:number; coverageRate:number;
  status:'PASS'|'WARNING'|'FAIL'; issues:string[];
}
export interface DedupSummary {
  beforeFileCount:number; afterFileCount:number; removedDuplicates:number;
  totalFactors:number; passRate:number; avgQuality:number;
}
export interface DedupQualityReport {
  timestamp:number; dedup:DedupSummary;
  byCategory:Record<string,{total:number;pass:number;avgQuality:number}>;
  byMarket:Record<string,{total:number;pass:number;coverage:number}>;
  mergedGroups:{groupName:string;from:string[];to:string;reason:string}[];
  worstFactors:{name:string;market:string;reason:string}[];
  overall:'PASS'|'WARNING'|'FAIL'; recommendations:string[];
}
export function evaluateDedupQuality(
  factors:DedupedFactor[],
  mergedGroups:{groupName:string;from:string[];to:string;reason:string}[]
):DedupQualityReport{
  if(factors.length===0)return{timestamp:Date.now(),dedup:{beforeFileCount:0,afterFileCount:0,removedDuplicates:0,totalFactors:0,passRate:0,avgQuality:0},byCategory:{},byMarket:{},mergedGroups:[],worstFactors:[],overall:'FAIL',recommendations:['数据为空']};
  const pass=factors.filter(f=>f.status==='PASS');
  const fail=factors.filter(f=>f.status==='FAIL');
  const passRate=Math.round(pass.length/factors.length*100);
  const avgQ=Math.round(factors.reduce((s,f)=>s+f.qualityScore,0)/factors.length*100)/100;
  const allSources=mergedGroups.flatMap(g=>g.from);
  const dedup:DedupSummary={beforeFileCount:allSources.length,afterFileCount:mergedGroups.length,removedDuplicates:allSources.length-mergedGroups.length,totalFactors:factors.length,passRate,avgQuality:avgQ};
  const byCategory:Record<string,{total:number;pass:number;avgQuality:number}>={};
  for(const f of factors){
    if(!byCategory[f.category])byCategory[f.category]={total:0,pass:0,avgQuality:0};
    byCategory[f.category].total++;if(f.status==='PASS')byCategory[f.category].pass++;
    byCategory[f.category].avgQuality+=f.qualityScore;
  }
  for(const c of Object.keys(byCategory))byCategory[c].avgQuality=Math.round(byCategory[c].avgQuality/byCategory[c].total*100)/100;
  const byMarket:Record<string,{total:number;pass:number;coverage:number}>={};
  for(const f of factors){
    if(!byMarket[f.market])byMarket[f.market]={total:0,pass:0,coverage:0};
    byMarket[f.market].total++;if(f.status==='PASS')byMarket[f.market].pass++;
    byMarket[f.market].coverage+=f.coverageRate;
  }
  for(const m of Object.keys(byMarket))byMarket[m].coverage=Math.round(byMarket[m].coverage/byMarket[m].total*100)/100;
  const worst=fail.slice(0,5).map(f=>({name:f.nameCn||f.name,market:f.market,reason:f.issues.join('; ')||'质量不达标'}));
  let o:'PASS'|'WARNING'|'FAIL';
  if(passRate>=90&&dedup.removedDuplicates>=5)o='PASS';
  else if(passRate>=70)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(dedup.removedDuplicates<5)recs.push(`仅去重${dedup.removedDuplicates}个——目标>=7`);
  if(passRate<90)recs.push(`通过率${passRate}%未达标`);
  return{timestamp:Date.now(),dedup,byCategory,byMarket,mergedGroups,worstFactors:worst,overall:o,recommendations:recs};
}
export default DedupQualityReport;
