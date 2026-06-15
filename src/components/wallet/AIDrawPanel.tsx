// ── R145 ML — AIDrawPanel (AI画线+形态识别+对话扣费+参数填充) ───────────
// PM: 4 modules, 6h
// R150: Added FeePreview + useBalanceCheck integration
import { useState, useCallback, useRef } from 'react';
import {
  Card, Button, Space, Tag, Table, Input, Select, Modal, Progress,
  message, Alert, Tabs, Descriptions, Tooltip, Badge, Empty,
} from 'antd';
import {
  ThunderboltOutlined, LineChartOutlined, BulbOutlined,
  RobotOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DollarOutlined, ReloadOutlined, FormOutlined, ApiOutlined,
  EyeOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import FeePreview from '@/components/billing/FeePreview';
import useBalanceCheck from '@/hooks/useBalanceCheck';

// ═══════════ Types ═══════════

interface DrawLineResult {
  id: string;
  type: 'trendline' | 'support' | 'resistance' | 'channel_upper' | 'channel_lower' | 'neckline';
  label: string;
  startPrice: number;
  endPrice: number;
  confidence: number;
  color: string;
}

interface PatternResult {
  id: string;
  type: 'head_shoulders_top' | 'head_shoulders_bottom' | 'double_top' | 'double_bottom' | 'triangle_ascending' | 'triangle_descending' | 'flag_bull' | 'flag_bear' | 'wedge';
  label: string;
  confidence: number;
  priceZone: [number, number];
  targetPrice: number;
}

interface ParamFillResult {
  strategyType: string;
  params: { name: string; value: string; range: string; description: string }[];
  confidence: number;
  reasoning: string;
}

interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cost?: number;  // 1U per assistant message
  error?: string;
}

// ═══════════ Mock ═══════════

const MOCK_DRAW_LINES: DrawLineResult[] = [
  { id:'dl1',type:'trendline',label:'上升趋势线',startPrice:36500,endPrice:38200,confidence:0.87,color:'#22c55e' },
  { id:'dl2',type:'support',label:'支撑位',startPrice:36200,endPrice:36200,confidence:0.92,color:'#22c55e' },
  { id:'dl3',type:'resistance',label:'阻力位',startPrice:39200,endPrice:39200,confidence:0.85,color:'#ef4444' },
  { id:'dl4',type:'channel_upper',label:'通道上轨',startPrice:39000,endPrice:39800,confidence:0.78,color:'#3b82f6' },
  { id:'dl5',type:'channel_lower',label:'通道下轨',startPrice:36200,endPrice:36800,confidence:0.78,color:'#3b82f6' },
];

const MOCK_PATTERNS: PatternResult[] = [
  { id:'p1',type:'head_shoulders_bottom',label:'头肩底',confidence:0.82,priceZone:[36200,38200],targetPrice:40200 },
  { id:'p2',type:'triangle_ascending',label:'上升三角形',confidence:0.71,priceZone:[37800,39200],targetPrice:40600 },
];

const MOCK_PARAM_FILLS: Record<string, ParamFillResult> = {
  'MA均线': { strategyType:'MA均线',params:[{name:'短期均线',value:'20',range:'5-50',description:'快速均线周期'},{name:'长期均线',value:'60',range:'20-200',description:'慢速均线周期'},{name:'K线周期',value:'4h',range:'15m-1d',description:'K线时间周期'}],confidence:0.88,reasoning:'20/60周期在4h图上金叉/死叉信号准确率最高, 回测胜率64.5%' },
  'RSI': { strategyType:'RSI',params:[{name:'超卖阈值',value:'28',range:'20-35',description:'RSI低于此值买入'},{name:'超买阈值',value:'72',range:'65-80',description:'RSI高于此值卖出'},{name:'K线周期',value:'1h',range:'15m-4h',description:'K线时间周期'}],confidence:0.84,reasoning:'28/72阈值减少假信号, 1h周期平衡灵敏度' },
  '布林带': { strategyType:'布林带',params:[{name:'周期',value:'20',range:'10-50',description:'布林带周期'},{name:'标准差',value:'2.0',range:'1.5-3.0',description:'标准差倍数'},{name:'K线周期',value:'4h',range:'1h-1d',description:'K线时间周期'}],confidence:0.91,reasoning:'20周期+2倍标准差是布林带经典配置, 4h周期过滤噪音' },
  'MACD': { strategyType:'MACD',params:[{name:'快线',value:'12',range:'8-26',description:'快线EMA'},{name:'慢线',value:'26',range:'12-52',description:'慢线EMA'},{name:'信号线',value:'9',range:'5-15',description:'信号线EMA'},{name:'K线周期',value:'1d',range:'4h-1w',description:'K线时间周期'}],confidence:0.86,reasoning:'经典12/26/9参数+日线, 回测胜率稳定' },
};

