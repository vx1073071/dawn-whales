// ══ R281 LOBEHUB P2: P0修复质量验证 ══
export interface P0FixItem { area:'unified-entry'|'dedup-components'|'pseudo-data'|'naming-unified'|'registry'; checkName:string; status:'FIXED'|'PARTIAL'|'BROKEN'; details:string; affectedFiles:number; testsPassed:number; }
export interface P0FixReport { timestamp:number; totalChecks:number; fixed:number; partial:number; broken:number; fixRate:number; byArea:Record<string,{total:number;fixed:number;rate:number}>; brokenItems:string[]; overall:'GO'|'CONDITIONAL_GO'|'NO_GO'; signOff:string; }
export function evaluateP0Fixes(checks:P0FixItem[]):P0FixReport{
  if(checks.length===0)return{timestamp:Date.now(),totalChecks:0,fixed:0,partial:0,broken:0,fixRate:0,byArea:{},brokenItems:[],overall:'NO_GO',signOff:'无检查项'};
  const fixed=checks.filter(c=>c.status==='FIXED');
  const partial=checks.filter(c=>c.status==='PARTIAL');
  const broken=checks.filter(c=>c.status==='BROKEN');
  const fixRate=Math.round(fixed.length/checks.length*100);
  const byArea:Record<string,any>={};
  for(const c of checks){if(!byArea[c.area])byArea[c.area]={total:0,fixed:0,rate:0};byArea[c.area].total++;if(c.status==='FIXED')byArea[c.area].fixed++}
  for(const a of Object.keys(byArea))byArea[a].rate=Math.round(byArea[a].fixed/byArea[a].total*100);
  let o:'GO'|'CONDITIONAL_GO'|'NO_GO';
  if(broken.length===0&&fixRate>=90)o='GO';
  else if(broken.length<=2&&fixRate>=70)o='CONDITIONAL_GO';
  else o='NO_GO';
  const brokenItems=broken.map(b=>b.checkName);
  return{timestamp:Date.now(),totalChecks:checks.length,fixed:fixed.length,partial:partial.length,broken:broken.length,fixRate,byArea,brokenItems,overall:o,signOff:o==='GO'?'所有P0修复通过——批准合并':o==='CONDITIONAL_GO'?`${broken.length}项有问题但可条件合并——${brokenItems.join(',')}`:`${broken.length}项阻断——${brokenItems.join(',')}必须修复`};
}
export default P0FixReport;
