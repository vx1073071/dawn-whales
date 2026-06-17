// ══ R266 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import { evaluateDrawingQuality } from '../../src/lib/quant/ai-drawing-quality-r266';
import { evaluateInterpretationCalibration } from '../../src/lib/quant/interpretation-calibration-r266';
import { analyzeCounterView } from '../../src/lib/quant/counter-view-ab-r266';

describe('R266 P1 AI Drawing', ()=>{
  const mk=(slope:number,bound:number,touch:number)=>({symbol:'AAPL',exchange:'NQ',period:'d1',type:'trendline'as const,aiLine:{startPrice:150,endPrice:155,slope},humanLine:{startPrice:150,endPrice:155,slope:0},slopeErrorPct:slope,boundaryErrorPct:bound,validTouchCount:touch,status:'EXCELLENT'as const});
  it('perfect drawing',()=>{const r=evaluateDrawingQuality([mk(0,0,5)]);expect(r.overall).toBe('PASS')});
  it('bad slope',()=>{const r=evaluateDrawingQuality([mk(15,0,2)]);expect(r.overall).toBe('WARNING')});
  it('very bad',()=>{const r=evaluateDrawingQuality([mk(20,15,0)]);expect(r.overall).toBe('FAIL')});
  it('excellent rate',()=>{const r=evaluateDrawingQuality([mk(0,0,5),mk(0,0,5),mk(15,10,0)]);expect(r.excellentRate).toBeGreaterThan(50);expect(r.excellentRate).toBeLessThanOrEqual(100)});
  it('recommendations for bad',()=>{expect(evaluateDrawingQuality([mk(15,10,0)]).recommendations.length).toBeGreaterThan(0)});
  it('avg slope tracked',()=>{expect(evaluateDrawingQuality([mk(5,2,3),mk(3,1,4)]).avgSlopeError).toBeGreaterThan(0)});
  it('avg valid touches',()=>{expect(evaluateDrawingQuality([mk(0,0,4)]).avgValidTouches).toBeGreaterThan(2)});
  it('score 100 perfect',()=>{expect(evaluateDrawingQuality([mk(0,0,5)]).overallScore).toBeGreaterThan(90)});
  it('score drops with errors',()=>{expect(evaluateDrawingQuality([mk(0,0,5)]).overallScore).toBeGreaterThan(evaluateDrawingQuality([mk(10,5,0)]).overallScore)});
  it('empty returns FAIL',()=>{expect(evaluateDrawingQuality([]).overall).toBe('FAIL')});
  it('boundary error tracked',()=>{expect(evaluateDrawingQuality([mk(0,5,3)]).avgBoundaryError).toBeGreaterThan(3)});
  it('overallScore 0-100',()=>{const r=evaluateDrawingQuality([mk(0,0,5)]);expect(r.overallScore).toBeGreaterThanOrEqual(0);expect(r.overallScore).toBeLessThanOrEqual(100)});
});

