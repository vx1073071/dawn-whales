// ══ R282 LOBEHUB P2: 人话化准确率审计 ══
export interface HumanizedFactor {
  factorId:string; originalName:string; humanizedName:string; emoji:string;
  oneliner:string; summary3s:string; readLevel:number; // 阅读难度 1-20
  accuracyScore:number; // 0-100 人话vs原始含义匹配度
  sampleValue:number; sampleInterpretation:string;
  status:'ACCURATE'|'MISLEADING'|'WRONG'|'UNTESTED';
}
export interface HumanizeAuditReport {
  timestamp:number; totalTested:number; accurate:number; misleading:number; wrong:number;
  accuracyRate:number; avgReadLevel:number;
  byCategory:Record<string,{total:number;accurate:number;avgLvl:number}>;
  worstOffenders:{name:string;status:string;reason:string}[];
  overall:'PASS'|'WARNING'|'FAIL';
  recommendations:string[];
}
export function auditHumanize(factors:HumanizedFactor[]):HumanizeAuditReport{
  if(factors.length===0)return{timestamp:Date.now(),totalTested:0,accurate:0,misleading:0,wrong:0,accuracyRate:0,avgReadLevel:0,byCategory:{},worstOffenders:[],overall:'FAIL',recommendations:['无人话化数据']};
  const acc=factors.filter(f=>f.status==='ACCURATE');
  const mis=factors.filter(f=>f.status==='MISLEADING');
  const wrong=factors.filter(f=>f.status==='WRONG');
  const accRate=Math.round(acc.length/factors.length*100);
  const avgLvl=Math.round(factors.reduce((s,f)=>s+f.readLevel,0)/factors.length);
  // group by category (extracted from factorId)
  const byCategory:Record<string,any>={};
  for(const f of factors){
    const cat=f.factorId.split('-')[0]||'other';
    if(!byCategory[cat])byCategory[cat]={total:0,accurate:0,sumLvl:0};
    byCategory[cat].total++;if(f.status==='ACCURATE')byCategory[cat].accurate++;
    byCategory[cat].sumLvl+=f.readLevel;
  }
  for(const c of Object.keys(byCategory)){byCategory[c].avgLvl=Math.round(byCategory[c].sumLvl/byCategory[c].total);delete byCategory[c].sumLvl}
  const worst=[...factors].filter(f=>f.status!=='ACCURATE').sort((a,b)=>a.accuracyScore-b.accuracyScore).slice(0,5).map(f=>({name:f.humanizedName||f.originalName,status:f.status,reason:f.status==='WRONG'?'完全错误':f.status==='MISLEADING'?'有误导':'未测试'}));
  let o:'PASS'|'WARNING'|'FAIL';
  if(accRate>=85&&avgLvl<=12)o='PASS';
  else if(accRate>=60)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(accRate<90)recs.push(`准确率${accRate}%——${wrong.length}个完全错误`);
  if(mis.length>0)recs.push(`${mis.length}个有误导风险`);
  if(avgLvl>12)recs.push(`阅读难度${avgLvl}过高——目标≤12(8年级)`);
  return{timestamp:Date.now(),totalTested:factors.length,accurate:acc.length,misleading:mis.length,wrong:wrong.length,accuracyRate:accRate,avgReadLevel:avgLvl,byCategory,worstOffenders:worst,overall:o,recommendations:recs};
}
export default HumanizeAuditReport;
