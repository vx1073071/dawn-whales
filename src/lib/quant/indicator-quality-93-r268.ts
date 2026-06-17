// ══ R268 LOBEHUB P1: 93指标质量基准 ══
// 93-Indicator Quality Benchmark — 93指标全覆盖质量验证(29→93追平TradingView)
export type IndicatorCategory='trend'|'momentum'|'volume'|'volatility'|'overlay'|'china'|'orderflow';

export interface IndicatorQualitySample {
  id:string;name:string;category:IndicatorCategory;isNew:boolean;
  algorithmCorrect:boolean;renderCorrect:boolean;paramsValid:boolean;
  twEquivalent:boolean;benchmarkDiffPct:number;
  status:'PASS'|'MINOR_ISSUE'|'MAJOR_ISSUE';
}

export interface CategorySummary {
  category:IndicatorCategory;total:number;pass:number;minorIssues:number;majorIssues:number;
  passRate:number;avgDiff:number;status:'PASS'|'WARNING'|'FAIL';
}

export interface IndicatorQualityReport {
  timestamp:number;overallScore:number;overall:'PASS'|'WARNING'|'FAIL';
  totalIndicators:number;passCount:number;passRate:number;
  byCategory:CategorySummary[];worstIndicators:IndicatorQualitySample[];
  recommendations:string[];
}

export function generateIndicatorQualityReport(samples:IndicatorQualitySample[]):IndicatorQualityReport{
  if(samples.length===0)return{timestamp:Date.now(),overallScore:0,overall:'FAIL',totalIndicators:0,passCount:0,passRate:0,byCategory:[],worstIndicators:[],recommendations:['无样本']};
  const pass=samples.filter(s=>s.status==='PASS').length;
  const passRate=pass/samples.length*100;

  const cats=new Map<IndicatorCategory,IndicatorQualitySample[]>();
  for(const s of samples){const g=cats.get(s.category)||[];g.push(s);cats.set(s.category,g)}
  const byCategory:CategorySummary[]=[];
  for(const [cat,ss] of cats){
    const p=ss.filter(s=>s.status==='PASS').length;
    const minor=ss.filter(s=>s.status==='MINOR_ISSUE').length;
    const major=ss.filter(s=>s.status==='MAJOR_ISSUE').length;
    const avgDiff=ss.reduce((a,s)=>a+s.benchmarkDiffPct,0)/ss.length;
    let status:CategorySummary['status'];const rate=p/ss.length*100;
    if(rate>=90)status='PASS';else if(rate>=70)status='WARNING';else status='FAIL';
    byCategory.push({category:cat,total:ss.length,pass:p,minorIssues:minor,majorIssues:major,passRate:Math.round(rate*10)/10,avgDiff:Math.round(avgDiff*100)/100,status});
  }

  const worstIndicators=samples.filter(s=>s.status==='MAJOR_ISSUE').slice(0,10);
  let score=Math.round(passRate);
  const recs:string[]=[];
  for(const c of byCategory){if(c.status==='FAIL')recs.push(`❌ ${c.category}通过率${c.passRate}%`);else if(c.status==='WARNING')recs.push(`⚠️ ${c.category}通过率${c.passRate}%`)}
  if(worstIndicators.length>0)recs.push(`🔧 ${worstIndicators.length}个指标需修复`);

  return{timestamp:Date.now(),overallScore:score,overall:score>=90?'PASS':score>=70?'WARNING':'FAIL',totalIndicators:samples.length,passCount:pass,passRate:Math.round(passRate*10)/10,byCategory,worstIndicators,recommendations:recs};
}

export default IndicatorQualityReport;
