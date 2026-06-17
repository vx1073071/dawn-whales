// R275 LOBEHUB 测试集 — 30 tests
import { describe, it, expect } from 'vitest';
import { benchmarkGlobal25, GlobalIndicator } from '../../src/lib/quant/global-25-report-r275';
import { generateFullReport, DataSegment } from '../../src/lib/quant/full-data-report-r275';
import { evaluateV320Release, ReleaseChecklist } from '../../src/lib/quant/v320-release-r275';

// ═══ R275 P1: 25全球指标质量终报 ═══
const mkG=(id:string,name:string,market:string,category:string,status:'PASS'|'WARNING'|'FAIL',freshness:number=600000):GlobalIndicator=>({id,name,market,category,value:100,expectedRange:[80,120],dataFreshnessMs:freshness,source:'test',status});

describe('R275 Global 25 Report',()=>{
  it('PASS all indicators good',()=>{const inds=[];for(let i=0;i<25;i++)inds.push(mkG(`g${i}`,`指标${i}`,['HK','CN','JP','IN','BR','KR','TW','EU','SA'][i%9],['volume','short','margin','deriv','breadth'][i%5],'PASS'));const r=benchmarkGlobal25(inds);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkGlobal25([]);expect(r.overall).toBe('FAIL')});
  it('WARNING mid range',()=>{const inds=[];for(let i=0;i<18;i++)inds.push(mkG(`g${i}`,`指标${i}`,'HK','volume','PASS'));for(let i=18;i<25;i++)inds.push(mkG(`g${i}`,`指标${i}`,'HK','volume','FAIL'));const r=benchmarkGlobal25(inds);expect(r.overall).toBe('WARNING')});
  it('counts correct',()=>{const inds=[mkG('a','a','HK','v','PASS'),mkG('b','b','CN','v','PASS'),mkG('c','c','JP','v','WARNING'),mkG('d','d','HK','v','FAIL')];const r=benchmarkGlobal25(inds);expect(r.passCount).toBe(2);expect(r.warningCount).toBe(1);expect(r.failCount).toBe(1)});
  it('by market breakdown',()=>{const inds=[mkG('a','a','HK','v','PASS'),mkG('b','b','HK','v','FAIL'),mkG('c','c','CN','v','PASS')];const r=benchmarkGlobal25(inds);expect(r.byMarket['HK'].total).toBe(2);expect(r.byMarket['CN'].total).toBe(1)});
  it('by category breakdown',()=>{const inds=[mkG('a','a','HK','cat1','PASS'),mkG('b','b','HK','cat1','PASS'),mkG('c','c','CN','cat2','PASS')];const r=benchmarkGlobal25(inds);expect(r.byCategory['cat1'].total).toBe(2);expect(r.byCategory['cat2'].total).toBe(1)});
  it('stale indicators detected',()=>{const r=benchmarkGlobal25([mkG('a','a','HK','v','PASS',7200000)],3600000);expect(r.staleIndicators.length).toBe(1)});
  it('top failures listed',()=>{const inds=[mkG('a','fail1','HK','v','FAIL'),mkG('b','fail2','HK','v','FAIL'),mkG('c','pass','HK','v','PASS')];const r=benchmarkGlobal25(inds);expect(r.topFailures.length).toBe(2)});
  it('pass rate calculated',()=>{const inds=[];for(let i=0;i<20;i++)inds.push(mkG(`g${i}`,`i`,'HK','v','PASS'));for(let i=20;i<25;i++)inds.push(mkG(`g${i}`,`i`,'HK','v','FAIL'));const r=benchmarkGlobal25(inds);expect(r.passRate).toBe(80)});
  it('recommendations on failure',()=>{const inds=[mkG('a','a','HK','v','FAIL'),mkG('b','b','HK','v','FAIL'),mkG('c','c','HK','v','FAIL')];const r=benchmarkGlobal25(inds);expect(r.recommendations.length).toBeGreaterThan(0)});
});

// ═══ R275 P2: 全量数据报告+收入复核 ═══
const mkSeg=(name:string,count:number,quality:number,coverage:number,issues:string[]=[]):DataSegment=>({name,indicatorCount:count,avgQuality:quality,coverageRate:coverage,issues});

