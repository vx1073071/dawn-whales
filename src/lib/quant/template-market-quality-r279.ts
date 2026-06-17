// R279 P2 fix
export interface FactorTemplate{id:string;name:string;nameCn:string;authorId:string;authorName:string;category:string;factors:string[];factorsCount:number;downloads:number;rating:number;reviewCount:number;perfMonths:number;monthlyReturn:number;maxDrawdown:number;sharpe:number;qualityFlags:string[]}
export interface TemplateMarketReport{timestamp:number;totalTemplates:number;avgRating:number;avgDownloads:number;topCreators:{authorId:string;authorName:string;templates:number;totalDownloads:number;avgRating:number}[];qualityDistribution:{high:number;medium:number;low:number};worstTemplates:{name:string;author:string;rating:number;flag:string}[];overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function evaluateTemplateMarket(templates:FactorTemplate[]):TemplateMarketReport{
  if(templates.length===0)return{timestamp:Date.now(),totalTemplates:0,avgRating:0,avgDownloads:0,topCreators:[],qualityDistribution:{high:0,medium:0,low:0},worstTemplates:[],overall:'FAIL',recommendations:['数据为空']};
  const avgR=templates.reduce((s,x)=>s+x.rating,0)/templates.length;
  const avgD=templates.reduce((s,x)=>s+x.downloads,0)/templates.length;
  const creators:Record<string,any>={};
  for(const x of templates){if(!creators[x.authorId])creators[x.authorId]={name:x.authorName,templates:0,totalDownloads:0,sumRating:0};creators[x.authorId].templates++;creators[x.authorId].totalDownloads+=x.downloads;creators[x.authorId].sumRating+=x.rating}
  const top=Object.entries(creators).sort((a,b)=>b[1].templates-a[1].templates).slice(0,10).map(([id,info])=>({authorId:id,authorName:info.name,templates:info.templates,totalDownloads:info.totalDownloads,avgRating:Math.round(info.sumRating/info.templates*100)/100}));
  const high=templates.filter(t=>t.rating>=4&&t.sharpe>=0.5&&t.qualityFlags.length===0).length;
  const medium=templates.filter(t=>t.rating>=3&&t.rating<4||t.sharpe<0.5&&t.sharpe>=0||t.qualityFlags.length>0).length;
  const low=templates.filter(t=>t.rating<3||t.sharpe<0).length;
  const worst=templates.filter(t=>t.rating<3||t.sharpe<0).sort((a,b)=>a.rating-b.rating).slice(0,5).map(tmp=>{const f=tmp.qualityFlags&&tmp.qualityFlags.length>0?tmp.qualityFlags.join('; '):'low';return{name:tmp.nameCn||tmp.name,author:tmp.authorName,rating:tmp.rating,flag:f}});
  const highRate=high/templates.length;
  let o:'PASS'|'WARNING'|'FAIL';
  if(highRate>=0.6&&avgR>=3.5)o='PASS';
  else if(highRate>=0.3)o='WARNING';else o='FAIL';
  const recs:string[]=[];
  if(avgR<3.5)recs.push('avg rating low');
  if(low>0)recs.push(`${low} low quality`);
  return{timestamp:Date.now(),totalTemplates:templates.length,avgRating:Math.round(avgR*100)/100,avgDownloads:Math.round(avgD*100)/100,topCreators:top,qualityDistribution:{high,medium,low},worstTemplates:worst,overall:o,recommendations:recs};
}
export default TemplateMarketReport;
