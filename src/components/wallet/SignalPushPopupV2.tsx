// ── R209 ML P5: SignalPushPopupV2 — 因子实时推送弹窗升级版 ──────────
// Upgraded from R202 SignalPushPopup: added one-click order + 0.5U charge + upgrade funnel
// Factor trigger -> popup -> one-click trade -> 0.5U label -> upgrade guide

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Tag, Card, Badge, Progress } from 'antd';
import {
  ThunderboltOutlined, RightOutlined, CloseOutlined,
  LockOutlined,
} from '@ant-design/icons';

interface SignalEvent {
  id: string;
  factorId: string;
  factorName: string;
  oldSignal: 'green'|'yellow'|'red';
  newSignal: 'green'|'yellow'|'red';
  ic: number;
  message: string;
  tradePair?: string;
  price?: number;
  timestamp: number;
  priority: 'high'|'medium'|'low';
}

interface Props {
  events?: SignalEvent[];
  onDismiss?: (eventId: string) => void;
  onTrade?: (eventId: string, pair?: string) => void;
  onCharge?: (serviceId: string, amount: number) => Promise<boolean>;
  onUpgrade?: () => void;
  tier?: 'free'|'daily'|'realtime';
  balance?: number|null;
  locale?: string;
  maxVisible?: number;
  autoDismissMs?: number;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    title:'因子信号',upgrade:'升级',
    flipLong:'翻多🚀',flipShort:'翻空⚠️',weaken:'转弱⚡',strengthen:'转强📈',
    trade:'一键交易',dismiss:'忽略',
    price:'0.5U',charged:'已扣费',insufficient:'余额不足',
    locked:'付费解锁',unlockPush:'开通推送 0.5U/条',
    queue:'队列',
    noEvents:'暂无信号',
  },
  en: {
    title:'Factor Signal',upgrade:'Upgrade',
    flipLong:'Flip Long',flipShort:'Flip Short',weaken:'Weakening',strengthen:'Strengthening',
    trade:'Trade',dismiss:'Dismiss',
    price:'0.5U',charged:'Charged',insufficient:'Insufficient',
    locked:'Unlock',unlockPush:'Enable Push 0.5U/push',
    queue:'Queue',
    noEvents:'No signals',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const SIG_EMOJI: Record<string,string> = {green:'🟢',yellow:'🟡',red:'🔴'};
const PRI_COLORS: Record<string,string> = {high:'#ff4d4f',medium:'#d4a853',low:'#4a90d9'};

function getTransition(oldS: string, newS: string, l: string): string {
  if (oldS==='green'&&newS==='red') return T('flipShort',l);
  if (oldS==='red'&&newS==='green') return T('flipLong',l);
  if (oldS==='green'&&newS==='yellow') return T('weaken',l);
  if (oldS==='yellow'&&newS==='green') return T('strengthen',l);
  if (oldS==='yellow'&&newS==='red') return T('flipShort',l);
  if (oldS==='red'&&newS==='yellow') return T('flipLong',l);
  return '';
}

const DEMO_EVENTS: SignalEvent[] = [
  {id:'sig_1',factorId:'MOM_12M',factorName:'12M动量',oldSignal:'yellow',newSignal:'green',ic:0.042,message:'12M动量因子信号反转: 中→强',tradePair:'AAPL',price:195.2,timestamp:Date.now()-120000,priority:'high'},
  {id:'sig_2',factorId:'LOW_VOL',factorName:'低波动',oldSignal:'green',newSignal:'red',ic:-0.018,message:'低波动因子信号反转: 强→弱',tradePair:'TLT',price:92.1,timestamp:Date.now()-90000,priority:'high'},
  {id:'sig_3',factorId:'PE',factorName:'PE价值',oldSignal:'yellow',newSignal:'green',ic:0.028,message:'PE价值因子信号增强: 中→强',tradePair:'JPM',price:198.5,timestamp:Date.now()-60000,priority:'medium'},
];

const SignalPushPopupV2: React.FC<Props> = ({
  events: customEvents, onDismiss, onTrade, onCharge, onUpgrade,
  tier: propTier, balance: _balance, locale: pl,
  maxVisible = 3, autoDismissMs = 8000,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const tier = propTier||'free';
  const [events] = useState<SignalEvent[]>(customEvents||DEMO_EVENTS);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [charging, setCharging] = useState<string|null>(null);
  const [traded, setTraded] = useState<Set<string>>(new Set());

  const visibleEvents = events.filter(e=>!dismissed.has(e.id)).slice(0, maxVisible);

  // Auto-dismiss
  useEffect(() => {
    if (visibleEvents.length===0) return;
    const timers = visibleEvents.map(e=>setTimeout(()=>setDismissed(prev=>new Set(prev).add(e.id)), autoDismissMs));
    return ()=>timers.forEach(clearTimeout);
  }, [events.map(e=>e.id).join(','), autoDismissMs]);

  const handleDismiss = useCallback((eventId: string) => {
    setDismissed(prev=>new Set(prev).add(eventId));
    onDismiss?.(eventId);
  }, [onDismiss]);

  const handleTrade = useCallback(async (event: SignalEvent) => {
    if (tier!=='realtime') { onUpgrade?.(); return; }
    setCharging(event.id);
    try {
      if (onCharge) {
        const ok = await onCharge('push_trade_'+event.id, 0.5);
        if (!ok) { setCharging(null); return; }
      }
      await new Promise(r=>setTimeout(r,600));
      setTraded(prev=>new Set(prev).add(event.id));
      onTrade?.(event.id, event.tradePair);
    } catch {}
    setCharging(null);
  }, [tier, onCharge, onTrade, onUpgrade]);

  if (visibleEvents.length===0) return null;

  return (
    <div style={{position:'fixed',bottom:20,right:20,zIndex:9999,display:'flex',flexDirection:'column',gap:8,maxWidth:380}}>
      {visibleEvents.map((event,idx)=>{
        const trans = getTransition(event.oldSignal, event.newSignal, l);
        const priColor = PRI_COLORS[event.priority];
        const isCharging = charging===event.id;
        const isTraded = traded.has(event.id);
        const isLocked = tier!=='realtime';

        return (
          <Card key={event.id} size="small" style={{
            background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 98%)',
            border:`2px solid ${priColor}40`,
            borderRadius:12,
            boxShadow:`0 4px 24px ${priColor}20`,
            animation:'slideIn .3s ease-out',
            opacity: idx===visibleEvents.length-1?1:0.85,
            transform:`scale(${1-idx*0.03}) translateY(${idx*4}px)`,
          }}>
            {/* Priority border top */}
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:priColor,borderRadius:'12px 12px 0 0'}}/>

            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <ThunderboltOutlined style={{color:priColor}}/>
                <span style={{color:'#e8e8e8',fontSize:13,fontWeight:700}}>{event.factorName}</span>
                <Badge count={T('price',l)} size="small" style={{backgroundColor:'#d4a853',fontSize:9}}/>
              </div>
              <Button type="text" size="small" icon={<CloseOutlined/>}
                onClick={()=>handleDismiss(event.id)} style={{color:'#909090',padding:0}}/>
            </div>

            {/* Signal transition */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,padding:'6px 10px',background:'rgba(255,255,255,0.04)',borderRadius:8}}>
              <span style={{fontSize:16}}>{SIG_EMOJI[event.oldSignal]}</span>
              <span style={{color:'#909090',fontSize:11}}>→</span>
              <span style={{fontSize:16}}>{SIG_EMOJI[event.newSignal]}</span>
              <Tag color={event.newSignal==='green'?'green':event.newSignal==='red'?'red':'gold'} style={{margin:0,fontSize:10}}>{trans}</Tag>
              <span style={{marginLeft:'auto',color:'#909090',fontSize:10}}>IC: <span style={{color:event.ic>0?'#52c41a':'#ff4d4f',fontWeight:600}}>{event.ic.toFixed(3)}</span></span>
            </div>

            {/* Message + Trade */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{flex:1}}>
                <div style={{color:'#ccc',fontSize:11}}>{event.message}</div>
                {event.tradePair&&(
                  <div style={{color:'#909090',fontSize:9,marginTop:2}}>{event.tradePair} {event.price?`$${event.price}`:''}</div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{display:'flex',gap:6,marginTop:8}}>
              <Button size="small" onClick={()=>handleDismiss(event.id)}
                style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#909090',fontSize:11}}>
                {T('dismiss',l)}
              </Button>
              {isLocked?(
                <Button size="small" type="primary" icon={<LockOutlined/>}
                  onClick={onUpgrade}
                  style={{background:'linear-gradient(135deg, #d4a853 0%, #b8960f 100%)',border:'none',fontSize:11,fontWeight:600}}>
                  {T('unlockPush',l)}
                </Button>
              ):isTraded?(
                <Button size="small" icon={<RightOutlined/>}
                  style={{background:'rgba(82,196,26,0.1)',border:'1px solid rgba(82,196,26,0.2)',color:'#52c41a',fontSize:11}}>
                  ✅ Traded
                </Button>
              ):(
                <Button size="small" type="primary" icon={<RightOutlined/>} loading={isCharging}
                  onClick={()=>handleTrade(event)}
                  style={{background:'linear-gradient(135deg, #d73027 0%, #b71c1c 100%)',border:'none',fontSize:11,fontWeight:600}}>
                  {T('trade',l)} {event.tradePair||''} <span style={{fontSize:9,opacity:.7}}>{T('price',l)}</span>
                </Button>
              )}
            </div>

            {/* Auto-dismiss progress */}
            <Progress percent={100} strokeColor={priColor+'30'} trailColor="transparent" showInfo={false} size="small" style={{marginTop:6}}/>
          </Card>
        );
      })}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default SignalPushPopupV2;
