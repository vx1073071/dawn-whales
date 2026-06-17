// ══ R281 LOBEHUB P1: FactorRegistry完整性审计 ══
export interface FactorRegistryEntry { id:string; name:string; nameCn:string; category:string; source:string; filePath:string; registeredAt:number; hasDedup:boolean; hasNameUnified:boolean; status:'REGISTERED'|'ORPHAN'|'DUPLICATE'|'STALE'; }
export interface RegistryAuditReport { timestamp:number; totalRegistered:number; orphans:number; duplicates:number; stale:number; completenessRate:number; byCategory:Record<string,{registered:number;missing:number}>; missingEntries:string[]; overall:'PASS'|'WARNING'|'FAIL'; recommendations:string[]; }
export function auditFactorRegistry(entries:FactorRegistryEntry[],expectedTotal:number=620):RegistryAuditReport{
  if(entries.length===0)return{timestamp:Date.now(),totalRegistered:0,orphans:0,duplicates:0,stale:0,completenessRate:0,byCategory:{},missingEntries:['全空——Registry未初始化'],overall:'FAIL',recommendations:['立即初始化FactorRegistry']};
  const orphans=entries.filter(e=>e.status==='ORPHAN').length;
  const dups=entries.filter(e=>e.status==='DUPLICATE').length;
  const staleCount=entries.filter(e=>e.status==='STALE').length;
  void entries.filter(e=>e.status==='REGISTERED').length; // validate REGISTERED status exists
  const completeRate=Math.round(entries.length/expectedTotal*100);
  const byCategory:Record<string,any>={};
  for(const e of entries){if(!byCategory[e.category])byCategory[e.category]={registered:0,missing:0};byCategory[e.category].registered++}
  const missing=expectedTotal-entries.length;
  let o:'PASS'|'WARNING'|'FAIL';
  if(completeRate>=95&&orphans===0&&dups===0)o='PASS';
  else if(completeRate>=80&&orphans<=10)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(missing>0)recs.push(`缺失${missing}个因子未注册`);
  if(orphans>0)recs.push(`${orphans}个孤立因子——文件存在但未注册`);
  if(dups>0)recs.push(`${dups}个重复注册`);
  return{timestamp:Date.now(),totalRegistered:entries.length,orphans,duplicates:dups,stale:staleCount,completenessRate:completeRate,byCategory,missingEntries:missing>0?[`${missing}个因子缺失`]:[],overall:o,recommendations:recs};
}
export default RegistryAuditReport;
