// R284 LOBEHUB 测试集 — 20 tests
import { describe, it, expect } from 'vitest';
import { verifyP0Fixes, P0CriticalFix } from '../../src/lib/quant/p0-critical-fix-r284';
import { auditIndicator50, Indicator50Check } from '../../src/lib/quant/indicator-50-audit-r284';

const mkP=(area:string,name:string,status:'FIXED'|'PARTIAL'|'BROKEN'):P0CriticalFix=>({area,checkName:name,cleanRate:status==='FIXED'?100:50,status,issues:status!=='FIXED'?['问题']:[]});

describe('R284 P0 Critical Fix',()=>{
  it('GO all fixed',()=>{const r=verifyP0Fixes([mkP('pseudo-data','伪数据','FIXED'),mkP('unified-entry','入口','FIXED'),mkP('indicator-50','指标50','FIXED'),mkP('drawing-ai','AI画线','FIXED'),mkP('skeleton','骨架屏','FIXED')]);expect(r.overall).toBe('GO')});
  it('NO_GO empty',()=>{const r=verifyP0Fixes([]);expect(r.overall).toBe('NO_GO')});
  it('CONDITIONAL_GO one broken',()=>{const r=verifyP0Fixes([mkP('a','a','FIXED'),mkP('b','b','FIXED'),mkP('c','c','BROKEN')]);expect(r.overall).toBe('CONDITIONAL_GO')});
  it('NO_GO two broken',()=>{const r=verifyP0Fixes([mkP('a','a','BROKEN'),mkP('b','b','BROKEN')]);expect(r.overall).toBe('NO_GO')});
  it('fix rate calculated',()=>{const r=verifyP0Fixes([mkP('a','a','FIXED'),mkP('b','b','FIXED'),mkP('c','c','BROKEN')]);expect(r.fixRate).toBe(67)});
  it('by area breakdown',()=>{const r=verifyP0Fixes([mkP('pseudo-data','a','FIXED'),mkP('pseudo-data','b','FIXED'),mkP('drawing-ai','c','FIXED')]);expect(r.byArea['pseudo-data'].total).toBe(2);expect(r.byArea['drawing-ai'].total).toBe(1)});
  it('area status PASS',()=>{const r=verifyP0Fixes([mkP('pseudo-data','a','FIXED'),mkP('pseudo-data','b','FIXED')]);expect(r.byArea['pseudo-data'].status).toBe('PASS')});
  it('fixed count',()=>{const r=verifyP0Fixes([mkP('a','a','FIXED'),mkP('b','b','FIXED'),mkP('c','c','BROKEN')]);expect(r.fixed).toBe(2);expect(r.broken).toBe(1)});
  it('partial count',()=>{const r=verifyP0Fixes([mkP('a','a','FIXED'),mkP('b','b','PARTIAL')]);expect(r.fixed).toBe(1)});
});

const mkI=(nameCn:string,category:string,status:'PASS'|'WARNING'|'FAIL'='PASS'):Indicator50Check=>({indicatorId:'x',name:'x',nameCn,category,algorithmVerified:true,dataSource:'test',coverageVsTW:90,status});

describe('R284 Indicator 50 Audit',()=>{
  it('PASS all good',()=>{const is=[];for(let i=0;i<50;i++)is.push(mkI(`指标${i}`,['trend','momentum','volume','volatility','overlay'][i%5]));const r=auditIndicator50(is);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=auditIndicator50([]);expect(r.overall).toBe('FAIL')});
  it('WARNING moderate',()=>{const is=[];for(let i=0;i<35;i++)is.push(mkI(`x${i}`,'trend'));for(let i=35;i<50;i++)is.push(mkI(`x${i}`,'trend','FAIL'));const r=auditIndicator50(is);expect(r.overall).toBe('WARNING')});
  it('FAIL many broken',()=>{const is=[];for(let i=0;i<20;i++)is.push(mkI(`x${i}`,'trend','FAIL'));const r=auditIndicator50(is);expect(r.overall).toBe('FAIL')});
  it('pass rate',()=>{const is=[mkI('a','trend'),mkI('b','trend'),mkI('c','trend','FAIL')];const r=auditIndicator50(is);expect(r.passRate).toBe(67)});
  it('by category',()=>{const is=[mkI('a','trend'),mkI('b','trend'),mkI('c','momentum')];const r=auditIndicator50(is);expect(r.byCategory['trend'].total).toBe(2);expect(r.byCategory['momentum'].total).toBe(1)});
  it('worst listed',()=>{const is=[mkI('坏1','trend','FAIL'),mkI('坏2','trend','FAIL'),mkI('好','trend')];const r=auditIndicator50(is);expect(r.worst).toContain('坏1')});
  it('total 50',()=>{const is=[];for(let i=0;i<50;i++)is.push(mkI(`x${i}`,'trend'));const r=auditIndicator50(is);expect(r.total).toBe(50)});
  it('pass count',()=>{const is=[mkI('a','trend'),mkI('b','trend','WARNING'),mkI('c','trend','FAIL')];const r=auditIndicator50(is);expect(r.pass).toBe(1);expect(r.fail).toBe(1)});
  it('category pass tracked',()=>{const is=[mkI('a','trend'),mkI('b','trend'),mkI('c','momentum','FAIL')];const r=auditIndicator50(is);expect(r.byCategory['trend'].pass).toBe(2);expect(r.byCategory['momentum'].pass).toBe(0)});
});
