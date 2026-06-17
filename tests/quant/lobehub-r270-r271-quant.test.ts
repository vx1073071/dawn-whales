// R270+R271 LOBEHUB 测试集 — 30 tests
import { describe, it, expect } from 'vitest';
import { genV310 } from '../../src/lib/quant/v310-final-r270';
import { reviewRevenue } from '../../src/lib/quant/revenue-review-r270';
import { generateDrawing68Report } from '../../src/lib/quant/drawing-68-report-r271';
import { analyzeDrawingToStrategy } from '../../src/lib/quant/drawing-to-strategy-ab-r271';
import { evaluateKLineUX } from '../../src/lib/quant/kline-ux-score-r271';

describe('R270 v3.1.0 Final',()=>{
  it('SHIP on all pass',()=>expect(genV310(90,90,85,95,90).overall).toBe('SHIP'));
  it('SHIP_WITH_CAUTION',()=>expect(genV310(75,75,80,85,70).overall).toBe('SHIP_WITH_CAUTION'));
  it('HOLD on fail',()=>expect(genV310(50,90,80,90,85).overall).toBe('HOLD'));
  it('5 dimensions',()=>expect(genV310(90,90,85,95,90).dimensions.length).toBe(5));
  it('revenue projection',()=>expect(genV310(90,90,85,95,90).revenue.base).toBeGreaterThan(0));
  it('highlights populated',()=>expect(genV310(90,90,85,95,90).highlights.length).toBeGreaterThan(0));
  it('risks empty on pass',()=>expect(genV310(90,90,85,95,90).risks.length).toBe(0));
  it('risks on fail',()=>{const r=genV310(50,90,80,90,85);expect(r.risks.length).toBeGreaterThan(0)});
  it('signOff for non-SHIP',()=>expect(genV310(50,90,80,90,85).signOff.length).toBeGreaterThan(0));
  it('no signOff for SHIP',()=>expect(genV310(90,90,85,95,90).signOff.length).toBe(0));
  it('score 0-100',()=>{const r=genV310(90,90,85,95,90);expect(r.overallScore).toBeGreaterThanOrEqual(0)});
});

describe('R270 Revenue Review',()=>{
  it('HIGH confidence',()=>expect(reviewRevenue(5000,2000,2.5,85,0.05).confidence).toBe('HIGH'));
  it('LOW confidence',()=>expect(reviewRevenue(5000,1000,1,50,0.01).confidence).toBe('LOW'));
  it('adjustment factors',()=>{const r=reviewRevenue(5000,2000,2.5,85,0.05);expect(r.factors.length).toBeGreaterThan(0)});
  it('adjusted > base when good',()=>{const r=reviewRevenue(5000,2000,2.5,90,0.06);expect(r.adjustedBase).toBeGreaterThan(5000)});
  it('adjusted < base when bad',()=>{const r=reviewRevenue(5000,1000,1,50,0.01);expect(r.adjustedBase).toBeLessThan(5000)});
  it('best > base',()=>{const r=reviewRevenue(5000,2000,2,70,0.03);expect(r.adjustedBest).toBeGreaterThan(r.adjustedBase)});
  it('worst < base',()=>{const r=reviewRevenue(5000,2000,2,70,0.03);expect(r.adjustedWorst).toBeLessThan(r.adjustedBase)});
});

