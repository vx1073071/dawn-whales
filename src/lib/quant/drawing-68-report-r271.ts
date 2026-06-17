// ══ R271 LOBEHUB P1: 68画线使用率终报 ══
import { generateDrawingUsageReport, DrawingUsageSample } from './drawing-usage-benchmark-r269';
export interface Drawing68Report{
  timestamp:number;totalTools:number;usedTools:number;unusedTools:number;
  adoptionRate:number;topTools:string[];unusedTools_:string[];
  conversionFunnel:{users:number;activeDrawers:number;payingUsers:number;conversionRate:number};
  recommendations:string[];
}
export function generateDrawing68Report(samples:DrawingUsageSample[],totalUsers:number,payingUsers:number):Drawing68Report{
  const base=generateDrawingUsageReport(samples);
  const activeDrawers=samples.reduce((s,x)=>s+x.dailyUsers,0);
  const usedTools=new Set(samples.filter(s=>s.dailyUsers>0).map(s=>s.toolId)).size;
  const unused=samples.filter(s=>s.dailyUsers===0).map(s=>s.toolName);
  const conversionRate=activeDrawers>0?payingUsers/activeDrawers:0;
  const recs:string[]=[];
  if(unused.length>10)recs.push(`⚠️ ${unused.length}个画线工具零使用——考虑隐藏或合并`);
  if(conversionRate<0.05)recs.push('画线→付费转化<5%——需要优化付费入口');
  return{timestamp:Date.now(),totalTools:samples.length,usedTools,unusedTools:unused.length,adoptionRate:Math.round(usedTools/samples.length*100),topTools:base.top10.map(t=>t.toolName),unusedTools_:unused,conversionFunnel:{users:totalUsers,activeDrawers,payingUsers,conversionRate:Math.round(conversionRate*1000)/10},recommendations:recs};
}
export default Drawing68Report;
