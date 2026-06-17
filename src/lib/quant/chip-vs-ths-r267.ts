// ══ R267 LOBEHUB P2: 筹码分布 vs 同花顺对标 ══
// Chip Distribution vs THS Benchmark — 筹码分布准确性对标
export interface ChipCompareSample {
  symbol:string;exchange:string;
  ours:{poc:number;vah:number;val:number;avgCost:number;profitRatio:number;concentration:number};
  ths:{poc:number;vah:number;val:number;avgCost:number;profitRatio:number;concentration:number};
  pocDiffPct:number;vahDiffPct:number;valDiffPct:number;avgCostDiffPct:number;profitRatioDelta:number;concDelta:number;
  status:'MATCH'|'MINOR_DIFF'|'MAJOR_DIFF';
}
export interface ChipCompareResult {
  totalSamples:number;matchRate:number;minorDiffRate:number;majorDiffRate:number;
  avgPocDiff:number;avgVahDiff:number;avgValDiff:number;avgCostDiff:number;avgProfitDelta:number;avgConcDelta:number;
  overall:'PASS'|'WARNING'|'FAIL';score:number;recommendations:string[];
}

export function compareChipDistribution(samples:ChipCompareSample[]):ChipCompareResult{
  if(samples.length===0)return{totalSamples:0,matchRate:0,minorDiffRate:0,majorDiffRate:0,avgPocDiff:0,avgVahDiff:0,avgValDiff:0,avgCostDiff:0,avgProfitDelta:0,avgConcDelta:0,overall:'FAIL',score:0,recommendations:['无样本']};
  const match=samples.filter(s=>s.status==='MATCH').length;
  const minor=samples.filter(s=>s.status==='MINOR_DIFF').length;
  const major=samples.filter(s=>s.status==='MAJOR_DIFF').length;
  const avgPoc=samples.reduce((a,s)=>a+Math.abs(s.pocDiffPct),0)/samples.length;
  const avgVah=samples.reduce((a,s)=>a+Math.abs(s.vahDiffPct),0)/samples.length;
  const avgVal=samples.reduce((a,s)=>a+Math.abs(s.valDiffPct),0)/samples.length;
  const avgCost=samples.reduce((a,s)=>a+Math.abs(s.avgCostDiffPct),0)/samples.length;
  const avgProfit=samples.reduce((a,s)=>a+Math.abs(s.profitRatioDelta),0)/samples.length;
  const avgConc=samples.reduce((a,s)=>a+Math.abs(s.concDelta),0)/samples.length;

  let score=100;
  if(avgPoc>3)score-=20;else if(avgPoc>1)score-=10;
  if(avgVah>5)score-=15;
  if(avgCost>5)score-=20;else if(avgCost>2)score-=10;
  if(major/samples.length>0.3)score-=25;

  const recs:string[]=[];
  if(avgPoc>1)recs.push(`⚠️ POC偏差${avgPoc.toFixed(1)}%——最大成交价不准`);
  if(avgCost>2)recs.push(`⚠️ 平均成本偏差${avgCost.toFixed(1)}%`);
  if(major>0)recs.push(major>samples.length*0.3?`❌ ${major}个样本偏差过大`:`⚠️ ${major}个样本偏差较大`);

  return{totalSamples:samples.length,matchRate:Math.round(match/samples.length*1000)/10,minorDiffRate:Math.round(minor/samples.length*1000)/10,majorDiffRate:Math.round(major/samples.length*1000)/10,avgPocDiff:Math.round(avgPoc*100)/100,avgVahDiff:Math.round(avgVah*100)/100,avgValDiff:Math.round(avgVal*100)/100,avgCostDiff:Math.round(avgCost*100)/100,avgProfitDelta:Math.round(avgProfit*100)/100,avgConcDelta:Math.round(avgConc*100)/100,overall:score>=80?'PASS':score>=60?'WARNING':'FAIL',score:Math.max(0,score),recommendations:recs};
}

export default ChipCompareResult;
