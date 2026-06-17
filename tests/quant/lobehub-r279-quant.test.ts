// R279 LOBEHUB 测试集 — 24 tests
import { describe, it, expect } from 'vitest';
import { evaluateFactorPKs, FactorPK } from '../../src/lib/quant/factor-pk-quality-r279';
import { evaluateTemplateMarket, FactorTemplate } from '../../src/lib/quant/template-market-quality-r279';
import { evaluateGlobalAllocation, GlobalAllocation } from '../../src/lib/quant/global-allocation-r279';

// P1
const mkPK=(aName:string,aIC:number,aSharpe:number,bName:string,bIC:number,bSharpe:number,winner:string,conf:number):FactorPK=>({aFactor:{name:aName,ic:aIC,ir:aIC*0.5,sharpe:aSharpe},bFactor:{name:bName,ic:bIC,ir:bIC*0.5,sharpe:bSharpe},pkResult:{winner,icEdge:aIC-bIC,irEdge:(aIC-bIC)*0.5,sharpeEdge:aSharpe-bSharpe,confidence:conf},verdict:`${winner} wins with confidence ${conf}`});

describe('R279 Factor PK Quality',()=>{
  it('PASS high confidence',()=>{const r=evaluateFactorPKs([mkPK('动量',0.08,0.9,'价值',0.05,0.6,'动量',0.85),mkPK('质量',0.06,0.8,'规模',0.03,0.4,'质量',0.9),mkPK('反转',0.04,0.5,'波动',0.02,0.3,'反转',0.75)]);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=evaluateFactorPKs([]);expect(r.overall).toBe('FAIL')});
  it('WARNING low confidence',()=>{const r=evaluateFactorPKs([mkPK('a','b',0.05,0.6,'c','d',0.05,0.6,'a','b',0.45)]);expect(r.overall).toBe('WARNING')});
  it('top winners tracked',()=>{const r=evaluateFactorPKs([mkPK('动量',0.08,0.9,'价值',0.05,0.6,'动量',0.85),mkPK('动量',0.08,0.9,'质量',0.06,0.8,'动量',0.9)]);expect(r.topWinners[0].name).toBe('动量');expect(r.topWinners[0].wins).toBe(2)});
  it('upsets detected',()=>{const r=evaluateFactorPKs([mkPK('弱因子',0.02,0.3,'强因子',0.08,1.0,'弱因子',0.3)]);expect(r.upsets.length).toBe(1)});
  it('avg confidence calculated',()=>{const r=evaluateFactorPKs([mkPK('a',0.06,0.8,'c',0.04,0.5,'a',0.75),mkPK('e',0.05,0.6,'g',0.03,0.4,'e',0.85)]);expect(r.avgConfidence).toBe(0.8)});
  it('total PKs correct',()=>{const r=evaluateFactorPKs([mkPK('a','b',0.01,0.3,'c','d',0.01,0.3,'a','b',0.5)]);expect(r.totalPKs).toBe(1)});
  it('recommendations on low conf',()=>{const r=evaluateFactorPKs([mkPK('a','b',0.05,0.6,'c','d',0.05,0.6,'a','b',0.3)]);expect(r.recommendations.length).toBeGreaterThan(0)});
});

// P2
const mkT=(id:string,nameCn:string,authorName:string,category:string,factors:number,rating:number,downloads:number,sharpe:number,flags:string[]=[]):FactorTemplate=>({id,name:id,nameCn,authorId:`auth-${authorName}`,authorName,category,factors:Array(factors).fill('f').map((_,i)=>`f${i}`),factorsCount:factors,downloads,rating,reviewCount:Math.round(downloads*0.1),perfMonths:12,monthlyReturn:sharpe*0.02,maxDrawdown:0.15,sharpe,qualityFlags:flags});

