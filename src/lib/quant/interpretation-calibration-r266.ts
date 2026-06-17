// ══ R266 LOBEHUB P2: AI解读置信度校准引擎 ══
// AI Interpretation Confidence Calibrator — 指标AI解读的置信度是否准确？
export interface InterpretationSample {
  indicatorId:string;indicatorName:string;aiInterpretation:string;
  aiConfidence:'HIGH'|'MEDIUM'|'LOW';
  actualOutcome:'CORRECT'|'PARTIALLY_CORRECT'|'WRONG';
  userFoundHelpful:boolean;userRating?:number;
}

export interface CalibrationResult {
  indicatorId:string;indicatorName:string;
  samples:number;accuracy:number;helpfulRate:number;avgRating:number;
  highConfAccuracy:number;medConfAccuracy:number;lowConfAccuracy:number;
  calibrated:boolean; // HIGH→高准确, LOW→低准确?
}

export interface CalibrationReport {
  timestamp:number;overallAccuracy:number;overallHelpful:number;
  calibratedIndicators:number;totalIndicators:number;
  byIndicator:CalibrationResult[];
  recommendations:string[];
}

export function evaluateInterpretationCalibration(samples:InterpretationSample[]):CalibrationReport{
  const groups=new Map<string,InterpretationSample[]>();
  for(const s of samples){const g=groups.get(s.indicatorId)||[];g.push(s);groups.set(s.indicatorId,g)}
  const byIndicator:CalibrationResult[]=[];
  for(const [id,ss] of groups){
    const corr=ss.filter(s=>s.actualOutcome==='CORRECT').length;
    const part=ss.filter(s=>s.actualOutcome==='PARTIALLY_CORRECT').length;
    const accuracy=(corr+part*0.5)/ss.length;
    const helpful=ss.filter(s=>s.userFoundHelpful).length/ss.length;
    const rated=ss.filter(s=>s.userRating!==undefined);
    const avgR=rated.length>0?rated.reduce((a,s)=>a+(s.userRating||0),0)/rated.length:0;

    const hConf=ss.filter(s=>s.aiConfidence==='HIGH');
    const mConf=ss.filter(s=>s.aiConfidence==='MEDIUM');
    const lConf=ss.filter(s=>s.aiConfidence==='LOW');
    const hAcc=hConf.length>0?(hConf.filter(s=>s.actualOutcome==='CORRECT').length+hConf.filter(s=>s.actualOutcome==='PARTIALLY_CORRECT').length*0.5)/hConf.length:0;
    const mAcc=mConf.length>0?(mConf.filter(s=>s.actualOutcome==='CORRECT').length+mConf.filter(s=>s.actualOutcome==='PARTIALLY_CORRECT').length*0.5)/mConf.length:0;
    const lAcc=lConf.length>0?(lConf.filter(s=>s.actualOutcome==='CORRECT').length+lConf.filter(s=>s.actualOutcome==='PARTIALLY_CORRECT').length*0.5)/lConf.length:0;
    const calibrated=hAcc>=0.8&&lAcc<=0.4;

    byIndicator.push({indicatorId:id,indicatorName:ss[0].indicatorName,samples:ss.length,accuracy:Math.round(accuracy*1000)/10,helpfulRate:Math.round(helpful*1000)/10,avgRating:Math.round(avgR*100)/100,highConfAccuracy:hAcc,medConfAccuracy:mAcc,lowConfAccuracy:lAcc,calibrated});
  }

  const totalCorr=samples.filter(s=>s.actualOutcome==='CORRECT').length+samples.filter(s=>s.actualOutcome==='PARTIALLY_CORRECT').length*0.5;
  const overallAccuracy=totalCorr/Math.max(1,samples.length);
  const overallHelpful=samples.filter(s=>s.userFoundHelpful).length/Math.max(1,samples.length);
  const calibratedCount=byIndicator.filter(i=>i.calibrated).length;

  const recs:string[]=[];
  for(const b of byIndicator){if(!b.calibrated)recs.push(`⚠️ ${b.indicatorName}置信度未校准——HIGH应高准确/LOW应低准确`)}
  if(overallHelpful<0.6)recs.push('用户帮助度<60%——AI解读改进');

  return{timestamp:Date.now(),overallAccuracy:Math.round(overallAccuracy*1000)/10,overallHelpful:Math.round(overallHelpful*1000)/10,calibratedIndicators:calibratedCount,totalIndicators:groups.size,byIndicator,recommendations:recs};
}

export default CalibrationReport;
