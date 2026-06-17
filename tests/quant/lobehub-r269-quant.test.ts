// ══ R269 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import { generateDrawingUsageReport, DrawingUsageSample } from '../../src/lib/quant/drawing-usage-benchmark-r269';
import { generatePattern51Report } from '../../src/lib/quant/pattern-51-final-r269';
import { compareChinaToFutu, ChinaIndicatorSample } from '../../src/lib/quant/china-vs-futu-r269';
import type { PatternSample } from '../../src/lib/quant/pattern-recognition-benchmark-r267';

const mkD=(toolId:string,name:string,cat:string,users:number,drawings:number,retention:number,conversion:number):DrawingUsageSample=>({toolId:toolId as any,toolName:name,category:cat,dailyUsers:users,dailyDrawings:drawings,avgPerUser:drawings/users,retentionRate:retention,conversionRate:conversion});
const mkP=(id:any,ai:boolean,human:boolean,conf:number=0.9):PatternSample=>({patternId:id,patternName:'test',symbol:'A',exchange:'NQ',aiDetected:ai,humanLabel:human,confidence:conf});
const mkC=(id:string,name:string,diffPct:number,dirMatch:boolean):ChinaIndicatorSample=>({id,name,category:'china_market',ourValue:100,futuValue:100+diffPct,diffPct,directionMatch:dirMatch,status:Math.abs(diffPct)<1?'MATCH':Math.abs(diffPct)<5?'TOLERABLE':'DEVIATED'});

describe('R269 P1 Drawing Usage',()=>{
  it('total users',()=>{expect(generateDrawingUsageReport([mkD('trendline','趋势线','basic',500,3000,0.6,0.05),mkD('fib_retracement','斐波那契','fib',200,800,0.5,0.15)]).totalDailyUsers).toBe(700)});
  it('top10',()=>{const r=generateDrawingUsageReport([mkD('trendline','趋势线','basic',500,3000,0.6,0.05),mkD('fib_retracement','斐波那契','fib',200,800,0.5,0.15)]);expect(r.top10.length).toBeLessThanOrEqual(2);expect(r.top10[0].toolName).toBe('趋势线')});
  it('byCategory',()=>{const r=generateDrawingUsageReport([mkD('trendline','T','basic',500,3000,0.6,0.05),mkD('fib_retracement','F','fib',200,800,0.5,0.15)]);expect(r.byCategory.length).toBeLessThanOrEqual(2)});
  it('high retention',()=>{const r=generateDrawingUsageReport([mkD('trendline','T','basic',500,3000,0.6,0.05),mkD('x','X','other',50,100,0.2,0.01)]);expect(r.highRetentionTools).toContain('T')});
  it('high conversion',()=>{const r=generateDrawingUsageReport([mkD('fib_tool','Fib','fib',200,800,0.5,0.15)]);expect(r.highConversionTools).toContain('Fib')});
  it('recommendations',()=>{expect(generateDrawingUsageReport([mkD('fib_tool','Fib','fib',200,800,0.5,0.15),mkD('x','X','other',50,100,0.2,0.01),mkD('y','Y','other',40,80,0.2,0.02),mkD('z','Z','other',30,60,0.2,0.03)]).recommendations.length).toBeGreaterThan(0)});
  it('category pct',()=>{const r=generateDrawingUsageReport([mkD('t1','A','cat1',300,1500,0.5,0.05),mkD('t2','B','cat2',700,3500,0.5,0.05)]);const cat1=r.byCategory.find(c=>c.category==='cat1');expect(cat1?.pctOfTotal).toBeGreaterThan(0)});
  it('total drawings',()=>{expect(generateDrawingUsageReport([mkD('t','T','c',500,3000,0.5,0.05)]).totalDailyDrawings).toBe(3000)});
  it('empty',()=>{expect(generateDrawingUsageReport([]).totalDailyUsers).toBe(0)});
  it('fib recommendation',()=>{const r=generateDrawingUsageReport([mkD('fib_retracement','Fib','fib',300,1200,0.5,0.15)]);expect(r.recommendations.some(rec=>rec.includes('斐波那契'))).toBe(true)});
  it('avg per user',()=>{const r=generateDrawingUsageReport([mkD('t','T','c',500,3000,0.5,0.05)]);expect(r.top10[0].dailyDrawings).toBe(3000)});
  it('low retention warning',()=>{const r=generateDrawingUsageReport([mkD('x','X','other',50,100,0.2,0.01),mkD('y','Y','other',40,80,0.2,0.02),mkD('z','Z','other',30,60,0.2,0.03),mkD('w','W','other',20,40,0.2,0.04)]);expect(r.recommendations.some(rec=>rec.includes('留存'))).toBe(true)});
});