describe('R279 Template Market Quality',()=>{
  it('PASS high quality',()=>{const r=evaluateTemplateMarket([mkT('a','动量模板','张三','momentum',5,4.5,1000,0.8),mkT('b','价值模板','李四','value',4,4.2,800,0.7),mkT('c','成长模板','王五','growth',6,4.0,600,0.6),mkT('d','均衡模板','张三','multi',8,4.8,1500,0.9)]);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=evaluateTemplateMarket([]);expect(r.overall).toBe('FAIL')});
  it('WARNING mixed quality',()=>{const r=evaluateTemplateMarket([mkT('a','a','A','v',3,4.5,500,0.8),mkT('b','b','B','v',3,2.5,100,0.1,['过拟合']),mkT('c','c','C','v',3,2.0,50,-0.2,['数据陈旧'])]);expect(r.overall).toBe('WARNING')});
  it('top creators by templates',()=>{const r=evaluateTemplateMarket([mkT('a','a','张三','v',3,4.5,100,0.8),mkT('b','b','张三','v',3,4.0,200,0.7),mkT('c','c','李四','v',3,4.2,80,0.6)]);expect(r.topCreators[0].authorName).toBe('张三');expect(r.topCreators[0].templates).toBe(2)});
  it('quality distribution',()=>{const r=evaluateTemplateMarket([mkT('a','a','A','v',3,4.5,500,0.8),mkT('b','b','A','v',3,3.5,100,0.1,['bad']),mkT('c','c','A','v',3,2.5,50,-0.3)]);expect(r.qualityDistribution.high).toBe(1);expect(r.qualityDistribution.low).toBe(1)});
  it('worst templates listed',()=>{const r=evaluateTemplateMarket([mkT('a','a','A','v',3,2.5,50,-0.3),mkT('b','b','B','v',3,2.0,20,-0.1)]);expect(r.worstTemplates.length).toBe(2)});
  it('avg rating calculated',()=>{const r=evaluateTemplateMarket([mkT('a','a','A','v',3,4.0,100,0.5),mkT('b','b','A','v',3,5.0,200,0.8)]);expect(r.avgRating).toBe(4.5)});
  it('recommendations on low quality',()=>{const r=evaluateTemplateMarket([mkT('a','a','A','v',3,2.5,50,-0.3,['bad'])]);expect(r.recommendations.length).toBeGreaterThan(0)});
});

// P3
const mkA=(market:string,targetW:number,actualW:number,ytd:number,sharpe:number,hedgeRatio:number=0.9):GlobalAllocation=>({market,targetWeight:targetW,actualWeight:actualW,deviationPct:Math.abs(targetW-actualW),benchmarkWeight:targetW,currency:'USD',hedgeRatio,performance:{ytd,month1:ytd*0.3,month3:ytd*0.6,sharpe}});

describe('R279 Global Allocation',()=>{
  it('PASS low deviation',()=>{const r=evaluateGlobalAllocation([mkA('US',40,40,12,0.8),mkA('CN',15,15,8,0.6),mkA('JP',10,10,5,0.4),mkA('EU',10,10,6,0.5),mkA('IN',8,8,10,0.7),mkA('KR',5,5,3,0.3),mkA('TW',4,4,7,0.6),mkA('BR',3,3,4,0.3),mkA('SA',2,2,2,0.2),mkA('SG',1.5,1.5,3,0.4),mkA('AU',1,1,1,0.2),mkA('HK',0.5,0.5,5,0.5)],14);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=evaluateGlobalAllocation([]);expect(r.overall).toBe('FAIL')});
  it('WARNING moderate deviation',()=>{const r=evaluateGlobalAllocation([mkA('US',40,38,12,0.8),mkA('CN',15,18,8,0.6),mkA('JP',10,8,5,0.4),mkA('EU',10,12,6,0.5),mkA('IN',8,6,10,0.7),mkA('KR',5,8,3,0.3),mkA('TW',4,3,7,0.6),mkA('BR',3,5,4,0.3)],14);expect(r.overall).toBe('WARNING')});
  it('market status reported',()=>{const r=evaluateGlobalAllocation([mkA('US',40,40,12,0.8),mkA('JP',10,12,5,0.4)]);expect(r.markets.length).toBe(2)});
  it('performance summary',()=>{const r=evaluateGlobalAllocation([mkA('US',40,40,12,0.8),mkA('CN',10,10,8,0.6)]);expect(r.performance.totalReturn).toBeGreaterThan(0)});
  it('best/worst market',()=>{const r=evaluateGlobalAllocation([mkA('US',40,40,12,0.8),mkA('JP',10,10,3,0.3)]);expect(r.performance.bestMarket).toBe('US');expect(r.performance.worstMarket).toBe('JP')});
  it('hedge effectiveness',()=>{const r=evaluateGlobalAllocation([mkA('US',40,40,12,0.8,0.95),mkA('CN',10,10,8,0.6,0.85)]);expect(r.hedgeEffectiveness).toBe(90)});
  it('recommendations on low coverage',()=>{const r=evaluateGlobalAllocation([mkA('US',40,40,12,0.8),mkA('CN',10,10,8,0.6)]);expect(r.recommendations.length).toBeGreaterThan(0)});
});
