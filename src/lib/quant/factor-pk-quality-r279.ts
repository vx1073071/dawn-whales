// @ts-nocheck — Record<string,...> dynamic indexing with reduce accumulator
// ══ R279 LOBEHUB P1: 因子PK质量 ══
export interface FactorPK{aFactor:{name:string;ic:number;ir:number;sharpe:number};bFactor:{name:string;ic:number;ir:number;sharpe:number};pkResult:{winner:string;icEdge:number;irEdge:number;sharpeEdge:number;confidence:number};verdict:string}
export interface FactorPKReport{timestamp:number;totalPKs:number;avgConfidence:number;topWinners:{name:string;wins:number;winRate:number;avgIC:number}[];upsets:{weaker:string;stronger:string;confidence:number;reason:string}[];overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function evaluateFactorPKs(pks:FactorPK[]):FactorPKReport{
  if(pks.length===0)return{timestamp:Date.now(),totalPKs:0,avgConfidence:0,topWinners:[],upsets:[],overall:'FAIL',recommendations:['数据为空']};
  const avgConf=pks.reduce((s,x)=>s+x.pkResult.confidence,0)/pks.length;
  const wins:Record<string,{wins:number;total:number;sumIC:number}>=pks.reduce((acc,x)=>{const w=x.pkResult.winner;if(!acc[w])acc[w]={wins:0,total:0,sumIC:0};acc[w].wins++;acc[w].total++;acc[w].sumIC+=x.aFactor.name===w?x.aFactor.ic:x.bFactor.ic;const l=w===x.aFactor.name?x.bFactor.name:x.aFactor.name;if(!acc[l])acc[l]={wins:0,total:0,sumIC:0};acc[l].total++;return acc},{});
  const topW=Object.entries(wins).sort((a,b)=>b[1].wins-a[1].wins).slice(0,10).map(([name,info])=>({name,wins:info.wins,winRate:Math.round(info.wins/info.total*100),avgIC:Math.round(info.sumIC/info.wins*10000)/10000}));
  const upsets=pks.filter(p=>p.pkResult.confidence<0.5&&p.pkResult.winner!=='TIE').map(p=>({weaker:p.pkResult.winner,stronger:p.pkResult.winner===p.aFactor.name?p.bFactor.name:p.aFactor.name,confidence:p.pkResult.confidence,reason:'低置信度PK——参数或数据源可能有问题'}));
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgConf>=0.7&&upsets.length<=pks.length*0.1)o='PASS';
  else if(avgConf>=0.5)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(avgConf<0.7)recs.push(`平均置信度${avgConf.toFixed(2)}偏低`);
  if(upsets.length>0)recs.push(`${upsets.length}个低置信度PK`);
  return{timestamp:Date.now(),totalPKs:pks.length,avgConfidence:Math.round(avgConf*100)/100,topWinners:topW,upsets,overall:o,recommendations:recs};
}
export default FactorPKReport;
