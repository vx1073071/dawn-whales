// ══ R274 LOBEHUB P1: 🇭🇰🇨🇳12指标基准 vs 富途/同花顺 ══
export interface HKCNIndicator{market:'HK'|'CN';code:string;name:string;category:string;value:number;benchmark:number;deviationPct:number}
export interface HKCN12Report{timestamp:number;hkIndicators:HKCNIndicator[];cnIndicators:HKCNIndicator[];hkAvgDeviation:number;cnAvgDeviation:number;hkCoverageVsFutu:{futuCount:number;ourCount:number;matchRate:number};cnCoverageVsTHS:{thsCount:number;ourCount:number;matchRate:number};overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkHKCN12(hkData:HKCNIndicator[],cnData:HKCNIndicator[],futuRef:{indicatorCount:number},thsRef:{indicatorCount:number}):HKCN12Report{
  const allHk=hkData;
  const allCn=cnData;
  if(allHk.length===0&&allCn.length===0)return{timestamp:Date.now(),hkIndicators:[],cnIndicators:[],hkAvgDeviation:100,cnAvgDeviation:100,hkCoverageVsFutu:{futuCount:futuRef.indicatorCount,ourCount:0,matchRate:0},cnCoverageVsTHS:{thsCount:thsRef.indicatorCount,ourCount:0,matchRate:0},overall:'FAIL',recommendations:['数据为空——检查指标桥接']};
  const hkAvg=allHk.length>0?allHk.reduce((s,x)=>s+x.deviationPct,0)/allHk.length:0;
  const cnAvg=allCn.length>0?allCn.reduce((s,x)=>s+x.deviationPct,0)/allCn.length:0;
  const hkCov=futuRef.indicatorCount>0?Math.round(allHk.length/futuRef.indicatorCount*100):0;
  const cnCov=thsRef.indicatorCount>0?Math.round(allCn.length/thsRef.indicatorCount*100):0;
  const avgCov=(hkCov+cnCov)/2;
  const avgDev=(hkAvg+cnAvg)/2;
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgCov>=85&&avgDev<=10)o='PASS';
  else if(avgCov>=60&&avgDev<=30)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(hkCov<85)recs.push(`🇭🇰覆盖${hkCov}%不足——富途${futuRef.indicatorCount}个`);
  if(cnCov<85)recs.push(`🇨🇳覆盖${cnCov}%不足——同花顺${thsRef.indicatorCount}个`);
  if(hkAvg>10)recs.push(`🇭🇰偏差${hkAvg.toFixed(1)}%偏高`);
  if(cnAvg>10)recs.push(`🇨🇳偏差${cnAvg.toFixed(1)}%偏高`);
  return{timestamp:Date.now(),hkIndicators:allHk,cnIndicators:allCn,hkAvgDeviation:Math.round(hkAvg*100)/100,cnAvgDeviation:Math.round(cnAvg*100)/100,hkCoverageVsFutu:{futuCount:futuRef.indicatorCount,ourCount:allHk.length,matchRate:hkCov},cnCoverageVsTHS:{thsCount:thsRef.indicatorCount,ourCount:allCn.length,matchRate:cnCov},overall:o,recommendations:recs};
}
export default HKCN12Report;