// ═══════════ Sub-components ═══════════

// ── AI Draw Lines (M01) ──

function AIDrawLines() {
  const [symbol, setSymbol] = useState('BTC-USDT');
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<DrawLineResult[]>([]);
  const [patterns, setPatterns] = useState<PatternResult[]>([]);
  const [deducted, setDeducted] = useState(false);
  const { balance, deductFee, checkBalance } = useBalanceCheck();

  const handleDraw = useCallback(async () => {
    const ok = await deductFee(1, 'AI画线+形态识别', async () => {
      setLoading(true);
      setDeducted(true);
      await new Promise(r=>setTimeout(r,1200+Math.random()*800));
      if (Math.random() > 0.1) {
        setLines(MOCK_DRAW_LINES);
        setPatterns(MOCK_PATTERNS);
      } else {
        setLines([]);
        setPatterns([]);
        setDeducted(false);
        message.warning('AI分析失败, 已退费1 USDT');
      }
      setLoading(false);
    });
    if (!ok) checkBalance(1, 'AI画线+形态识别');
  }, [deductFee, checkBalance]);

  const lineColors: Record<string,string> = {trendline:'#22c55e',support:'#22c55e',resistance:'#ef4444',channel_upper:'#3b82f6',channel_lower:'#3b82f6',neckline:'#f59e0b'};

  return (
    <div>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
        <Input value={symbol} onChange={e=>setSymbol(e.target.value)} style={{width:140,background:'#0d0f1a'}} placeholder="交易对"/>
        <Button type="primary" icon={loading?<ReloadOutlined spin/>:<LineChartOutlined/>} loading={loading}
          onClick={handleDraw} disabled={balance<1}>
          AI自动画线 (1 USDT)
        </Button>
        <Tag color="blue">余额: {balance.toFixed(2)} U</Tag>
        {deducted && <Tag color="green">已扣费</Tag>}
        {/* ── R150 #30: 退款视觉反馈 ── */}
        {!deducted && lines.length === 0 && patterns.length === 0 && !loading && (
          <Tag color="#22c55e" style={{animation:'pulse 2s ease-in-out'}}>↩️ 已退费1U</Tag>
        )}
      </div>
      <div style={{marginBottom:10}}>
        <FeePreview aiService="draw" showAiPrice={false} size="small" />
      </div>

      {lines.length > 0 && (
        <Card size="small" title={<Space><LineChartOutlined/><span style={{color:'#e0e0e0'}}>画线结果</span></Space>}
          style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:10}}
          styles={{body:{padding:'10px'}}}>
          <Table dataSource={lines} columns={[
            {title:'类型',key:'type',width:90,render:(_:any,r:DrawLineResult)=><Tag color={lineColors[r.type]}>{r.label}</Tag>},
            {title:'起价',dataIndex:'startPrice',key:'s',width:80,render:(v:number)=><span style={{fontFamily:'monospace',color:'#e0e0e0'}}>{v.toFixed(2)}</span>},
            {title:'终价',dataIndex:'endPrice',key:'e',width:80,render:(v:number)=><span style={{fontFamily:'monospace',color:'#e0e0e0'}}>{v.toFixed(2)}</span>},
            {title:'置信',dataIndex:'confidence',key:'c',width:60,render:(v:number)=><span style={{color:v>=0.8?'#22c55e':v>=0.6?'#f59e0b':'#ef4444',fontWeight:600}}>{(v*100).toFixed(0)}%</span>},
          ]} rowKey="id" size="small" pagination={false} rowClassName={()=>'dark-table-row'}/>
        </Card>
      )}

      {patterns.length > 0 && (
        <Card size="small" title={<Space><EyeOutlined/><span style={{color:'#e0e0e0'}}>形态识别</span></Space>}
          style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
          styles={{body:{padding:'10px'}}}>
          <Table dataSource={patterns} columns={[
            {title:'形态',key:'type',render:(_:any,r:PatternResult)=><Tag color="purple">{r.label}</Tag>},
            {title:'价格区间',key:'zone',render:(_:any,r:PatternResult)=><span style={{fontFamily:'monospace',color:'#e0e0e0'}}>{r.priceZone[0].toFixed(0)} - {r.priceZone[1].toFixed(0)}</span>},
            {title:'目标价',dataIndex:'targetPrice',key:'t',render:(v:number)=><span style={{fontFamily:'monospace',color:'#22c55e',fontWeight:600}}>{v.toFixed(0)}</span>},
            {title:'置信',dataIndex:'confidence',key:'c',width:60,render:(v:number)=><span style={{color:v>=0.8?'#22c55e':'#f59e0b',fontWeight:600}}>{(v*100).toFixed(0)}%</span>},
          ]} rowKey="id" size="small" pagination={false} rowClassName={()=>'dark-table-row'}/>
        </Card>
      )}

      {lines.length===0&&!loading&&<Empty description="点击「AI自动画线」分析K线趋势和形态 (扣费1 USDT)"/>}
      <Alert message="AI画线+形态识别: 1 USDT/次 · 失败退费 · 置信度<30%不标注 · 退款原因: AI模型分析超时或置信度不足" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ── AI Chat (M03) ──

