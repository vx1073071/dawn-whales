// ══ R282 LOBEHUB P1: P1核心体验质量验证 ══
export interface P1ExperienceCheck {
  area:'i18n'|'fold-card'|'summary-3s'|'humanize'|'pk-oneline'|'degrade'|'perf'|'mock'|'climate'|'alarm'|'recipe'|'naming';
  checkName:string; targetFactorCount:number; actualPassed:number;
  coverageRate:number; issues:string[];
  status:'PASS'|'WARNING'|'FAIL';
}
export interface P1ExperienceReport {
  timestamp:number; totalChecks:number; passCount:number; failCount:number;
  overallRate:number;
  byArea:Record<string,{total:number;pass:number;coverage:number;status:string}>;
  worstAreas:string[];
  overall:'PASS'|'WARNING'|'FAIL';
  recommendations:string[];
}
export function evaluateP1Experience(checks:P1ExperienceCheck[]):P1ExperienceReport{
  if(checks.length===0)return{timestamp:Date.now(),totalChecks:0,passCount:0,failCount:0,overallRate:0,byArea:{},worstAreas:[],overall:'FAIL',recommendations:['无检查项']};
  const pass=checks.filter(c=>c.status==='PASS');
  const fail=checks.filter(c=>c.status==='FAIL');
  const overallRate=Math.round(pass.length/checks.length*100);
  const byArea:Record<string,any>={};
  for(const c of checks){
    if(!byArea[c.area])byArea[c.area]={total:0,pass:0,sumCov:0};
    byArea[c.area].total++;if(c.status==='PASS')byArea[c.area].pass++;
    byArea[c.area].sumCov+=c.coverageRate;
  }
  for(const a of Object.keys(byArea)){
    byArea[a].coverage=Math.round(byArea[a].sumCov/byArea[a].total);
    byArea[a].status=byArea[a].pass===byArea[a].total?'PASS':byArea[a].pass>=byArea[a].total*0.7?'WARNING':'FAIL';
    delete byArea[a].sumCov;
  }
  const worst=Object.entries(byArea).filter(([_,v])=>v.status==='FAIL').map(([k])=>k);
  let o:'PASS'|'WARNING'|'FAIL';
  if(overallRate>=85&&worst.length===0)o='PASS';
  else if(overallRate>=60)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(worst.length>0)recs.push(`FAIL区域: ${worst.join(',')}`);
  fail.slice(0,3).forEach(f=>recs.push(`${f.area}/${f.checkName}: ${f.issues.join(';')}`));
  return{timestamp:Date.now(),totalChecks:checks.length,passCount:pass.length,failCount:fail.length,overallRate,byArea,worstAreas:worst,overall:o,recommendations:recs};
}
export default P1ExperienceReport;
