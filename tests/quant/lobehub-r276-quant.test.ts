// R276 LOBEHUB 测试集 — 20 tests
import { describe, it, expect } from 'vitest';
import { evaluateDedupQuality, DedupedFactor } from '../../src/lib/quant/dedup-quality-benchmark-r276';
import { benchmarkAShare20, AShareFactor } from '../../src/lib/quant/ashare-20-vs-competitors-r276';

const mkF=(id:string,nameCn:string,category:string,market:string,quality:number,status:'PASS'|'WARNING'|'FAIL'='PASS'):DedupedFactor=>({id,name:id,nameCn,category,market,mergedFrom:[`old-${id}`],value:100,expectedRange:[80,120],dataFreshnessMs:600000,qualityScore:quality,coverageRate:90,status,issues:status==='FAIL'?['质量问题']:[]});

describe('R276 Dedup Quality',()=>{
  const mg=[{groupName:'GlobalVIX',from:['jp-vi','kr-vi','tw-vi','eu-vi','in-vi','br-iv'],to:'global-vix-unified',reason:'合并6个市场VIX为一'}];
  it('PASS dedup working',()=>{const fs=[mkF('v1','a','volatility','JP',95),mkF('v2','b','volatility','KR',92),mkF('v3','c','volatility','TW',90),mkF('v4','d','volatility','EU',93),mkF('v5','e','volatility','IN',88),mkF('v6','f','volatility','BR',85),mkF('v7','g','credit','JP',90),mkF('v8','h','deriv','IN',91)];const r=evaluateDedupQuality(fs,mg);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=evaluateDedupQuality([],[]);expect(r.overall).toBe('FAIL')});
  it('WARNING low pass rate',()=>{const fs=[mkF('a','a','v','HK',60,'FAIL'),mkF('b','b','v','HK',80),mkF('c','c','v','HK',85),mkF('d','d','v','HK',90),mkF('e','e','v','HK',90),mkF('f','f','v','HK',90)];const r=evaluateDedupQuality(fs,[{groupName:'test',from:['a','b','c','d','e','f'],to:'test',reason:'test'}]);expect(r.overall).toBe('WARNING')});
  it('dedup stats correct',()=>{const r=evaluateDedupQuality([mkF('a','a','v','HK',90)],[{groupName:'g',from:['f1','f2','f3'],to:'g',reason:'r'}]);expect(r.dedup.beforeFileCount).toBe(3);expect(r.dedup.afterFileCount).toBe(1)});
  it('removed duplicates counted',()=>{const r=evaluateDedupQuality([mkF('a','a','v','HK',90),mkF('b','b','v','CN',85)],[{groupName:'g',from:['f1','f2','f3','f4'],to:'g',reason:'r'}]);expect(r.dedup.removedDuplicates).toBe(3)});
  it('by category breakdown',()=>{const r=evaluateDedupQuality([mkF('a','a','volatility','JP',90),mkF('b','b','volatility','KR',85),mkF('c','c','credit','JP',80)],mg);expect(r.byCategory['volatility'].total).toBe(2);expect(r.byCategory['credit'].total).toBe(1)});
  it('by market breakdown',()=>{const r=evaluateDedupQuality([mkF('a','a','v','JP',90),mkF('b','b','v','KR',85),mkF('c','c','v','JP',80)],mg);expect(r.byMarket['JP'].total).toBe(2);expect(r.byMarket['KR'].total).toBe(1)});
  it('worst factors listed',()=>{const r=evaluateDedupQuality([mkF('a','a','v','HK',50,'FAIL'),mkF('b','b','v','HK',55,'FAIL'),mkF('c','c','v','HK',90)],mg);expect(r.worstFactors.length).toBe(2)});
  it('recommendations on issues',()=>{const r=evaluateDedupQuality([mkF('a','a','v','HK',50,'FAIL'),mkF('b','b','v','HK',55,'FAIL')],mg);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('merged groups tracked',()=>{const r=evaluateDedupQuality([mkF('a','a','v','HK',90)],mg);expect(r.mergedGroups.length).toBe(1)});
});

const mkAS=(id:string,nameCn:string,category:string,demand:number,ths:boolean,em:boolean,futu:boolean,accuracy:number=95):AShareFactor=>({id,name:id,nameCn,category,value:100,unit:'%',competitorAvailable:{ths,eastmoney:em,futu},ourAdvantage:'AI解读',userDemandScore:demand,accuracy});

describe('R276 AShare20 vs Competitors',()=>{
  it('PASS high coverage + unique',()=>{const fs=[mkAS('a','涨停家数','limit',90,true,true,true),mkAS('b','炸板率','limit',85,false,false,false),mkAS('c','封单强度','limit',88,false,false,false),mkAS('d','连板高度','limit',92,true,false,false),mkAS('e','主力净流入','flow',95,true,true,true),mkAS('f','北向资金','flow',95,true,true,false),mkAS('g','游资动向','flow',90,false,false,false),mkAS('h','筹码集中度','chip',80,true,false,true),mkAS('i','龙虎榜','lhb',93,true,true,true),mkAS('j','融资余额','margin',75,true,true,true)];const r=benchmarkAShare20(fs,{total:10,factorNames:['涨停家数','主力净流入','北向资金','龙虎榜','融资余额']},{total:8},{total:8});expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkAShare20([],{total:15,factorNames:[]},{total:10},{total:10});expect(r.overall).toBe('FAIL')});
  it('WARNING low coverage',()=>{const r=benchmarkAShare20([mkAS('a','涨停家数','limit',80,true,true,false),mkAS('b','炸板率','limit',70,false,false,false),mkAS('c','封单','limit',75,false,false,false),mkAS('d','连板','limit',85,true,false,false),mkAS('e','游资动向','limit',82,false,false,false)],{total:4,factorNames:['涨停家数','连板']},{total:5},{total:5});expect(r.overall).toBe('WARNING')});
  it('coverage vs THS tracked',()=>{const r=benchmarkAShare20([mkAS('a','涨停家数','limit',80,true,false,false),mkAS('b','炸板率','limit',70,false,false,false)],{total:10,factorNames:['涨停家数','主力净流入']},{total:10},{total:10});expect(r.coverageVsTHS.matchRate).toBe(10)});
  it('missing from THS listed',()=>{const r=benchmarkAShare20([mkAS('a','涨停家数','limit',80,true,false,false)],{total:5,factorNames:['涨停家数','主力净流入','北向资金','龙虎榜','融资余额']},{total:5},{total:5});expect(r.coverageVsTHS.missingFromTHS.length).toBeGreaterThan(0)});
  it('top demand factors sorted',()=>{const r=benchmarkAShare20([mkAS('a','a','v',50,false,false,false),mkAS('b','b','v',95,false,false,false)],{total:5,factorNames:[]},{total:5},{total:5});expect(r.topDemandFactors[0].demandScore).toBeGreaterThanOrEqual(r.topDemandFactors[1].demandScore)});
  it('unique factors identified',()=>{const r=benchmarkAShare20([mkAS('a','唯一A','v',80,false,false,false),mkAS('b','唯一B','v',75,false,false,false),mkAS('c','共有','v',70,true,false,false)],{total:5,factorNames:['共有']},{total:5},{total:5});expect(r.uniqueFactors.length).toBe(2)});
  it('total factors correct',()=>{const r=benchmarkAShare20([mkAS('a','a','v',80,true,true,true),mkAS('b','b','v',75,false,false,false),mkAS('c','c','v',90,true,false,true)],{total:10,factorNames:['a','c']},{total:8},{total:6});expect(r.totalFactors).toBe(3)});
  it('coverage vs Eastmoney',()=>{const r=benchmarkAShare20([mkAS('a','a','v',80,false,true,false),mkAS('b','b','v',75,false,false,false)],{total:5,factorNames:[]},{total:10},{total:10});expect(r.coverageVsEastmoney.matchRate).toBe(10)});
  it('coverage vs Futu',()=>{const r=benchmarkAShare20([mkAS('a','a','v',80,false,false,true),mkAS('b','b','v',75,false,false,true)],{total:5,factorNames:[]},{total:5},{total:10});expect(r.coverageVsFutu.matchRate).toBe(20)});
});
