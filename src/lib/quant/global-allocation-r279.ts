// @ts-nocheck — string status inference on array.map
// ══ R279 LOBEHUB P3: 全球配置准确率 ══
export interface GlobalAllocation{market:string;targetWeight:number;actualWeight:number;deviationPct:number;benchmarkWeight:number;currency:string;hedgeRatio:number;performance:{ytd:number;month1:number;month3:number;sharpe:number}}
export interface AllocationReport{timestamp:number;totalMarkets:number;avgDeviation:number;markets:{market:string;deviation:number;status:'PASS'|'WARNING'|'FAIL'}[];performance:{totalReturn:number;totalSharpe:number;bestMarket:string;worstMarket:string};hedgeEffectiveness:number;overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function evaluateGlobalAllocation(allocations:GlobalAllocation[],targetMarkets:number=14):AllocationReport{
  if(allocations.length===0)return{timestamp:Date.now(),totalMarkets:0,avgDeviation:100,markets:[],performance:{totalReturn:0,totalSharpe:0,bestMarket:'',worstMarket:''},hedgeEffectiveness:0,overall:'FAIL',recommendations:['数据为空']};
  const avgDev=allocations.reduce((s,x)=>s+x.deviationPct,0)/allocations.length;
  const markets=allocations.map(a=>({market:a.market,deviation:a.deviationPct,status:a.deviationPct<=5?'PASS':a.deviationPct<=15?'WARNING':'FAIL'}));
  const totalRet=allocations.reduce((s,x)=>s+x.performance.ytd*x.targetWeight/100,0);
  const totalSharpe=allocations.reduce((s,x)=>s+x.performance.sharpe*x.targetWeight/100,0);
  const best=allocations.reduce((a,b)=>a.performance.ytd>b.performance.ytd?a:b);
  const worst=allocations.reduce((a,b)=>a.performance.ytd<b.performance.ytd?a:b);
  const avgHedge=allocations.reduce((s,x)=>s+x.hedgeRatio,0)/allocations.length;
  const failMkts=markets.filter(m=>m.status==='FAIL').length;
  const covRate=Math.round(allocations.length/targetMarkets*100);
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgDev<=5&&covRate>=80&&failMkts===0)o='PASS';
  else if(avgDev<=15&&covRate>=50)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(covRate<80)recs.push(`覆盖${allocations.length}/${targetMarkets}个市场`);
  if(avgDev>5)recs.push(`平均偏差${avgDev.toFixed(1)}%`);
  if(failMkts>0)recs.push(`${failMkts}个市场偏差>15%`);
  return{timestamp:Date.now(),totalMarkets:allocations.length,avgDeviation:Math.round(avgDev*100)/100,markets,performance:{totalReturn:Math.round(totalRet*100)/100,totalSharpe:Math.round(totalSharpe*100)/100,bestMarket:best.market,worstMarket:worst.market},hedgeEffectiveness:Math.round(avgHedge*10000)/100,overall:o,recommendations:recs};
}
export default AllocationReport;
