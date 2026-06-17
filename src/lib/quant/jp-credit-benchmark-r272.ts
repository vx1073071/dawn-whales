// ══ R272 LOBEHUB P3: 日本信用质量 vs JPX ══
export interface CreditStock{code:string;name:string;marginBalance:number;marginBuy:number;marginSell:number;marginRatio:number;loanBalance:number}
export interface JPCreditBenchmark{timestamp:number;totalStocks:number;avgMarginRatio:number;totalMarginBuy:number;totalMarginSell:number;netMarginPosition:number;vsJPX:{jpxCount:number;ourCount:number;coverageRate:number;deviationPct:number};overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkJPCredit(data:CreditStock[],jpxRef:{totalCount:number;avgMarginRatio:number}):JPCreditBenchmark{
  if(data.length===0)return{timestamp:Date.now(),totalStocks:0,avgMarginRatio:0,totalMarginBuy:0,totalMarginSell:0,netMarginPosition:0,vsJPX:{jpxCount:jpxRef.totalCount,ourCount:0,coverageRate:0,deviationPct:100},overall:'FAIL',recommendations:['数据为空——检查日本信用数据源']};
  const avgMr=data.reduce((s,x)=>s+x.marginRatio,0)/data.length;
  const buy=data.reduce((s,x)=>s+x.marginBuy,0);
  const sell=data.reduce((s,x)=>s+x.marginSell,0);
  const net=buy-sell;
  const covRate=Math.round(data.length/jpxRef.totalCount*100);
  const devPct=Math.round(Math.abs(avgMr-jpxRef.avgMarginRatio)/jpxRef.avgMarginRatio*100);
  let o:'PASS'|'WARNING'|'FAIL';
  if(covRate>=85&&devPct<=15)o='PASS';
  else if(covRate>=60&&devPct<=40)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(covRate<85)recs.push(`覆盖${covRate}%低于JPX(${jpxRef.totalCount})`);
  if(devPct>15)recs.push(`保证金比率偏差${devPct}%—JPX基准${jpxRef.avgMarginRatio}%`);
  if(net>0)recs.push(`净买入=${net.toLocaleString()}—看多信号`);
  else recs.push(`净卖出=${Math.abs(net).toLocaleString()}—看空信号`);
  return{timestamp:Date.now(),totalStocks:data.length,avgMarginRatio:Math.round(avgMr*100)/100,totalMarginBuy:buy,totalMarginSell:sell,netMarginPosition:net,vsJPX:{jpxCount:jpxRef.totalCount,ourCount:data.length,coverageRate:covRate,deviationPct:devPct},overall:o,recommendations:recs};
}
export default JPCreditBenchmark;
