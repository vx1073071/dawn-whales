// ══ R272 LOBEHUB P1: 卖空数据基准 vs 富途 ══
export interface ShortSellStock{code:string;name:string;shortVolume:number;shortRatio:number;shortTurnover:number;totalVolume:number}
export interface ShortSellBenchmark{timestamp:number;totalStocks:number;avgShortRatio:number;topShorted:{code:string;name:string;ratio:number}[];coverageVsFutu:{futuCount:number;ourCount:number;matchRate:number};deviationPct:number;overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkShortSell(data:ShortSellStock[],futuRef:{totalCount:number;top10Codes:string[]}):ShortSellBenchmark{
  if(data.length===0)return{timestamp:Date.now(),totalStocks:0,avgShortRatio:0,topShorted:[],coverageVsFutu:{futuCount:futuRef.totalCount,ourCount:0,matchRate:0},deviationPct:100,overall:'FAIL',recommendations:['数据为空——检查HKShortSell桥接']};
  const avg=data.reduce((s,x)=>s+x.shortRatio,0)/data.length;
  const top=[...data].sort((a,b)=>b.shortRatio-a.shortRatio).slice(0,10).map(s=>({code:s.code,name:s.name,ratio:s.shortRatio}));
  const coverage={futuCount:futuRef.totalCount,ourCount:data.length,matchRate:Math.round(data.length/futuRef.totalCount*100)};
  const topMatch=top.map(t=>t.code).filter(c=>futuRef.top10Codes.includes(c)).length;
  const deviationPct=Math.round((1-topMatch/10)*100);
  let o:'PASS'|'WARNING'|'FAIL';
  if(coverage.matchRate>=90&&deviationPct<=20)o='PASS';
  else if(coverage.matchRate>=70&&deviationPct<=50)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(coverage.matchRate<90)recs.push(`覆盖率${coverage.matchRate}%低于富途的${futuRef.totalCount}—需扩展`);
  if(deviationPct>20)recs.push(`Top10偏差${deviationPct}%—检查排序逻辑`);
  if(avg<5)recs.push(`平均卖空比率${avg.toFixed(1)}%偏低`);
  return{timestamp:Date.now(),totalStocks:data.length,avgShortRatio:Math.round(avg*100)/100,topShorted:top,coverageVsFutu:coverage,deviationPct,overall:o,recommendations:recs};
}
export default ShortSellBenchmark;
