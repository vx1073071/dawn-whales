// R277 LOBEHUB 测试集 — 20 tests
import { describe, it, expect } from 'vitest';
import { benchmarkGlobal84, Global84Factor } from '../../src/lib/quant/global-84-benchmark-r277';
import { benchmarkMacro12, Macro12Factor } from '../../src/lib/quant/macro-12-bloomberg-r277';

// ═══ P1: 84全球因子 ═══
const mkG=(id:string,nameCn:string,market:string,category:string,accuracy:number,status:'PASS'|'WARNING'|'FAIL'='PASS'):Global84Factor=>({id,name:id,nameCn,market,category,value:100,expectedRange:[80,120],accuracy,freshnessMs:600000,source:'test',status,issues:status==='FAIL'?['精度问题']:[]});

describe('R277 Global 84 Benchmark',()=>{
  const mkts=['JP','IN','KR','TW','EU','BR','SA','SG','AU','HK','CN','US','GB','CA'];
  const cats=['trend','momentum','volume','volatility','credit','flow'];
  it('PASS all factors good',()=>{const fs=[];for(let i=0;i<84;i++)fs.push(mkG(`g${i}`,`因子${i}`,mkts[i%14],cats[i%6],90+i%10));const r=benchmarkGlobal84(fs);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkGlobal84([]);expect(r.overall).toBe('FAIL')});
  it('WARNING moderate quality',()=>{const fs=[];for(let i=0;i<60;i++)fs.push(mkG(`g${i}`,`f${i}`,mkts[i%14],cats[i%6],85));for(let i=60;i<84;i++)fs.push(mkG(`g${i}`,`f${i}`,mkts[i%14],cats[i%6],50,'FAIL'));const r=benchmarkGlobal84(fs);expect(r.overall).toBe('WARNING')});
  it('pass rate calculated',()=>{const fs=[mkG('a','a','JP','trend',90),mkG('b','b','JP','momentum',85),mkG('c','c','JP','volume',60,'FAIL')];const r=benchmarkGlobal84(fs);expect(r.passRate).toBe(67)});
  it('by market breakdown',()=>{const fs=[mkG('a','a','JP','trend',90),mkG('b','b','JP','momentum',85),mkG('c','c','KR','trend',80)];const r=benchmarkGlobal84(fs);expect(r.byMarket['JP'].total).toBe(2);expect(r.byMarket['KR'].total).toBe(1)});
  it('by category breakdown',()=>{const fs=[mkG('a','a','JP','trend',90),mkG('b','b','JP','momentum',85),mkG('c','c','KR','trend',80)];const r=benchmarkGlobal84(fs);expect(r.byCategory['trend'].total).toBe(2);expect(r.byCategory['momentum'].total).toBe(1)});
  it('worst factors listed',()=>{const fs=[mkG('a','a','JP','v',50,'FAIL'),mkG('b','b','KR','v',55,'FAIL'),mkG('c','c','TW','v',90)];const r=benchmarkGlobal84(fs);expect(r.worstFactors.length).toBe(2)});
  it('market ranking sorted',()=>{const fs=[mkG('a','a','JP','trend',95),mkG('b','b','JP','momentum',90),mkG('c','c','KR','trend',60,'FAIL'),mkG('d','d','TW','trend',80)];const r=benchmarkGlobal84(fs);expect(r.marketRanking[0].score).toBeGreaterThanOrEqual(r.marketRanking[r.marketRanking.length-1].score)});
  it('recommendations on failures',()=>{const fs=[];for(let i=0;i<20;i++)fs.push(mkG(`g${i}`,`f${i}`,mkts[i%14],'trend',50,'FAIL'));const r=benchmarkGlobal84(fs);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('total factors correct',()=>{const fs=[];for(let i=0;i<84;i++)fs.push(mkG(`g${i}`,`f${i}`,mkts[i%14],cats[i%6],90));const r=benchmarkGlobal84(fs);expect(r.totalFactors).toBe(84)});
});

// ═══ P2: 宏观12 vs Bloomberg ═══
const mkM=(id:string,nameCn:string,country:string,ourValue:number,bbgValue:number,status:'PASS'|'WARNING'|'FAIL'='PASS'):Macro12Factor=>({id,name:id,nameCn,country,value:ourValue,expectedRange:[ourValue*0.8,ourValue*1.2],bloombergValue:bbgValue,deviationPct:Math.round(Math.abs(ourValue-bbgValue)/bbgValue*10000)/100,source:'FRED',updateFreq:'monthly',status});

describe('R277 Macro12 vs Bloomberg',()=>{
  it('PASS low deviation',()=>{const fs=[mkM('a','GDP增速','US',2.5,2.5),mkM('b','CPI','US',3.0,3.0),mkM('c','PMI','US',52,52),mkM('d','失业率','US',3.8,3.8),mkM('e','GDP增速','CN',5.0,5.0),mkM('f','CPI','CN',0.5,0.5),mkM('g','PMI','CN',50,50),mkM('h','GDP增速','JP',1.2,1.2),mkM('i','CPI','JP',2.8,2.8),mkM('j','GDP增速','EU',0.8,0.8),mkM('k','CPI','EU',2.5,2.5),mkM('l','PMI','EU',48,48)];const r=benchmarkMacro12(fs,[]);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkMacro12([],[]);expect(r.overall).toBe('FAIL')});
  it('WARNING moderate deviation',()=>{const r=benchmarkMacro12([mkM('a','GDP','US',2.8,2.5),mkM('b','CPI','US',3.3,3.0),mkM('c','PMI','US',55,52)],[]);expect(r.overall).toBe('WARNING')});
  it('FAIL high deviation',()=>{const r=benchmarkMacro12([mkM('a','GDP','US',5.0,2.5),mkM('b','CPI','US',6.0,3.0)],[]);expect(r.overall).toBe('FAIL')});
  it('avg deviation calculated',()=>{const r=benchmarkMacro12([mkM('a','GDP','US',2.5,2.5),mkM('b','CPI','US',3.3,3.0)],[]);expect(r.avgDeviation).toBeGreaterThan(0)});
  it('by country breakdown',()=>{const r=benchmarkMacro12([mkM('a','GDP','US',2.5,2.5),mkM('b','CPI','US',3.0,3.0),mkM('c','GDP','CN',5.0,5.0)],[]);expect(r.byCountry['US'].total).toBe(2);expect(r.byCountry['CN'].total).toBe(1)});
  it('top deviations sorted',()=>{const r=benchmarkMacro12([mkM('a','GDP','US',3.0,2.5),mkM('b','CPI','US',3.0,3.0)],[]);expect(r.topDeviations[0].deviationPct).toBeGreaterThanOrEqual(r.topDeviations[1].deviationPct)});
  it('update lag tracked',()=>{const r=benchmarkMacro12([mkM('a','GDP','US',2.5,2.5)],[]);expect(r.updateLag).toBeDefined()});
  it('recommendations on deviation',()=>{const r=benchmarkMacro12([mkM('a','GDP','US',3.5,2.5)],[]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('total factors correct',()=>{const r=benchmarkMacro12([mkM('a','GDP','US',2.5,2.5),mkM('b','CPI','US',3.0,3.0)],[]);expect(r.totalFactors).toBe(2)});
});
