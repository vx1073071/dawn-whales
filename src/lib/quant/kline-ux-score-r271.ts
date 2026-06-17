// ══ R271 LOBEHUB P3: K线页体验评分 ══
export interface KLineUXSample{userId:string;loadTimeMs:number;firstInteractionMs:number;totalSessionMs:number;actionsPerSession:number;returned7d:boolean;rating?:number}
export interface KLineUXReport{timestamp:number;overallScore:number;overall:'EXCELLENT'|'GOOD'|'FAIR'|'POOR';avgLoadMs:number;avgFirstInteractionMs:number;avgSessionMs:number;avgActions:number;retention7d:number;avgRating:number;recommendations:string[]}

export function evaluateKLineUX(samples:KLineUXSample[]):KLineUXReport{
  if(samples.length===0)return{timestamp:Date.now(),overallScore:0,overall:'POOR',avgLoadMs:0,avgFirstInteractionMs:0,avgSessionMs:0,avgActions:0,retention7d:0,avgRating:0,recommendations:['无样本']};
  const al=samples.reduce((s,x)=>s+x.loadTimeMs,0)/samples.length;const af=samples.reduce((s,x)=>s+x.firstInteractionMs,0)/samples.length;const as=samples.reduce((s,x)=>s+x.totalSessionMs,0)/samples.length;const aa=samples.reduce((s,x)=>s+x.actionsPerSession,0)/samples.length;const ret=samples.filter(s=>s.returned7d).length/samples.length*100;const rt=samples.filter(s=>s.rating!==undefined);const ar=rt.length>0?rt.reduce((a,s)=>a+(s.rating||0),0)/rt.length:0;
  let sc=100;if(al>3000)sc-=20;else if(al>1500)sc-=10;if(af>5000)sc-=15;if(ret<40)sc-=25;else if(ret<60)sc-=12;if(ar<3)sc-=15;
  const recs:string[]=[];if(al>1500)recs.push(`⚠️ 加载${Math.round(al)}ms`);if(ret<50)recs.push(`⚠️ 7日留存${ret.toFixed(0)}%`);
  return{timestamp:Date.now(),overallScore:Math.max(0,sc),overall:sc>=85?'EXCELLENT':sc>=70?'GOOD':sc>=50?'FAIR':'POOR',avgLoadMs:Math.round(al),avgFirstInteractionMs:Math.round(af),avgSessionMs:Math.round(as),avgActions:Math.round(aa*10)/10,retention7d:Math.round(ret),avgRating:Math.round(ar*100)/100,recommendations:recs};
}
export default KLineUXReport;
