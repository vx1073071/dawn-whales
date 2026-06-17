// ══ R283 LOBEHUB P1: P2差异化终验 ══
export interface P2DiffCheck {
  area:'backtrack'|'move-factor'|'social-compare'|'factor-diary'|'favorites'|'freshness'|'template-merge'|'arena';
  checkName:string; targetFactorCount:number; actualPassed:number;
  coverageRate:number; uxScore:number; // 0-100
  issues:string[]; status:'PASS'|'WARNING'|'FAIL';
}
export interface P2DiffReport {
  timestamp:number; totalChecks:number; passCount:number; failCount:number;
  overallRate:number; avgUxScore:number;
  byArea:Record<string,{total:number;pass:number;ux:number;status:string}>;
  worstAreas:string[]; bestFeature:string;
  overall:'GO'|'CONDITIONAL_GO'|'NO_GO'; signOff:string;
  recommendations:string[];
}
export function evaluateP2Diff(checks:P2DiffCheck[]):P2DiffReport{
  if(checks.length===0)return{timestamp:Date.now(),totalChecks:0,passCount:0,failCount:0,overallRate:0,avgUxScore:0,byArea:{},worstAreas:[],bestFeature:'',overall:'NO_GO',signOff:'无检查项',recommendations:['数据为空']};
  const pass=checks.filter(c=>c.status==='PASS');
  const fail=checks.filter(c=>c.status==='FAIL');
  const overallRate=Math.round(pass.length/checks.length*100);
  const avgUx=Math.round(checks.reduce((s,c)=>s+c.uxScore,0)/checks.length);
  const byArea:Record<string,any>={};
  for(const c of checks){
    if(!byArea[c.area])byArea[c.area]={total:0,pass:0,sumUx:0};
    byArea[c.area].total++;if(c.status==='PASS')byArea[c.area].pass++;
    byArea[c.area].sumUx+=c.uxScore;
  }
  for(const a of Object.keys(byArea)){
    byArea[a].ux=Math.round(byArea[a].sumUx/byArea[a].total);
    byArea[a].status=byArea[a].pass===byArea[a].total?'PASS':byArea[a].pass>=byArea[a].total*0.6?'WARNING':'FAIL';
    delete byArea[a].sumUx;
  }
  const worst=Object.entries(byArea).filter(([_,v])=>v.status==='FAIL').map(([k])=>k);
  const best=checks.reduce((a,b)=>b.uxScore>a.uxScore?b:a);
  let o:'GO'|'CONDITIONAL_GO'|'NO_GO';
  if(overallRate>=100&&worst.length===0)o='GO';
  else if(overallRate>=75)o='CONDITIONAL_GO';else o='NO_GO';
  const recs:string[]=[];
  if(worst.length>0)recs.push(`FAIL区域: ${worst.join(',')}`);
  if(avgUx<70)recs.push(`平均UX评分${avgUx}——需优化体验`);
  return{timestamp:Date.now(),totalChecks:checks.length,passCount:pass.length,failCount:fail.length,overallRate,avgUxScore:avgUx,byArea,worstAreas:worst,bestFeature:best.checkName,overall:o,signOff:o==='GO'?'全部P2差异项通过——批准发布':o==='CONDITIONAL_GO'?`条件通过——${worst.length}个区域待修复`:'阻断——必须修复',recommendations:recs};
}
export default P2DiffReport;
