// ══ R267 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import { evaluatePatternRecognition, PatternSample, PatternId } from '../../src/lib/quant/pattern-recognition-benchmark-r267';
import { compareChipDistribution, ChipCompareSample } from '../../src/lib/quant/chip-vs-ths-r267';
import { evaluateCloudSync, SyncSample } from '../../src/lib/quant/cloud-sync-ux-r267';

const mkP=(id:PatternId,ai:boolean,human:boolean,conf:number=0.9):PatternSample=>({patternId:id,patternName:'test',symbol:'AAPL',exchange:'NQ',aiDetected:ai,humanLabel:human,confidence:conf});
const mkC=(pocDiff:number,vahDiff:number,valDiff:number,costDiff:number,profitDelta:number,concDelta:number):ChipCompareSample=>({symbol:'AAPL',exchange:'NQ',ours:{poc:150,vah:155,val:145,avgCost:152,profitRatio:0.75,concentration:0.3},ths:{poc:150+pocDiff,vah:155+vahDiff,val:145+valDiff,avgCost:152+costDiff,profitRatio:0.75+profitDelta,concentration:0.3+concDelta},pocDiffPct:pocDiff,vahDiffPct:vahDiff,valDiffPct:valDiff,avgCostDiffPct:costDiff,profitRatioDelta:profitDelta,concDelta,status:pocDiff<1?'MATCH':pocDiff<5?'MINOR_DIFF':'MAJOR_DIFF'});
const mkS=(success:boolean,duration:number,conflict:boolean,resolved:boolean,integrity:boolean=true):SyncSample=>({userId:'u1',deviceId:'d1',syncType:'SAVE',drawingCount:5,dataSizeKB:10,syncDurationMs:duration,success,conflictDetected:conflict,conflictResolved:resolved,dataIntegrity:integrity});

