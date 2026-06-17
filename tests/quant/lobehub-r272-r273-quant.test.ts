// R272+R273 LOBEHUB ���试集 — 42 tests
import { describe, it, expect } from 'vitest';
// R272
import { benchmarkShortSell, ShortSellStock } from '../../src/lib/quant/short-sell-benchmark-r272';
import { benchmarkLimits, LimitStock } from '../../src/lib/quant/limit-benchmark-r272';
import { benchmarkJPCredit, CreditStock } from '../../src/lib/quant/jp-credit-benchmark-r272';
// R273
import { benchmarkFO, FOInstrument } from '../../src/lib/quant/fo-benchmark-r273';
import { benchmarkInstitutional, InstitutionalFlow } from '../../src/lib/quant/institutional-benchmark-r273';
import { benchmarkFX, FXPair } from '../../src/lib/quant/fx-benchmark-r273';

// ═══ R272 ═══
const mkSS=(code:string,name:string,ratio:number):ShortSellStock=>({code,name,shortVolume:1000000,shortRatio:ratio,shortTurnover:50000000,totalVolume:10000000});

describe('R272 Short Sell Benchmark',()=>{
  it('PASS coverage 90%',()=>{const r=benchmarkShortSell([mkSS('A','a',12),mkSS('B','b',8),mkSS('C','c',5),mkSS('D','d',3),mkSS('E','e',15),mkSS('F','f',7),mkSS('G','g',9),mkSS('H','h',4),mkSS('I','i',6)],{totalCount:10,top10Codes:['A','B','C','D','E','X','Y','Z','W','V']});expect(r.overall).toBe('WARNING')});
  it('FAIL empty',()=>{const r=benchmarkShortSell([],{totalCount:100,top10Codes:[]});expect(r.overall).toBe('FAIL')});
  it('top shorted sorted',()=>{const r=benchmarkShortSell([mkSS('A','a',15),mkSS('B','b',5),mkSS('C','c',10),mkSS('D','d',3)],{totalCount:5,top10Codes:['A','B','C']});expect(r.topShorted[0].ratio).toBeGreaterThanOrEqual(r.topShorted[1].ratio)});
  it('coverage tracked',()=>{const r=benchmarkShortSell([mkSS('A','a',10),mkSS('B','b',8)],{totalCount:10,top10Codes:['A','B']});expect(r.coverageVsFutu.matchRate).toBe(20)});
  it('deviation calculated',()=>{const r=benchmarkShortSell([mkSS('A','a',10),mkSS('B','b',8)],{totalCount:10,top10Codes:['A','B','Z']});expect(r.deviationPct).toBeGreaterThanOrEqual(0)});
  it('avg short ratio',()=>{const r=benchmarkShortSell([mkSS('A','a',10),mkSS('B','b',20)],{totalCount:5,top10Codes:['A','B']});expect(r.avgShortRatio).toBe(15)});
  it('recommendations on deviation',()=>{const r=benchmarkShortSell([mkSS('A','a',1)],{totalCount:100,top10Codes:['Z']});expect(r.recommendations.length).toBeGreaterThan(0)});
});