function AIChatBilling() {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {id:'m1',role:'assistant',content:'你好! 我是TradingEasy AI助手。每次对话扣费1 USDT, 回复失败退费。',timestamp:Date.now()-60000},
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const { balance, deductFee, checkBalance } = useBalanceCheck();

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const userMsg: AIChatMessage = {id:'u'+Date.now(),role:'user',content:input,timestamp:Date.now()};
    setMessages(p=>[...p,userMsg]);
    setInput('');
    setSending(true);
    
    const ok = await deductFee(1, 'AI对话', async () => {
      await new Promise(r=>setTimeout(r,600+Math.random()*500));
      const success = Math.random() > 0.12;
      if (success) {
        const replies = ['根据当前K线形态, MACD显示金叉信号, 建议关注...','RSI处于中性区域, 暂无明确方向, 建议观望...','布林带收窄, 可能出现突破行情, 建议设置突破挂单...'];
        const reply = replies[Math.floor(Math.random()*replies.length)];
        setMessages(p=>[...p,{id:'a'+Date.now(),role:'assistant',content:reply,timestamp:Date.now(),cost:1}]);
      } else {
        setMessages(p=>[...p,{id:'a'+Date.now(),role:'assistant',content:'抱歉, AI回复失败。已退费1 USDT, 请重试。',timestamp:Date.now(),error:'退费'}]);}
    });
    if (!ok) checkBalance(1, 'AI对话');
    setSending(false);
  },[input,deductFee,checkBalance]);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <Space><RobotOutlined style={{color:'#a78bfa'}}/><span style={{color:'#e0e0e0',fontWeight:600}}>AI对话</span></Space>
        <Space><Tag color="blue">余额: {balance.toFixed(2)} U</Tag><Tag color="purple">1U/次</Tag></Space>
      </div>

      <div ref={chatRef} style={{maxHeight:300,overflow:'auto',marginBottom:10,background:'#0d0f1a',borderRadius:8,padding:'10px',border:'1px solid #2a2d3e'}}>
        {messages.map(m=>(
          <div key={m.id} style={{marginBottom:8,display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
            <div style={{maxWidth:'80%',padding:'8px 12px',borderRadius:8,background:m.role==='user'?'#3b82f620':'#a78bfa20',
              border:`1px solid ${m.role==='user'?'#3b82f644':'#a78bfa44'}`,fontSize:12}}>
              <div style={{color:m.error?'#ef4444':'#e0e0e0'}}>{m.content}</div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:9,color:'#6b7280'}}>
                <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                {m.cost&&<span style={{color:'#f59e0b'}}>-{m.cost}U</span>}
                {m.error&&<span style={{color:'#22c55e'}}>{m.error}</span>}
              </div>
            </div>
          </div>
        ))}
        {sending&&<div style={{textAlign:'center',color:'#8b949e',fontSize:11}}><ReloadOutlined spin/> AI思考中...</div>}
      </div>

      <div style={{display:'flex',gap:8}}>
        <Input value={input} onChange={e=>setInput(e.target.value)} onPressEnter={handleSend}
          placeholder="输入问题..." disabled={sending} style={{background:'#0d0f1a'}}/>
        <Button type="primary" onClick={handleSend} loading={sending} icon={<RobotOutlined/>} disabled={!input.trim()}>发送 (1U)</Button>
      </div>
      <Alert message="AI对话: 1 USDT/次 · 静默扣款 · 失败退费 · 单次<4K token · 超时30s截断" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ── Param Fill (M04) ──

