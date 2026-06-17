// ══ R271 LOBEHUB P2: 画线→策略转化A/B ══
export interface DrawingToStrategyAB{testId:string;variant:'A'|'B';description:string;drawingUsers:number;strategyClicks:number;ctr:number;strategyCreated:number;conversionRate:number;revenue:number}
export interface DTStrategyReport{timestamp:number;winner:'A'|'B'|'TIE';lift:number;recommendation:string;variants:DrawingToStrategyAB[]}

export function analyzeDrawingToStrategy(a:DrawingToStrategyAB,b:DrawingToStrategyAB):DTStrategyReport{
  let aW=0,bW=0;if(a.ctr>b.ctr*1.05)aW++;else if(b.ctr>a.ctr*1.05)bW++;if(a.conversionRate>b.conversionRate*1.05)aW++;else if(b.conversionRate>a.conversionRate*1.05)bW++;
  let w:'A'|'B'|'TIE'='TIE';if(aW>bW)w='A';else if(bW>aW)w='B';
  const lift=b.ctr>0?(a.ctr-b.ctr)/b.ctr:0;
  return{timestamp:Date.now(),winner:w,lift,recommendation:w==='A'?'A胜出——直接展示按钮':w==='B'?'B胜出——沿用现有':'差异不显著——继续测试',variants:[a,b]};
}
export default DTStrategyReport;