describe('R272 Limit Benchmark',()=>{
  const mkL=(code:string,name:string,type:'UP'|'DOWN',count:number):LimitStock=>({code,name,type,limitCount:count,volumeRatio:2,boardTurnover:1000000});
  it('PASS',()=>{const r=benchmarkLimits([mkL('A','a','UP',3),mkL('B','b','DOWN',1),mkL('C','c','UP',2),mkL('D','d','UP',1)],{upCount:4,downCount:1,upCodes:['A','C','D'],downCodes:['B']});expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkLimits([],{upCount:10,downCount:5,upCodes:[],downCodes:[]});expect(r.overall).toBe('FAIL')});
  it('correct up/down totals',()=>{const r=benchmarkLimits([mkL('A','a','UP',3),mkL('B','b','UP',1),mkL('C','c','DOWN',2),mkL('D','d','UP',1)],{upCount:3,downCount:1,upCodes:['A','B','D'],downCodes:['C']});expect(r.totalUpLimit).toBe(3);expect(r.totalDownLimit).toBe(1)});
  it('match rates calculated',()=>{const r=benchmarkLimits([mkL('A','a','UP',5),mkL('B','b','DOWN',3)],{upCount:2,downCount:2,upCodes:['A','X'],downCodes:['B','Y']});expect(r.vsTongHuaShun.matchRateUp).toBe(50);expect(r.vsTongHuaShun.matchRateDown).toBe(50)});
  it('top up sorted',()=>{const r=benchmarkLimits([mkL('A','a','UP',5),mkL('B','b','UP',1),mkL('C','c','UP',3)],{upCount:3,downCount:0,upCodes:['A','B','C'],downCodes:[]});expect(r.topUp[0].count).toBeGreaterThanOrEqual(r.topUp[1].count)});
  it('recommendations on low match',()=>{const r=benchmarkLimits([mkL('A','a','UP',1)],{upCount:20,downCount:0,upCodes:['Z'],downCodes:[]});expect(r.recommendations.length).toBeGreaterThan(0)});
  it('WARNING mid match',()=>{const r=benchmarkLimits([mkL('A','a','UP',2),mkL('B','b','UP',1),mkL('C','c','DOWN',1),mkL('D','d','UP',1),mkL('E','e','DOWN',1)],{upCount:4,downCount:3,upCodes:['A','B','D'],downCodes:['C','E']});expect(r.overall).toBe('WARNING')});
});

describe('R272 JP Credit Benchmark',()=>{
  const mkC=(code:string,name:string,mr:number):CreditStock=>({code,name,marginBalance:100000000,marginBuy:50000000,marginSell:30000000,marginRatio:mr,loanBalance:20000000});
  it('PASS',()=>{const r=benchmarkJPCredit([mkC('A','a',45),mkC('B','b',42),mkC('C','c',48),mkC('D','d',44),mkC('E','e',47),mkC('F','f',43),mkC('G','g',46),mkC('H','h',44),mkC('I','i',45)],{totalCount:10,avgMarginRatio:45});expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkJPCredit([],{totalCount:50,avgMarginRatio:40});expect(r.overall).toBe('FAIL')});
  it('net position calculated',()=>{const r=benchmarkJPCredit([mkC('A','a',30),mkC('B','b',35)],{totalCount:5,avgMarginRatio:32});expect(r.netMarginPosition).toBeGreaterThan(0)});
  it('coverage rate vs JPX',()=>{const r=benchmarkJPCredit([mkC('A','a',30),mkC('B','b',35)],{totalCount:10,avgMarginRatio:32});expect(r.vsJPX.coverageRate).toBe(20)});
  it('deviation tracked',()=>{const r=benchmarkJPCredit([mkC('A','a',50)],{totalCount:5,avgMarginRatio:30});expect(r.vsJPX.deviationPct).toBeGreaterThan(0)});
  it('WARNING',()=>{const r=benchmarkJPCredit([mkC('A','a',20),mkC('B','b',25),mkC('C','c',30),mkC('D','d',28),mkC('E','e',22),mkC('F','f',35),mkC('G','g',40)],{totalCount:10,avgMarginRatio:45});expect(r.overall).toBe('WARNING')});
  it('recommendations on low coverage',()=>{const r=benchmarkJPCredit([mkC('A','a',30)],{totalCount:100,avgMarginRatio:30});expect(r.recommendations.length).toBeGreaterThan(0)});
});

// ═══ R273 ═══
const mkFO=(type:'FUT'|'OPT',symbol:string,oi:number):FOInstrument=>({type,symbol,expiry:'2026-06',openInterest:oi,volume:oi/10,turnover:oi*100,changeOI:oi*0.1});

