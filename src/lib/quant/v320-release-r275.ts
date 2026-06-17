// ══ R275 LOBEHUB P3: v3.2.0 终极发布终报 ══
export interface ReleaseChecklist{area:string;items:{name:string;status:'DONE'|'PENDING'|'BLOCKED';owner:string}[]}
export interface V320ReleaseReport{timestamp:number;version:string;status:'GO'|'NO_GO'|'CONDITIONAL_GO';checklist:ReleaseChecklist[];rolloutPlan:{phase:string;target:string;date:string;criteria:string}[];signatures:{role:string;name:string;signed:boolean}[];riskAssessment:{risk:string;severity:'HIGH'|'MEDIUM'|'LOW';mitigation:string}[];goNoGoReason:string}
export function evaluateV320Release(checklist:ReleaseChecklist[],indicatorsTotal:number=131,indicatorsPassed:number=125,testsTotal:number=83,testsPassed:number=83):V320ReleaseReport{
  const allItems=checklist.flatMap(c=>c.items);
  const done=allItems.filter(i=>i.status==='DONE').length;
  const blocked=allItems.filter(i=>i.status==='BLOCKED');
  const doneRate=allItems.length>0?Math.round(done/allItems.length*100):0;
  const indRate=indicatorsTotal>0?Math.round(indicatorsPassed/indicatorsTotal*100):0;
  const testRate=testsTotal>0?Math.round(testsPassed/testsTotal*100):0;
  let go:'GO'|'NO_GO'|'CONDITIONAL_GO';
  let reason='';
  const allBlockedNames=blocked.map(b=>b.name);
  if(doneRate>=95&&blocked.length===0&&indRate>=90&&testRate===100){go='GO';reason='全部检查通过——批准发布v3.2.0';}
  else if(blocked.length>0){go='NO_GO';reason=`${blocked.length}个阻塞项: ${allBlockedNames.join(', ')}`;}
  else{go='CONDITIONAL_GO';reason=`完成率${doneRate}%——${allItems.length-done}个待完成但可条件发布`;}
  const risks:V320ReleaseReport['riskAssessment']=[];
  if(indRate<95)risks.push({risk:'部分指标未达标',severity:'MEDIUM',mitigation:'发布后72h内修复'});
  if(doneRate<100)risks.push({risk:'发布清单未100%完成',severity:'LOW',mitigation:'分阶段完成余量'});
  return{timestamp:Date.now(),version:'v3.2.0',status:go,checklist,rolloutPlan:[{phase:'Phase 1',target:'1%灰度',date:'D+0',criteria:'无P0问题'},{phase:'Phase 2',target:'10%',date:'D+1',criteria:'Crash率<0.1%'},{phase:'Phase 3',target:'50%',date:'D+3',criteria:'无P1问题'},{phase:'Phase 4',target:'100%',date:'D+7',criteria:'全量稳定'}],signatures:[{role:'PM',name:'Owner',signed:go==='GO'},{role:'QA',name:'QA Lead',signed:testRate===100},{role:'Dev',name:'Tech Lead',signed:doneRate>=95}],riskAssessment:risks,goNoGoReason:reason};
}
export default V320ReleaseReport;
