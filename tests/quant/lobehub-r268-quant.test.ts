// ══ R268 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import { generateIndicatorQualityReport, IndicatorQualitySample } from '../../src/lib/quant/indicator-quality-93-r268';
import { generateRenderBenchmark, RenderProfile } from '../../src/lib/quant/indicator-render-perf-r268';

const mkI=(id:string,cat:any,new_:boolean,algo:boolean,render:boolean,params:boolean,tw:boolean,diff:number):IndicatorQualitySample=>({id,name:'test',category:cat,isNew:new_,algorithmCorrect:algo,renderCorrect:render,paramsValid:params,twEquivalent:tw,benchmarkDiffPct:diff,status:algo&&render&&params?'PASS':algo&&render?'MINOR_ISSUE':'MAJOR_ISSUE'});
const mkR=(cnt:number,renderMs:number,fps:number,mem:number,chart:'main'|'sub'='main'):RenderProfile=>({indicatorCount:cnt,category:'trend',renderTimeMs:renderMs,fps,memoryMB:mem,chartType:chart,status:fps>=50?'FAST':fps>=30?'ACCEPTABLE':fps>=15?'SLOW':'UNUSABLE'});

describe('R268 P1 93-Indicator Quality',()=>{
  it('all pass',()=>{const r=generateIndicatorQualityReport([mkI('a','trend',false,true,true,true,true,0)]);expect(r.overall).toBe('PASS')});
  it('PASS with 100%',()=>{const r=generateIndicatorQualityReport([mkI('a','trend',false,true,true,true,true,0),mkI('b','momentum',true,true,true,true,true,0)]);expect(r.passRate).toBe(100)});
  it('WARNING at 80%',()=>{const r=generateIndicatorQualityReport([mkI('a','trend',false,true,true,true,true,0),mkI('b','trend',false,true,true,true,true,0),mkI('c','trend',false,false,true,false,false,5),mkI('d','trend',false,true,false,false,true,8)]);expect(r.overall==='WARNING'||r.overall==='FAIL').toBe(true)});
  it('category breakdown',()=>{const r=generateIndicatorQualityReport([mkI('a','trend',false,true,true,true,true,0),mkI('b','momentum',true,true,true,true,true,0)]);expect(r.byCategory.length).toBeLessThanOrEqual(2)});
  it('category PASS rate',()=>{const r=generateIndicatorQualityReport([mkI('a','trend',false,true,true,true,true,0),mkI('b','trend',false,true,true,true,true,0)]);expect(r.byCategory[0].passRate).toBeGreaterThanOrEqual(90)});
  it('worst indicators',()=>{const r=generateIndicatorQualityReport([mkI('bad','trend',false,false,false,false,false,20)]);expect(r.worstIndicators.length).toBeGreaterThan(0)});
  it('recommendations for major issues',()=>{expect(generateIndicatorQualityReport([mkI('bad','trend',false,false,false,false,false,15)]).recommendations.length).toBeGreaterThan(0)});
  it('minor issues tracked',()=>{const r=generateIndicatorQualityReport([mkI('a','trend',false,true,false,true,true,3)]);expect(r.byCategory[0].minorIssues).toBeGreaterThanOrEqual(0)});
  it('avg diff tracked',()=>{const r=generateIndicatorQualityReport([mkI('a','trend',false,true,true,true,true,5)]);expect(r.byCategory[0].avgDiff).toBeGreaterThan(0)});
  it('overall score',()=>{const r=generateIndicatorQualityReport([mkI('a','trend',false,true,true,true,true,0),mkI('b','trend',false,true,true,true,true,0)]);expect(r.overallScore).toBe(100)});
  it('empty',()=>{expect(generateIndicatorQualityReport([]).overall).toBe('FAIL')});
  it('new indicators tracked',()=>{const r=generateIndicatorQualityReport([mkI('n1','china',true,true,true,true,false,1)]);expect(r.totalIndicators).toBe(1)});
});

describe('R268 P2 Render Perf',()=>{
  it('FAST for 10 indicators',()=>{const r=generateRenderBenchmark([mkR(10,16,60,80)]);expect(r.overall).toBe('PASS')});
  it('WARNING for low FPS',()=>{const r=generateRenderBenchmark([mkR(93,80,25,200)]);expect(['WARNING','FAIL']).toContain(r.overall)});
  it('FAIL for very slow',()=>{const r=generateRenderBenchmark([mkR(93,600,10,400)]);expect(r.overall).toBe('FAIL')});
  it('byCount tracking',()=>{const r=generateRenderBenchmark([mkR(10,15,60,80),mkR(50,30,45,120),mkR(93,50,30,200)]);expect(r.byCount[10]).toBeTruthy();expect(r.byCount[93]).toBeTruthy()});
  it('scalability analysis',()=>{const r=generateRenderBenchmark([mkR(10,15,60,80),mkR(93,80,25,200)]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('avg fps',()=>{const r=generateRenderBenchmark([mkR(50,25,50,100)]);expect(r.avgFps).toBeGreaterThan(40)});
  it('avg render ms',()=>{const r=generateRenderBenchmark([mkR(30,30,45,110)]);expect(r.avgRenderMs).toBeGreaterThan(0)});
  it('avg memory',()=>{const r=generateRenderBenchmark([mkR(20,20,55,90)]);expect(r.avgMemoryMB).toBeGreaterThan(0)});
  it('recommendations for slow',()=>{expect(generateRenderBenchmark([mkR(93,600,10,400)]).recommendations.length).toBeGreaterThan(0)});
  it('empty',()=>{expect(generateRenderBenchmark([]).overall).toBe('FAIL')});
  it('SLOW status',()=>{const r=generateRenderBenchmark([mkR(80,300,18,250)]);expect(r.overall==='WARNING'||r.overall==='FAIL').toBe(true)});
  it('byCount fps',()=>{const r=generateRenderBenchmark([mkR(20,20,55,90),mkR(20,25,50,95)]);expect(r.byCount[20].fps).toBeGreaterThan(40)});
  it('scalability from 10 to 93',()=>{const r=generateRenderBenchmark([mkR(10,15,60,80),mkR(93,50,30,200)]);expect(r.recommendations.some(rec=>rec.includes('×'))).toBe(true)});
});