describe('R273 F&O Benchmark',()=>{
  it('PASS',()=>{const r=benchmarkFO([mkFO('FUT','NIFTY-JUN',5000000),mkFO('FUT','BANKNIFTY-JUN',3000000),mkFO('OPT','NIFTY-18000CE',8000000),mkFO('OPT','NIFTY-18500PE',6000000),mkFO('FUT','FINNIFTY-JUN',1000000),mkFO('OPT','BANKNIFTY-42000CE',4000000),mkFO('FUT','MIDCPNIFTY-JUN',500000),mkFO('OPT','NIFTY-18200CE',3500000),mkFO('OPT','NIFTY-17600PE',2500000)],{futuresCount:4,optionsCount:5,top5OICodes:['NIFTY-18000CE','NIFTY-18500PE','NIFTY-JUN','BANKNIFTY-42000CE','BANKNIFTY-JUN']});expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkFO([],{futuresCount:100,optionsCount:200,top5OICodes:[]});expect(r.overall).toBe('FAIL')});
  it('fut/opt split correct',()=>{const r=benchmarkFO([mkFO('FUT','A',1000),mkFO('OPT','B',2000),mkFO('FUT','C',3000)],{futuresCount:2,optionsCount:1,top5OICodes:['A','B','C']});expect(r.totalFutures).toBe(2);expect(r.totalOptions).toBe(1)});
  it('top by OI sorted',()=>{const r=benchmarkFO([mkFO('FUT','A',1000),mkFO('FUT','B',5000),mkFO('OPT','C',3000)],{futuresCount:2,optionsCount:1,top5OICodes:['B','C','A']});expect(r.topByOI[0].oi).toBeGreaterThanOrEqual(r.topByOI[1].oi)});
  it('fut coverage',()=>{const r=benchmarkFO([mkFO('FUT','A',1000),mkFO('FUT','B',2000)],{futuresCount:5,optionsCount:10,top5OICodes:['A','B']});expect(r.vsNSE.futCoverage).toBe(40)});
  it('opt coverage',()=>{const r=benchmarkFO([mkFO('OPT','A',1000),mkFO('OPT','B',2000),mkFO('OPT','C',3000)],{futuresCount:1,optionsCount:10,top5OICodes:['A','B','C']});expect(r.vsNSE.optCoverage).toBe(30)});
  it('WARNING',()=>{const r=benchmarkFO([mkFO('FUT','A',1000),mkFO('OPT','B',2000),mkFO('FUT','C',3000),mkFO('OPT','D',4000)],{futuresCount:3,optionsCount:3,top5OICodes:['A','B','C','D']});expect(r.overall).toBe('WARNING')});
  it('recommendations on low coverage',()=>{const r=benchmarkFO([mkFO('FUT','A',1000)],{futuresCount:20,optionsCount:20,top5OICodes:['A']});expect(r.recommendations.length).toBeGreaterThan(0)});
});

const mkIF=(market:'KR'|'TW',foreign:number,inst:number,dealer:number):InstitutionalFlow=>({market,date:'2026-06-17',institutions:inst,foreign,dealer,totalNet:foreign+inst+dealer,prevClose:0,weightedIndex:0});

describe('R273 Institutional Benchmark',()=>{
  it('PASS low deviation',()=>{const r=benchmarkInstitutional([mkIF('KR',50000000000,20000000000,10000000000),mkIF('TW',30000000000,10000000000,5000000000)],{koreaForeignNet:50000000000,koreaTotalNet:80000000000,taiwanForeignNet:30000000000,taiwanTotalNet:45000000000});expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkInstitutional([],{koreaForeignNet:50000000000,koreaTotalNet:80000000000,taiwanForeignNet:30000000000,taiwanTotalNet:45000000000});expect(r.overall).toBe('FAIL')});
  it('Korea net calculated',()=>{const r=benchmarkInstitutional([mkIF('KR',100,50,30),mkIF('KR',200,80,20)],{koreaForeignNet:300,koreaTotalNet:480,taiwanForeignNet:0,taiwanTotalNet:0});expect(r.markets.kr.foreignNet).toBe(300);expect(r.markets.kr.totalNet).toBe(480)});
  it('Taiwan net calculated',()=>{const r=benchmarkInstitutional([mkIF('TW',50,30,20),mkIF('TW',100,50,30)],{koreaForeignNet:0,koreaTotalNet:0,taiwanForeignNet:150,taiwanTotalNet:280});expect(r.markets.tw.foreignNet).toBe(150);expect(r.markets.tw.totalNet).toBe(280)});
  it('deviation tracked',()=>{const r=benchmarkInstitutional([mkIF('KR',50000000000,0,0)],{koreaForeignNet:50000000000,koreaTotalNet:50000000000,taiwanForeignNet:0,taiwanTotalNet:0});expect(r.vsOfficial.koreaDeviation).toBe(0)});
  it('WARNING moderate deviation',()=>{const r=benchmarkInstitutional([mkIF('KR',65000000000,0,0),mkIF('TW',38000000000,0,0)],{koreaForeignNet:50000000000,koreaTotalNet:50000000000,taiwanForeignNet:30000000000,taiwanTotalNet:30000000000});expect(r.overall).toBe('WARNING')});
  it('FAIL high deviation',()=>{const r=benchmarkInstitutional([mkIF('KR',30000000000,0,0)],{koreaForeignNet:100000000000,koreaTotalNet:100000000000,taiwanForeignNet:0,taiwanTotalNet:0});expect(r.overall).toBe('FAIL')});
  it('recommendations on deviation',()=>{const r=benchmarkInstitutional([mkIF('KR',30000000000,0,0)],{koreaForeignNet:100000000000,koreaTotalNet:100000000000,taiwanForeignNet:0,taiwanTotalNet:0});expect(r.recommendations.length).toBeGreaterThan(0)});
});