describe('R271 Drawing 68',()=>{
  const mkD=(id:string,name:string,users:number)=>({toolId:id as any,toolName:name,category:'basic',dailyUsers:users,dailyDrawings:users*5,avgPerUser:5,retentionRate:0.5,conversionRate:0.05});
  it('adoption rate',()=>{const r=generateDrawing68Report([mkD('a','线1',100),mkD('b','线2',50),mkD('c','线3',0)],1000,10);expect(r.adoptionRate).toBeGreaterThan(50)});
  it('unused tools detected',()=>{const r=generateDrawing68Report([mkD('a','线1',100),mkD('b','线2',0)],500,5);expect(r.unusedTools).toBeGreaterThan(0)});
  it('top tools',()=>{const r=generateDrawing68Report([mkD('a','趋势线',500),mkD('b','水平线',300)],1000,20);expect(r.topTools).toContain('趋势线')});
  it('conversion funnel',()=>{const r=generateDrawing68Report([mkD('a','T',200)],500,10);expect(r.conversionFunnel.conversionRate).toBeGreaterThan(0)});
  it('recommendations for unused',()=>{const r=generateDrawing68Report([mkD('a','T',100),mkD('b','X',0),mkD('c','Y',0),mkD('d','Z',0),mkD('e','W',0),mkD('f','V',0),mkD('g','U',0),mkD('h','T',0),mkD('i','S',0),mkD('j','R',0),mkD('k','Q',0)]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('unusedTools_ list',()=>{const r=generateDrawing68Report([mkD('a','T',100),mkD('b','未用',0)],200,5);expect(r.unusedTools_).toContain('未用')});
});

describe('R271 Drawing→Strategy',()=>{
  it('A wins',()=>{const r=analyzeDrawingToStrategy({testId:'t',variant:'A',description:'A',drawingUsers:100,strategyClicks:30,ctr:0.3,strategyCreated:10,conversionRate:0.1,revenue:15},{testId:'t',variant:'B',description:'B',drawingUsers:100,strategyClicks:15,ctr:0.15,strategyCreated:5,conversionRate:0.05,revenue:7});expect(r.winner).toBe('A')});
  it('B wins',()=>{const r=analyzeDrawingToStrategy({testId:'t',variant:'A',description:'A',drawingUsers:100,strategyClicks:10,ctr:0.1,strategyCreated:3,conversionRate:0.03,revenue:4},{testId:'t',variant:'B',description:'B',drawingUsers:100,strategyClicks:30,ctr:0.3,strategyCreated:12,conversionRate:0.12,revenue:18});expect(r.winner).toBe('B')});
  it('TIE when close',()=>{const r=analyzeDrawingToStrategy({testId:'t',variant:'A',description:'A',drawingUsers:100,strategyClicks:20,ctr:0.2,strategyCreated:8,conversionRate:0.08,revenue:10},{testId:'t',variant:'B',description:'B',drawingUsers:100,strategyClicks:20,ctr:0.2,strategyCreated:8,conversionRate:0.08,revenue:10});expect(r.winner).toBe('TIE')});
  it('lift calculated',()=>{const r=analyzeDrawingToStrategy({testId:'t',variant:'A',description:'A',drawingUsers:100,strategyClicks:30,ctr:0.3,strategyCreated:10,conversionRate:0.1,revenue:15},{testId:'t',variant:'B',description:'B',drawingUsers:100,strategyClicks:15,ctr:0.15,strategyCreated:5,conversionRate:0.05,revenue:7});expect(r.lift).toBeGreaterThan(0)});
  it('recommendation generated',()=>{const r=analyzeDrawingToStrategy({testId:'t',variant:'A',description:'A',drawingUsers:100,strategyClicks:30,ctr:0.3,strategyCreated:10,conversionRate:0.1,revenue:15},{testId:'t',variant:'B',description:'B',drawingUsers:100,strategyClicks:15,ctr:0.15,strategyCreated:5,conversionRate:0.05,revenue:7});expect(r.recommendation.length).toBeGreaterThan(0)});
  it('2 variants',()=>{const r=analyzeDrawingToStrategy({testId:'t',variant:'A',description:'A',drawingUsers:100,strategyClicks:20,ctr:0.2,strategyCreated:5,conversionRate:0.05,revenue:8},{testId:'t',variant:'B',description:'B',drawingUsers:100,strategyClicks:20,ctr:0.2,strategyCreated:5,conversionRate:0.05,revenue:8});expect(r.variants.length).toBe(2)});
});

describe('R271 KLine UX',()=>{
  const mkK=(load:number,first:number,session:number,actions:number,ret:boolean,rating?:number)=>({userId:'u1',loadTimeMs:load,firstInteractionMs:first,totalSessionMs:session,actionsPerSession:actions,returned7d:ret,rating});
  it('EXCELLENT',()=>{expect(evaluateKLineUX([mkK(500,2000,120000,8,true,5)]).overall).toBe('EXCELLENT')});
  it('POOR',()=>{expect(evaluateKLineUX([mkK(4000,8000,30000,2,false,1)]).overall).toBe('POOR')});
  it('avgLoad',()=>{expect(evaluateKLineUX([mkK(1000,3000,60000,5,true,4),mkK(2000,4000,90000,4,false,3)]).avgLoadMs).toBe(1500)});
  it('retention',()=>{expect(evaluateKLineUX([mkK(500,2000,60000,5,true,4),mkK(600,2500,60000,5,false,4)]).retention7d).toBe(50)});
  it('recommendations for slow',()=>{expect(evaluateKLineUX([mkK(4000,8000,30000,2,false,1)]).recommendations.length).toBeGreaterThan(0)});
  it('avgRating',()=>{expect(evaluateKLineUX([mkK(500,2000,60000,5,true,4),mkK(600,2500,60000,5,false,5)]).avgRating).toBe(4.5)});
  it('empty',()=>{expect(evaluateKLineUX([]).overall).toBe('POOR')});
});