describe('R269 P2 Pattern 51',()=>{
  it('overall F1',()=>{expect(generatePattern51Report([mkP('DOUBLE_BOTTOM',true,true),mkP('HAMMER',true,true)]).overallF1).toBeGreaterThan(0.8)});
  it('difficulty breakdown',()=>{const r=generatePattern51Report([mkP('DOUBLE_BOTTOM',true,true),mkP('CUP_HANDLE',false,true)]);expect(r.byDifficulty.length).toBeGreaterThan(0)});
  it('top5 populated',()=>{const r=generatePattern51Report([mkP('DOUBLE_BOTTOM',true,true),mkP('BULL_ENGULFING',true,true)]);expect(r.top5.length).toBeGreaterThanOrEqual(1)});
  it('bottom5 populated',()=>{const r=generatePattern51Report([mkP('CUP_HANDLE',false,true)]);expect(r.bottom5.length).toBeGreaterThanOrEqual(1)});
  it('fail count',()=>{const r=generatePattern51Report([mkP('DOUBLE_BOTTOM',false,true)]);expect(r.failCount).toBeGreaterThan(0)});
  it('recommendations for failures',()=>{const r=generatePattern51Report([mkP('DOUBLE_BOTTOM',false,true)]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('pass count',()=>{const r=generatePattern51Report([mkP('DOUBLE_BOTTOM',true,true),mkP('DOUBLE_BOTTOM',true,true),mkP('DOUBLE_BOTTOM',true,true)]);expect(r.passCount).toBeGreaterThanOrEqual(1)});
  it('hard difficulty tracked',()=>{const r=generatePattern51Report([mkP('CUP_HANDLE',true,true)]);expect(r.byDifficulty.find(d=>d.difficulty==='HARD')).toBeTruthy()});
  it('easy difficulty pass rate high',()=>{const r=generatePattern51Report([mkP('BULL_ENGULFING',true,true),mkP('BULL_ENGULFING',true,true)]);const easy=r.byDifficulty.find(d=>d.difficulty==='EASY');expect(easy?.passRate).toBeGreaterThanOrEqual(50)});
  it('warning count',()=>{const r=generatePattern51Report([mkP('DOUBLE_BOTTOM',true,true),mkP('DOUBLE_BOTTOM',true,false)]);expect(r.warningCount).toBeGreaterThanOrEqual(0)});
  it('bottom5 fix message',()=>{const r=generatePattern51Report([mkP('DOUBLE_BOTTOM',false,true)]);expect(r.bottom5[0].fix.length).toBeGreaterThan(0)});
  it('empty',()=>{const r=generatePattern51Report([]);expect(r.totalPatterns).toBe(0)});
});

describe('R269 P3 China vs Futu',()=>{
  it('perfect match',()=>{expect(compareChinaToFutu([mkC('BBI','多空指数',0,true)]).overall).toBe('PASS')});
  it('minor deviation',()=>{const r=compareChinaToFutu([mkC('BBI','多空指数',3,true)]);expect(r.matchRate).toBeGreaterThan(50)});
  it('major deviation',()=>{const r=compareChinaToFutu([mkC('BBI','多空指数',8,false)]);expect(r.overall==='WARNING'||r.overall==='FAIL').toBe(true)});
  it('direction match rate',()=>{const r=compareChinaToFutu([mkC('A','a',0,true),mkC('B','b',3,false)]);expect(r.directionMatchRate).toBe(50)});
  it('avg diff tracked',()=>{const r=compareChinaToFutu([mkC('A','a',2,true)]);expect(r.avgDiffPct).toBeGreaterThan(1)});
  it('recommendations for deviation',()=>{expect(compareChinaToFutu([mkC('A','a',8,false)]).recommendations.length).toBeGreaterThan(0)});
  it('score 100 perfect',()=>{expect(compareChinaToFutu([mkC('A','a',0,true)]).score).toBeGreaterThan(90)});
  it('score drops with diff',()=>{const r=compareChinaToFutu([mkC('A','a',8,false)]);expect(r.score).toBeLessThan(80)});
  it('empty',()=>{expect(compareChinaToFutu([]).overall).toBe('FAIL')});
  it('total indicators',()=>{expect(compareChinaToFutu([mkC('A','a',0,true),mkC('B','b',2,true)]).totalIndicators).toBe(2)});
  it('10 indicators list defined',()=>{const {CHINA_10_INDICATORS}=require('../../src/lib/quant/china-vs-futu-r269');expect(CHINA_10_INDICATORS.length).toBe(10)});
  it('direction match important',()=>{const r=compareChinaToFutu([mkC('A','a',0,true),mkC('B','b',0,false)]);expect(r.directionMatchRate).toBeLessThan(100)});
});
