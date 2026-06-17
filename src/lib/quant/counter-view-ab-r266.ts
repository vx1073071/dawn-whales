// ══ R266 LOBEHUB P3: 反向观点A/B基准 ══
// Counter-View A/B Baseline — "强制展示反向观点"能否提升用户信任？
export interface CounterViewSample {
  testId:string;variant:'A'|'B';userId:string;
  aShowed:boolean; // A=有反向观点展示
  bShowed:boolean; // B=无反向观点(纯AI推荐)
  userClicked:boolean;userPurchased:boolean;userTrustScore?:number;
  sessionDuration:number;
}

export interface CounterViewResult {
  testId:string;totalUsers:number;
  ctrA:number;ctrB:number;ctrLift:number;
  purchaseRateA:number;purchaseRateB:number;purchaseLift:number;
  avgTrustA:number;avgTrustB:number;avgSessionA:number;avgSessionB:number;
  winner:'A'|'B'|'TIE';recommendation:string;
}

export interface CounterViewReport {
  timestamp:number;overallWinner:'A'|'B'|'TIE';
  recommendation:string;results:CounterViewResult[];
}

export function analyzeCounterView(samples:CounterViewSample[]):CounterViewReport{
  const aUsers=samples.filter(s=>s.aShowed);
  const bUsers=samples.filter(s=>s.bShowed);

  const ctrA=aUsers.filter(s=>s.userClicked).length/Math.max(1,aUsers.length);
  const ctrB=bUsers.filter(s=>s.userClicked).length/Math.max(1,bUsers.length);
  const ctrLift=bUsers.length>0?(ctrA-ctrB)/ctrB:0;

  const purchaseA=aUsers.filter(s=>s.userPurchased).length/Math.max(1,aUsers.length);
  const purchaseB=bUsers.filter(s=>s.userPurchased).length/Math.max(1,bUsers.length);
  const purchaseLift=bUsers.length>0?(purchaseA-purchaseB)/purchaseB:0;

  const trustA=aUsers.filter(s=>s.userTrustScore).reduce((a,s)=>a+(s.userTrustScore||0),0)/Math.max(1,aUsers.filter(s=>s.userTrustScore).length);
  const trustB=bUsers.filter(s=>s.userTrustScore).reduce((a,s)=>a+(s.userTrustScore||0),0)/Math.max(1,bUsers.filter(s=>s.userTrustScore).length);

  const avgSessionA=aUsers.reduce((a,s)=>a+s.sessionDuration,0)/Math.max(1,aUsers.length);
  const avgSessionB=bUsers.reduce((a,s)=>a+s.sessionDuration,0)/Math.max(1,bUsers.length);

  // Winner determination
  let aWins=0,bWins=0;
  if(ctrLift>0.05) aWins++;else if(ctrLift<-0.05) bWins++;
  if(purchaseLift>0.05) aWins++;else if(purchaseLift<-0.05) bWins++;
  if(trustA>trustB+0.5) aWins++;else if(trustB>trustA+0.5) bWins++;
  if(avgSessionA>avgSessionB*1.05) aWins++;else if(avgSessionB>avgSessionA*1.05) bWins++;

  let winner:'A'|'B'|'TIE'='TIE';
  if(aWins>bWins+1) winner='A';else if(bWins>aWins+1) winner='B';

  const recommendation=winner==='A'?'✅ 反向观点A方案胜出——展示反方观点提升信任+CTR→建议默认启用':
    winner==='B'?'B方案胜出但需更多数据——建议延长测试':'🤷 A/B差异不显著——继续收集数据';

  const result:CounterViewResult={testId:'r266-counter-view',totalUsers:samples.length,ctrA,ctrB,ctrLift,purchaseRateA:purchaseA,purchaseRateB:purchaseB,purchaseLift,avgTrustA:trustA,avgTrustB:trustB,avgSessionA,avgSessionB,winner,recommendation};

  return{timestamp:Date.now(),overallWinner:winner,recommendation,results:[result]};
}

export default CounterViewReport;
