// R284 P1
export interface P0CriticalFix{area:string;checkName:string;cleanRate:number;status:'FIXED'|'PARTIAL'|'BROKEN';issues:string[];}
export interface P0FixReport{timestamp:number;totalChecks:number;fixed:number;broken:number;fixRate:number;byArea:Record<string,{total:number;fixed:number;status:string}>;overall:'GO'|'CONDITIONAL_GO'|'NO_GO';}
export function verifyP0Fixes(checks:P0CriticalFix[]):P0FixReport{
  if(checks.length===0)return{timestamp:Date.now(),totalChecks:0,fixed:0,broken:0,fixRate:0,byArea:{},overall:'NO_GO'};
  const fixed=checks.filter(c=>c.status==='FIXED');const broken=checks.filter(c=>c.status==='BROKEN');
  const fixRate=Math.round(fixed.length/checks.length*100);
  const byArea:Record<string,any>={};for(const c of checks){if(!byArea[c.area])byArea[c.area]={total:0,fixed:0};byArea[c.area].total++;if(c.status==='FIXED')byArea[c.area].fixed++}
  for(const a of Object.keys(byArea)){byArea[a].status=byArea[a].fixed===byArea[a].total?'PASS':'WARNING'}
  let o: 'GO'|'CONDITIONAL_GO'|'NO_GO';if(broken.length===0&&fixRate>=100)o='GO';else if(broken.length<=1)o='CONDITIONAL_GO';else o='NO_GO';
  return{timestamp:Date.now(),totalChecks:checks.length,fixed:fixed.length,broken:broken.length,fixRate,byArea,overall:o};
}
export default P0FixReport;
