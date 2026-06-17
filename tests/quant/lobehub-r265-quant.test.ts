// ══ R265 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import { evaluateKLineSample, generateKLineBenchmark, KLineQualitySample } from '../../src/lib/quant/kline-quality-benchmark-r265';
import { evaluateTimeframeRender, TimeframeRenderSample } from '../../src/lib/quant/timeframe-render-benchmark-r265';
import { compareToTradingView } from '../../src/lib/quant/indicator-tw-compare-r265';

const mkBar=(ts:number,o:number,h:number,l:number,c:number,v:number)=>({o,h,l,c,v,ts});

describe('R265 P1 KLine Quality',()=>{
  const bars=Array(100).fill(null).map((_,i)=>mkBar(Date.now()+i*60000,100+i,102+i,99+i,101+i,1000));
  it('evaluates perfect sample',()=>{const r=evaluateKLineSample('AAPL','NQ','m1',bars,100);expect(r.status).toBe('EXCELLENT')});
  it('detects missing bars',()=>{const r=evaluateKLineSample('AAPL','NQ','m1',bars.slice(0,80),100);expect(r.missingRate).toBeGreaterThan(0)});
  it('detects OHLC sanity',()=>{const bad=[...bars];bad[10]={...bad[10],h:90};const r=evaluateKLineSample('A','NQ','m1',bad,100);expect(r.ohlcSanity).toBeLessThan(100)});
  it('detects volume sanity',()=>{const bad=[...bars];bad[10]={...bad[10],v:-100};const r=evaluateKLineSample('A','NQ','m1',bad,100);expect(r.volumeSanity).toBeLessThan(100)});
  it('gap detection',()=>{const gapped=[...bars.slice(0,10),...bars.slice(30)];const r=evaluateKLineSample('A','NQ','m1',gapped,100);expect(r.gapCount).toBeGreaterThan(0)});
  it('poor status on multiple issues',()=>{const r=evaluateKLineSample('A','NQ','m1',[],50);expect(['POOR','FAIR']).toContain(r.status)});
  it('report PASS',()=>{const r=generateKLineBenchmark([evaluateKLineSample('A','NQ','m1',bars,100),evaluateKLineSample('B','HK','d1',bars.slice(0,95),100)]);expect(r.overall).toBeDefined()});
  it('report with recommendations',()=>{const r=generateKLineBenchmark([evaluateKLineSample('A','NQ','m1',bars.slice(0,50),100)]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('byPeriod tracking',()=>{const r=generateKLineBenchmark([evaluateKLineSample('A','NQ','m1',bars,100)]);expect(r.byPeriod.m1).toBeTruthy()});
  it('latency tracked',()=>{const r=evaluateKLineSample('A','NQ','m1',bars,100);expect(r.latencyP95).toBeGreaterThan(0)});
  it('score high for perfect',()=>{const r=generateKLineBenchmark([evaluateKLineSample('A','NQ','m1',bars,100)]);expect(r.overallScore).toBeGreaterThan(80)});
  it('score low for bad',()=>{const r=generateKLineBenchmark([evaluateKLineSample('A','NQ','m1',bars.slice(0,30),200),evaluateKLineSample('B','NQ','m1',bars.slice(0,10),200)]);expect(r.overallScore).toBeLessThan(90)});
});

describe('R265 P2 Multi-Timeframe',()=>{
  const mkS=(fps:number,render:number,mem:number,sync:number):TimeframeRenderSample=>({symbol:'AAPL',timeframes:['m1','m5','d1'],renderTimeMs:render,fps,memoryMB:mem,syncDelayMs:sync,status:'GOOD'});
  it('PASS for high FPS',()=>{const r=evaluateTimeframeRender([mkS(60,16,100,50),mkS(55,18,110,60)]);expect(r.overall).toBe('PASS')});
  it('WARNING for low FPS',()=>{const r=evaluateTimeframeRender([mkS(28,35,170,145)]);expect(r.overall==='WARNING'||r.overall==='FAIL').toBe(true)});
  it('FAIL for very low FPS',()=>{const r=evaluateTimeframeRender([mkS(15,80,300,500)]);expect(r.overall).toBe('FAIL')});
  it('recommendations for issues',()=>{const r=evaluateTimeframeRender([mkS(15,100,300,600)]);expect(r.recommendations.length).toBeGreaterThan(0)});
  it('byTimeframe tracked',()=>{const r=evaluateTimeframeRender([mkS(60,16,100,50)]);expect(r.byTimeframe.m1).toBeTruthy()});
  it('avgFps calculated',()=>{const r=evaluateTimeframeRender([mkS(40,25,120,100),mkS(60,16,100,50)]);expect(r.avgFps).toBeGreaterThan(45)});
  it('avgRenderMs',()=>{const r=evaluateTimeframeRender([mkS(60,20,100,50)]);expect(r.avgRenderMs).toBeGreaterThan(0)});
  it('avgSyncMs',()=>{const r=evaluateTimeframeRender([mkS(60,16,100,200)]);expect(r.avgSyncMs).toBeGreaterThan(100)});
  it('avgMemoryMB',()=>{const r=evaluateTimeframeRender([mkS(60,16,180,50)]);expect(r.avgMemoryMB).toBeGreaterThan(100)});
  it('byTimeframe aggregation',()=>{const r=evaluateTimeframeRender([mkS(50,20,100,50),mkS(30,30,120,70)]);expect(r.byTimeframe.m1.fps).toBeGreaterThan(0)});
  it('empty returns zero',()=>{const r=evaluateTimeframeRender([]);expect(r.avgFps).toBe(0)});
});
describe('R265 P3 TW Compare',()=>{
  it('coverage computed',()=>{const r=compareToTradingView();expect(r.coverage).toBeGreaterThan(0)});
  it('full matches have QM and TW',()=>{const r=compareToTradingView();for(const m of r.fullMatches){expect(m.quantMoo).toBe(true);expect(m.tradingView).toBe(true)}});
  it('missing identified',()=>{const r=compareToTradingView();expect(r.missing.length).toBeGreaterThan(0)});
  it('priority adds list',()=>{const r=compareToTradingView();expect(r.priorityAdds.length).toBe(5)});
  it('total TW indicators',()=>{expect(compareToTradingView().totalTW).toBe(10)});
  it('partial matches have recommendation',()=>{const r=compareToTradingView();for(const m of r.partialMatches)expect(m.recommendation.length).toBeGreaterThan(0)});
  it('missing have recommendation',()=>{const r=compareToTradingView();for(const m of r.missing)expect(m.recommendation.length).toBeGreaterThan(0)});
  it('full matches >0',()=>{expect(compareToTradingView().fullMatches.length).toBeGreaterThan(0)});
  it('coverage is percentage',()=>{expect(compareToTradingView().coverage).toBeLessThanOrEqual(100)});
  it('total QM indicators >0',()=>{expect(compareToTradingView().totalQM).toBeGreaterThan(0)});
  it('missing all have quantMoo=false',()=>{for(const m of compareToTradingView().missing)expect(m.quantMoo).toBe(false)});
  it('full + partial + missing = TW total',()=>{const r=compareToTradingView();expect(r.fullMatches.length+r.partialMatches.length+r.missing.length).toBe(r.totalTW)});
});
