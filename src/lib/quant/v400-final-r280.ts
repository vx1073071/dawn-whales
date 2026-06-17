// ══ R280 LOBEHUB: v4.0.0数据质量终报+收入复核 ══
export interface V400QualityDim{name:string;category:string;score:number;totalFactors:number;passRate:number;avgIC:number;status:'PASS'|'WARNING'|'FAIL';issues:string[]}
export interface V400Revenue{scenario:string;probability:number;monthlyRevenue:number;annualRevenue:number;keyAssumptions:string[]}
export interface V400FinalReport{timestamp:number;version:string;overallQuality:number;overall:'SHIP'|'SHIP_WITH_CAUTION'|'HOLD';dimensions:V400QualityDim[];totalFactors:number;passRate:number;revenue:V400Revenue[];expectedAnnual:number;confidenceInterval:[number,number];highlights:string[];risks:string[];signOffRequired:string[]}
export function generateV400Final(
  dimensions:V400QualityDim[],
  dauEst:number=5000,
  arpuEst:number=4.5,
  conversionRate:number=0.05
):V400FinalReport{
  if(dimensions.length===0)return{timestamp:Date.now(),version:'v4.0.0',overallQuality:0,overall:'HOLD',dimensions:[],totalFactors:0,passRate:0,revenue:[],expectedAnnual:0,confidenceInterval:[0,0],highlights:[],risks:['数据为空'],signOffRequired:['Owner确认']};
  const totalF=dimensions.reduce((s,d)=>s+d.totalFactors,0);
  const totalPass=dimensions.reduce((s,d)=>s+Math.round(d.totalFactors*d.passRate/100),0);
  const passRate=totalF>0?Math.round(totalPass/totalF*100):0;
  const avgQ=dimensions.reduce((s,d)=>s+d.score*d.totalFactors,0)/totalF;
  const fc=dimensions.filter(d=>d.status==='FAIL').length;
  const wc=dimensions.filter(d=>d.status==='WARNING').length;
  let o:'SHIP'|'SHIP_WITH_CAUTION'|'HOLD';
  if(fc>0)o='HOLD';
  else if(wc>2)o='SHIP_WITH_CAUTION';
  else o='SHIP';
  const baseMonthly=Math.round(dauEst*arpuEst*conversionRate*30);
  const revenue:V400Revenue[]=[
    {scenario:'悲观',probability:0.15,monthlyRevenue:Math.round(baseMonthly*0.5),annualRevenue:Math.round(baseMonthly*0.5*12),keyAssumptions:['DAU下降','ARPU压缩']},
    {scenario:'保守',probability:0.25,monthlyRevenue:Math.round(baseMonthly*0.8),annualRevenue:Math.round(baseMonthly*0.8*12),keyAssumptions:['稳定增长']},
    {scenario:'基准',probability:0.40,monthlyRevenue:baseMonthly,annualRevenue:baseMonthly*12,keyAssumptions:['620因子全量上线','社区市场启动']},
    {scenario:'乐观',probability:0.15,monthlyRevenue:Math.round(baseMonthly*1.4),annualRevenue:Math.round(baseMonthly*1.4*12),keyAssumptions:['DAU翻倍','策略订阅爆发']},
    {scenario:'爆发',probability:0.05,monthlyRevenue:Math.round(baseMonthly*2.0),annualRevenue:Math.round(baseMonthly*2.0*12),keyAssumptions:['病毒传播','多市场起飞']},
  ];
  const exp=revenue.reduce((s,r)=>s+r.annualRevenue*r.probability,0);
  const worst=revenue[0].annualRevenue;
  const best=revenue[4].annualRevenue;
  const hl=dimensions.filter(d=>d.status==='PASS').map(d=>`✅ ${d.name}(${d.totalFactors}因子, ${d.passRate}%)`);
  const rk=dimensions.filter(d=>d.status==='FAIL').map(d=>`❌ ${d.name}: ${d.issues.join(',')}`);
  return{timestamp:Date.now(),version:'v4.0.0',overallQuality:Math.round(avgQ),overall:o,dimensions,totalFactors:totalF,passRate,revenue,expectedAnnual:Math.round(exp),confidenceInterval:[Math.round(worst),Math.round(best)],highlights:hl,risks:rk,signOffRequired:o!=='SHIP'?['Owner确认']:[]};
}
export default V400FinalReport;
