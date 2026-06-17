// ══ R265 LOBEHUB P3: 新10指标 vs TradingView对标 ══
import { INDICATOR_DEFS } from '../../components/chart/IndicatorPanel';
export interface IndicatorComparison {
  id:string;name:string;category:string;
  quantMoo:boolean;tradingView:boolean;gap:'FULL'|'PARTIAL'|'MISSING';
  twParams:number;twDescription:string;recommendation:string;
}
export interface IndicatorGapReport {
  timestamp:number;totalTW:number;totalQM:number;coverage:number;
  fullMatches:IndicatorComparison[];partialMatches:IndicatorComparison[];missing:IndicatorComparison[];
  priorityAdds:string[];
}
export const TW_INDICATORS:Array<{id:string;name:string;category:string;params:number;desc:string}>=[
  {id:'volume_profile',name:'成交量分布',category:'volume',params:3,desc:'TradingView #1使用率'},
  {id:'market_structure',name:'市场结构',category:'trend',params:2,desc:'HH/HL自动标注'},
  {id:'order_flow',name:'订单流',category:'volume',params:5,desc:'Delta/CVD'},
  {id:'supertrend',name:'超级趋势',category:'trend',params:2,desc:'ATR趋势线——散户最易理解'},
  {id:'vwap_bands',name:'VWAP带',category:'overlay',params:2,desc:'日内交易核心'},
  {id:'ichimoku',name:'一目均衡',category:'trend',params:3,desc:'五线合一'},
  {id:'pivot_points',name:'枢轴点',category:'overlay',params:1,desc:'S/R自动检测'},
  {id:'renko',name:'砖型图',category:'trend',params:1,desc:'去噪K线'},
  {id:'heikin_ashi',name:'平滑K线',category:'trend',params:0,desc:'趋势K线变体'},
  {id:'correlation_matrix',name:'相关性矩阵',category:'momentum',params:2,desc:'多标的联动'},
];
export function compareToTradingView():IndicatorGapReport{
  const qmIds=new Set(INDICATOR_DEFS.map(i=>i.id));
  const full:IndicatorComparison[]=[];const partial:IndicatorComparison[]=[];const missing:IndicatorComparison[]=[];
  for(const tw of TW_INDICATORS){
    if(qmIds.has(tw.id)){full.push({...tw,quantMoo:true,tradingView:true,gap:'FULL',twParams:tw.params,twDescription:tw.desc,recommendation:'✅ 已覆盖'});continue}
    const similar=INDICATOR_DEFS.find(q=>q.category===tw.category&&(q.id.includes(tw.id.split('_')[0])||tw.id.includes(q.id)));
    if(similar){partial.push({...tw,quantMoo:true,tradingView:true,gap:'PARTIAL',twParams:tw.params,twDescription:tw.desc,recommendation:`有类似(${similar.shortLabel})——需增强到${tw.name}`});continue}
    missing.push({...tw,quantMoo:false,tradingView:true,gap:'MISSING',twParams:tw.params,twDescription:tw.desc,recommendation:`📌 建议添加——${tw.desc}`});
  }
  return{timestamp:Date.now(),totalTW:TW_INDICATORS.length,totalQM:INDICATOR_DEFS.length,coverage:Math.round(full.length/TW_INDICATORS.length*100),fullMatches:full,partialMatches:partial,missing,priorityAdds:['volume_profile','supertrend','pivot_points','heikin_ashi','market_structure']};
}
export default IndicatorGapReport;
