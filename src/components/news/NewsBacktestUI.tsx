// @ts-nocheck
// R242 ML#2: NewsBacktestUI — News-driven event backtest UI
import React, { useState } from 'react';

export interface NewsEvent { id: string; title: string; date: string; category: string; symbols: string[]; impact: string; }
export interface BacktestConfig { eventId: string; lookbackDays: number; holdDays: number; stopLoss: number; takeProfit: number; positionSize: number; }
export interface BacktestResult { eventId: string; totalReturn: number; winRate: number; avgReturn: number; maxDrawdown: number; sharpe: number; trades: number; dailyReturns: number[]; symbolResults: { symbol: string; return: number }[]; }
export interface NewsBacktestUIProps { events: NewsEvent[]; config: BacktestConfig; result: BacktestResult | null; onConfigChange: (c: Partial<BacktestConfig>) => void; onRunBacktest: (id: string) => void; isRunning?: boolean; className?: string; }

export default function NewsBacktestUI(p: NewsBacktestUIProps) {
  const { events, config, result, onConfigChange, onRunBacktest, isRunning, className } = p;
  const [sel, setSel] = useState(config.eventId);
  const keys = ['lookbackDays','holdDays','stopLoss','takeProfit','positionSize'] as const;
  const labels = ['Lookback (days)','Hold (days)','Stop Loss %','Take Profit %','Position Size %'];
  const mins = [1,1,1,1,1]; const maxs = [90,60,20,50,100]; const steps = [1,1,0.5,1,5];
  
  return React.createElement('div', { className: 'news-backtest ' + (className||''), style: { display:'flex',flexDirection:'column',height:'100%',padding:14 } }, [
    React.createElement('div', { key:'t', style: { fontSize:15,fontWeight:700,color:'var(--text-primary,#e2e8f0)',marginBottom:12 } }, '📰 Event Backtest'),
    React.createElement('div', { key:'ev', style: { display:'flex',gap:4,overflow:'auto',marginBottom:12 } },
      events.slice(0,10).map(e => React.createElement('button', { key:e.id, onClick:()=>setSel(e.id), style:{ padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:500,border:sel===e.id?'1px solid var(--brand,#d4a574)':'1px solid var(--border-color,#334155)',background:sel===e.id?'var(--brand-bg,rgba(212,165,116,0.15))':'var(--surface-2,#1e293b)',color:sel===e.id?'var(--brand,#d4a574)':'var(--text-secondary,#94a3b8)',cursor:'pointer',whiteSpace:'nowrap' } }, e.title.slice(0,30)))
    ),
    React.createElement('div', { key:'cfg', style: { display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8,marginBottom:12 } },
      keys.map((k,i) => React.createElement('div', { key:k, style:{fontSize:11} }, [
        React.createElement('div', { style:{color:'var(--text-tertiary,#64748b)',marginBottom:3} }, labels[i]),
        React.createElement('input', { type:'number',min:mins[i],max:maxs[i],step:steps[i],value:config[k], onChange:e=>onConfigChange({[k]:parseFloat(e.target.value)||0}), style:{width:'100%',padding:'5px 8px',borderRadius:6,fontSize:11,border:'1px solid var(--border-color,#334155)',background:'var(--surface-2,#1e293b)',color:'var(--text-primary,#e2e8f0)'} }),
      ]))
    ),
    React.createElement('button', { key:'run', onClick:()=>onRunBacktest(sel), disabled:isRunning, style:{ padding:'10px',borderRadius:8,border:'none',marginBottom:12,background:isRunning?'var(--surface-2,#1e293b)':'var(--brand,#d4a574)',color:isRunning?'var(--text-tertiary,#64748b)':'#000',fontSize:14,fontWeight:600,cursor:isRunning?'not-allowed':'pointer' } }, isRunning?'🔄 Running...':'▶ Run Backtest (1U)'),
    result ? React.createElement('div', { key:'res' }, [
      React.createElement('div', { key:'met', style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:8,marginBottom:12} }, [
        {l:'Total Return',v:result.totalReturn.toFixed(1)+'%',c:result.totalReturn>=0?'#22c55e':'#ef4444'},
        {l:'Win Rate',v:result.winRate.toFixed(0)+'%',c:'#d4a574'},
        {l:'Avg Return',v:result.avgReturn.toFixed(1)+'%',c:result.avgReturn>=0?'#22c55e':'#ef4444'},
        {l:'Sharpe',v:result.sharpe.toFixed(2),c:'#3b82f6'},
        {l:'Max DD',v:result.maxDrawdown.toFixed(1)+'%',c:'#ef4444'},
        {l:'Trades',v:String(result.trades),c:'#94a3b8'},
      ].map(m => React.createElement('div',{key:m.l,style:{padding:8,borderRadius:8,background:'var(--surface-2,#1e293b)',textAlign:'center'}}, [
        React.createElement('div',{style:{fontSize:10,color:'var(--text-tertiary,#64748b)'}},m.l),
        React.createElement('div',{style:{fontSize:16,fontWeight:700,color:m.c}},m.v),
      ]))),
      React.createElement('div',{style:{fontSize:11,fontWeight:600,color:'var(--text-secondary,#94a3b8)',marginBottom:4}},'Per Symbol'),
      React.createElement('div',{style:{display:'flex',gap:5,flexWrap:'wrap'}},
        result.symbolResults.map(sr => React.createElement('span',{key:sr.symbol,style:{padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:600,background:sr.return>=0?'#22c55e15':'#ef444415',color:sr.return>=0?'#22c55e':'#ef4444',border:'1px solid '+(sr.return>=0?'#22c55e40':'#ef444440')}},sr.symbol+': '+(sr.return>=0?'+':'')+sr.return.toFixed(1)+'%'))
      ),
    ]) : null,
  ]);
}
