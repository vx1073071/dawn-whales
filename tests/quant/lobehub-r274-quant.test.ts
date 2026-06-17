// R274 LOBEHUB 测试集 — 30 tests
import { describe, it, expect } from 'vitest';
import { benchmarkHKCN12, HKCNIndicator } from '../../src/lib/quant/hk-cn-12-benchmark-r274';
import { evaluateCrossMarket, CrossMarketLink } from '../../src/lib/quant/cross-market-report-r274';
import { evaluateFXRisk, FXExposure } from '../../src/lib/quant/fx-risk-r274';

// R274 P1
const mkHK=(code:string,name:string,category:string,value:number,dev:number):HKCNIndicator=>({market:'HK',code,name,category,value,benchmark:value*(1+dev/100),deviationPct:dev});
const mkCN=(code:string,name:string,category:string,value:number,dev:number):HKCNIndicator=>({market:'CN',code,name,category,value,benchmark:value*(1+dev/100),deviationPct:dev});

describe('R274 HK/CN 12 Indicators',()=>{
  it('PASS high coverage low deviation',()=>{const hk=[mkHK('A','a','v',1000,5),mkHK('B','b','v',30,3),mkHK('C','c','v',500,4),mkHK('D','d','v',200,6),mkHK('E','e','v',5,2),mkHK('F','f','v',60,7)];const cn=[mkCN('G','g','v',50,8),mkCN('H','h','v',2000,5),mkCN('I','i','v',800,4),mkCN('J','j','v',5000,6),mkCN('K','k','v',15,3),mkCN('L','l','v',1.5,2)];const r=benchmarkHKCN12(hk,cn,{indicatorCount:6},{indicatorCount:6});expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkHKCN12([],[],{indicatorCount:6},{indicatorCount:6});expect(r.overall).toBe('FAIL')});
  it('splits HK/CN correctly',()=>{const r=benchmarkHKCN12([mkHK('A','a','v',100,5),mkHK('B','b','v',200,10)],[mkCN('C','c','v',300,3)],{indicatorCount:2},{indicatorCount:1});expect(r.hkIndicators.length).toBe(2);expect(r.cnIndicators.length).toBe(1)});
  it('avg deviation tracked',()=>{const r=benchmarkHKCN12([mkHK('A','a','v',100,10),mkHK('B','b','v',200,20)],[mkCN('C','c','v',300,5)],{indicatorCount:2},{indicatorCount:1});expect(r.hkAvgDeviation).toBe(15);expect(r.cnAvgDeviation).toBe(5)});
  it('HK coverage vs Futu',()=>{const r=benchmarkHKCN12([mkHK('A','a','v',100,5),mkHK('B','b','v',200,10),mkHK('C','c','v',300,8)],[],{indicatorCount:6},{indicatorCount:0});expect(r.hkCoverageVsFutu.matchRate).toBe(50)});
  it('CN coverage vs THS',()=>{const r=benchmarkHKCN12([],[mkCN('A','a','v',100,5),mkCN('B','b','v',200,3),mkCN('C','c','v',300,7),mkCN('D','d','v',400,2)],{indicatorCount:0},{indicatorCount:8});expect(r.cnCoverageVsTHS.matchRate).toBe(50)});
  it('WARNING mid range',()=>{const r=benchmarkHKCN12([mkHK('A','a','v',100,5),mkHK('B','b','v',200,10),mkHK('C','c','v',300,8),mkHK('D','d','v',400,12),mkHK('E','e','v',500,15)],[mkCN('F','f','v',100,5),mkCN('G','g','v',200,10),mkCN('H','h','v',300,12)],{indicatorCount:6},{indicatorCount:4});expect(r.overall).toBe('WARNING')});
  it('recommendations on low coverage',()=>{const r=benchmarkHKCN12([mkHK('A','a','v',100,5)],[],{indicatorCount:10},{indicatorCount:0});expect(r.recommendations.length).toBeGreaterThan(0)});
});

// R274 P2
const mkLink=(from:string,to:string,cor:number,sig:'HIGH'|'MEDIUM'|'LOW',dir:'POSITIVE'|'NEGATIVE'|'NEUTRAL',lag:number=0):CrossMarketLink=>({fromMarket:from,toMarket:to,correlation:cor,pValue:0.01,lagDays:lag,direction:dir,significance:sig});

