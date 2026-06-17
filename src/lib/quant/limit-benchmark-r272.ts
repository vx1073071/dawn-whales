// ══ R272 LOBEHUB P2: 涨跌停 vs 同花顺 ══
export interface LimitStock{code:string;name:string;type:'UP'|'DOWN';limitCount:number;volumeRatio:number;boardTurnover:number}
export interface LimitBenchmark{timestamp:number;totalUpLimit:number;totalDownLimit:number;topUp:{code:string;name:string;count:number}[];topDown:{code:string;name:string;count:number}[];vsTongHuaShun:{thsUpCount:number;ourUpCount:number;matchRateUp:number;thsDownCount:number;ourDownCount:number;matchRateDown:number};overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkLimits(data:LimitStock[],thsRef:{upCount:number;downCount:number;upCodes:string[];downCodes:string[]}):LimitBenchmark{
  if(data.length===0)return{timestamp:Date.now(),totalUpLimit:0,totalDownLimit:0,topUp:[],topDown:[],vsTongHuaShun:{thsUpCount:thsRef.upCount,ourUpCount:0,matchRateUp:0,thsDownCount:thsRef.downCount,ourDownCount:0,matchRateDown:0},overall:'FAIL',recommendations:['数据为空——检查涨跌停板引擎']};
  const up=data.filter(s=>s.type==='UP');
  const dn=data.filter(s=>s.type==='DOWN');
  const topUp=[...up].sort((a,b)=>b.limitCount-a.limitCount).slice(0,5).map(s=>({code:s.code,name:s.name,count:s.limitCount}));
  const topDown=[...dn].sort((a,b)=>b.limitCount-a.limitCount).slice(0,5).map(s=>({code:s.code,name:s.name,count:s.limitCount}));
  const upMatch=up.map(s=>s.code).filter(c=>thsRef.upCodes.includes(c)).length;
  const dnMatch=dn.map(s=>s.code).filter(c=>thsRef.downCodes.includes(c)).length;
  const mrUp=thsRef.upCount>0?Math.round(upMatch/thsRef.upCount*100):0;
  const mrDown=thsRef.downCount>0?Math.round(dnMatch/thsRef.downCount*100):0;
  const avgMatch=(mrUp+mrDown)/2;
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgMatch>=85)o='PASS';
  else if(avgMatch>=60)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(mrUp<85)recs.push(`涨停匹配${mrUp}%<85%`);
  if(mrDown<85)recs.push(`跌停匹配${mrDown}%<85%`);
  return{timestamp:Date.now(),totalUpLimit:up.length,totalDownLimit:dn.length,topUp,topDown,vsTongHuaShun:{thsUpCount:thsRef.upCount,ourUpCount:up.length,matchRateUp:mrUp,thsDownCount:thsRef.downCount,ourDownCount:dn.length,matchRateDown:mrDown},overall:o,recommendations:recs};
}
export default LimitBenchmark;
