// R282 LOBEHUB 测试集 — 20 tests
import { describe, it, expect } from 'vitest';
import { evaluateP1Experience, P1ExperienceCheck } from '../../src/lib/quant/p1-experience-verification-r282';
import { auditHumanize, HumanizedFactor } from '../../src/lib/quant/humanize-audit-r282';

const mkC=(area:'i18n'|'fold-card'|'summary-3s'|'humanize'|'pk-oneline'|'degrade'|'perf'|'mock'|'climate'|'alarm'|'recipe'|'naming',name:string,coverage:number,status:'PASS'|'WARNING'|'FAIL'='PASS'):P1ExperienceCheck=>({area,checkName:name,targetFactorCount:620,actualPassed:Math.round(620*coverage/100),coverageRate:coverage,issues:status==='FAIL'?['覆盖率不足']:[],status});

describe('R282 P1 Experience Verification',()=>{
  it('PASS all areas',()=>{const r=evaluateP1Experience([mkC('humanize','人话化覆盖',95),mkC('i18n','i18n覆盖',93),mkC('fold-card','折叠覆盖',92),mkC('summary-3s','摘要覆盖',90),mkC('pk-oneline','PK覆盖',90),mkC('degrade','降级覆盖',95),mkC('perf','性能达标',90),mkC('mock','mock覆盖',95),mkC('climate','气候覆盖',88),mkC('alarm','闹钟覆盖',90),mkC('recipe','食谱覆盖',85),mkC('naming','命名覆盖',90)]);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=evaluateP1Experience([]);expect(r.overall).toBe('FAIL')});
  it('WARNING partial',()=>{const r=evaluateP1Experience([mkC('humanize','人话化',70,'WARNING'),mkC('i18n','i18n',65,'WARNING'),mkC('fold-card','折叠',80),mkC('summary-3s','摘要',75),mkC('pk-oneline','PK',72),mkC('degrade','降级',70)]);expect(r.overall).toBe('WARNING')});
  it('FAIL critical area broken',()=>{const r=evaluateP1Experience([mkC('humanize','人话化',30,'FAIL'),mkC('i18n','i18n',25,'FAIL'),mkC('fold-card','折叠',80)]);expect(r.overall).toBe('FAIL')});
  it('by area breakdown',()=>{const r=evaluateP1Experience([mkC('humanize','a',90),mkC('humanize','b',85),mkC('i18n','c',80)]);expect(r.byArea['humanize'].total).toBe(2);expect(r.byArea['i18n'].total).toBe(1)});
  it('worst areas listed',()=>{const r=evaluateP1Experience([mkC('humanize','a',30,'FAIL'),mkC('i18n','b',20,'FAIL'),mkC('fold-card','c',90)]);expect(r.worstAreas).toContain('humanize');expect(r.worstAreas).toContain('i18n')});
  it('overall pass rate',()=>{const r=evaluateP1Experience([mkC('a','a',90),mkC('b','b',90),mkC('c','c',30,'FAIL')]);expect(r.overallRate).toBe(67)});
  it('recommendations on failures',()=>{const r=evaluateP1Experience([mkC('humanize','a',30,'FAIL')]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('pass count tracked',()=>{const r=evaluateP1Experience([mkC('a','a',90),mkC('b','b',90),mkC('c','c',40,'FAIL')]);expect(r.passCount).toBe(2);expect(r.failCount).toBe(1)});
});

// HumanizedFactor: factorId, originalName, humanizedName, emoji, oneliner, summary3s, readLevel, accuracyScore, sampleValue, sampleInterpretation, status
const mkH=(status:'ACCURATE'|'MISLEADING'|'WRONG'|'UNTESTED',acc:number=95,level:number=8):HumanizedFactor=>({factorId:'f-x',originalName:'orig',humanizedName:'人话名',emoji:'📊',oneliner:'一句话',summary3s:'摘要',readLevel:level,accuracyScore:acc,sampleValue:100,sampleInterpretation:'解读',status});

describe('R282 Humanize Audit',()=>{
  it('PASS high accuracy',()=>{const fs=[];for(let i=0;i<20;i++)fs.push(mkH('ACCURATE',96));const r=auditHumanize(fs);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=auditHumanize([]);expect(r.overall).toBe('FAIL')});
  it('WARNING one misleading',()=>{const r=auditHumanize([mkH('ACCURATE',95),mkH('ACCURATE',90),mkH('MISLEADING',40)]);expect(r.overall).toBe('WARNING')});
  it('FAIL one wrong',()=>{const r=auditHumanize([mkH('ACCURATE',95),mkH('WRONG',20)]);expect(r.overall).toBe('FAIL')});
  it('accuracy rate',()=>{const r=auditHumanize([mkH('ACCURATE',95),mkH('ACCURATE',90),mkH('WRONG',30)]);expect(r.accuracyRate).toBe(67)});
  it('avg read level',()=>{const r=auditHumanize([mkH('ACCURATE',95,8),mkH('ACCURATE',90,12)]);expect(r.avgReadLevel).toBe(10)});
  it('worst offenders',()=>{const r=auditHumanize([mkH('WRONG',20),mkH('MISLEADING',40)]);expect(r.worstOffenders.length).toBe(2)});
  it('by category breakdown',()=>{const r=auditHumanize([{...mkH('ACCURATE',95),factorId:'macd-01'},{...mkH('ACCURATE',90),factorId:'macd-02'},{...mkH('ACCURATE',85),factorId:'rsi-01'}]);expect(r.byCategory['macd'].total).toBe(2);expect(r.byCategory['rsi'].total).toBe(1)});
  it('recommendations on issues',()=>{const r=auditHumanize([mkH('WRONG',20)]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('misleading count',()=>{const r=auditHumanize([mkH('ACCURATE',95),mkH('MISLEADING',30),mkH('MISLEADING',25)]);expect(r.misleading).toBe(2)});
});
