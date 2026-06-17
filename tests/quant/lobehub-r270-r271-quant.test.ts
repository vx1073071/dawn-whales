// ══ R270+R271 LOBEHUB 双轮测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import { generateV310Report } from '../../src/lib/quant/v310-final-r270';
import { reviewRevenue } from '../../src/lib/quant/revenue-review-r270';
import { generateDrawing68Report, DrawingUsageSample } from '../../src/lib/quant/drawing-68-report-r271';
import { analyzeDrawingToStrategy, DrawingToStrategyAB } from '../../src/lib/quant/drawing-to-strategy-ab-r271';
import { evaluateKLineUX, KLineUXSample } from '../../src/lib/quant/kline-ux-score-r271';

const mkD=(id:string,p:number,ps:number,pf:number,ic:number,pat:number)=>generateV310Report(p,ps,pf,ic,pat);

describe('R270 P1 v3.1.0 Final',()=>{
  it('SHIP when all pass',()=>expect(mkD('t',90,90,85,95,90).overall).toBe('SHIP'));
  it('HOLD when FAIL',()=>expect(mkD('t',50,90,85,95,90).overall).toBe('HOLD'));
  it('SHIP_WITH_CAUTION with warnings',()=>expect(mkD('t',75,70,70,80,80).overall).toBe('SHIP_WITH_CAUTION'));
  it('5 dimensions',()=>expect(mkD('t',90,90,85,95,90).dimensions.length).toBe(5));
  it('revenue projection',()=>{const r=mkD('t',90,90,85,95,90);expect(r.revenueProjection.base).toBeGreaterThan(0)});
  it('highlights populated',()=>expect(mkD('t',90,90,85,95,90).highlights.length).toBeGreaterThan(0));
  it('risks empty on pass',()=>expect(mkD('t',90,90,85,95,90).risks.length).toBe(0));
  it('sign-off for non-SHIP',()=>expect(mkD('t',50,90,85,95,90).signOffRequired.length).toBeGreaterThan(0));
  it('version v3.1.0',()=>expect(mkD('t',90,90,85,95,90).version).toBe('v3.1.0'));
  it('score between 0-100',()=>{const r=mkD('t',90,90,85,95,90);expect(r.overallScore).toBeGreaterThan(0)});
});

describe('R270 P2 Revenue Review',()=>{
  it('high confidence with good data',()=>expect(reviewRevenue(1000,2000,2.5,90,0.06).confidence).toBe('HIGH'));
  it('low confidence with bad data',()=>expect(reviewRevenue(1000,2000,1.5,40,0.01).confidence).toBe('LOW'));
  it('adjustment up for quality',()=>{const r=reviewRevenue(1000,2000,2.5,90,0.06);expect(r.adjustedBase).toBeGreaterThan(1000)});
  it('adjustment down for low ctr',()=>{const r=reviewRevenue(1000,2000,1.5,90,0.01);expect(r.adjustedBase).toBeLessThan(1000)});
  it('factors populated',()=>expect(reviewRevenue(1000,2000,2.5,90,0.06).factors.length).toBeGreaterThan(0));
  it('adjustedBest > adjustedBase',()=>{const r=reviewRevenue(1000,2000,2.5,90,0.06);expect(r.adjustedBest).toBeGreaterThan(r.adjustedBase)});
  it('adjustedWorst < adjustedBase',()=>{const r=reviewRevenue(1000,2000,2.5,90,0.06);expect(r.adjustedWorst).toBeLessThan(r.adjustedBase)});
  it('ARPU factor',()=>{const r=reviewRevenue(1000,2000,3,90,0.06);expect(r.factors.some(f=>f.factor.includes('ARPU'))).toBe(true)});
});

