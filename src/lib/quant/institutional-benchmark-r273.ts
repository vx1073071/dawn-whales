// ══ R273 LOBEHUB P2: 三大法人 vs 官方 KRX/TWSE ══
export interface InstitutionalFlow{market:'KR'|'TW';date:string;institutions:number;foreign:number;dealer:number;totalNet:number;prevClose:number;weightedIndex:number}
export interface InstitutionalBenchmark{timestamp:number;markets:{kr:{foreignNet:number;institutionsNet:number;dealerNet:number;totalNet:number};tw:{foreignNet:number;institutionsNet:number;dealerNet:number;totalNet:number}};vsOfficial:{krExchangeRate:number;twExchangeRate:number;koreaDeviation:number;taiwanDeviation:number};overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkInstitutional(flows:InstitutionalFlow[],official:{koreaForeignNet:number;koreaTotalNet:number;taiwanForeignNet:number;taiwanTotalNet:number}):InstitutionalBenchmark{
  const kr=flows.filter(f=>f.market==='KR');
  const tw=flows.filter(f=>f.market==='TW');
  const krF=kr.reduce((s,x)=>s+x.foreign,0);const krI=kr.reduce((s,x)=>s+x.institutions,0);const krD=kr.reduce((s,x)=>s+x.dealer,0);const krT=krF+krI+krD;
  const twF=tw.reduce((s,x)=>s+x.foreign,0);const twI=tw.reduce((s,x)=>s+x.institutions,0);const twD=tw.reduce((s,x)=>s+x.dealer,0);const twT=twF+twI+twD;
  const krDev=official.koreaForeignNet>0?Math.round(Math.abs(krF-official.koreaForeignNet)/official.koreaForeignNet*100):100;
  const twDev=official.taiwanForeignNet>0?Math.round(Math.abs(twF-official.taiwanForeignNet)/official.taiwanForeignNet*100):100;
  const avgDev=(krDev+twDev)/2;
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgDev<=10)o='PASS';
  else if(avgDev<=30)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(krDev>10)recs.push(`韩国外资偏差${krDev}%—官方${official.koreaForeignNet.toLocaleString()}`);
  if(twDev>10)recs.push(`台湾外资偏差${twDev}%—官方${official.taiwanForeignNet.toLocaleString()}`);
  return{timestamp:Date.now(),markets:{kr:{foreignNet:krF,institutionsNet:krI,dealerNet:krD,totalNet:krT},tw:{foreignNet:twF,institutionsNet:twI,dealerNet:twD,totalNet:twT}},vsOfficial:{krExchangeRate:krDev,twExchangeRate:twDev,koreaDeviation:krDev,taiwanDeviation:twDev},overall:o,recommendations:recs};
}
export default InstitutionalBenchmark;
