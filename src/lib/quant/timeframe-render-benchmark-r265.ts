// ══ R265 LOBEHUB P2: 多时间框架渲染基准 ══
// Multi-Timeframe Render Benchmark — 四框联动的帧率+延迟+内存
export interface TimeframeRenderSample {
  symbol:string; timeframes:string[]; // ['1m','5m','1d','1w']
  renderTimeMs:number; fps:number; memoryMB:number;
  syncDelayMs:number; // 切换时间框架的延迟
  status:'EXCELLENT'|'GOOD'|'FAIR'|'POOR';
}

export interface MultiTimeframeReport {
  timestamp:number; overall:'PASS'|'WARNING'|'FAIL';
  avgFps:number; avgRenderMs:number; avgMemoryMB:number; avgSyncMs:number;
  byTimeframe:Record<string,{fps:number;renderMs:number}>;
  recommendations:string[];
}

export function evaluateTimeframeRender(samples:TimeframeRenderSample[]):MultiTimeframeReport{
  const avgFps=samples.reduce((s,x)=>s+x.fps,0)/Math.max(1,samples.length);
  const avgRender=samples.reduce((s,x)=>s+x.renderTimeMs,0)/Math.max(1,samples.length);
  const avgMem=samples.reduce((s,x)=>s+x.memoryMB,0)/Math.max(1,samples.length);
  const avgSync=samples.reduce((s,x)=>s+x.syncDelayMs,0)/Math.max(1,samples.length);
  const byTimeframe:Record<string,any>={};
  for(const s of samples){for(const tf of s.timeframes){if(!byTimeframe[tf])byTimeframe[tf]={fps:0,renderMs:0,count:0};byTimeframe[tf].fps+=s.fps;byTimeframe[tf].renderMs+=s.renderTimeMs;byTimeframe[tf].count++}}
  for(const k of Object.keys(byTimeframe)){const v=byTimeframe[k];v.fps=Math.round(v.fps/v.count);v.renderMs=Math.round(v.renderMs/v.count)}
  const recs:string[]=[];
  if(avgFps<30)recs.push(`帧率${Math.round(avgFps)}FPS低于30——影响滚动流畅度`);
  if(avgSync>200)recs.push(`同步延迟${Math.round(avgSync)}ms——时间框架切换卡顿`);
  if(avgMem>200)recs.push(`内存${Math.round(avgMem)}MB偏高——可能有泄漏`);
  return {timestamp:Date.now(),overall:avgFps>=50?'PASS':avgFps>=30?'WARNING':'FAIL',avgFps:Math.round(avgFps),avgRenderMs:Math.round(avgRender),avgMemoryMB:Math.round(avgMem),avgSyncMs:Math.round(avgSync),byTimeframe,recommendations:recs};
}

export default MultiTimeframeReport;