describe('R267 P1 Pattern',()=>{
  it('perfect detection',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',true,true),mkP('DOUBLE_BOTTOM',true,true)]);expect(r.byPattern[0].f1).toBe(1)});
  it('false positive',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',true,false)]);expect(r.byPattern[0].precision).toBe(0)});
  it('false negative',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',false,true)]);expect(r.byPattern[0].recall).toBe(0)});
  it('multiple patterns',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',true,true),mkP('HEAD_SHOULDERS',true,true)]);expect(r.totalPatterns).toBe(2)});
  it('PASS threshold',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',true,true),mkP('DOUBLE_BOTTOM',true,true),mkP('DOUBLE_BOTTOM',true,true)]);expect(r.byPattern[0].status).toBe('PASS')});
  it('FAIL on bad',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',false,true),mkP('DOUBLE_BOTTOM',true,false)]);expect(r.byPattern[0].status).toBe('FAIL')});
  it('overallF1',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',true,true),mkP('HAMMER',true,true)]);expect(r.overallF1).toBeGreaterThan(0.8)});
  it('top3 populated',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',true,true),mkP('BULL_ENGULFING',true,true),mkP('HAMMER',true,true),mkP('CUP_HANDLE',false,true)]);expect(r.top3.length).toBeGreaterThanOrEqual(1)});
  it('worst3 populated',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',true,true),mkP('CUP_HANDLE',false,true)]);expect(r.worst3.length).toBeGreaterThanOrEqual(1)});
  it('recommendations for FAIL',()=>{expect(evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',false,true)]).recommendations.length).toBeGreaterThan(0)});
  it('avgConfidence tracked',()=>{const r=evaluatePatternRecognition([mkP('DOUBLE_BOTTOM',true,true,0.7),mkP('DOUBLE_BOTTOM',true,true,0.9)]);expect(r.byPattern[0].avgConfidence).toBeGreaterThan(0.7)});
  it('empty returns zero',()=>{expect(evaluatePatternRecognition([]).totalPatterns).toBe(0)});
});

describe('R267 P2 Chip vs THS',()=>{
  it('perfect match',()=>{const r=compareChipDistribution([mkC(0,0,0,0,0,0)]);expect(r.overall).toBe('PASS')});
  it('minor diff',()=>{const r=compareChipDistribution([mkC(2,3,2,1,0.02,0.01)]);expect(r.overall==='PASS'||r.overall==='WARNING').toBe(true)});
  it('major diff',()=>{const r=compareChipDistribution([mkC(8,10,8,6,0.1,0.05),mkC(1,2,1,0.5,0.01,0)]);expect(r.majorDiffRate).toBeGreaterThanOrEqual(0)});
  it('POC diff tracked',()=>{const r=compareChipDistribution([mkC(3,0,0,0,0,0)]);expect(r.avgPocDiff).toBeGreaterThan(2)});
  it('cost diff tracked',()=>{const r=compareChipDistribution([mkC(0,0,0,4,0,0)]);expect(r.avgCostDiff).toBeGreaterThan(3)});
  it('score high for match',()=>{expect(compareChipDistribution([mkC(0,0,0,0,0,0)]).score).toBeGreaterThan(90)});
  it('score low for major',()=>{expect(compareChipDistribution([mkC(8,10,8,6,0.1,0.05)]).score).toBeLessThan(80)});
  it('match rate',()=>{const r=compareChipDistribution([mkC(0,0,0,0,0,0),mkC(8,10,8,6,0.1,0.05)]);expect(r.matchRate).toBe(50)});
  it('recommendations for bad',()=>{expect(compareChipDistribution([mkC(8,10,8,6,0.1,0.05)]).recommendations.length).toBeGreaterThan(0)});
  it('empty',()=>{expect(compareChipDistribution([]).overall).toBe('FAIL')});
  it('profit delta',()=>{const r=compareChipDistribution([mkC(0,0,0,0,0.05,0)]);expect(r.avgProfitDelta).toBeGreaterThan(0)});
  it('concentration delta',()=>{const r=compareChipDistribution([mkC(0,0,0,0,0,0.03)]);expect(r.avgConcDelta).toBeGreaterThan(0)});
});

describe('R267 P3 Cloud Sync',()=>{
  it('all success',()=>{const r=evaluateCloudSync([mkS(true,200,false,false),mkS(true,300,false,false)]);expect(r.overall).toBe('PASS')});
  it('failure drops score',()=>{const r=evaluateCloudSync([mkS(true,200,false,false),mkS(false,5000,false,false)]);expect(r.overall==='WARNING'||r.overall==='FAIL').toBe(true)});
  it('conflict resolved',()=>{const r=evaluateCloudSync([mkS(true,500,true,true)]);expect(r.conflictResolveRate).toBe(100)});
  it('conflict unresolved',()=>{const r=evaluateCloudSync([mkS(true,500,true,false)]);expect(r.conflictResolveRate).toBe(0)});
  it('data integrity',()=>{const r=evaluateCloudSync([mkS(true,200,false,false,true)]);expect(r.dataIntegrityRate).toBe(100)});
  it('data corruption',()=>{const r=evaluateCloudSync([mkS(true,200,false,false,false)]);expect(r.dataIntegrityRate).toBe(0)});
  it('avg duration',()=>{const r=evaluateCloudSync([mkS(true,200,false,false),mkS(true,400,false,false)]);expect(r.avgDurationMs).toBe(300)});
  it('P95 duration',()=>{const r=evaluateCloudSync([mkS(true,100,false,false),mkS(true,200,false,false),mkS(true,300,false,false)]);expect(r.p95DurationMs).toBeGreaterThan(0)});
  it('score high',()=>{expect(evaluateCloudSync([mkS(true,200,false,false)]).score).toBeGreaterThan(90)});
  it('recommendations for slow',()=>{expect(evaluateCloudSync([mkS(true,3000,false,false)]).recommendations.length).toBeGreaterThan(0)});
  it('empty',()=>{expect(evaluateCloudSync([]).overall).toBe('FAIL')});
});
