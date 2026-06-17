// R285 P2: 去重引擎/组件 质量审计 526→300引擎 + 564→200组件
export interface DedupGroup285{groupName:string;area:'engine'|'component';beforeCount:number;afterCount:number;savedCount:number;regressionTests:number;regressionPassed:number;status:'PASS'|'WARNING'|'FAIL';}
export interface Dedup285Report{timestamp:number;engineBefore:number;engineAfter:number;engineSaved:number;componentBefore:number;componentAfter:number;componentSaved:number;totalSaved:number;regressionRate:number;groups:DedupGroup285[];brokenGroups:string[];overall:'PASS'|'WARNING'|'FAIL';}
export function auditDedup285(groups:DedupGroup285[]):Dedup285Report{
  if(groups.length===0)return{timestamp:Date.now(),engineBefore:0,engineAfter:0,engineSaved:0,componentBefore:0,componentAfter:0,componentSaved:0,totalSaved:0,regressionRate:0,groups:[],brokenGroups:[],overall:'FAIL'};
  const eng=groups.filter(g=>g.area==='engine');const comp=groups.filter(g=>g.area==='component');
  const eBefore=eng.reduce((s,g)=>s+g.beforeCount,0);const eAfter=eng.reduce((s,g)=>s+g.afterCount,0);
  const cBefore=comp.reduce((s,g)=>s+g.beforeCount,0);const cAfter=comp.reduce((s,g)=>s+g.afterCount,0);
  const totalTests=groups.reduce((s,g)=>s+g.regressionTests,0);const totalPassed=groups.reduce((s,g)=>s+g.regressionPassed,0);
  const regRate=totalTests>0?Math.round(totalPassed/totalTests*100):0;
  const broken=groups.filter(g=>g.status==='FAIL').map(g=>g.groupName);
  let o: 'PASS'|'WARNING'|'FAIL';if(regRate>=95&&broken.length===0)o='PASS';else if(regRate>=80)o='WARNING';else o='FAIL';
  return{timestamp:Date.now(),engineBefore:eBefore,engineAfter:eAfter,engineSaved:eBefore-eAfter,componentBefore:cBefore,componentAfter:cAfter,componentSaved:cBefore-cAfter,totalSaved:eBefore+cBefore-eAfter-cAfter,regressionRate:regRate,groups,brokenGroups:broken,overall:o};
}
export default Dedup285Report;
