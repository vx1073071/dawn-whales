// ── R204 ML P6: TemplateDetailPage — 策略模板详情页 (因子权重可视化+四铁律+AI触发点+一键使用) ──────────
// Upgraded from StrategyDetail.tsx (R161)
// Shows: factor combo + weight viz bar charts, 4 iron laws panel, AI charge points with prices

import React, { useState } from 'react';
import { Button, Tag, Card, Progress, Badge } from 'antd';
import {
  ArrowLeftOutlined, DollarOutlined,
  SafetyOutlined, GlobalOutlined, CheckCircleOutlined, RightOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import type { TemplateItem } from './TemplateBrowserV2';

interface Props {
  template: TemplateItem;
  onBack: () => void;
  onUse: (tmpl: TemplateItem) => void;
  onCharge?: (serviceId: string, amount: number) => Promise<boolean>;
  locale?: string;

}

const IK: Record<string, Record<string, string>> = {
  zhCN: {
    back: '返回模板库', detail: '模板详情',
    name: '名称', category: '分类', market: '市场', assetClass: '资产类型',
    timeframe: '时间框架', difficulty: '难度',
    facComb: '因子组合', weight: '权重',
    ironLaws: '四铁律', law1: '一言', law1Desc: '一句话说清策略干什么',
    law2: '止损', law3: '适用', law4: '自检',
    aiCharge: 'AI增强触发点', aiDesc: '每个模板提供3-5个AI付费增值点',
    use: '一键使用此模板', using: '部署中...',
    charge: '2U部署费', insufficient: '余额不足',
    free: '免费', locked: '需付费解锁',
    backtest:'回测解读',fill:'AI填充',opt:'优化建议',dx:'因子诊断',
  },
  en: {
    back: 'Back to Templates', detail: 'Template Detail',
    name: 'Name', category: 'Category', market: 'Market', assetClass: 'Asset',
    timeframe: 'Timeframe', difficulty: 'Difficulty',
    facComb: 'Factor Combo', weight: 'Weight',
    ironLaws: '4 Iron Laws', law1: 'One-Liner', law1Desc: 'One sentence explains the strategy',
    law2: 'Stop-Loss', law3: 'Applicable', law4: 'Self-Check',
    aiCharge: 'AI Boost Points', aiDesc: 'Each template has 3-5 AI paid enhancements',
    use: 'Use This Template', using: 'Deploying...',
    charge: '2U deploy fee', insufficient: 'Insufficient balance',
    free: 'Free', locked: 'Paid unlock',
    backtest:'Backtest',fill:'AI Fill',opt:'Optimize',dx:'Diagnose',
  },
};

const T = (k: string, l: string): string => (IK[l]||IK.en)[k]||k;
const DC: Record<string,string> = {beginner:'#52c41a',intermediate:'#d4a853',advanced:'#ff4d4f'};



const TemplateDetailPage: React.FC<Props> = ({
  template, onBack, onUse, onCharge, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [deploying, setDeploying] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'factors'|'ironLaws'|'aiCharge'|''>('factors');

  const handleUse = async () => {
    setDeploying(true);
    if (onCharge) {
      try {
        const ok = await onCharge('template_deploy', 2);
        if (!ok) { setDeploying(false); return; }
      } catch { setDeploying(false); return; }
    }
    setTimeout(() => {
      onUse(template);
      setDeploying(false);
    }, 800);
  };

  const cc: Record<string,string> = {美股:'#4a90d9',港股:'#d73027',加密:'#f7931a',跨市场:'#9b59b6'};
  const totalWeight = template.factors.reduce((s,f)=>s+f.weight,0);

  const sectionStyle = (section: string) => ({
    padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
    background: expandedSection===section ? 'rgba(74,144,217,0.08)' : 'rgba(255,255,255,0.03)',
    border: expandedSection===section ? '1px solid rgba(74,144,217,0.3)' : '1px solid rgba(255,255,255,0.08)',
    marginBottom: 10, transition: 'all 0.2s',
  });

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(74,144,217,0.15)',minHeight:560}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <Button type="text" icon={<ArrowLeftOutlined/>} onClick={onBack}
          style={{color:'#909090'}}>{T('back',l)}</Button>
      </div>

      {/* Title + Meta */}
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <span style={{color:'#e8e8e8',fontSize:22,fontWeight:800}}>{l==='zhCN'?template.nameCN:template.name}</span>
          <Tag color={cc[template.category]||'#666'}>{template.category}</Tag>
          <Tag color={DC[template.difficulty]}>{T(template.difficulty==='beginner'?'beg':template.difficulty==='intermediate'?'mid':'adv',l)}</Tag>
        </div>
        {/* Meta grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:8}}>
          <div><span style={{color:'#909090',fontSize:11}}>{T('market',l)}</span><div style={{color:'#ccc',fontSize:12}}>{template.marketTags.join(' ')}</div></div>
          <div><span style={{color:'#909090',fontSize:11}}>{T('assetClass',l)}</span><div style={{color:'#ccc',fontSize:12}}>{template.assetClass}</div></div>
          <div><span style={{color:'#909090',fontSize:11}}>{T('timeframe',l)}</span><div style={{color:'#ccc',fontSize:12}}>{template.timeframe}</div></div>
          <div><span style={{color:'#909090',fontSize:11}}>{template.factors.length} factors</span><div style={{color:'#ccc',fontSize:12}}>{totalWeight>1?'⚠️ ':'✅ '}{(totalWeight*100).toFixed(0)}% allocated</div></div>
        </div>
      </div>

      {/* Iron Law 1: One-Liner (always visible) */}
      <Card size="small" style={{background:'rgba(212,168,83,0.06)',border:'1px solid rgba(212,168,83,0.2)',borderRadius:10,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
          <span style={{fontSize:18}}>📌</span>
          <div>
            <div style={{color:'#d4a853',fontSize:12,fontWeight:600,marginBottom:4}}>Iron Law #1: {T('law1',l)}</div>
            <div style={{color:'#d0d0d0',fontSize:13,lineHeight:1.6}}>{template.oneLiner}</div>
          </div>
        </div>
      </Card>

      {/* Expandable Sections */}
      {/* Section 1: Factor Combo with Weight Bars */}
      <div style={sectionStyle('factors')} onClick={()=>setExpandedSection(expandedSection==='factors'?'':'factors')}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <PieChartOutlined style={{color:'#4a90d9',fontSize:16}}/>
            <span style={{color:'#e8e8e8',fontSize:14,fontWeight:600}}>{T('facComb',l)} ({template.factors.length})</span>
          </div>
          <span style={{color:'#909090',fontSize:12}}>{expandedSection==='factors'?'▼':'▶'}</span>
        </div>
        {expandedSection==='factors' && (
          <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:10}}>
            {template.factors.map(f=>(
              <div key={f.factorId}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <Tag color={f.direction==='long'?'green':'red'} style={{fontSize:10,margin:0}}>
                      {f.direction==='long'?'🟢 LONG':'🔴 SHORT'}
                    </Tag>
                    <span style={{color:'#e8e8e8',fontSize:12,fontWeight:600}}>{f.factorName}</span>
                  </div>
                  <span style={{color:'#d4a853',fontSize:12,fontWeight:700}}>{(f.weight*100).toFixed(0)}%</span>
                </div>
                <Progress
                  percent={f.weight*100}
                  strokeColor={f.direction==='long'?'#52c41a':'#ff4d4f'}
                  trailColor='rgba(255,255,255,0.06)'
                  showInfo={false}
                  size="small"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: 4 Iron Laws */}
      <div style={sectionStyle('ironLaws')} onClick={()=>setExpandedSection(expandedSection==='ironLaws'?'':'ironLaws')}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <SafetyOutlined style={{color:'#d73027',fontSize:16}}/>
            <span style={{color:'#e8e8e8',fontSize:14,fontWeight:600}}>{T('ironLaws',l)}</span>
          </div>
          <span style={{color:'#909090',fontSize:12}}>{expandedSection==='ironLaws'?'▼':'▶'}</span>
        </div>
        {expandedSection==='ironLaws' && (
          <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px',background:'rgba(255,77,79,0.06)',borderRadius:6}}>
              <SafetyOutlined style={{color:'#ff4d4f'}}/><span style={{color:'#909090',fontSize:11}}>#{T('law2',l)}</span>
              <span style={{color:'#ff4d4f',fontSize:12,fontWeight:600}}>{template.ironLaws.stopLoss}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px',background:'rgba(74,144,217,0.06)',borderRadius:6}}>
              <GlobalOutlined style={{color:'#4a90d9'}}/><span style={{color:'#909090',fontSize:11}}>#{T('law3',l)}</span>
              <span style={{color:'#ccc',fontSize:12}}>{template.ironLaws.applicable}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px',background:'rgba(212,168,83,0.06)',borderRadius:6}}>
              <CheckCircleOutlined style={{color:'#d4a853'}}/><span style={{color:'#909090',fontSize:11}}>#{T('law4',l)}</span>
              <span style={{color:'#ccc',fontSize:12}}>{template.ironLaws.failureCheck}</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: AI Charge Points */}
      <div style={{...sectionStyle('aiCharge'),marginBottom:24}} onClick={()=>setExpandedSection(expandedSection==='aiCharge'?'':'aiCharge')}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <DollarOutlined style={{color:'#d4a853',fontSize:16}}/>
            <span style={{color:'#e8e8e8',fontSize:14,fontWeight:600}}>{T('aiCharge',l)} ({template.chargePoints.length})</span>
            <Badge count={T('aiDesc',l)} style={{backgroundColor:'rgba(212,168,83,0.2)',color:'#d4a853',fontSize:9}}/>
          </div>
          <span style={{color:'#909090',fontSize:12}}>{expandedSection==='aiCharge'?'▼':'▶'}</span>
        </div>
        {expandedSection==='aiCharge' && (
          <div style={{marginTop:12,display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))',gap:8}}>
            {template.chargePoints.map(cp=>{
              const iconMap: Record<string,string> = {
                backtest:'📊',fill:'🤖',optimize:'🔥',diagnose:'⚡',unlock:'🔓',
              };
              return (
                <Card key={cp.id} size="small" style={{
                  background:'rgba(212,168,83,0.08)',border:'1px solid rgba(212,168,83,0.2)',
                  borderRadius:8,textAlign:'center',
                }}>
                  <div style={{fontSize:22,marginBottom:4}}>{iconMap[cp.icon]||'💰'}</div>
                  <div style={{color:'#e8e8e8',fontSize:12,fontWeight:600}}>{l==='zhCN'?cp.labelCN:cp.label}</div>
                  <Tag color="gold" style={{marginTop:4,fontSize:10}}>{cp.price} USDT</Tag>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Use button + balance check */}
      <Button type="primary" size="large" block
        icon={deploying?undefined:<RightOutlined/>}
        loading={deploying}
        onClick={handleUse}
        style={{
          background:'linear-gradient(135deg, #d4a853 0%, #b8960f 100%)',
          border:'none',height:48,fontWeight:700,fontSize:15,
        }}>
        {deploying?T('using',l):T('use',l)}
      </Button>
    </div>
  );
};

export default TemplateDetailPage;
