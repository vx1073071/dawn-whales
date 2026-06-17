// ══ R274 LOBEHUB P2: 跨市场联动质量 ══
export interface CrossMarketLink{fromMarket:string;toMarket:string;correlation:number;pValue:number;lagDays:number;direction:'POSITIVE'|'NEGATIVE'|'NEUTRAL';significance:'HIGH'|'MEDIUM'|'LOW'}
export interface CrossMarketReport{timestamp:number;totalLinks:number;avgCorrelation:number;significantLinks:number;topLinks:{from:string;to:string;correlation:number;direction:string}[];dataFreshness:{youngestData:number;oldestData:number;staleHours:number};overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function evaluateCrossMarket(links:CrossMarketLink[],currentTime:number=Date.now()):CrossMarketReport{
  if(links.length===0)return{timestamp:Date.now(),totalLinks:0,avgCorrelation:0,significantLinks:0,topLinks:[],dataFreshness:{youngestData:0,oldestData:0,staleHours:0},overall:'FAIL',recommendations:['数据为空——检查跨市场联动引擎']};
  const avgCor=links.reduce((s,x)=>s+Math.abs(x.correlation),0)/links.length;
  const sig=links.filter(l=>l.significance==='HIGH');
  const top=[...links].sort((a,b)=>Math.abs(b.correlation)-Math.abs(a.correlation)).slice(0,5).map(l=>({from:l.fromMarket,to:l.toMarket,correlation:l.correlation,direction:l.direction}));
  const now=currentTime||Date.now();
  const staleThreshold=24*60*60*1000;
  const staleCount=links.filter(l=>l.lagDays*24*60*60*1000>staleThreshold).length;
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgCor>=0.6&&sig.length>=3&&staleCount===0)o='PASS';
  else if(avgCor>=0.4||sig.length>=1)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(avgCor<0.6)recs.push(`平均相关性${avgCor.toFixed(2)}偏低——检查数据源`);
  if(sig.length<3)recs.push(`仅${sig.length}个显著链接`);
  if(staleCount>0)recs.push(`${staleCount}个链接数据陈旧>24h`);
  return{timestamp:Date.now(),totalLinks:links.length,avgCorrelation:Math.round(avgCor*10000)/10000,significantLinks:sig.length,topLinks:top,dataFreshness:{youngestData:now,oldestData:now-links[links.length-1].lagDays*24*60*60*1000,staleHours:Math.round(staleCount*24)},overall:o,recommendations:recs};
}
export default CrossMarketReport;
