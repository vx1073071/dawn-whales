// ══ R275 LOBEHUB P1: 25全球指标质量终报 ══
export interface GlobalIndicator{id:string;name:string;market:string;category:string;value:number;expectedRange:[number,number];dataFreshnessMs:number;source:string;status:'PASS'|'WARNING'|'FAIL'}
export interface Global25Report{timestamp:number;totalIndicators:number;passCount:number;warningCount:number;failCount:number;passRate:number;byMarket:Record<string,{total:number;pass:number;fail:number}>;byCategory:Record<string,{total:number;pass:number}>;staleIndicators:string[];topFailures:{name:string;market:string;reason:string}[];overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkGlobal25(indicators:GlobalIndicator[],freshnessThresholdMs:number=3600000):Global25Report{
  if(indicators.length===0)return{timestamp:Date.now(),totalIndicators:0,passCount:0,warningCount:0,failCount:0,passRate:0,byMarket:{},byCategory:{},staleIndicators:[],topFailures:[],overall:'FAIL',recommendations:['数据为空——检查全球指标桥接']};
  const pass=indicators.filter(i=>i.status==='PASS');
  const warn=indicators.filter(i=>i.status==='WARNING');
  const fail=indicators.filter(i=>i.status==='FAIL');
  const stale=indicators.filter(i=>i.dataFreshnessMs>freshnessThresholdMs).map(i=>i.name);
  const byMarket:Record<string,{total:number;pass:number;fail:number}>={};
  const byCategory:Record<string,{total:number;pass:number}>={};
  indicators.forEach(i=>{
    if(!byMarket[i.market])byMarket[i.market]={total:0,pass:0,fail:0};
    byMarket[i.market].total++;
    if(i.status==='PASS')byMarket[i.market].pass++;
    if(i.status==='FAIL')byMarket[i.market].fail++;
    if(!byCategory[i.category])byCategory[i.category]={total:0,pass:0};
    byCategory[i.category].total++;
    if(i.status==='PASS')byCategory[i.category].pass++;
  });
  const topFails=fail.slice(0,5).map(f=>({name:f.name,market:f.market,reason:`超出范围[${f.expectedRange.join(',')}]当前=${f.value}`}));
  const passRate=Math.round(pass.length/indicators.length*100);
  let o:'PASS'|'WARNING'|'FAIL';
  if(passRate>=90&&stale.length===0)o='PASS';
  else if(passRate>=70&&stale.length<=3)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(passRate<90)recs.push(`通过率${passRate}%——${fail.length}个不达标`);
  if(stale.length>0)recs.push(`${stale.length}个指标数据陈旧>${freshnessThresholdMs/3600000}h`);
  return{timestamp:Date.now(),totalIndicators:indicators.length,passCount:pass.length,warningCount:warn.length,failCount:fail.length,passRate,byMarket,byCategory,staleIndicators:stale,topFailures:topFails,overall:o,recommendations:recs};
}
export default Global25Report;
