// R280 LOBEHUB 测试集 — 15 tests
import { describe, it, expect } from 'vitest';
import { generateV400Final, V400QualityDim } from '../../src/lib/quant/v400-final-r280';

const mkD=(name:string,category:string,score:number,total:number,passRate:number,status:'PASS'|'WARNING'|'FAIL'):V400QualityDim=>({name,category,score,totalFactors:total,passRate,avgIC:0.05,status,issues:status==='FAIL'?['质量问题']:[]});

describe('R280 v4.0.0 Final',()=>{
  it('SHIP all pass',()=>{const r=generateV400Final([mkD('经典因子','classic',92,220,95,'PASS'),mkD('学术因子','academic',88,200,90,'PASS'),mkD('ESG因子','esg',85,25,92,'PASS'),mkD('另类数据','alt',90,20,95,'PASS'),mkD('期权因子','options',88,15,93,'PASS'),mkD('固收因子','fixed',86,10,90,'PASS'),mkD('全球因子','global',89,84,94,'PASS'),mkD('A股因子','china',91,16,96,'PASS'),mkD('宏观因子','macro',87,12,91,'PASS')],5000,4.5,0.05);expect(r.overall).toBe('SHIP')});
  it('HOLD on fail',()=>{const r=generateV400Final([mkD('经典因子','classic',92,220,95,'PASS'),mkD('学术因子','academic',60,200,50,'FAIL')],5000,4.5,0.05);expect(r.overall).toBe('HOLD')});
  it('SHIP_WITH_CAUTION',()=>{const r=generateV400Final([mkD('经典因子','classic',92,220,95,'PASS'),mkD('学术因子','academic',75,200,80,'WARNING'),mkD('ESG因子','esg',70,25,75,'WARNING'),mkD('另类数据','alt',72,20,78,'WARNING')],5000,4.5,0.05);expect(r.overall).toBe('SHIP_WITH_CAUTION')});
  it('HOLD empty',()=>{const r=generateV400Final([],5000,4.5,0.05);expect(r.overall).toBe('HOLD')});
  it('total factors summed',()=>{const r=generateV400Final([mkD('a','x',90,100,95,'PASS'),mkD('b','y',85,50,90,'PASS')],5000,4.5,0.05);expect(r.totalFactors).toBe(150)});
  it('pass rate calculated',()=>{const r=generateV400Final([mkD('a','x',90,100,80,'PASS'),mkD('b','y',85,100,90,'PASS')],5000,4.5,0.05);expect(r.passRate).toBe(85)});
  it('5 revenue scenarios',()=>{const r=generateV400Final([mkD('a','x',90,100,95,'PASS')],5000,4.5,0.05);expect(r.revenue.length).toBe(5)});
  it('expected annual positive',()=>{const r=generateV400Final([mkD('a','x',90,100,95,'PASS')],5000,4.5,0.05);expect(r.expectedAnnual).toBeGreaterThan(0)});
  it('confidence interval',()=>{const r=generateV400Final([mkD('a','x',90,100,95,'PASS')],5000,4.5,0.05);expect(r.confidenceInterval[1]).toBeGreaterThan(r.confidenceInterval[0])});
  it('version v4.0.0',()=>{const r=generateV400Final([mkD('a','x',90,100,95,'PASS')],5000,4.5,0.05);expect(r.version).toBe('v4.0.0')});
  it('overall quality score',()=>{const r=generateV400Final([mkD('a','x',90,50,95,'PASS'),mkD('b','y',80,50,90,'PASS')],5000,4.5,0.05);expect(r.overallQuality).toBe(85)});
  it('highlights populated',()=>{const r=generateV400Final([mkD('a','x',92,100,95,'PASS'),mkD('b','y',88,100,90,'PASS')],5000,4.5,0.05);expect(r.highlights.length).toBeGreaterThan(0)});
  it('risks on fail',()=>{const r=generateV400Final([mkD('a','x',50,100,30,'FAIL')],5000,4.5,0.05);expect(r.risks.length).toBeGreaterThan(0)});
  it('signOff for non-SHIP',()=>{const r=generateV400Final([mkD('a','x',50,100,30,'FAIL')],5000,4.5,0.05);expect(r.signOffRequired.length).toBeGreaterThan(0)});
  it('scenario probabilities sum to 1',()=>{const r=generateV400Final([mkD('a','x',90,100,95,'PASS')],5000,4.5,0.05);const sum=r.revenue.reduce((s,x)=>s+x.probability,0);expect(sum).toBeCloseTo(1,2)});
});
