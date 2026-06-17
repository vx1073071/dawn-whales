// R278 LOBEHUB 测试集 — 22 tests
import { describe, it, expect } from 'vitest';
import { benchmark620, Factor620 } from '../../src/lib/quant/factor-620-benchmark-r278';
import { benchmarkAcademicICIR, AcademicFactor } from '../../src/lib/quant/academic-ic-ir-r278';

const mkF=(id:string,nameCn:string,source:string,category:string,ic:number,ir:number,sharpe:number,status:'PASS'|'WARNING'|'FAIL'='PASS'):Factor620=>({id,name:id,nameCn,category,subcategory:`${category}-sub`,source:source as any,icValue:ic,irValue:ir,sharpe,maxDrawdown:0.15,coveragePct:95,freshnessMs:600000,status,issues:status==='FAIL'?['质量问题']:[]});

describe('R278 Factor 620 Benchmark',()=>{
  const sources=['classic','academic','esg','alt','options','fixed_income','global','china','macro'];
  it('PASS all factors good',()=>{const fs=[];for(let i=0;i<620;i++)fs.push(mkF(`f${i}`,`因子${i}`,sources[i%9],'momentum',0.05+Math.random()*0.1,0.3+Math.random()*0.5,0.8+Math.random()*1.5));const r=benchmark620(fs);expect(r.totalFactors).toBe(620);expect(r.summary.passRate).toBe(100)});
  it('FAIL empty',()=>{const r=benchmark620([]);expect(r.totalFactors).toBe(0)});
  it('summary counts correct',()=>{const fs=[mkF('a','a','classic','v',0.05,0.3,0.8),mkF('b','b','academic','v',0.03,0.2,0.5,'FAIL'),mkF('c','c','esg','v',0.01,0.1,0.3,'WARNING')];const r=benchmark620(fs);expect(r.summary.pass).toBe(1);expect(r.summary.fail).toBe(1);expect(r.summary.warn).toBe(1)});
  it('by source breakdown',()=>{const fs=[mkF('a','a','classic','v',0.05,0.3,0.8),mkF('b','b','classic','v',0.04,0.25,0.7),mkF('c','c','academic','v',0.03,0.2,0.5)];const r=benchmark620(fs);expect(r.bySource['classic'].total).toBe(2);expect(r.bySource['academic'].total).toBe(1)});
  it('by category breakdown',()=>{const fs=[mkF('a','a','classic','momentum',0.05,0.3,0.8),mkF('b','b','classic','value',0.04,0.25,0.7),mkF('c','c','academic','momentum',0.03,0.2,0.5)];const r=benchmark620(fs);expect(r.byCategory['momentum'].total).toBe(2);expect(r.byCategory['value'].total).toBe(1)});
  it('top by IC sorted',()=>{const fs=[mkF('a','a','classic','v',0.01,0.1,0.3),mkF('b','b','classic','v',0.09,0.5,1.2)];const r=benchmark620(fs);expect(Math.abs(r.topByIC[0].ic)).toBeGreaterThanOrEqual(Math.abs(r.topByIC[1].ic))});
  it('top by Sharpe sorted',()=>{const fs=[mkF('a','a','classic','v',0.05,0.3,0.5),mkF('b','b','classic','v',0.05,0.3,1.5)];const r=benchmark620(fs);expect(r.topBySharpe[0].sharpe).toBeGreaterThanOrEqual(r.topBySharpe[1].sharpe)});
  it('worst factors listed',()=>{const fs=[mkF('a','a','classic','v',0.01,0.1,0.1,'FAIL'),mkF('b','b','academic','v',0.02,0.1,0.2,'FAIL'),mkF('c','c','esg','v',0.05,0.3,0.8)];const r=benchmark620(fs);expect(r.worstFactors.length).toBe(2)});
  it('avg IC by source',()=>{const fs=[mkF('a','a','classic','v',0.05,0.3,0.8),mkF('b','b','classic','v',0.03,0.2,0.5)];const r=benchmark620(fs);expect(r.bySource['classic'].avgIC).toBeGreaterThan(0)});
  it('avg Sharpe by source',()=>{const fs=[mkF('a','a','classic','v',0.05,0.3,1.0),mkF('b','b','classic','v',0.04,0.25,0.8)];const r=benchmark620(fs);expect(r.bySource['classic'].avgSharpe).toBeGreaterThan(0)});
  it('recommendations on failures',()=>{const fs=[];for(let i=0;i<50;i++)fs.push(mkF(`f${i}`,`f${i}`,'classic','v',0.01,0.05,0,'FAIL'));const r=benchmark620(fs);expect(r.recommendations.length).toBeGreaterThan(0)});
});

