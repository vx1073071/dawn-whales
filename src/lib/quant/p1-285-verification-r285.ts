export interface P1Check285{area:string;checkName:string;coveragePct:number;status:'PASS'|'WARNING'|'FAIL';issues:string[];}
export interface P1285Report{timestamp:number;totalChecks:number;pass:number;fail:number;passRate:number;byArea:Record<string,{total:number;pass:number;coverage:number;status:string}>;overall:'GO'|'CONDITIONAL_GO'|'NO_GO';}
export function evaluateP1285(checks:P1Check285[]):P1285Report{
  if(checks.length===0)return{timestamp:Date.now(),totalChecks:0,pass:0,fail:0,passRate:0,byArea:{},overall:'NO_GO'};
  const pass=checks.filter(c=>c.status==='PASS');const fail=checks.filter(c=>c.status==='FAIL');
  const byArea:Record<string,any>={};for(const c of checks){if(!byArea[c.area])byArea[c.area]={total:0,pass:0,sumCov:0};byArea[c.area].total++;if(c.status==='PASS')byArea[c.area].pass++;byArea[c.area].sumCov+=c.coveragePct;}
  for(const a of Object.keys(byArea)){byArea[a].coverage=Math.round(byArea[a].sumCov/byArea[a].total);byArea[a].status=byArea[a].pass===byArea[a].total?'PASS':byArea[a].pass>0?'WARNING':'FAIL';delete byArea[a].sumCov;}
  const pr=Math.round(pass.length/checks.length*100);let o: 'GO'|'CONDITIONAL_GO'|'NO_GO';if(pr>=90&&fail.length===0)o='GO';else if(pr>=60)o='CONDITIONAL_GO';else o='NO_GO';
  return{timestamp:Date.now(),totalChecks:checks.length,pass:pass.length,fail:fail.length,passRate:pr,byArea,overall:o};
}
export default P1285Report;
