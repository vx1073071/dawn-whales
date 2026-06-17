// R284 P2
export interface Indicator50Check{indicatorId:string;name:string;nameCn:string;category:string;algorithmVerified:boolean;dataSource:string;coverageVsTW:number;status:'PASS'|'WARNING'|'FAIL';}
export interface Indicator50Report{timestamp:number;total:number;pass:number;fail:number;passRate:number;byCategory:Record<string,{total:number;pass:number}>;worst:string[];overall:'PASS'|'WARNING'|'FAIL';}
export function auditIndicator50(indicators:Indicator50Check[]):Indicator50Report{
  if(indicators.length===0)return{timestamp:Date.now(),total:0,pass:0,fail:0,passRate:0,byCategory:{},worst:[],overall:'FAIL'};
  const pass=indicators.filter(i=>i.status==='PASS');const fail=indicators.filter(i=>i.status==='FAIL');
  const byCategory:Record<string,any>={};for(const i of indicators){if(!byCategory[i.category])byCategory[i.category]={total:0,pass:0};byCategory[i.category].total++;if(i.status==='PASS')byCategory[i.category].pass++}
  const worst=fail.slice(0,5).map(i=>i.nameCn||i.name);
  let o: 'PASS'|'WARNING'|'FAIL';const pr=Math.round(pass.length/indicators.length*100);if(pr>=90)o='PASS';else if(pr>=70)o='WARNING';else o='FAIL';
  return{timestamp:Date.now(),total:indicators.length,pass:pass.length,fail:fail.length,passRate:pr,byCategory,worst,overall:o};
}
export default Indicator50Report;
