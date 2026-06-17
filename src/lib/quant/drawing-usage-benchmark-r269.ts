// ══ R269 LOBEHUB P1: 画线使用率基准 ══
// Drawing Tool Usage Benchmark — 68种画线工具谁在用？用了多少次？
export type DrawingToolId='trendline'|'horizontal_line'|'vertical_line'|'ray'|'arrow'|'fib_retracement'|'fib_extension'|'fib_channel'|'fib_timezone'|'pitchfork'|'parallel_channel'|'rect'|'ellipse'|'text'|'label'|'xabcd_pattern'|'gann_fan'|'gann_box'|'regression_channel'|'brush';

export interface DrawingUsageSample {
  toolId:DrawingToolId;toolName:string;category:string;
  dailyUsers:number;dailyDrawings:number;avgPerUser:number;
  retentionRate:number; // 7天留存
  conversionRate:number; // 使用→付费
}

export interface DrawingUsageReport {
  timestamp:number;totalDailyUsers:number;totalDailyDrawings:number;
  top10:Array<{toolId:string;toolName:string;dailyUsers:number;dailyDrawings:number}>;
  byCategory:Array<{category:string;tools:number;totalUsers:number;pctOfTotal:number}>;
  highRetentionTools:string[];highConversionTools:string[];
  recommendations:string[];
}

export function generateDrawingUsageReport(samples:DrawingUsageSample[]):DrawingUsageReport{
  if(samples.length===0)return{timestamp:Date.now(),totalDailyUsers:0,totalDailyDrawings:0,top10:[],byCategory:[],highRetentionTools:[],highConversionTools:[],recommendations:['无样本']};

  const totalUsers=samples.reduce((s,x)=>s+x.dailyUsers,0);
  const totalDrawings=samples.reduce((s,x)=>s+x.dailyDrawings,0);
  const sorted=[...samples].sort((a,b)=>b.dailyUsers-a.dailyUsers);
  const top10=sorted.slice(0,10).map(s=>({toolId:s.toolId,toolName:s.toolName,dailyUsers:s.dailyUsers,dailyDrawings:s.dailyDrawings}));

  const cats=new Map<string,DrawingUsageSample[]>();
  for(const s of samples){const g=cats.get(s.category)||[];g.push(s);cats.set(s.category,g)}
  const byCategory=Array.from(cats.entries()).map(([cat,ss])=>({category:cat,tools:ss.length,totalUsers:ss.reduce((a,s)=>a+s.dailyUsers,0),pctOfTotal:Math.round(ss.reduce((a,s)=>a+s.dailyUsers,0)/totalUsers*100)})).sort((a,b)=>b.totalUsers-a.totalUsers);

  const highRetention=samples.filter(s=>s.retentionRate>0.5).map(s=>s.toolName);
  const highConversion=samples.filter(s=>s.conversionRate>0.1).map(s=>s.toolName);

  const recs:string[]=[];
  const fibTools=samples.filter(s=>s.toolId.includes('fib'));
  if(fibTools.length>0&&fibTools.reduce((a,s)=>a+s.dailyUsers,0)>totalUsers*0.2)recs.push('💡 斐波那契工具使用率高——可考虑收费模板');
  if(highConversion.length>0)recs.push(`💰 高转化工具(${highConversion.slice(0,3).join('、')})——推广优先级最高`);
  const lowRetention=samples.filter(s=>s.retentionRate<0.3).map(s=>s.toolName);
  if(lowRetention.length>3)recs.push(`⚠️ 低留存工具(${lowRetention.slice(0,3).join('、')})——需使用引导`);

  return{timestamp:Date.now(),totalDailyUsers:totalUsers,totalDailyDrawings:totalDrawings,top10,byCategory,highRetentionTools:highRetention,highConversionTools:highConversion,recommendations:recs};
}

export default DrawingUsageReport;