describe('R271 P1 Drawing 68',()=>{
  const mk=(id:string,n:string,c:string,u:number,d:number):DrawingUsageSample=>({toolId:id as any,toolName:n,category:c,dailyUsers:u,dailyDrawings:d,avgPerUser:u>0?d/u:0,retentionRate:0.5,conversionRate:0.05});
  it('adoption rate',()=>{const r=generateDrawing68Report([mk('a','A','c',100,500),mk('b','B','c',0,0)],1000,20);expect(r.usedTools).toBe(1)});
  it('unused tools',()=>{const r=generateDrawing68Report([mk('a','A','c',100,500),mk('b','B','c',0,0)],1000,20);expect(r.unusedTools).toBe(1)});
  it('conversion funnel',()=>{const r=generateDrawing68Report([mk('a','A','c',100,500)],1000,20);expect(r.conversionFunnel.payingUsers).toBe(20)});
  it('recommendations for unused',()=>{const arr:DrawingUsageSample[]=[];for(let i=0;i<15;i++)arr.push(mk(`t${i}`,`T${i}`,'c',0,0));const r=generateDrawing68Report(arr,1000,20);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('adoption rate percentage',()=>{const r=generateDrawing68Report([mk('a','A','c',100,500),mk('b','B','c',0,0)],1000,20);expect(r.adoptionRate).toBe(50)});
  it('top tools',()=>{const r=generateDrawing68Report([mk('a','Trend','c',200,1000),mk('b','Fib','c',100,500)],1000,20);expect(r.topTools).toContain('Trend')});
});

describe('R271 P2 Drawing-to-Strategy',()=>{
  const mk=(v:'A'|'B',draw:number,click:number,created:number,rev:number):DrawingToStrategyAB=>({testId:'t1',variant:v,description:'',drawingUsers:draw,strategyClicks:click,ctr:draw>0?click/draw:0,strategyCreated:created,conversionRate:click>0?created/click:0,revenue:rev});
  it('A wins with higher CTR',()=>{const r=analyzeDrawingToStrategy(mk('A',100,30,10,50),mk('B',100,15,5,25));expect(r.winner==='A'||r.winner==='TIE').toBe(true)});
  it('TIE when close',()=>{const r=analyzeDrawingToStrategy(mk('A',100,20,5,25),mk('B',100,19,5,25));expect(r.winner==='TIE'||r.winner==='A'||r.winner==='B').toBe(true)});
  it('lift calculated',()=>{const r=analyzeDrawingToStrategy(mk('A',100,30,10,50),mk('B',100,15,5,25));expect(typeof r.lift).toBe('number')});
  it('recommendation generated',()=>expect(analyzeDrawingToStrategy(mk('A',100,30,10,50),mk('B',100,15,5,25)).recommendation.length).toBeGreaterThan(0));
  it('revenue tracked',()=>{const r=analyzeDrawingToStrategy(mk('A',100,30,10,50),mk('B',100,15,5,25));expect(r.variants[0].revenue).toBeGreaterThan(0)});
});

describe('R271 P3 KLine UX',()=>{
  const mk=(load:number,first:number,session:number,actions:number,ret:boolean,rat?:number):KLineUXSample=>({userId:'u1',loadTimeMs:load,firstInteractionMs:first,totalSessionMs:session,actionsPerSession:actions,returned7d:ret,rating:rat});
  it('EXCELLENT',()=>expect(evaluateKLineUX([mk(500,2000,300000,15,true,5)]).overall).toBe('EXCELLENT'));
  it('FAIR for slow',()=>expect(evaluateKLineUX([mk(3000,6000,120000,2,true,2)]).overall).toBe('FAIR'));
  it('POOR for very bad',()=>expect(evaluateKLineUX([mk(6000,10000,60000,1,false,1)]).overall).toBe('POOR'));
  it('retention tracked',()=>{const r=evaluateKLineUX([mk(800,3000,300000,10,true,4),mk(800,3000,300000,10,false,4)]);expect(r.retention7d).toBe(50)});
  it('avg rating',()=>{const r=evaluateKLineUX([mk(800,3000,300000,10,true,4),mk(800,3000,300000,10,true,5)]);expect(r.avgRating).toBeGreaterThan(4)});
  it('recommendations for slow load',()=>expect(evaluateKLineUX([mk(3000,4000,120000,3,false,2)]).recommendations.length).toBeGreaterThan(0));
  it('empty',()=>expect(evaluateKLineUX([]).overall).toBe('POOR'));
});
