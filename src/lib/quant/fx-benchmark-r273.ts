// ══ R273 LOBEHUB P3: 多币种汇率基准 vs 24币种 ══
export interface FXPair{from:string;to:string;rate:number;bid:number;ask:number;spread:number;timestamp:number;source:string}
export interface FXBenchmark{timestamp:number;totalPairs:number;avgSpread:number;maxSpread:{pair:string;spread:number};coverage:{targetCount:number;actualCount:number;coverageRate:number};majorPairs:{pair:string;rate:number;spread:number}[];overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkFX(data:FXPair[],targetPairCount:number=24):FXBenchmark{
  if(data.length===0)return{timestamp:Date.now(),totalPairs:0,avgSpread:0,maxSpread:{pair:'',spread:0},coverage:{targetCount:targetPairCount,actualCount:0,coverageRate:0},majorPairs:[],overall:'FAIL',recommendations:['数据为空——检查汇率数据源']};
  const avgS=data.reduce((s,x)=>s+x.spread,0)/data.length;
  const maxS=data.reduce((a,b)=>b.spread>a.spread?b:a,data[0]);
  const covRate=Math.round(data.length/targetPairCount*100);
  const majors=data.filter(d=>['USD','EUR','JPY','GBP','CNY','HKD','KRW','TWD','INR','BRL'].some(c=>d.from===c||d.to===c)).map(d=>({pair:`${d.from}/${d.to}`,rate:d.rate,spread:d.spread}));
  let o:'PASS'|'WARNING'|'FAIL';
  const maxPair = `${maxS.from}/${maxS.to}`;
  if(covRate>=90&&avgS<0.005)o='PASS';
  else if(covRate>=60&&avgS<0.02)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(covRate<90)recs.push(`汇率对覆盖${data.length}/${targetPairCount}(${covRate}%)`);
  if(avgS>=0.005)recs.push(`平均点差${(avgS*10000).toFixed(1)}pips偏高`);
  if(maxS.spread>0.01)recs.push(`最大点差${maxPair}: ${(maxS.spread*10000).toFixed(1)}pips`);
  return{timestamp:Date.now(),totalPairs:data.length,avgSpread:Math.round(avgS*100000)/100000,maxSpread:{pair:maxPair,spread:Math.round(maxS.spread*100000)/100000},coverage:{targetCount:targetPairCount,actualCount:data.length,coverageRate:covRate},majorPairs:majors,overall:o,recommendations:recs};
}
export default FXBenchmark;
