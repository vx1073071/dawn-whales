// ══ R270 LOBEHUB P1: v3.1.0终报 ══
export interface QualityDim{name:string;score:number;status:'PASS'|'WARNING'|'FAIL'}
export interface V310Report{version:string;overallScore:number;overall:'SHIP'|'SHIP_WITH_CAUTION'|'HOLD';dimensions:QualityDim[];revenue:{base:number;best:number;worst:number};highlights:string[];risks:string[];signOff:string[]}
export function genV310(dq:number,ps:number,pf:number,ic:number,pt:number,dau:number=2000):V310Report{
  const d: QualityDim[] = [
    { name: '行情数据', score: dq, status: dq >= 80 ? 'PASS' as const : dq >= 60 ? 'WARNING' as const : 'FAIL' as const },
    { name: '推送系统', score: ps, status: ps >= 85 ? 'PASS' as const : ps >= 65 ? 'WARNING' as const : 'FAIL' as const },
    { name: '渲染性能', score: pf, status: pf >= 80 ? 'PASS' as const : pf >= 60 ? 'WARNING' as const : 'FAIL' as const },
    { name: '指标覆盖', score: ic, status: ic >= 90 ? 'PASS' as const : ic >= 70 ? 'WARNING' as const : 'FAIL' as const },
    { name: '形态识别', score: pt, status: pt >= 85 ? 'PASS' as const : pt >= 70 ? 'WARNING' as const : 'FAIL' as const },
  ];
  const avg=d.reduce((s,x)=>s+x.score,0)/5;const fc=d.filter(x=>x.status==='FAIL').length;const wc=d.filter(x=>x.status==='WARNING').length;
  let ov:V310Report['overall'];if(fc>0)ov='HOLD';else if(wc>1)ov='SHIP_WITH_CAUTION';else ov='SHIP';
  const rev={base:Math.round(dau*3*0.04*0.05*1.5*30),best:Math.round(dau*3*0.06*0.06*1.8*30),worst:Math.round(dau*2*0.02*0.03*1.2*30)};
  const hl=d.filter(x=>x.status==='PASS').map(x=>`✅ ${x.name}`);const rk=d.filter(x=>x.status==='FAIL').map(x=>`❌ ${x.name}`);
  return{version:'v3.1.0',overallScore:Math.round(avg),overall:ov,dimensions:d,revenue:rev,highlights:hl,risks:rk,signOff:ov!=='SHIP'?['Owner确认']:[]};
}
export default V310Report;
