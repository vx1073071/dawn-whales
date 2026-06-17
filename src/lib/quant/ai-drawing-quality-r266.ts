// ══ R266 LOBEHUB P1: AI画线质量评估引擎 ══
// AI Auto-Drawing Quality Evaluator — AI自动画的趋势线/支撑压力准不准？
export interface DrawingQualitySample {
  symbol:string;exchange:string;period:string;
  type:'trendline'|'support'|'resistance'|'channel';
  aiLine:{startPrice:number;endPrice:number;slope:number};
  humanLine:{startPrice:number;endPrice:number;slope:number}; // 专家标注
  slopeErrorPct:number;boundaryErrorPct:number;validTouchCount:number;
  status:'EXCELLENT'|'GOOD'|'FAIR'|'POOR';
}

export interface AIDrawingQualityReport {
  timestamp:number;overallScore:number;overall:'PASS'|'WARNING'|'FAIL';
  totalSamples:number;avgSlopeError:number;avgBoundaryError:number;
  avgValidTouches:number;excellentRate:number;
  recommendations:string[];
}

export function evaluateDrawingQuality(samples:DrawingQualitySample[]):AIDrawingQualityReport{
  if(samples.length===0)return{timestamp:Date.now(),overallScore:0,overall:'FAIL',totalSamples:0,avgSlopeError:0,avgBoundaryError:0,avgValidTouches:0,excellentRate:0,recommendations:['无样本']};
  const avgSlope=samples.reduce((s,x)=>s+x.slopeErrorPct,0)/samples.length;
  const avgBound=samples.reduce((s,x)=>s+x.boundaryErrorPct,0)/samples.length;
  const avgTouch=samples.reduce((s,x)=>s+x.validTouchCount,0)/samples.length;
  const excellent=samples.filter(x=>x.status==='EXCELLENT').length;
  const excellentRate=excellent/samples.length*100;

  let score=100;
  if(avgSlope>10)score-=25;else if(avgSlope>5)score-=12;
  if(avgBound>8)score-=25;else if(avgBound>3)score-=10;
  if(avgTouch<2)score-=20;else if(avgTouch<3)score-=10;

  const recs:string[]=[];
  if(avgSlope>5)recs.push(`⚠️ 斜率误差${avgSlope.toFixed(1)}%——AI画线角度偏差大`);
  if(avgBound>3)recs.push(`⚠️ 边界误差${avgBound.toFixed(1)}%——线位不准`);
  if(avgTouch<3)recs.push(`⚠️ 平均触点${avgTouch.toFixed(1)}——线未被价格确认`);

  return{timestamp:Date.now(),overallScore:Math.max(0,score),overall:score>=80?'PASS':score>=60?'WARNING':'FAIL',totalSamples:samples.length,avgSlopeError:Math.round(avgSlope*10)/10,avgBoundaryError:Math.round(avgBound*10)/10,avgValidTouches:Math.round(avgTouch*10)/10,excellentRate:Math.round(excellentRate),recommendations:recs};
}

export default AIDrawingQualityReport;
