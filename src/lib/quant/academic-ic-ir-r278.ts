// ══ R278 LOBEHUB P2: 学术IC/IR vs 文献 ══
export interface AcademicFactor {
  id:string; name:string; nameCn:string; author:string; pubYear:number; journal:string;
  category:string; samplePeriod:string; ourIC:number; ourIR:number;
  literatureIC:number; literatureIR:number;
  icDeviation:number; irDeviation:number;
  replicationStatus:'EXACT_MATCH'|'CLOSE'|'DIVERGENT'|'UNAVAILABLE';
}
export interface AcademicICReport {
  timestamp:number; totalFactors:number;
  replicationSummary:{exact:number;close:number;divergent:number;unavailable:number};
  avgICMatch:number; avgIRMatch:number;
  byJournal: Record<string,{count:number;avgICDev:number;replicationRate:number}>;
  byYear: Record<string,{count:number;avgIC:number}>;
  topReplicated: {name:string;author:string;ourIC:number;litIC:number;deviation:number}[];
  divergentFactors: {name:string;author:string;ourIC:number;litIC:number;deviation:number;reason:string}[];
  overall: 'PASS'|'WARNING'|'FAIL'; recommendations:string[];
}
export function benchmarkAcademicICIR(
  factors:AcademicFactor[],
  targetMatchRate:number=0.7
):AcademicICReport{
  if(factors.length===0)return{timestamp:Date.now(),totalFactors:0,replicationSummary:{exact:0,close:0,divergent:0,unavailable:0},avgICMatch:0,avgIRMatch:0,byJournal:{},byYear:{},topReplicated:[],divergentFactors:[],overall:'FAIL',recommendations:['数据为空']};
  const exact=factors.filter(f=>f.replicationStatus==='EXACT_MATCH');
  const close=factors.filter(f=>f.replicationStatus==='CLOSE');
  const divergent=factors.filter(f=>f.replicationStatus==='DIVERGENT');
  const unavailable=factors.filter(f=>f.replicationStatus==='UNAVAILABLE');
  const totalWithData=factors.filter(f=>f.replicationStatus!=='UNAVAILABLE');
  const avgICMatch=totalWithData.length>0?Math.round(totalWithData.reduce((s,f)=>s+f.icDeviation,0)/totalWithData.length*100)/100:0;
  const avgIRMatch=totalWithData.length>0?Math.round(totalWithData.reduce((s,f)=>s+f.irDeviation,0)/totalWithData.length*100)/100:0;
  const byJournal:Record<string,any>={};
  const byYear:Record<string,any>={};
  for(const f of factors){
    if(!byJournal[f.journal])byJournal[f.journal]={count:0,sumICDev:0,replicated:0};
    byJournal[f.journal].count++;byJournal[f.journal].sumICDev+=f.icDeviation;
    if(f.replicationStatus!=='UNAVAILABLE')byJournal[f.journal].replicated++;
    if(!byYear[f.pubYear])byYear[f.pubYear]={count:0,sumIC:0};
    byYear[f.pubYear].count++;byYear[f.pubYear].sumIC+=f.ourIC;
  }
  for(const j of Object.keys(byJournal)){byJournal[j].avgICDev=Math.round(byJournal[j].sumICDev/byJournal[j].count*100)/100;byJournal[j].replicationRate=Math.round(byJournal[j].replicated/byJournal[j].count*100);delete byJournal[j].sumICDev;delete byJournal[j].replicated}
  for(const y of Object.keys(byYear)){byYear[y].avgIC=Math.round(byYear[y].sumIC/byYear[y].count*10000)/10000;delete byYear[y].sumIC}
  const topReplicated=exact.slice(0,5).concat(close.filter(f=>f.icDeviation<=3).slice(0,5)).slice(0,8).map(f=>({name:f.nameCn||f.name,author:f.author,ourIC:f.ourIC,litIC:f.literatureIC,deviation:f.icDeviation}));
  const replRate=totalWithData.length>0?(exact.length+close.length)/totalWithData.length:0;
  let o:'PASS'|'WARNING'|'FAIL';
  if(replRate>=targetMatchRate&&divergent.length<=3&&unavailable.length<=2)o='PASS';
  else if(replRate>=0.4&&divergent.length<=5)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(divergent.length>3)recs.push(`${divergent.length}个与文献显著偏离——需审查实现`);
  if(replRate<0.7)recs.push(`可复现率${(replRate*100).toFixed(0)}%低于70%`);
  return{timestamp:Date.now(),totalFactors:factors.length,replicationSummary:{exact:exact.length,close:close.length,divergent:divergent.length,unavailable:unavailable.length},avgICMatch,avgIRMatch,byJournal,byYear,topReplicated,divergentFactors:divergent.slice(0,5).map(f=>({name:f.nameCn||f.name,author:f.author,ourIC:f.ourIC,litIC:f.literatureIC,deviation:f.icDeviation,reason:'需审查数据源或参数'})),overall:o,recommendations:recs};
}
export default AcademicICReport;
