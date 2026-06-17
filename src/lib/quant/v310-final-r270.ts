// ══ R270 LOBEHUB P1: v3.1.0数据质量终报 ══
export interface QualityDimension{name:string;score:number;status:'PASS'|'WARNING'|'FAIL';details:string}
export interface v310FinalReport{version:string;timestamp:number;overallScore:number;overall:'SHIP'|'SHIP_WITH_CAUTION'|'HOLD';dimensions:QualityDimension[];revenueProjection:{base:number;best:number;worst:number};highlights:string[];risks:string[];signOffRequired:string[]}
export function generateV310Report(dq:number,ps:number,pf:number,ic:number,pat:number,dau:number=2000):v310FinalReport{
  const dims:QualityDimension[]=[
    {name:'行情数据',score:dq,status:dq>=80?'PASS':dq>=60?'WARNING':'FAIL',details:`${dq}/100`},
    {name:'推送系统',score:ps,status:ps>=85?'PASS':ps>=65?'WARNING':'FAIL',details:`${ps}/100`},
    {name:'渲染性能',score:pf,status:pf>=80?'PASS':pf>=60?'WARNING':'FAIL',details:`${pf}/100`},
    {name:'指标覆盖',score:ic,status:ic>=90?'PASS':ic>=70?'WARNING':'FAIL',details:`${ic}/100`},
    {name:'形态识别',score:pat,status:pat>=85?'PASS':pat>=70?'WARNING':'FAIL',details:`${pat}/100`},
  ];
  const avg=dims.reduce((s,d)=>s+d.score,0)/5;
  const fail=dims.filter(d=>d.status==='FAIL').length;
  const warn=dims.filter(d=>d.status==='WARNING').length;
  let ov:v310FinalReport['overall'];if(fail>0)ov='HOLD';else if(warn>1)ov='SHIP_WITH_CAUTION';else ov='SHIP';
  const rev={base:Math.round(dau*3*0.04*0.05*1.5*30),best:Math.round(dau*3*0.06*0.06*1.8*30),worst:Math.round(dau*2*0.02*0.03*1.2*30)};
  const hl:string[]=[],rk:string[]=[];
  for(const d of dims){if(d.status==='PASS')hl.push(d.name);else rk.push(d.name)}
  return{version:'v3.1.0',timestamp:Date.now(),overallScore:Math.round(avg),overall:ov,dimensions:dims,revenueProjection:rev,highlights:hl,risks:rk,signOffRequired:ov!=='SHIP'?['Owner确认']:[]};
}
export default v310FinalReport;
