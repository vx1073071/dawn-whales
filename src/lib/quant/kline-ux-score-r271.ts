// ══ R271 LOBEHUB P3: K线页体验评分 ══
export interface KLineUXSample{userId:string;loadTimeMs:number;firstInteractionMs:number;totalSessionMs:number;actionsPerSession:number;returned7d:boolean;rating?:number}
export interface KLineUXReport{timestamp:number;overallScore:number;overall:'EXCELLENT'|'GOOD'|'FAIR'|'POOR';avgLoadMs:number;avgFirstInteractionMs:number;avgSessionMs:number;avgActions:number;retention7d:number;avgRating:number;recommendations:string[]}
export function evaluateKLineUX(samples:KLineUXSample[]):KLineUXReport{
  if(samples.length===0)return{timestamp:Date.now(),overallScore:0,overall:'POOR',avgLoadMs:0,avgFirstInteractionMs:0,avgSessionMs:0,avgActions:0,retention7d:0,avgRating:0,recommendations:['无样本']};
  const avgL=samples.reduce((s,x)=>s+x.loadTimeMs,0)/samples.length;const avgF=samples.reduce((s,x)=>s+x.firstInteractionMs,0)/samples.length;const avgS=samples.reduce((s,x)=>s+x.totalSessionMs,0)/samples.length;const avgA=samples.reduce((s,x)=>s+x.actionsPerSession,0)/samples.length;const ret=samples.filter(s=>s.returned7d).length/samples.length*100;const rated=samples.filter(s=>s.rating!==undefined);const avgR=rated.length>0?rated.reduce((a,s)=>a+(s.rating||0),0)/rated.length:0;
  let sc=100;if(avgL>3000)sc-=20;else if(avgL>1500)sc-=10;if(avgF>5000)sc-=15;if(ret<40)sc-=25;else if(ret<60)sc-=12;if(avgR<3)sc-=15;
  let o:'EXCELLENT'|'GOOD'|'FAIR'|'POOR';if(sc>=85)o='EXCELLENT';else if(sc>=70)o='GOOD';else if(sc>=50)o='FAIR';else o='POOR';
  const recs:string[]=[];if(avgL>1500)recs.push(`加载${Math.round(avgL)}ms过高`);if(ret<50)recs.push(`留存${ret.toFixed(0)}%低`);
  return{timestamp:Date.now(),overallScore:Math.max(0,sc),overall:o,avgLoadMs:Math.round(avgL),avgFirstInteractionMs:Math.round(avgF),avgSessionMs:Math.round(avgS),avgActions:Math.round(avgA*10)/10,retention7d:Math.round(ret),avgRating:Math.round(avgR*100)/100,recommendations:recs};
}