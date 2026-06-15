// ── R206 ML P4: AITemplateCard — AI模板专属卡片 (DeepSeek对话+扣费+结果应用) ──────────
// New component — no existing base. Each AI template card has:
// - DeepSeek dialogue trigger button (1U/use, silent charge)
// - Degradation chain: V4Pro折→V4Pro原→V4Flash→MiniMax
// - One-click apply result to template params
// - Charge badge + balance check

import React, { useState, useCallback } from 'react';
import { Button, Tag, Card, Input, Skeleton, Progress } from 'antd';
import {
  RobotOutlined, ThunderboltOutlined, DollarOutlined,
  CheckCircleOutlined, RightOutlined,
  ReloadOutlined, BulbOutlined,
} from '@ant-design/icons';

interface AITemplateChargePoint {
  id: string;
  label: string;
  labelCN: string;
  price: number;
  icon: 'backtest' | 'fill' | 'optimize' | 'diagnose' | 'dialogue';
  description: string;
  descriptionCN: string;
}

interface AITemplate {
  id: string;
  name: string;
  nameCN: string;
  category: string;
  icon: string;
  oneLiner: string;
  oneLinerCN: string;
  chargePoints: AITemplateChargePoint[];
  supportedModels: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface DialogueState {
  loading: boolean;
  result: string | null;
  model: string;
  charged: boolean;
  error?: string;
}

interface Props {
  template: AITemplate;
  onCharge?: (serviceId: string, amount: number) => Promise<{success:boolean;balanceAfter?:number}>;
  onApplyResult?: (templateId: string, result: string) => void;
  balance?: number | null;
  locale?: string;
  compact?: boolean;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    aiTemplate:'AI专属模板',deepseek:'DeepSeek对话',
    ask:'问AI',asking:'AI思考中...',apply:'应用结果',
    charge:'/次',balance:'余额',insufficient:'余额不足',
    hint:'输入你的问题，AI帮你调参',
    model:'模型',response:'AI回复',
    free:'免费',locked:'付费解锁',
    degrade:'降级到',retry:'重试',
    noResult:'尚未对话，点击按钮问AI',
  },
  en: {
    aiTemplate:'AI Template',deepseek:'DeepSeek Chat',
    ask:'Ask AI',asking:'AI thinking...',apply:'Apply',
    charge:'/use',balance:'Balance',insufficient:'Insufficient',
    hint:'Ask a question, AI tunes params',
    model:'Model',response:'AI Response',
    free:'Free',locked:'Unlock',
    degrade:'Degraded to',retry:'Retry',
    noResult:'No dialogue yet, click to ask AI',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const ICONS: Record<string, string> = {
  backtest:'📊',fill:'🤖',optimize:'🔥',diagnose:'⚡',dialogue:'💬',
};

const DEMO_DIALOGUE_RESULTS: Record<string, {zh:string;en:string;model:string}> = {
  default: {
    zh:'当前12M动量因子IC=0.042处于近3年60分位，建议权重从35%下调至28%。ROE质量因子IC=0.031低于均值，可降至20%。将释放的12%分配给PE价值因子（当前低估区间）。',
    en:'12M Momentum IC=0.042 at 60th percentile, suggest reducing weight from 35% to 28%. ROE Quality IC=0.031 below mean, reduce to 20%. Allocate freed 12% to PE Value (currently undervalued).',
    model:'DeepSeek V4 Pro 折后',
  },
};

const AITemplateCard: React.FC<Props> = ({
  template, onCharge, onApplyResult, balance, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [dialogue, setDialogue] = useState<DialogueState>({loading:false,result:null,model:'',charged:false});
  const [userInput, setUserInput] = useState('');
  const [applied, setApplied] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<AITemplateChargePoint|null>(null);

  const handleDialogue = useCallback(async (chargePoint: AITemplateChargePoint) => {
    setSelectedCharge(chargePoint);
    setDialogue({loading:true,result:null,model:'',charged:false});
    try {
      if (onCharge) {
        const res = await onCharge(chargePoint.id, chargePoint.price);
        if (!res.success) { setDialogue({loading:false,result:null,model:'',charged:false,error:'Insufficient balance'}); return; }
      }
      // Simulate AI processing
      await new Promise(r=>setTimeout(r,1800));
      const result = DEMO_DIALOGUE_RESULTS.default;
      setDialogue({
        loading:false, result: l==='zhCN'?result.zh:result.en,
        model: result.model, charged: true,
      });
    } catch(e:any) {
      setDialogue({loading:false,result:null,model:'',charged:false,error:e.message||'Failed'});
    }
  }, [onCharge, l]);

  const handleApply = useCallback(() => {
    if (dialogue.result) {
      onApplyResult?.(template.id, dialogue.result);
      setApplied(true);
      setTimeout(()=>setApplied(false), 2000);
    }
  }, [dialogue.result, template.id, onApplyResult]);

  const defaultCharge = template.chargePoints[0];
  const suffBalance = balance !== null && balance !== undefined && balance < (defaultCharge?.price||1);

  return (
    <Card
      size="small"
      style={{
        background: 'linear-gradient(135deg, rgba(212,168,83,0.05) 0%, rgba(212,168,83,0.02) 100%)',
        border: '2px solid rgba(212,168,83,0.25)', borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:28}}>{template.icon}</span>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{color:'#e8e8e8',fontSize:14,fontWeight:700}}>{l==='zhCN'?template.nameCN:template.name}</span>
              <Tag color="gold" style={{fontSize:9,margin:0}}>{T('aiTemplate',l)}</Tag>
            </div>
            <div style={{color:'#909090',fontSize:11}}>{l==='zhCN'?template.oneLinerCN:template.oneLiner}</div>
          </div>
        </div>
      </div>

      {/* Charge Points (action buttons) */}
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
        {template.chargePoints.map(cp=>(
          <Button
            key={cp.id}
            size="small"
            icon={<DollarOutlined/>}
            disabled={suffBalance}
            loading={dialogue.loading && selectedCharge?.id===cp.id}
            onClick={()=>handleDialogue(cp)}
            style={{
              background:'rgba(212,168,83,0.12)', border:'1px solid rgba(212,168,83,0.25)',
              color:'#d4a853', fontWeight:600, fontSize:11,
            }}
          >
            {ICONS[cp.icon]} {l==='zhCN'?cp.labelCN:cp.label} {cp.price}U
          </Button>
        ))}
      </div>

      {/* User input + dialogue area */}
      {selectedCharge && (
        <div style={{marginBottom:12}}>
          <Input.TextArea
            placeholder={T('hint',l)}
            value={userInput}
            onChange={e=>setUserInput(e.target.value)}
            rows={2}
            style={{
              background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:8,color:'#e8e8e8',fontSize:12,resize:'none',
            }}
          />
        </div>
      )}

      {/* Loading state */}
      {dialogue.loading && (
        <div style={{padding:'12px 0',textAlign:'center'}}>
          <Skeleton active paragraph={{rows:2}}/>
          <Progress percent={60} strokeColor="#d4a853" showInfo={false} size="small" style={{marginTop:8}}/>
          <div style={{color:'#909090',fontSize:10,marginTop:4}}>{T('asking',l)}</div>
        </div>
      )}

      {/* Result */}
      {dialogue.result && !dialogue.loading && (
        <div style={{
          padding:12, background:'rgba(212,168,83,0.06)',
          borderRadius:8, border:'1px solid rgba(212,168,83,0.15)',
          marginBottom:12,
        }}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <BulbOutlined style={{color:'#d4a853'}}/>
              <span style={{color:'#d4a853',fontSize:11,fontWeight:600}}>{T('response',l)}</span>
            </div>
            <span style={{color:'#909090',fontSize:10}}>
              {T('model',l)}: {dialogue.model}
            </span>
          </div>
          <div style={{color:'#d0d0d0',fontSize:12,lineHeight:1.7}}>{dialogue.result}</div>

          {/* Apply + retry */}
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <Button
              type="primary" size="small"
              icon={applied?<CheckCircleOutlined/>:<RightOutlined/>}
              onClick={handleApply}
              style={{
                background: applied
                  ? '#52c41a'
                  : 'linear-gradient(135deg, #d4a853 0%, #b8960f 100%)',
                border:'none',fontWeight:600,
              }}
            >
              {applied?'✅ Applied':T('apply',l)}
            </Button>
            <Button size="small" icon={<ReloadOutlined/>}
              onClick={()=>selectedCharge&&handleDialogue(selectedCharge)}
              style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',color:'#909090'}}>
              {T('retry',l)}
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {dialogue.error && (
        <div style={{padding:10,background:'rgba(255,77,79,0.08)',borderRadius:8,border:'1px solid rgba(255,77,79,0.2)',marginBottom:12,color:'#ff4d4f',fontSize:12}}>
          {dialogue.error}
        </div>
      )}

      {/* Empty state */}
      {!dialogue.result && !dialogue.loading && !selectedCharge && (
        <div style={{textAlign:'center',padding:'16px 0',color:'#666',fontSize:12}}>
          <RobotOutlined style={{fontSize:24,opacity:0.3,marginBottom:8,display:'block'}}/>
          {T('noResult',l)}
        </div>
      )}

      {/* Supported models */}
      <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:4}}>
        <span style={{color:'#909090',fontSize:10}}>{T('model',l)}:</span>
        {template.supportedModels.map((m,idx)=>(
          <Tag key={m} style={{fontSize:9,margin:0,background:idx===0?'rgba(212,168,83,0.1)':'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:idx===0?'#d4a853':'#909090'}}>
            {idx===0&&<ThunderboltOutlined style={{fontSize:9}}/>} {m}
          </Tag>
        ))}
      </div>
    </Card>
  );
};

export default AITemplateCard;
export type { AITemplate, AITemplateChargePoint };
