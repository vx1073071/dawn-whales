// ══ R283 LOBEHUB P2: 全量E2E回归终验 ══
export interface E2ECheck {
  section:string; // 'factor-render'|'data-freshness'|'ux-workflow'|'perf'|'integration'
  checkName:string; totalTests:number; passed:number; failed:number;
  brokenTests:string[]; durationMs:number;
  status:'PASS'|'FLAKY'|'FAIL';
}
export interface E2EFinalReport {
  timestamp:number; totalSections:number; totalTests:number; totalPassed:number;
  passRate:number; totalDurationMs:number;
  bySection:Record<string,{total:number;passed:number;rate:number;duration:number}>;
  flakyTests:string[]; brokenSections:string[];
  overall:'GO'|'CONDITIONAL_GO'|'NO_GO'; signOff:string;
}
export function evaluateE2EFinal(checks:E2ECheck[]):E2EFinalReport{
  if(checks.length===0)return{timestamp:Date.now(),totalSections:0,totalTests:0,totalPassed:0,passRate:0,totalDurationMs:0,bySection:{},flakyTests:[],brokenSections:[],overall:'NO_GO',signOff:'无E2E检查项'};
  const totalTests=checks.reduce((s,c)=>s+c.totalTests,0);
  const totalPassed=checks.reduce((s,c)=>s+c.passed,0);
  const passRate=totalTests>0?Math.round(totalPassed/totalTests*100):0;
  const totalDur=checks.reduce((s,c)=>s+c.durationMs,0);
  const bySection:Record<string,any>={};
  for(const c of checks){
    if(!bySection[c.section])bySection[c.section]={total:0,passed:0,duration:0};
    bySection[c.section].total+=c.totalTests;bySection[c.section].passed+=c.passed;
    bySection[c.section].duration+=c.durationMs;
  }
  for(const s of Object.keys(bySection)){
    bySection[s].rate=Math.round(bySection[s].passed/bySection[s].total*100);
    bySection[s].duration=Math.round(bySection[s].duration);
  }
  const flaky=checks.filter(c=>c.status==='FLAKY').flatMap(c=>c.brokenTests);
  const broken=checks.filter(c=>c.status==='FAIL');
  const brokenSections=broken.map(c=>c.section);
  let o:'GO'|'CONDITIONAL_GO'|'NO_GO';
  if(passRate>=98&&broken.length===0&&flaky.length===0)o='GO';
  else if(passRate>=90&&broken.length===0)o='CONDITIONAL_GO';else o='NO_GO';
  return{timestamp:Date.now(),totalSections:checks.length,totalTests,totalPassed,passRate,totalDurationMs:totalDur,bySection,flakyTests:flaky,brokenSections,overall:o,signOff:o==='GO'?'全量E2E通过——GO':o==='CONDITIONAL_GO'?`条件GO——${flaky.length}个flaky测试`:'阻断——${broken.length}个section失败'};
}
export default E2EFinalReport;
