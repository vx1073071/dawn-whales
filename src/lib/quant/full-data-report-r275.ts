// ══ R275 LOBEHUB P2: 全量数据报告+收入复核 ══
export interface DataSegment{name:string;indicatorCount:number;avgQuality:number;coverageRate:number;issues:string[]}
export interface RevenueScenario{name:string;probability:number;monthlyRevenue:number;annualRevenue:number;keyDrivers:string[]}
export interface FullDataReport{timestamp:number;segments:DataSegment[];totalIndicators:number;overallQuality:number;overallCoverage:number;revenueScenarios:RevenueScenario[];expectedAnnualRevenue:number;confidenceInterval:[number,number];overall:'PASS'|'WARNING'|'FAIL';actionItems:string[]}
export function generateFullReport(segments:DataSegment[],dau:number=3000,arpu:number=3.5,conversionRate:number=0.04):FullDataReport{
  if(segments.length===0)return{timestamp:Date.now(),segments:[],totalIndicators:0,overallQuality:0,overallCoverage:0,revenueScenarios:[],expectedAnnualRevenue:0,confidenceInterval:[0,0],overall:'FAIL',actionItems:['数据为空']};
  const total=segments.reduce((s,x)=>s+x.indicatorCount,0);
  const avgQ=segments.reduce((s,x)=>s+x.avgQuality*x.indicatorCount,0)/total;
  const avgC=segments.reduce((s,x)=>s+x.coverageRate*x.indicatorCount,0)/total;
  const baseMonthly=dau*arpu*conversionRate*30;
  const scenarios:RevenueScenario[]=[
    {name:'悲观',probability:0.15,monthlyRevenue:Math.round(baseMonthly*0.6),annualRevenue:Math.round(baseMonthly*0.6*12),keyDrivers:['DAU下降','ARPU压缩']},
    {name:'保守',probability:0.25,monthlyRevenue:Math.round(baseMonthly*0.85),annualRevenue:Math.round(baseMonthly*0.85*12),keyDrivers:['稳定增长']},
    {name:'基准',probability:0.40,monthlyRevenue:Math.round(baseMonthly),annualRevenue:Math.round(baseMonthly*12),keyDrivers:['预期增长','新市场采纳']},
    {name:'乐观',probability:0.15,monthlyRevenue:Math.round(baseMonthly*1.3),annualRevenue:Math.round(baseMonthly*1.3*12),keyDrivers:['DAU超预期','转化提升']},
    {name:'爆发',probability:0.05,monthlyRevenue:Math.round(baseMonthly*1.8),annualRevenue:Math.round(baseMonthly*1.8*12),keyDrivers:['病毒传播','多市场起飞']},
  ];
  const expected=scenarios.reduce((s,x)=>s+x.annualRevenue*x.probability,0);
  const worst=scenarios[0].annualRevenue;
  const best=scenarios[4].annualRevenue;
  const issues=segments.flatMap(s=>s.issues);
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgQ>=85&&avgC>=90)o='PASS';
  else if(avgQ>=65&&avgC>=70)o='WARNING';
  else o='FAIL';
  const actions:string[]=[];
  if(avgQ<85)actions.push(`数据质量${Math.round(avgQ)}不达标——修复${issues.length}个问题`);
  if(avgC<90)actions.push(`覆盖率${Math.round(avgC)}%低于90%`);
  actions.push(`预期年收入≈${Math.round(expected).toLocaleString()}U (${Math.round(worst).toLocaleString()}-${Math.round(best).toLocaleString()})`);
  return{timestamp:Date.now(),segments,totalIndicators:total,overallQuality:Math.round(avgQ*100)/100,overallCoverage:Math.round(avgC*100)/100,revenueScenarios:scenarios,expectedAnnualRevenue:Math.round(expected),confidenceInterval:[Math.round(worst),Math.round(best)],overall:o,actionItems:actions};
}
export default FullDataReport;
