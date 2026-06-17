// ══ R267 LOBEHUB P3: 画线云同步体验基准 ══
// Drawing Cloud Sync UX Benchmark — 画线同步的速度+可靠性+冲突处理
export interface SyncSample {
  userId:string;deviceId:string;syncType:'SAVE'|'LOAD'|'SYNC'|'CONFLICT';
  drawingCount:number;dataSizeKB:number;syncDurationMs:number;success:boolean;
  conflictDetected:boolean;conflictResolved:boolean;dataIntegrity:boolean;
}
export interface SyncResult {
  totalOps:number;successRate:number;avgDurationMs:number;p95DurationMs:number;
  conflictRate:number;conflictResolveRate:number;dataIntegrityRate:number;
  overall:'PASS'|'WARNING'|'FAIL';score:number;recommendations:string[];
}

export function evaluateCloudSync(samples:SyncSample[]):SyncResult{
  if(samples.length===0)return{totalOps:0,successRate:0,avgDurationMs:0,p95DurationMs:0,conflictRate:0,conflictResolveRate:0,dataIntegrityRate:0,overall:'FAIL',score:0,recommendations:['无样本']};
  const success=samples.filter(s=>s.success).length;
  const durations=samples.map(s=>s.syncDurationMs).sort((a,b)=>a-b);
  const avgDur=durations.reduce((a,b)=>a+b,0)/durations.length;
  const p95=durations[Math.floor(durations.length*0.95)]||durations[durations.length-1];
  const conflicts=samples.filter(s=>s.conflictDetected).length;
  const conflictResolved=samples.filter(s=>s.conflictDetected&&s.conflictResolved).length;
  const dataOk=samples.filter(s=>s.dataIntegrity).length;

  let score=100;
  if(success/samples.length<0.95)score-=30;else if(success/samples.length<0.98)score-=15;
  if(avgDur>2000)score-=20;else if(avgDur>1000)score-=10;
  if(conflicts>0&&conflictResolved/conflicts<0.9)score-=20;
  if(dataOk/samples.length<0.99)score-=25;

  const recs:string[]=[];
  if(success/samples.length<0.98)recs.push(`❌ 成功率${(success/samples.length*100).toFixed(1)}%`);
  if(avgDur>1000)recs.push(`⚠️ 平均延迟${Math.round(avgDur)}ms——影响体验`);
  if(conflicts>0)recs.push(conflictResolved/conflicts<0.9?`❌ 冲突解决率${(conflictResolved/conflicts*100).toFixed(0)}%`:`✅ 冲突解决率${(conflictResolved/conflicts*100).toFixed(0)}%`);

  return{totalOps:samples.length,successRate:Math.round(success/samples.length*1000)/10,avgDurationMs:Math.round(avgDur),p95DurationMs:Math.round(p95),conflictRate:Math.round(conflicts/samples.length*1000)/10,conflictResolveRate:conflicts>0?Math.round(conflictResolved/conflicts*1000)/10:100,dataIntegrityRate:Math.round(dataOk/samples.length*1000)/10,overall:score>=80?'PASS':score>=60?'WARNING':'FAIL',score:Math.max(0,score),recommendations:recs};
}

export default SyncResult;
