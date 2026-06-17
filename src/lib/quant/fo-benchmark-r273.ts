// ══ R273 LOBEHUB P1: F&O数据基准 vs NSE ══
export interface FOInstrument{type:'FUT'|'OPT';symbol:string;expiry:string;strike?:number;openInterest:number;volume:number;turnover:number;changeOI:number;iv?:number}
export interface FOBenchmark{timestamp:number;totalFutures:number;totalOptions:number;totalOI:number;totalVolume:number;topByOI:{symbol:string;type:string;oi:number}[];vsNSE:{nseFutCount:number;ourFutCount:number;nseOptCount:number;ourOptCount:number;futCoverage:number;optCoverage:number};overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkFO(data:FOInstrument[],nseRef:{futuresCount:number;optionsCount:number;top5OICodes:string[]}):FOBenchmark{
  if(data.length===0)return{timestamp:Date.now(),totalFutures:0,totalOptions:0,totalOI:0,totalVolume:0,topByOI:[],vsNSE:{nseFutCount:nseRef.futuresCount,ourFutCount:0,nseOptCount:nseRef.optionsCount,ourOptCount:0,futCoverage:0,optCoverage:0},overall:'FAIL',recommendations:['数据为空——检查NSE数据源']};
  const fut=data.filter(d=>d.type==='FUT');
  const opt=data.filter(d=>d.type==='OPT');
  const oi=data.reduce((s,x)=>s+x.openInterest,0);
  const vol=data.reduce((s,x)=>s+x.volume,0);
  const top=[...data].sort((a,b)=>b.openInterest-a.openInterest).slice(0,5).map(x=>({symbol:x.symbol,type:x.type,oi:x.openInterest}));
  const fCov=nseRef.futuresCount>0?Math.round(fut.length/nseRef.futuresCount*100):0;
  const oCov=nseRef.optionsCount>0?Math.round(opt.length/nseRef.optionsCount*100):0;
  const avgCov=(fCov+oCov)/2;
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgCov>=85)o='PASS';
  else if(avgCov>=60)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(fCov<85)recs.push(`期货覆盖${fCov}%<NSE(${nseRef.futuresCount})`);
  if(oCov<85)recs.push(`期权覆盖${oCov}%<NSE(${nseRef.optionsCount})`);
  return{timestamp:Date.now(),totalFutures:fut.length,totalOptions:opt.length,totalOI:oi,totalVolume:vol,topByOI:top,vsNSE:{nseFutCount:nseRef.futuresCount,ourFutCount:fut.length,nseOptCount:nseRef.optionsCount,ourOptCount:opt.length,futCoverage:fCov,optCoverage:oCov},overall:o,recommendations:recs};
}
export default FOBenchmark;
