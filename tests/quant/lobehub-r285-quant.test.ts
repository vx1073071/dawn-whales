// R285 LOBEHUB 测试集 — 20 tests
import { describe, it, expect } from 'vitest';
import { evaluateP1285, P1Check285 } from '../../src/lib/quant/p1-285-verification-r285';
import { auditDedup285, DedupGroup285 } from '../../src/lib/quant/dedup-285-audit-r285';

const mkC=(area:string,name:string,coverage:number,status:'PASS'|'WARNING'|'FAIL'='PASS'):P1Check285=>({area,checkName:name,coveragePct:coverage,issues:status==='FAIL'?['low']:[],status});

describe('R285 P1+TW11 Verification',()=>{
  it('GO all pass',()=>{const r=evaluateP1285([mkC('dedup','去重',95),mkC('i18n','i18n',93),mkC('template-mkt','模板市场',90),mkC('ai-report','AI报告',88),mkC('colorblind','色盲',92),mkC('tw-time','时段高亮',90),mkC('tw-crosshair','十字准星',90),mkC('tw-datawin','数据窗口',90),mkC('tw-period','自定义周期',88),mkC('tw-template','模板保存',92),mkC('tw-multiscreen','多屏',85),mkC('tw-overlay','叠加',90)]);expect(r.overall).toBe('GO')});
  it('NO_GO empty',()=>{const r=evaluateP1285([]);expect(r.overall).toBe('NO_GO')});
  it('CONDITIONAL_GO partial',()=>{const r=evaluateP1285([mkC('dedup','去重',95),mkC('i18n','i18n',70,'WARNING'),mkC('tw-time','时段',80),mkC('tw-crosshair','十字',80),mkC('template','模板',85),mkC('report','报告',82)]);expect(r.overall).toBe('CONDITIONAL_GO')});
  it('NO_GO broken',()=>{const r=evaluateP1285([mkC('dedup','去重',95),mkC('i18n','i18n',30,'FAIL'),mkC('tw-time','时段',40,'FAIL')]);expect(r.overall).toBe('NO_GO')});
  it('by area',()=>{const r=evaluateP1285([mkC('dedup','a',90),mkC('dedup','b',85),mkC('i18n','c',80)]);expect(r.byArea['dedup'].total).toBe(2);expect(r.byArea['i18n'].total).toBe(1)});
  it('pass rate',()=>{const r=evaluateP1285([mkC('a','a',90),mkC('b','b',90),mkC('c','c',40,'FAIL')]);expect(r.passRate).toBe(67)});
  it('area coverage',()=>{const r=evaluateP1285([mkC('dedup','a',90),mkC('dedup','b',80)]);expect(r.byArea['dedup'].coverage).toBe(85)});
  it('area status',()=>{const r=evaluateP1285([mkC('dedup','a',90),mkC('dedup','b',85)]);expect(r.byArea['dedup'].status).toBe('PASS')});
  it('fail count',()=>{const r=evaluateP1285([mkC('a','a',90),mkC('b','b',40,'FAIL'),mkC('c','c',30,'FAIL')]);expect(r.fail).toBe(2)});
});

const mkG=(name:string,area:'engine'|'component',before:number,after:number,tests:number,passed:number,status:'PASS'|'WARNING'|'FAIL'='PASS'):DedupGroup285=>({groupName:name,area,beforeCount:before,afterCount:after,savedCount:before-after,regressionTests:tests,regressionPassed:passed,status});

describe('R285 Dedup Audit',()=>{
  it('PASS dedup working',()=>{const r=auditDedup285([mkG('core','engine',200,150,100,100),mkG('factor','engine',180,100,80,80),mkG('data','engine',146,50,60,60),mkG('ui','component',200,100,80,80),mkG('chart','component',180,50,70,70),mkG('panel','component',184,50,60,60)]);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=auditDedup285([]);expect(r.overall).toBe('FAIL')});
  it('WARNING regression issue',()=>{const r=auditDedup285([mkG('core','engine',200,150,100,85,'WARNING'),mkG('ui','component',200,100,80,80)]);expect(r.overall).toBe('WARNING')});
  it('engine stats',()=>{const r=auditDedup285([mkG('core','engine',200,150,100,100),mkG('data','engine',100,50,50,50)]);expect(r.engineBefore).toBe(300);expect(r.engineAfter).toBe(200);expect(r.engineSaved).toBe(100)});
  it('component stats',()=>{const r=auditDedup285([mkG('ui','component',200,80,100,100),mkG('chart','component',150,60,80,80)]);expect(r.componentBefore).toBe(350);expect(r.componentAfter).toBe(140)});
  it('total saved',()=>{const r=auditDedup285([mkG('core','engine',200,150,100,100),mkG('ui','component',200,100,100,100)]);expect(r.totalSaved).toBe(150)});
  it('regression rate',()=>{const r=auditDedup285([mkG('core','engine',200,150,100,95),mkG('ui','component',200,100,100,100)]);expect(r.regressionRate).toBe(98)});
  it('groups tracked',()=>{const r=auditDedup285([mkG('a','engine',100,50,50,50),mkG('b','component',100,50,50,50)]);expect(r.groups.length).toBe(2)});
  it('broken groups listed',()=>{const r=auditDedup285([mkG('blown','engine',100,50,50,10,'FAIL')]);expect(r.brokenGroups).toContain('blown')});
  it('FAIL low regression',()=>{const r=auditDedup285([mkG('core','engine',200,150,100,50,'FAIL')]);expect(r.overall).toBe('FAIL')});
  it('saved count per group',()=>{const r=auditDedup285([mkG('core','engine',200,150,100,100)]);expect(r.groups[0].savedCount).toBe(50)});
});