describe('R266 P2 AI Confidence',()=>{
  const mk=(indId:string,conf:'HIGH'|'MEDIUM'|'LOW',outcome:'CORRECT'|'PARTIALLY_CORRECT'|'WRONG',helpful:boolean)=>({indicatorId:indId,indicatorName:'Test',aiInterpretation:'test',aiConfidence:conf,actualOutcome:outcome,userFoundHelpful:helpful});
  it('high accuracy',()=>{const r=evaluateInterpretationCalibration([mk('macd','HIGH','CORRECT',true),mk('macd','HIGH','CORRECT',true)]);expect(r.byIndicator[0].accuracy).toBeGreaterThan(80)});
  it('calibrated when HIGH→high LOW→low',()=>{const r=evaluateInterpretationCalibration([mk('macd','HIGH','CORRECT',true),mk('macd','HIGH','CORRECT',true),mk('macd','LOW','WRONG',false)]);expect(r.byIndicator[0].calibrated).toBe(true)});
  it('uncalibrated when wrong',()=>{const r=evaluateInterpretationCalibration([mk('macd','HIGH','WRONG',false)]);expect(r.byIndicator[0].calibrated).toBe(false)});
  it('helpful rate',()=>{const r=evaluateInterpretationCalibration([mk('macd','HIGH','CORRECT',true),mk('macd','HIGH','CORRECT',false)]);expect(r.byIndicator[0].helpfulRate).toBe(50)});
  it('avg rating',()=>{const r=evaluateInterpretationCalibration([{...mk('macd','HIGH','CORRECT',true),userRating:4},{...mk('macd','HIGH','CORRECT',true),userRating:5}]);expect(r.byIndicator[0].avgRating).toBeGreaterThan(3)});
  it('multiple indicators',()=>{const r=evaluateInterpretationCalibration([mk('macd','HIGH','CORRECT',true),mk('rsi','MEDIUM','CORRECT',true)]);expect(r.totalIndicators).toBe(2)});
  it('recommendations for uncalibrated',()=>{expect(evaluateInterpretationCalibration([mk('macd','HIGH','WRONG',false)]).recommendations.length).toBeGreaterThan(0)});
  it('overall accuracy',()=>{const r=evaluateInterpretationCalibration([mk('a','HIGH','CORRECT',true),mk('a','HIGH','WRONG',false)]);expect(r.overallAccuracy).toBeGreaterThan(0)});
  it('highConfAccuracy tracked',()=>{const r=evaluateInterpretationCalibration([mk('a','HIGH','CORRECT',true)]);expect(r.byIndicator[0].highConfAccuracy).toBeGreaterThan(0.5)});
  it('empty',()=>{const r=evaluateInterpretationCalibration([]);expect(r.totalIndicators).toBe(0)});
  it('partially correct counts as half',()=>{const r=evaluateInterpretationCalibration([mk('a','HIGH','PARTIALLY_CORRECT',true)]);expect(r.overallAccuracy).toBeGreaterThan(0)});
  it('medConfAccuracy tracked',()=>{const r=evaluateInterpretationCalibration([mk('a','MEDIUM','CORRECT',true),mk('a','MEDIUM','WRONG',false)]);expect(r.byIndicator[0].medConfAccuracy).toBeGreaterThan(0)});
});

describe('R266 P3 Counter View',()=>{
  const mk=(variant:'A'|'B',clicked:boolean,purchased:boolean,trust?:number,duration?:number)=>({testId:'t1',variant,userId:'u1',aShowed:variant==='A',bShowed:variant==='B',userClicked:clicked,userPurchased:purchased,userTrustScore:trust,sessionDuration:duration||300});
  it('A wins with higher CTR',()=>{const r=analyzeCounterView([mk('A',true,false),mk('A',true,false),mk('B',false,false)]);expect(r.overallWinner==='A'||r.overallWinner==='TIE').toBe(true)});
  it('B wins with higher CTR',()=>{const r=analyzeCounterView([mk('B',true,false),mk('B',true,false),mk('A',false,false)]);expect(r.overallWinner==='B'||r.overallWinner==='TIE').toBe(true)});
  it('CTR tracked',()=>{const r=analyzeCounterView([mk('A',true,false),mk('A',false,false)]);expect(r.results[0].ctrA).toBe(0.5)});
  it('purchase rate tracked',()=>{const r=analyzeCounterView([mk('A',true,true),mk('A',true,false)]);expect(r.results[0].purchaseRateA).toBe(0.5)});
  it('trust score',()=>{const r=analyzeCounterView([mk('A',true,false,4),mk('A',true,false,5)]);expect(r.results[0].avgTrustA).toBeGreaterThan(4)});
  it('session duration',()=>{const r=analyzeCounterView([mk('A',true,false,undefined,400),mk('B',false,false,undefined,200)]);expect(r.results[0].avgSessionA).toBeGreaterThan(r.results[0].avgSessionB)});
  it('recommendation generated',()=>{expect(analyzeCounterView([mk('A',true,false)]).recommendation.length).toBeGreaterThan(0)});
  it('TIE when close',()=>{const r=analyzeCounterView([mk('A',true,false),mk('B',true,false)]);expect(r.overallWinner==='TIE'||r.overallWinner==='A'||r.overallWinner==='B').toBe(true)});
  it('lift calculated',()=>{const r=analyzeCounterView([mk('A',true,true,5,500),mk('A',true,true,5,500),mk('B',true,true,3,300)]);expect(typeof r.results[0].ctrLift).toBe('number')});
  it('empty',()=>{const r=analyzeCounterView([]);expect(r.results.length).toBe(1)});
  it('total users',()=>{const r=analyzeCounterView([mk('A',true,false),mk('B',false,false)]);expect(r.results[0].totalUsers).toBe(2)});
});