// R278 P2
const mkA=(id:string,nameCn:string,author:string,year:number,journal:string,category:string,ourIC:number,litIC:number,status:'EXACT_MATCH'|'CLOSE'|'DIVERGENT'|'UNAVAILABLE'='EXACT_MATCH'):AcademicFactor=>({id,name:id,nameCn,author,pubYear:year,journal,category,samplePeriod:'2000-2025',ourIC,ourIR:ourIC*0.5,literatureIC:litIC,literatureIR:litIC*0.5,icDeviation:Math.abs(ourIC-litIC)*100,irDeviation:Math.abs(ourIC-litIC)*50,replicationStatus:status});

describe('R278 Academic IC/IR',()=>{
  it('PASS high replication',()=>{const fs=[mkA('a','动量','Jegadeesh',1993,'JF','momentum',0.08,0.08),mkA('b','价值','Fama',1992,'JF','value',0.06,0.06),mkA('c','质量','Novy-Marx',2013,'JFE','quality',0.05,0.05),mkA('d','波动','Ang',2006,'JF','volatility',0.04,0.04),mkA('e','规模','Banz',1981,'JFE','size',0.03,0.03)];const r=benchmarkAcademicICIR(fs);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkAcademicICIR([]);expect(r.overall).toBe('FAIL')});
  it('WARNING some divergent',()=>{const r=benchmarkAcademicICIR([mkA('a','动量','J',1993,'JF','v',0.08,0.08),mkA('b','价值','F',1992,'JF','v',0.06,0.06),mkA('c','X','N',2013,'JFE','v',0.02,0.06,'DIVERGENT')]);expect(r.overall).toBe('WARNING')});
  it('FAIL many divergent',()=>{const r=benchmarkAcademicICIR([mkA('a','X1','A',2000,'JF','v',0.01,0.06,'DIVERGENT'),mkA('b','X2','B',2000,'JF','v',0.02,0.06,'DIVERGENT'),mkA('c','X3','C',2000,'JF','v',0.01,0.05,'DIVERGENT'),mkA('d','X4','D',2000,'JF','v',0.02,0.05,'DIVERGENT')]);expect(r.overall).toBe('FAIL')});
  it('replication summary correct',()=>{const fs=[mkA('a','a','A',2000,'JF','v',0.08,0.08),mkA('b','b','B',2000,'JF','v',0.06,0.06,'CLOSE'),mkA('c','c','C',2000,'JFE','v',0.02,0.06,'DIVERGENT'),mkA('d','d','D',2000,'JFE','v',0,0,'UNAVAILABLE')];const r=benchmarkAcademicICIR(fs);expect(r.replicationSummary.exact).toBe(1);expect(r.replicationSummary.divergent).toBe(1);expect(r.replicationSummary.unavailable).toBe(1)});
  it('avg IC match calculated',()=>{const r=benchmarkAcademicICIR([mkA('a','a','A',2000,'JF','v',0.08,0.08),mkA('b','b','B',2000,'JF','v',0.06,0.06,'CLOSE')]);expect(r.avgICMatch).toBeGreaterThanOrEqual(0)});
  it('by journal breakdown',()=>{const r=benchmarkAcademicICIR([mkA('a','a','A',2000,'JF','v',0.08,0.08),mkA('b','b','B',2000,'JF','v',0.06,0.06),mkA('c','c','C',2000,'JFE','v',0.05,0.05)]);expect(r.byJournal['JF'].count).toBe(2);expect(r.byJournal['JFE'].count).toBe(1)});
  it('by year breakdown',()=>{const r=benchmarkAcademicICIR([mkA('a','a','A',1992,'JF','v',0.06,0.06),mkA('b','b','B',2013,'JFE','v',0.05,0.05)]);expect(r.byYear['1992'].count).toBe(1);expect(r.byYear['2013'].count).toBe(1)});
  it('top replicated listed',()=>{const r=benchmarkAcademicICIR([mkA('a','动量','J',1993,'JF','v',0.08,0.08),mkA('b','价值','F',1992,'JF','v',0.06,0.06)]);expect(r.topReplicated.length).toBeGreaterThan(0)});
  it('divergent factors reported',()=>{const r=benchmarkAcademicICIR([mkA('a','X','N',2013,'JFE','v',0.02,0.06,'DIVERGENT')]);expect(r.divergentFactors.length).toBe(1)});
  it('recommendations on divergent',()=>{const r=benchmarkAcademicICIR([mkA('a','X1','A',2000,'JF','v',0.01,0.06,'DIVERGENT'),mkA('b','X2','B',2000,'JF','v',0.02,0.06,'DIVERGENT'),mkA('c','X3','C',2000,'JF','v',0.01,0.05,'DIVERGENT'),mkA('d','X4','D',2000,'JF','v',0.02,0.05,'DIVERGENT')]);expect(r.recommendations.length).toBeGreaterThan(0)});
});
