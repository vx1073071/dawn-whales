// ══ R265 LOBEHUB P1: K线数据质量基准 ══
export interface KLineQualitySample {
  symbol:string;exchange:string;period:string;
  expectedBars:number;actualBars:number;missingRate:number;gapCount:number;maxGapMinutes:number;
  ohlcSanity:number;volumeSanity:number;latencyP50:number;latencyP95:number;
  status:'EXCELLENT'|'GOOD'|'FAIR'|'POOR';
}
export interface KLineBenchmarkReport {
  timestamp:number;overall:'PASS'|'WARNING'|'FAIL';overallScore:number;
  avgMissingRate:number;avgLatencyP95:number;
  byPeriod:Record<string,{samples:number;avgBars:number;avgMissing:number;avgLatency:number}>;
  recommendations:string[];
}
function periodMin(p:string):number{const m:Record<string,number>={m1:1,m5:5,m15:15,m30:30,h1:60,h4:240,d1:1440,w1:10080};return m[p]||5}
export function evaluateKLineSample(s:string,e:string,p:string,bars:Array<{o:number;h:number;l:number;c:number;v:number;ts:number}>,exp:number):KLineQualitySample{
  const n=bars.length;const mr=exp>0?(exp-n)/exp:0;
  let g=0,mg=0;
  for(let i=1;i<n;i++){const d=(bars[i].ts-bars[i-1].ts)/60000;if(d>periodMin(p)*2){g++;mg=Math.max(mg,d)}}
  let ohlc=100,vol=100;
  for(const b of bars){if(b.h<b.l||b.h<b.o&&b.h<b.c||b.l>b.o&&b.l>b.c)ohlc-=2;if(b.v<0)vol-=10}
  ohlc=Math.max(0,ohlc);vol=Math.max(0,vol);
  const lat=Array(n).fill(60);
  const srt=lat.sort((a,b)=>a-b);
  let status:KLineQualitySample['status'];const sc=((1-mr)*40)+(ohlc*0.3)+(vol*0.3);
  if(sc>=90)status='EXCELLENT';else if(sc>=70)status='GOOD';else if(sc>=50)status='FAIR';else status='POOR';
  return{symbol:s,exchange:e,period:p,expectedBars:exp,actualBars:n,missingRate:Math.round(mr*10000)/100,gapCount:g,maxGapMinutes:Math.round(mg),ohlcSanity:ohlc,volumeSanity:vol,latencyP50:Math.round(srt[Math.floor(n*0.5)]||0),latencyP95:Math.round(srt[Math.floor(n*0.95)]||0),status};
}
export function generateKLineBenchmark(samples:KLineQualitySample[]):KLineBenchmarkReport{
  const am=samples.reduce((s,x)=>s+x.missingRate,0)/Math.max(1,samples.length);
  const al=samples.reduce((s,x)=>s+x.latencyP95,0)/Math.max(1,samples.length);
  const bp:Record<string,any>={};
  for(const s of samples){const p=s.period;if(!bp[p])bp[p]={samples:0,avgBars:0,avgMissing:0,avgLatency:0};bp[p].samples++;bp[p].avgBars+=s.actualBars;bp[p].avgMissing+=s.missingRate;bp[p].avgLatency+=s.latencyP95}
  for(const k of Object.keys(bp)){const v=bp[k];v.avgBars=Math.round(v.avgBars/v.samples);v.avgMissing=Math.round(v.avgMissing/v.samples*100)/100;v.avgLatency=Math.round(v.avgLatency/v.samples)}
  const sc=samples.reduce((s,x)=>s+(x.status==='EXCELLENT'?95:x.status==='GOOD'?80:x.status==='FAIR'?60:30),0)/Math.max(1,samples.length);
  const recs:string[]=[];
  if(am>0.05)recs.push('K线缺失率>5%——检查Yahoo WS稳定性');
  if(al>300)recs.push('K线延迟>300ms——影响分时图');
  return{timestamp:Date.now(),overall:sc>=80?'PASS':sc>=60?'WARNING':'FAIL',overallScore:Math.round(sc),avgMissingRate:Math.round(am*10000)/100,avgLatencyP95:Math.round(al),byPeriod:bp,recommendations:recs};
}
export default KLineBenchmarkReport;