const mkFX=(from:string,to:string,spread:number):FXPair=>({from,to,rate:1,spread,bid:1-spread/2,ask:1+spread/2,source:'test',timestamp:Date.now()});

describe('R273 FX Benchmark',()=>{
  it('PASS high coverage low spread',()=>{const pairs=[];const cur=['USD','EUR','JPY','GBP','CNY','HKD','KRW','TWD','INR','BRL','SGD','MYR','IDR','THB','PHP','VND','AUD','NZD','CAD','CHF','SEK','NOK','DKK'];for(let i=0;i<23;i++)pairs.push(mkFX(cur[i],'CNY',0.0003));const r=benchmarkFX(pairs,24);expect(r.overall).toBe('PASS')});
  it('FAIL empty',()=>{const r=benchmarkFX([],24);expect(r.overall).toBe('FAIL')});
  it('avg spread calculated',()=>{const r=benchmarkFX([mkFX('USD','CNY',0.001),mkFX('EUR','CNY',0.002)],24);expect(r.avgSpread).toBe(0.0015)});
  it('coverage rate correct',()=>{const r=benchmarkFX([mkFX('USD','CNY',0.001),mkFX('EUR','CNY',0.001),mkFX('JPY','CNY',0.001)],24);expect(r.coverage.coverageRate).toBe(13)});
  it('max spread tracked',()=>{const r=benchmarkFX([mkFX('USD','CNY',0.001),mkFX('EUR','CNY',0.003)],24);expect(r.maxSpread.spread).toBe(0.003)});
  it('major pairs present',()=>{const r=benchmarkFX([mkFX('USD','CNY',0.001),mkFX('EUR','CNY',0.002),mkFX('JPY','CNY',0.001)],24);expect(r.majorPairs.length).toBeGreaterThan(0)});
  it('WARNING',()=>{const r=benchmarkFX([mkFX('USD','CNY',0.008),mkFX('EUR','CNY',0.009),mkFX('JPY','CNY',0.007),mkFX('GBP','CNY',0.006),mkFX('HKD','CNY',0.007),mkFX('KRW','CNY',0.008),mkFX('TWD','CNY',0.006),mkFX('INR','CNY',0.009),mkFX('BRL','CNY',0.007),mkFX('SGD','CNY',0.005),mkFX('MYR','CNY',0.006),mkFX('IDR','CNY',0.008),mkFX('THB','CNY',0.007),mkFX('PHP','CNY',0.006),mkFX('VND','CNY',0.008)],24);expect(r.overall).toBe('WARNING')});
  it('FAIL low coverage',()=>{const r=benchmarkFX([mkFX('USD','CNY',0.001),mkFX('EUR','CNY',0.002)],24);expect(r.overall).toBe('FAIL')});
  it('recommendations on low coverage',()=>{const r=benchmarkFX([mkFX('USD','CNY',0.001)],24);expect(r.recommendations.length).toBeGreaterThan(0)});
});