function ParamFillUI() {
  const [framework, setFramework] = useState('MA均线');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParamFillResult|null>(null);
  const [saved, setSaved] = useState<Record<string,boolean>>({});
  const { balance, deductFee, checkBalance } = useBalanceCheck();

  const handleFill = useCallback(async () => {
    const ok = await deductFee(1, 'AI参数推荐', async () => {
      setLoading(true);
      setResult(null);
      await new Promise(r=>setTimeout(r,1000+Math.random()*600));
      if (Math.random() > 0.1) {
        setResult(MOCK_PARAM_FILLS[framework]);
      } else {
        message.warning('AI分析失败, 已退费1 USDT');
      }
      setLoading(false);
    });
    if (!ok) checkBalance(1, 'AI参数推荐');
  },[framework,deductFee,checkBalance]);

  const handleSave = useCallback((framework:string)=>{
    setSaved(p=>({...p,[framework]:true}));
    message.success('参数已保存为模板');
  },[framework]);

  return (
    <div>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
        <Select value={framework} onChange={setFramework} style={{width:130}} options={[
          {label:'MA均线',value:'MA均线'},{label:'RSI',value:'RSI'},{label:'布林带',value:'布林带'},{label:'MACD',value:'MACD'},
        ]}/>
        <Button type="primary" icon={loading?<ReloadOutlined spin/>:<FormOutlined/>} loading={loading}
          onClick={handleFill} disabled={balance<1}>
          AI推荐参数 (1 USDT)
        </Button>
        <Tag color="blue">余额: {balance.toFixed(2)} U</Tag>
      </div>

      {result && (
        <Card size="small" title={<Space><FormOutlined/><span style={{color:'#e0e0e0'}}>{result.strategyType} 推荐参数</span></Space>}
          extra={<Space><Tag color="green">置信{((result.confidence)*100).toFixed(0)}%</Tag>
            <Button size="small" type="primary" onClick={()=>handleSave(result.strategyType)} disabled={saved[result.strategyType]}>
              <CheckCircleOutlined/> {saved[result.strategyType]?'已保存':'保存模板'}
            </Button></Space>}
          style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
          styles={{body:{padding:'12px'}}}>
          <Table dataSource={result.params} columns={[
            {title:'参数',dataIndex:'name',key:'name',render:(v:string)=><span style={{color:'#e0e0e0',fontWeight:500}}>{v}</span>},
            {title:'推荐值',dataIndex:'value',key:'val',render:(v:string)=><Tag color="blue">{v}</Tag>},
            {title:'范围',dataIndex:'range',key:'range',render:(v:string)=><span style={{color:'#8b949e',fontSize:10}}>{v}</span>},
            {title:'说明',dataIndex:'description',key:'desc',render:(v:string)=><span style={{color:'#8b949e',fontSize:10}}>{v}</span>},
          ]} rowKey="name" size="small" pagination={false} rowClassName={()=>'dark-table-row'}/>
          <div style={{marginTop:10,padding:'8px 12px',background:'#0d0f1a',borderRadius:6,fontSize:11,color:'#8b949e'}}>
            💡 AI推理: {result.reasoning}
          </div>
        </Card>
      )}

      {!result&&!loading&&<Empty description="选择策略框架, AI推荐最优参数 (扣费1 USDT)"/>}
      <Alert message="AI参数填充: 1 USDT/次 · 仅填充现有框架参数 · 不生成代码 · 失败退费 · 可保存为模板" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ── Main Export ──

export default function AIDrawPanel() {
  return (
    <div style={{padding:'0 4px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,
        padding:'12px 16px',background:'linear-gradient(135deg,#1a1d2e 0%,#232740 100%)',borderRadius:10,border:'1px solid #2a2d3e'}}>
        <Space>
          <RobotOutlined style={{fontSize:20,color:'#a78bfa'}}/>
          <div><div style={{color:'#e0e0e0',fontWeight:600,fontSize:16}}>AI 功能</div>
            <div style={{color:'#6b7280',fontSize:11}}>自动画线·形态识别·AI对话·参数填充 · 1-2U/次</div></div>
        </Space>
        <Space><Tag color="green">v17.6</Tag><Tag color="purple">静默扣款</Tag></Space>
      </div>

      <Card size="small" style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
        styles={{body:{padding:'12px'}}}>
        <Tabs defaultActiveKey="draw" size="small" items={[
          { key:'draw',label:<Space size={4}><LineChartOutlined/><span>AI画线+形态</span></Space>,children:<AIDrawLines/>},
          { key:'chat',label:<Space size={4}><RobotOutlined/><span>AI对话</span></Space>,children:<AIChatBilling/>},
          { key:'param',label:<Space size={4}><FormOutlined/><span>参数填充</span></Space>,children:<ParamFillUI/>},
        ]}/>
      </Card>
    </div>
  );
}