describe('R275 Full Data Report',()=>{
  it('PASS all segments good',()=>{const r=generateFullReport([mkSeg('HK',12,90,95),mkSeg('CN',12,88,92),mkSeg('JP',8,87,91),mkSeg('IN',6,85,90),mkSeg('BR',4,92,94),mkSeg('KR',4,89,93),mkSeg('TW',4,91,95),mkSeg('EU',4,86,88),mkSeg('SA',2,90,96)],3000,3.5,0.04);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=generateFullReport([],3000,3.5,0.04);expect(r.overall).toBe('FAIL')});
  it('WARNING moderate quality',()=>{const r=generateFullReport([mkSeg('HK',10,70,80),mkSeg('CN',10,72,82)],3000,3.5,0.04);expect(r.overall).toBe('WARNING')});
  it('total indicators summed',()=>{const r=generateFullReport([mkSeg('HK',10,85,90),mkSeg('CN',5,80,85),mkSeg('JP',3,90,95)],3000,3.5,0.04);expect(r.totalIndicators).toBe(18)});
  it('weighted quality avg',()=>{const r=generateFullReport([mkSeg('HK',10,90,90),mkSeg('CN',5,80,90)],3000,3.5,0.04);expect(r.overallQuality).toBeCloseTo(86.67,1)});
  it('5 revenue scenarios',()=>{const r=generateFullReport([mkSeg('HK',10,90,95)],3000,3.5,0.04);expect(r.revenueScenarios.length).toBe(5)});
  it('expected annual revenue positive',()=>{const r=generateFullReport([mkSeg('HK',10,90,95)],3000,3.5,0.04);expect(r.expectedAnnualRevenue).toBeGreaterThan(0)});
  it('confidence interval',()=>{const r=generateFullReport([mkSeg('HK',10,90,95)],3000,3.5,0.04);expect(r.confidenceInterval[1]).toBeGreaterThan(r.confidenceInterval[0])});
  it('action items populated',()=>{const r=generateFullReport([mkSeg('HK',5,60,70,['数据延迟','覆盖不足'])],3000,3.5,0.04);expect(r.actionItems.length).toBeGreaterThan(0)});
  it('scenario probabilities sum to 1',()=>{const r=generateFullReport([mkSeg('HK',10,90,95)],3000,3.5,0.04);const sum=r.revenueScenarios.reduce((s,x)=>s+x.probability,0);expect(sum).toBeCloseTo(1,2)});
});

// ═══ R275 P3: v3.2.0 发布终报 ═══
const mkCL=(area:string,items:{name:string;status:'DONE'|'PENDING'|'BLOCKED'}[]):ReleaseChecklist=>({area,items:items.map(i=>({...i,owner:'test'}))});

describe('R275 v3.2.0 Release',()=>{
  it('GO all done',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'},{name:'测试',status:'DONE'}]),mkCL('发布',[{name:'部署',status:'DONE'}])],131,125,83,83);expect(r.status).toBe('GO')});
  it('NO_GO blocked',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'},{name:'阻塞项',status:'BLOCKED'}])],131,125,83,83);expect(r.status).toBe('NO_GO')});
  it('CONDITIONAL_GO pending',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'},{name:'文档',status:'PENDING'}])],131,120,83,83);expect(r.status).toBe('CONDITIONAL_GO')});
  it('version v3.2.0',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'}])],131,125,83,83);expect(r.version).toBe('v3.2.0')});
  it('4 rollout phases',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'}])],131,125,83,83);expect(r.rolloutPlan.length).toBe(4)});
  it('signatures included',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'}])],131,125,83,83);expect(r.signatures.length).toBe(3)});
  it('PM signs on GO',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'},{name:'测试',status:'DONE'}]),mkCL('发布',[{name:'部署',status:'DONE'}])],131,125,83,83);expect(r.signatures[0].signed).toBe(true)});
  it('risk assessment for low indicators',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'}])],131,100,83,83);expect(r.riskAssessment.length).toBeGreaterThan(0)});
  it('go no go reason provided',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'}])],131,125,83,83);expect(r.goNoGoReason.length).toBeGreaterThan(0)});
  it('conditional go with pending',()=>{const r=evaluateV320Release([mkCL('数据',[{name:'指标',status:'DONE'},{name:'审查',status:'PENDING'},{name:'文档',status:'PENDING'},{name:'性能',status:'DONE'}])],131,125,83,83);expect(r.status).toBe('CONDITIONAL_GO')});
});
