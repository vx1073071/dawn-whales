// ── R208 ML P5: ArbitrageHeatmap — 套利热力图 (AH/ADR/ETF溢价可视化) ──────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// Color-coded heatmap Grid: rows = pair, columns = time/status
// Green=discount, Red=premium, Yellow=fair, intensity = magnitude
// Real-time refresh (polling mock), click to trigger ArbitrageScanEngine (2U)
// Linked with R203 ArbitrageScanPanel

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Tag, Tooltip, Badge, Empty } from 'antd';
import { HeatMapOutlined, SyncOutlined, ThunderboltOutlined, DollarOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';

interface HeatmapCell {
  pairId: string;
  symbolA: string;
  symbolB: string;
  marketA: string;
  marketB: string;
  premiumPct: number; // positive = A premium, negative = B premium
  intensity: 'none'|'low'|'medium'|'high';
  direction: 'A_PREMIUM'|'B_PREMIUM'|'FAIR';
  lastUpdate: number;
  type: 'AH'|'ADR'|'ETF';
  alertTriggered?: boolean;
}

interface Props {
  cells?: HeatmapCell[];
  onScanTrigger?: (pairId: string) => void;
  onCharge?: (serviceId: string, amount: number) => Promise<boolean>;
  balance?: number | null;
  refreshInterval?: number;
  locale?: string;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    title:'套利热力图',sub:'AH/ADR/ETF溢价实时监控',
    refresh:'刷新',autoRefresh:'自动刷新',
    type:'类型',pair:'交易对',premium:'溢价',
    fair:'公允',alert:'触发警戒',
    scan:'套利扫描',scanning:'扫描中',
    price:'2U',scanAll:'全部扫描',
    lastUpdate:'更新',off:'关闭',on:'开启',
    noData:'暂无数据',
    ah:'AH',adr:'ADR',etf:'ETF',
  },
  en: {
    title:'Arbitrage Heatmap',sub:'AH/ADR/ETF Premium Monitor',
    refresh:'Refresh',autoRefresh:'Auto',
    type:'Type',pair:'Pair',premium:'Premium',
    fair:'Fair',alert:'Alert',
    scan:'Arb Scan',scanning:'Scanning',
    price:'2U',scanAll:'Scan All',
    lastUpdate:'Updated',off:'Off',on:'On',
    noData:'No data',
    ah:'AH',adr:'ADR',etf:'ETF',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const DEMO_CELLS: HeatmapCell[] = [
  // AH pairs
  {pairId:'AH_icbc',symbolA:'工商银行',symbolB:'ICBC-H',marketA:'CN',marketB:'HK',premiumPct:3.8,intensity:'high',direction:'A_PREMIUM',lastUpdate:Date.now(),type:'AH',alertTriggered:true},
  {pairId:'AH_pingan',symbolA:'中国平安',symbolB:'PingAn-H',marketA:'CN',marketB:'HK',premiumPct:5.2,intensity:'high',direction:'A_PREMIUM',lastUpdate:Date.now(),type:'AH',alertTriggered:true},
  {pairId:'AH_merchants',symbolA:'招商银行',symbolB:'CMB-H',marketA:'CN',marketB:'HK',premiumPct:4.1,intensity:'high',direction:'A_PREMIUM',lastUpdate:Date.now(),type:'AH',alertTriggered:true},
  {pairId:'AH_ccb',symbolA:'建设银行',symbolB:'CCB-H',marketA:'CN',marketB:'HK',premiumPct:1.2,intensity:'low',direction:'A_PREMIUM',lastUpdate:Date.now(),type:'AH'},
  {pairId:'AH_sinopec',symbolA:'中国石化',symbolB:'Sinopec-H',marketA:'CN',marketB:'HK',premiumPct:2.8,intensity:'medium',direction:'A_PREMIUM',lastUpdate:Date.now(),type:'AH'},
  {pairId:'AH_cmb',symbolA:'招商银行',symbolB:'CMB-H',marketA:'CN',marketB:'HK',premiumPct:-0.5,intensity:'low',direction:'B_PREMIUM',lastUpdate:Date.now(),type:'AH'},
  // ADR pairs
  {pairId:'ADR_baba',symbolA:'Alibaba-ADR',symbolB:'BABA-HK',marketA:'US',marketB:'HK',premiumPct:-2.4,intensity:'medium',direction:'B_PREMIUM',lastUpdate:Date.now(),type:'ADR'},
  {pairId:'ADR_jd',symbolA:'JD-ADR',symbolB:'JD-HK',marketA:'US',marketB:'HK',premiumPct:-4.1,intensity:'high',direction:'B_PREMIUM',lastUpdate:Date.now(),type:'ADR',alertTriggered:true},
  {pairId:'ADR_nio',symbolA:'NIO-ADR',symbolB:'NIO-HK',marketA:'US',marketB:'HK',premiumPct:-3.5,intensity:'high',direction:'B_PREMIUM',lastUpdate:Date.now(),type:'ADR',alertTriggered:true},
  // ETF pairs
  {pairId:'ETF_spy',symbolA:'SPY',symbolB:'NAV',marketA:'US',marketB:'US',premiumPct:0.15,intensity:'low',direction:'FAIR',lastUpdate:Date.now(),type:'ETF'},
  {pairId:'ETF_qqq',symbolA:'QQQ',symbolB:'NAV',marketA:'US',marketB:'US',premiumPct:0.08,intensity:'none',direction:'FAIR',lastUpdate:Date.now(),type:'ETF'},
  {pairId:'ETF_gld',symbolA:'GLD',symbolB:'AUM',marketA:'US',marketB:'US',premiumPct:2.9,intensity:'medium',direction:'A_PREMIUM',lastUpdate:Date.now(),type:'ETF'},
];

const TYPE_COLORS: Record<string,string> = {AH:'#9b59b6',ADR:'#d4a853',ETF:'#4a90d9'};

function getHeatColor(premium: number, intensity: string): string {
  const abs = Math.abs(premium);
  if (intensity === 'high') return abs > 4 ? '#ff4d4f' : '#ff7875';
  if (intensity === 'medium') return '#faad14';
  if (intensity === 'low') return '#52c41a';
  return 'rgba(255,255,255,0.04)';
}

function getBgColor(premium: number, intensity: string): string {
  const hc = getHeatColor(premium, intensity);
  const alpha = intensity === 'high' ? '0.25' : intensity === 'medium' ? '0.15' : '0.08';
  return hc + alpha;
}

const ArbitrageHeatmap: React.FC<Props> = ({
  cells: customCells, onScanTrigger, onCharge, balance,
  refreshInterval = 10000, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [cells, setCells] = useState<HeatmapCell[]>(customCells||DEMO_CELLS);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [scanning, setScanning] = useState<string|null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-refresh with random fluctuation
  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(()=>{
      setCells(prev=>prev.map(c=>({
        ...c,
        premiumPct: c.premiumPct + (Math.random()-0.5)*0.6,
        intensity: Math.abs(c.premiumPct)>4?'high':Math.abs(c.premiumPct)>2?'medium':Math.abs(c.premiumPct)>0.5?'low':'none',
        direction: c.premiumPct>0.5?'A_PREMIUM':c.premiumPct<-0.5?'B_PREMIUM':'FAIR',
        alertTriggered: Math.abs(c.premiumPct) > 3.5,
        lastUpdate: Date.now(),
      })));
      setLastRefresh(Date.now());
    }, refreshInterval);
    return ()=>clearInterval(iv);
  }, [autoRefresh, refreshInterval]);

  const handleScan = useCallback(async (pairId?: string) => {
    setScanning(pairId||'ALL');
    try {
      if (onCharge) {
        const ok = await onCharge('arb_scan', 2);
        if (!ok) { setScanning(null); return; }
      }
      await new Promise(r=>setTimeout(r,1200));
      onScanTrigger?.(pairId||'all');
    } catch {}
    setScanning(null);
  }, [onCharge, onScanTrigger]);

  const alertCount = cells.filter(c=>c.alertTriggered).length;

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(215,48,39,0.15)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <HeatMapOutlined style={{fontSize:22,color:'#ff4d4f'}}/>
          <div>
            <div style={{color:'#e8e8e8',fontSize:16,fontWeight:700}}>{T('title',l)}</div>
            <div style={{color:'#909090',fontSize:12}}>{T('sub',l)} <span style={{color:'#d4a853'}}>{formatTime(lastRefresh)}</span></div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {alertCount>0&&<Badge count={alertCount} style={{backgroundColor:'#ff4d4f'}}><span/></Badge>}
          <Tooltip title={T('autoRefresh',l)}>
            <Tag color={autoRefresh?'green':'default'} style={{cursor:'pointer',margin:0}} onClick={()=>setAutoRefresh(!autoRefresh)}>
              <SyncOutlined spin={autoRefresh}/> {autoRefresh?T('on',l):T('off',l)}
            </Tag>
          </Tooltip>
          <Button size="small" icon={<ThunderboltOutlined/>} loading={scanning==='ALL'}
            onClick={()=>handleScan()} disabled={balance!==null&&balance!==undefined&&balance<2}
            style={{background:'linear-gradient(135deg, #d73027 0%, #b71c1c 100%)',border:'none',color:'#fff',fontWeight:600}}>
            {scanning==='ALL'?T('scanning',l):T('scanAll',l)} <span style={{fontSize:9,opacity:.7}}>{T('price',l)}</span>
          </Button>
        </div>
      </div>

      {/* Heatmap Grid */}
      {(['AH','ADR','ETF'] as Array<'AH'|'ADR'|'ETF'>).map(type=>{
        const items = cells.filter(c=>c.type===type);
        if (items.length===0) return null;
        return (
          <div key={type} style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
              <span style={{width:8,height:8,borderRadius:4,background:TYPE_COLORS[type],display:'inline-block'}}/>
              <span style={{color:'#e8e8e8',fontSize:12,fontWeight:600}}>{T(type.toLowerCase(),l)}</span>
              <span style={{color:'#909090',fontSize:10}}>({items.length})</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:6}}>
              {items.map(cell=>{
                const bg = getBgColor(cell.premiumPct, cell.intensity);
                const color = getHeatColor(cell.premiumPct, cell.intensity);
                return (
                  <Tooltip key={cell.pairId}
                    title={`${cell.symbolA} ↔ ${cell.symbolB} | ${cell.marketA}/${cell.marketB} | ${cell.premiumPct>0?'溢':'折'}价 ${Math.abs(cell.premiumPct).toFixed(1)}%`}>
                    <div onClick={()=>handleScan(cell.pairId)}
                      style={{
                        padding:'8px 10px', borderRadius:8, cursor:'pointer',
                        background: bg,
                        border: cell.alertTriggered?`2px solid ${color}`:'1px solid rgba(255,255,255,0.06)',
                        position:'relative', transition:'all .15s',
                      }}>
                      {/* Alert badge */}
                      {cell.alertTriggered && (
                        <Badge dot status="processing" color="red" style={{position:'absolute',top:4,right:4}}/>
                      )}
                      {/* Pair name */}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{flex:1}}>
                          <div style={{color:'#e8e8e8',fontSize:11,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                            {cell.symbolA}
                          </div>
                          <div style={{color:'#909090',fontSize:9}}>↔ {cell.symbolB}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{color,fontSize:16,fontWeight:800}}>
                            {cell.premiumPct > 0 ? '+' : ''}{cell.premiumPct.toFixed(1)}%
                          </div>
                          <div style={{fontSize:9,color:'#909090'}}>
                            {cell.direction==='A_PREMIUM'?<RiseOutlined style={{color:'#ff4d4f'}}/>:cell.direction==='B_PREMIUM'?<FallOutlined style={{color:'#52c41a'}}/>:T('fair',l)}
                          </div>
                        </div>
                      </div>
                      {/* Market tags */}
                      <div style={{display:'flex',gap:4,marginTop:4}}>
                        <Tag style={{fontSize:8,margin:0,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#909090',padding:'0 4px'}}>
                          {cell.marketA}/{cell.marketB}
                        </Tag>
                        <Tag color={cell.alertTriggered?'red':'default'} style={{fontSize:8,margin:0}}>
                          {cell.intensity.toUpperCase()}
                        </Tag>
                      </div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}

      {cells.length===0&&(
        <Empty description={<span style={{color:'#909090'}}>{T('noData',l)}</span>} image={Empty.PRESENTED_IMAGE_SIMPLE}/>
      )}

      {/* Legend */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.04)',fontSize:10,color:'#909090'}}>
        <span>{T('premium',l)}:</span>
        {['high','medium','low','none'].map(lv=>(
          <span key={lv} style={{display:'flex',alignItems:'center',gap:3}}>
            <span style={{width:10,height:10,borderRadius:2,background:getHeatColor(lv==='high'?5:lv==='medium'?3:lv==='low'?1:0,lv),display:'inline-block'}}/>
            {lv}
          </span>
        ))}
        <span style={{marginLeft:'auto'}}><DollarOutlined/> {T('scan',l)} {T('price',l)}</span>
      </div>
    </div>
  );
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

export default ArbitrageHeatmap;
