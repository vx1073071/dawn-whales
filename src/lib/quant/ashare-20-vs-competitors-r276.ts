// ══ R276 LOBEHUB P2: A股20因子 vs 竞品对标 (同花顺/东方财富/富途) ══
export interface AShareFactor{id:string;name:string;nameCn:string;category:string;value:number;unit:string;competitorAvailable:{ths:boolean;eastmoney:boolean;futu:boolean};ourAdvantage:string;userDemandScore:number;accuracy:number}
export interface AShare20Benchmark{timestamp:number;totalFactors:number;coverageVsTHS:{thsTotal:number;ourTotal:number;matchRate:number;missingFromTHS:string[]};coverageVsEastmoney:{emTotal:number;ourTotal:number;matchRate:number};coverageVsFutu:{futuTotal:number;ourTotal:number;matchRate:number};topDemandFactors:{name:string;demandScore:number;available:boolean}[];uniqueFactors:string[];overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function benchmarkAShare20(factors:AShareFactor[],thsRef:{total:number;factorNames:string[]},emRef:{total:number},futuRef:{total:number}):AShare20Benchmark{
  if(factors.length===0)return{timestamp:Date.now(),totalFactors:0,coverageVsTHS:{thsTotal:thsRef.total,ourTotal:0,matchRate:0,missingFromTHS:[]},coverageVsEastmoney:{emTotal:emRef.total,ourTotal:0,matchRate:0},coverageVsFutu:{futuTotal:futuRef.total,ourTotal:0,matchRate:0},topDemandFactors:[],uniqueFactors:[],overall:'FAIL',recommendations:['数据为空']};
  const thsMatch=factors.filter(f=>f.competitorAvailable.ths).length;
  const missing=thsRef.factorNames.filter(n=>!factors.some(f=>f.nameCn===n||f.name===n));
  const thsRate=thsRef.total>0?Math.round(thsMatch/thsRef.total*100):0;
  const emMatch=factors.filter(f=>f.competitorAvailable.eastmoney).length;
  const emRate=emRef.total>0?Math.round(emMatch/emRef.total*100):0;
  const futuMatch=factors.filter(f=>f.competitorAvailable.futu).length;
  const futuRate=futuRef.total>0?Math.round(futuMatch/futuRef.total*100):0;
  const top=[...factors].sort((a,b)=>b.userDemandScore-a.userDemandScore).slice(0,10).map(f=>({name:f.nameCn||f.name,demandScore:f.userDemandScore,available:true}));
  const unique=factors.filter(f=>!f.competitorAvailable.ths&&!f.competitorAvailable.eastmoney&&!f.competitorAvailable.futu).map(f=>f.nameCn||f.name);
  const avgCov=(thsRate+emRate+futuRate)/3;
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgCov>=60&&unique.length>=3)o='PASS';
  else if(avgCov>=20)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(thsRate<80)recs.push(`同花顺匹配${thsRate}%——缺失: ${missing.slice(0,5).join(',')}`);
  if(unique.length<3)recs.push(`独有因子仅${unique.length}个——需要差异化`);
  return{timestamp:Date.now(),totalFactors:factors.length,coverageVsTHS:{thsTotal:thsRef.total,ourTotal:factors.length,matchRate:thsRate,missingFromTHS:missing.slice(0,10)},coverageVsEastmoney:{emTotal:emRef.total,ourTotal:factors.length,matchRate:emRate},coverageVsFutu:{futuTotal:futuRef.total,ourTotal:factors.length,matchRate:futuRate},topDemandFactors:top,uniqueFactors:unique,overall:o,recommendations:recs};
}
export default AShare20Benchmark;
