// ══ R268 LOBEHUB P2: 93指标渲染性能基准 ══
// 93-Indicator Render Performance — 29→93后渲染会不会卡？
export interface RenderProfile {
  indicatorCount:number;category:string;
  renderTimeMs:number;fps:number;memoryMB:number;
  chartType:'main'|'sub'; // 主图/副图
  status:'FAST'|'ACCEPTABLE'|'SLOW'|'UNUSABLE';
}

export interface RenderBenchmarkReport {
  timestamp:number;overall:'PASS'|'WARNING'|'FAIL';
  avgFps:number;avgRenderMs:number;avgMemoryMB:number;
  byCount:Record<number,{fps:number;renderMs:number;memoryMB:number}>;
  recommendations:string[];
}

export function generateRenderBenchmark(profiles:RenderProfile[]):RenderBenchmarkReport{
  if(profiles.length===0)return{timestamp:Date.now(),overall:'FAIL',avgFps:0,avgRenderMs:0,avgMemoryMB:0,byCount:{},recommendations:['无样本']};
  const avgFps=profiles.reduce((s,p)=>s+p.fps,0)/profiles.length;
  const avgRender=profiles.reduce((s,p)=>s+p.renderTimeMs,0)/profiles.length;
  const avgMem=profiles.reduce((s,p)=>s+p.memoryMB,0)/profiles.length;

  const byCount:Record<number,any>={};
  for(const p of profiles){
    if(!byCount[p.indicatorCount])byCount[p.indicatorCount]={fps:0,renderMs:0,memoryMB:0,samples:0};
    byCount[p.indicatorCount].fps+=p.fps;byCount[p.indicatorCount].renderMs+=p.renderTimeMs;
    byCount[p.indicatorCount].memoryMB+=p.memoryMB;byCount[p.indicatorCount].samples++;
  }
  for(const k of Object.keys(byCount)){const v=byCount[+k];v.fps=Math.round(v.fps/v.samples);v.renderMs=Math.round(v.renderMs/v.samples);v.memoryMB=Math.round(v.memoryMB/v.samples)}

  const recs:string[]=[];
  // 10 indicators = baseline
  const baseline=byCount[10];
  if(byCount[93]&&baseline){
    const slowDown=byCount[93].renderMs/baseline.renderMs;
    if(slowDown>3)recs.push(`⚠️ 93指标渲染比10指标慢${slowDown.toFixed(1)}×`);
    else recs.push(`✅ 93指标渲染仅慢${slowDown.toFixed(1)}×——扩展性良好`);
  }
  if(avgFps<30)recs.push(`❌ 平均帧率${Math.round(avgFps)}FPS——影响交互`);

  let overall:'PASS'|'WARNING'|'FAIL'='PASS';
  if(avgFps<20||avgRender>500)overall='FAIL';
  else if(avgFps<30||avgRender>200)overall='WARNING';

  return{timestamp:Date.now(),overall,avgFps:Math.round(avgFps),avgRenderMs:Math.round(avgRender),avgMemoryMB:Math.round(avgMem),byCount,recommendations:recs};
}

export default RenderBenchmarkReport;