describe('R274 Cross Market Linkage',()=>{
  it('PASS strong linkage',()=>{const r=evaluateCrossMarket([mkLink('HK','CN',0.85,'HIGH','POSITIVE'),mkLink('HK','JP',0.72,'HIGH','POSITIVE'),mkLink('CN','KR',0.68,'HIGH','POSITIVE'),mkLink('HK','IN',0.55,'MEDIUM','POSITIVE'),mkLink('JP','KR',0.78,'HIGH','POSITIVE')]);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=evaluateCrossMarket([]);expect(r.overall).toBe('FAIL')});
  it('FAIL weak correlations',()=>{const r=evaluateCrossMarket([mkLink('HK','CN',0.2,'LOW','NEUTRAL'),mkLink('JP','KR',0.15,'LOW','NEUTRAL')]);expect(r.overall).toBe('FAIL')});
  it('WARNING moderate',()=>{const r=evaluateCrossMarket([mkLink('HK','CN',0.55,'MEDIUM','POSITIVE'),mkLink('HK','JP',0.45,'MEDIUM','POSITIVE')]);expect(r.overall).toBe('WARNING')});
  it('avg correlation calculated',()=>{const r=evaluateCrossMarket([mkLink('A','B',0.5,'HIGH','POSITIVE'),mkLink('C','D',0.7,'HIGH','POSITIVE')]);expect(r.avgCorrelation).toBe(0.6)});
  it('significant links counted',()=>{const r=evaluateCrossMarket([mkLink('HK','CN',0.8,'HIGH','POSITIVE'),mkLink('HK','JP',0.5,'MEDIUM','POSITIVE'),mkLink('CN','KR',0.7,'HIGH','POSITIVE'),mkLink('JP','IN',0.6,'HIGH','POSITIVE')]);expect(r.significantLinks).toBe(3)});
  it('top links sorted by abs correlation',()=>{const r=evaluateCrossMarket([mkLink('HK','CN',0.5,'HIGH','POSITIVE'),mkLink('JP','KR',-0.9,'HIGH','NEGATIVE')]);expect(Math.abs(r.topLinks[0].correlation)).toBeGreaterThanOrEqual(Math.abs(r.topLinks[1].correlation))});
  it('recommendations on low corr',()=>{const r=evaluateCrossMarket([mkLink('A','B',0.1,'LOW','NEUTRAL')]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('stale data allows',()=>{const r=evaluateCrossMarket([mkLink('HK','CN',0.7,'HIGH','POSITIVE',5)]);expect(r.dataFreshness.staleHours).toBeGreaterThanOrEqual(0)});
});

// R274 P3
const mkFX=(pair:string,pos:number,pnl:number,hedge:number,v:number,stress:number):FXExposure=>({pair,position:pos,pnl,hedgeRatio:hedge,var95:v,stressLoss:stress,correlationToMarket:0.3});

describe('R274 FX Risk Precision',()=>{
  it('PASS well hedged',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,50000,0.96,200000,500000),mkFX('EUR/CNY',8000000,30000,0.97,150000,400000),mkFX('JPY/CNY',5000000,15000,0.95,100000,250000)],0.95);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=evaluateFXRisk([],0.95);expect(r.overall).toBe('FAIL')});
  it('WARNING moderate hedge',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,50000,0.75,500000,800000),mkFX('EUR/CNY',8000000,30000,0.72,400000,600000)],0.95);expect(r.overall).toBe('WARNING')});
  it('FAIL poor hedge',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,50000,0.5,1000000,1500000)],0.95);expect(r.overall).toBe('FAIL')});
  it('total exposure calculated',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,50000,0.9,200000,500000),mkFX('EUR/CNY',-5000000,-20000,0.9,100000,300000)],0.95);expect(r.totalExposure).toBe(15000000)});
  it('net PnL tracked',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,50000,0.9,100000,200000),mkFX('EUR/CNY',5000000,-10000,0.9,50000,100000)],0.95);expect(r.netPnl).toBe(40000)});
  it('VaR95 aggregated',()=>{const r=evaluateFXRisk([mkFX('A',100000,1000,0.9,50000,100000),mkFX('B',100000,500,0.9,30000,50000)],0.95);expect(r.var95Total).toBe(80000)});
  it('stress test max loss',()=>{const r=evaluateFXRisk([mkFX('A',100000,1000,0.9,10000,500000),mkFX('B',100000,500,0.9,5000,300000)],0.95);expect(r.stressTestMaxLoss).toBe(800000)});
  it('top exposures by position',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,50000,0.9,50000,100000),mkFX('EUR/CNY',5000000,20000,0.9,30000,50000)],0.95);expect(Math.abs(r.topExposures[0].position)).toBeGreaterThanOrEqual(Math.abs(r.topExposures[1].position))});
  it('hedge effectiveness tracked',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,10000,0.85,200000,500000),mkFX('EUR/CNY',5000000,5000,0.95,100000,300000)],0.95);expect(r.hedgeEffectiveness).toBe(90)});
  it('recommendations on poor hedge',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,50000,0.5,1000000,1500000)],0.95);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('PASS with benchmark=0.8',()=>{const r=evaluateFXRisk([mkFX('USD/CNY',10000000,50000,0.85,200000,500000)],0.8);expect(r.overall).toBe('PASS')});
});
