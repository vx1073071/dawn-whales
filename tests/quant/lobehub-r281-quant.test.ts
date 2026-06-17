// R281 LOBEHUB 测试集 — 18 tests
import { describe, it, expect } from 'vitest';
import { auditFactorRegistry, FactorRegistryEntry } from '../../src/lib/quant/factor-registry-audit-r281';
import { evaluateP0Fixes, P0FixItem } from '../../src/lib/quant/p0-fix-verification-r281';

const mkE=(id:string,nameCn:string,category:string,status:'REGISTERED'|'ORPHAN'|'DUPLICATE'|'STALE'='REGISTERED'):FactorRegistryEntry=>({id,name:id,nameCn,category,source:'classic',filePath:`src/lib/quant/${id}.ts`,registeredAt:Date.now(),hasDedup:status==='REGISTERED',hasNameUnified:status==='REGISTERED',status});

describe('R281 Factor Registry Audit',()=>{
  it('PASS registry complete',()=>{const es=[];for(let i=0;i<620;i++)es.push(mkE(`f${i}`,`因子${i}`,['trend','momentum','volume','volatility','esg','macro','china'][i%7]));const r=auditFactorRegistry(es,620);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=auditFactorRegistry([],620);expect(r.overall).toBe('FAIL')});
  it('WARNING incomplete',()=>{const es=[];for(let i=0;i<500;i++)es.push(mkE(`f${i}`,`因子${i}`,'trend'));const r=auditFactorRegistry(es,620);expect(r.overall).toBe('WARNING')});
  it('orphans detected',()=>{const r=auditFactorRegistry([mkE('a','a','v','REGISTERED'),mkE('b','b','v','ORPHAN'),mkE('c','c','v','ORPHAN')],620);expect(r.orphans).toBe(2)});
  it('duplicates detected',()=>{const r=auditFactorRegistry([mkE('a','a','v','REGISTERED'),mkE('b','b','v','DUPLICATE')],620);expect(r.duplicates).toBe(1)});
  it('stale detected',()=>{const r=auditFactorRegistry([mkE('a','a','v','STALE'),mkE('b','b','v','REGISTERED')],620);expect(r.stale).toBe(1)});
  it('completeness rate',()=>{const es=[];for(let i=0;i<310;i++)es.push(mkE(`f${i}`,'a','v'));const r=auditFactorRegistry(es,620);expect(r.completenessRate).toBe(50)});
  it('by category breakdown',()=>{const r=auditFactorRegistry([mkE('a','a','trend'),mkE('b','b','trend'),mkE('c','c','momentum')],620);expect(r.byCategory['trend'].registered).toBe(2);expect(r.byCategory['momentum'].registered).toBe(1)});
  it('recommendations on issues',()=>{const r=auditFactorRegistry([mkE('a','a','v','ORPHAN')],620);expect(r.recommendations.length).toBeGreaterThan(0)});
});

const mkP=(area:'unified-entry'|'dedup-components'|'pseudo-data'|'naming-unified'|'registry',name:string,status:'FIXED'|'PARTIAL'|'BROKEN'):P0FixItem=>({area,checkName:name,status,details:'verified',affectedFiles:2,testsPassed:10});

describe('R281 P0 Fix Verification',()=>{
  it('GO all fixed',()=>{const r=evaluateP0Fixes([mkP('unified-entry','入口统一','FIXED'),mkP('dedup-components','组件去重','FIXED'),mkP('pseudo-data','伪数据清理','FIXED'),mkP('naming-unified','命名统一','FIXED'),mkP('registry','Registry','FIXED')]);expect(r.overall).toBe('GO')});
  it('NO_GO empty',()=>{const r=evaluateP0Fixes([]);expect(r.overall).toBe('NO_GO')});
  it('CONDITIONAL_GO partial',()=>{const r=evaluateP0Fixes([mkP('unified-entry','入口','FIXED'),mkP('dedup-components','去重','FIXED'),mkP('pseudo-data','清理','PARTIAL'),mkP('naming-unified','命名','FIXED'),mkP('registry','注册','FIXED')]);expect(r.overall).toBe('CONDITIONAL_GO')});
  it('NO_GO broken',()=>{const r=evaluateP0Fixes([mkP('unified-entry','入口','BROKEN'),mkP('dedup-components','去重','BROKEN'),mkP('pseudo-data','清理','BROKEN')]);expect(r.overall).toBe('NO_GO')});
  it('fix rate calculated',()=>{const r=evaluateP0Fixes([mkP('a','a','FIXED'),mkP('b','b','FIXED'),mkP('c','c','BROKEN')]);expect(r.fixRate).toBe(67)});
  it('by area breakdown',()=>{const r=evaluateP0Fixes([mkP('unified-entry','a','FIXED'),mkP('unified-entry','b','FIXED'),mkP('dedup-components','c','FIXED')]);expect(r.byArea['unified-entry'].total).toBe(2);expect(r.byArea['dedup-components'].total).toBe(1)});
  it('broken items listed',()=>{const r=evaluateP0Fixes([mkP('a','入口坏了','BROKEN')]);expect(r.brokenItems).toContain('入口坏了')});
  it('signOff for GO',()=>{const r=evaluateP0Fixes([mkP('a','a','FIXED'),mkP('b','b','FIXED')]);expect(r.signOff).toContain('批准')});
  it('signOff for NO_GO',()=>{const r=evaluateP0Fixes([mkP('a','阻断','BROKEN')]);expect(r.signOff).toContain('必须修复')});
});
