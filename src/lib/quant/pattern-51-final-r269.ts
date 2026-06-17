// ══ R269 LOBEHUB P2: 形态51准确率终报 ══
// Pattern 51 Final Accuracy Report — 30→51形态的完整准确率终报
import { evaluatePatternRecognition, PatternSample, PATTERN_NAMES } from './pattern-recognition-benchmark-r267';

export interface Pattern51FinalReport {
  timestamp:number;overallF1:number;totalPatterns:number;
  passCount:number;warningCount:number;failCount:number;
  byDifficulty:{difficulty:'EASY'|'MEDIUM'|'HARD';count:number;avgF1:number;passRate:number}[];
  top5:Array<{id:string;name:string;f1:number}>;
  bottom5:Array<{id:string;name:string;f1:number;fix:string}>;
  recommendations:string[];
}

export function generatePattern51Report(samples:PatternSample[]):Pattern51FinalReport{
  const base=evaluatePatternRecognition(samples);
  const failCount=base.byPattern.filter(p=>p.status==='FAIL').length;
  const warningCount=base.byPattern.filter(p=>p.status==='WARNING').length;

  const byDiff=new Map<'EASY'|'MEDIUM'|'HARD',PatternSample[]>();
  for(const s of samples){const d=PATTERN_NAMES[s.patternId].difficulty;const g=byDiff.get(d)||[];g.push(s);byDiff.set(d,g)}
  const byDifficulty=Array.from(byDiff.entries()).map(([difficulty,ss])=>{
    const pReport=evaluatePatternRecognition(ss);
    return{difficulty,count:new Set(ss.map(s=>s.patternId)).size,avgF1:pReport.overallF1,passRate:Math.round(pReport.byPattern.filter(p=>p.status==='PASS').length/pReport.byPattern.length*100)};
  });

  const top5=base.top3.slice(0,5).map(p=>({id:p.patternId,name:p.patternName,f1:p.f1}));
  const bottom5=base.worst3.slice(0,5).map(p=>({id:p.patternId,name:p.patternName,f1:p.f1,fix:p.f1<0.5?'需重新训练模型':p.f1<0.7?'参数调整+增加训练样本':'接近可用'}));

  const recs:string[]=[];
  if(failCount>10)recs.push(`❌ ${failCount}个形态完全失败——需优先修复`);
  else if(failCount>0)recs.push(`⚠️ ${failCount}个形态F1不合格`);
  const hardPassRate=byDifficulty.find(d=>d.difficulty==='HARD')?.passRate||0;
  if(hardPassRate<30)recs.push('困难形态通过率<30%——建议先专注简单+中等');

  return{timestamp:Date.now(),overallF1:base.overallF1,totalPatterns:base.totalPatterns,passCount:base.passCount,warningCount,failCount,byDifficulty,top5,bottom5,recommendations:recs};
}

export default Pattern51FinalReport;
