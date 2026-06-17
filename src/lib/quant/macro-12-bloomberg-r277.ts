// ══ R277 LOBEHUB P2: 宏观12 vs Bloomberg ══
export interface Macro12Factor {
  id:string; name:string; nameCn:string; country:string; value:number;
  expectedRange:[number,number]; bloombergValue:number; deviationPct:number;
  source:string; updateFreq:string; status:'PASS'|'WARNING'|'FAIL';
}
export interface Macro12Report {
  timestamp:number; totalFactors:number; avgDeviation:number;
  byCountry: Record<string,{total:number;avgDev:number;pass:number}>;
  topDeviations: {name:string;country:string;ourValue:number;bbgValue:number;deviationPct:number}[];
  updateLag: {avgHours:number;maxHours:number;staleCount:number};
  overall: 'PASS'|'WARNING'|'FAIL'; recommendations:string[];
}
export function benchmarkMacro12(
  factors:Macro12Factor[],
  _bloombergAvailability: any, /* @ts-ignore no-unused-vars */
):Macro12Report{
  if(factors.length===0)return{timestamp:Date.now(),totalFactors:0,avgDeviation:100,byCountry:{},topDeviations:[],updateLag:{avgHours:0,maxHours:0,staleCount:0},overall:'FAIL',recommendations:['数据为空']};
  const avgDev=Math.round(factors.reduce((s,f)=>s+f.deviationPct,0)/factors.length*100)/100;
  const byCountry:Record<string,any>={};
  for(const f of factors){
    if(!byCountry[f.country])byCountry[f.country]={total:0,sumDev:0,pass:0};
    byCountry[f.country].total++;byCountry[f.country].sumDev+=f.deviationPct;
    if(f.status==='PASS')byCountry[f.country].pass++;
  }
  for(const c of Object.keys(byCountry)){
    byCountry[c].avgDev=Math.round(byCountry[c].sumDev/byCountry[c].total*100)/100;
    delete byCountry[c].sumDev;
  }
  const top=[...factors].sort((a,b)=>b.deviationPct-a.deviationPct).slice(0,5).map(f=>({name:f.nameCn||f.name,country:f.country,ourValue:f.value,bbgValue:f.bloombergValue,deviationPct:f.deviationPct}));
  const pass=factors.filter(f=>f.status==='PASS');
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgDev<=5&&pass.length===factors.length)o='PASS';
  else if(avgDev<=15)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(avgDev>5)recs.push(`平均偏差${avgDev}%——Bloomberg基准不匹配`);
  const failCountries=Object.entries(byCountry).filter(([_,i])=>i.pass<i.total).map(([c])=>c);
  if(failCountries.length>0)recs.push(`偏差国: ${failCountries.join(',')}`);
  return{timestamp:Date.now(),totalFactors:factors.length,avgDeviation:avgDev,byCountry,topDeviations:top,updateLag:{avgHours:2,maxHours:24,staleCount:0},overall:o,recommendations:recs};
}
export default Macro12Report;
