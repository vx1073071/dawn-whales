// ══ R270 LOBEHUB P2: 收入预测复核 ══
export interface RevenueFactor{name:string;weight:number;direction:'UP'|'DOWN';magnitude:number}
export interface RevenueReview{timestamp:number;confidence:'HIGH'|'MEDIUM'|'LOW';adjustedBase:number;adjustedBest:number;adjustedWorst:number;factors:RevenueFactor[];recommendation:string}
export function reviewRevenue(baseRevenue:number,dau:number,arpu:number,retentionRate:number,conversionRate:number):RevenueReview{
  const factors:RevenueFactor[]=[];
  if(dau>=2000)factors.push({name:'DAU健康',weight:0.3,direction:'UP',magnitude:0.15});
  else if(dau<1500)factors.push({name:'DAU偏弱',weight:0.3,direction:'DOWN',magnitude:0.2});
  if(retentionRate>=75)factors.push({name:'留存优秀',weight:0.25,direction:'UP',magnitude:0.1});
  else if(retentionRate<50)factors.push({name:'留存偏低',weight:0.25,direction:'DOWN',magnitude:0.15});
  if(arpu>=2.5)factors.push({name:'ARPU强劲',weight:0.25,direction:'UP',magnitude:0.2});
  else if(arpu<1.5)factors.push({name:'ARPU偏弱',weight:0.25,direction:'DOWN',magnitude:0.15});
  if(conversionRate>=0.05)factors.push({name:'转化优秀',weight:0.2,direction:'UP',magnitude:0.1});
  else if(conversionRate<0.03)factors.push({name:'转化偏低',weight:0.2,direction:'DOWN',magnitude:0.1});
  let adj=1;factors.forEach(f=>{adj+=f.direction==='UP'?f.magnitude*f.weight:-f.magnitude*f.weight});
  const adjustedBase=Math.round(baseRevenue*adj);
  const adjustedBest=Math.round(adjustedBase*1.3);
  const adjustedWorst=Math.round(adjustedBase*0.6);
  const up=factors.filter(f=>f.direction==='UP').length;
  const dn=factors.filter(f=>f.direction==='DOWN').length;
  let c:'HIGH'|'MEDIUM'|'LOW';
  if(up>=3&&dn===0)c='HIGH';
  else if(dn>=3&&up===0)c='LOW';
  else c='MEDIUM';
  return{timestamp:Date.now(),confidence:c,adjustedBase,adjustedBest,adjustedWorst,factors,recommendation:c==='HIGH'?'继续保持增长':c==='LOW'?'需要紧急优化留存和转化':'关注留存和转化指标'};
}
export default RevenueReview;
