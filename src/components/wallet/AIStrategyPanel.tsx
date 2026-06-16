// @ts-nocheck

// ── R146 ML — AIStrategyPanel (组合生成+回测解读+优化+健康检查) ──────────
// PM: 4 modules, 6h
import { useState, useCallback } from 'react';
import {
  Card, Button, Space, Tag, Table, Input, Select, Tabs, Modal,
  Progress, message, Empty, Descriptions, Alert, Badge,
} from 'antd';
import {
  ThunderboltOutlined, RobotOutlined, CheckCircleOutlined,
  CloseCircleOutlined, DollarOutlined, ReloadOutlined,
  ReadOutlined, BulbOutlined, HeartOutlined, PieChartOutlined,
  FormOutlined, SafetyCertificateOutlined, TrophyOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface PortfolioResult {
  strategies: { name: string; type: string; weight: number; reason: string }[];
  expectedReturn: number;
  expectedRisk: string;
  reasoning: string;
}

interface BacktestReadResult {
  summary: string;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  badPeriods: { period: string; pnl: number; reason: string }[];
  paramSensitivity: { param: string; sensitivity: string }[];
  overallRating: 'good' | 'ok' | 'poor';
}

interface OptimizeResult {
  currentParams: { name: string; value: string }[];
  suggestions: { param: string; current: string; suggested: string; impact: string; reason: string }[];
  expectedImprovement: string;
}

interface HealthCheckResult {
  strategyName: string;
  status: 'red' | 'yellow' | 'green';
  label: string;
  detail: string;
  lastUpdated: string;
  daysSinceUpdate: number;
}

// ═══════════ Mock Data ═══════════

const MOCK_PORTFOLIO: PortfolioResult = {
  strategies: [
    { name:'MACD金叉',type:'趋势',weight:30,reason:'日线周期金叉信号明显, 近期胜率高' },
    { name:'布林带突破',type:'突破',weight:25,reason:'布林带收窄预示突破, 补充趋势跟随' },
    { name:'RSI超卖反弹',type:'反转',weight:25,reason:'震荡市中捕捉超卖反弹机会' },
    { name:'EMA交叉',type:'趋势',weight:20,reason:'中长期趋势确认, 降低假信号' },
  ],
  expectedReturn: 28.5,
  expectedRisk: '中等',
  reasoning: '趋势为主(75%)+反转为辅(25%)的稳健组合。MACD+布林带捕捉主趋势, RSI在震荡期补充收益, EMA过滤噪音。历史回测年化收益28.5%, 最大回撤15%。',
};

const MOCK_BACKTEST_READ: Record<string, BacktestReadResult> = {
  'MACD金叉': { summary:'MACD金叉策略在2024Q3-2025Q1表现优秀, 但在2025Q2震荡期连续亏损。主要收益来自趋势行情(贡献82%), 震荡期是最大拖后腿阶段。', winRate:64.5, sharpeRatio:2.4, maxDrawdown:18,
    badPeriods:[{period:'2025-Q2',pnl:-3400,reason:'震荡市MACD频繁金叉死叉, 假信号增加'},{period:'2024-Q1',pnl:-1200,reason:'单边下跌中金叉信号被破坏'}],
    paramSensitivity:[{param:'快线EMA',sensitivity:'高'},{param:'慢线EMA',sensitivity:'中'},{param:'K线周期',sensitivity:'高'}],overallRating:'good' },
};

const MOCK_OPTIMIZE: OptimizeResult = {
  currentParams:[{name:'快线EMA',value:'12'},{name:'慢线EMA',value:'26'},{name:'信号线',value:'9'},{name:'K线周期',value:'1d'}],
  suggestions:[
    {param:'快线EMA',current:'12',suggested:'14',impact:'中',reason:'14周期减少震荡市假信号, 胜率从64.5%→68%'},
    {param:'信号线',current:'9',suggested:'7',impact:'低',reason:'7周期加快响应, 减少滞后'},
    {param:'K线周期',current:'1d',suggested:'4h',impact:'高',reason:'4h周期信号更密集, 月交易机会+40%'},
  ],
  expectedImprovement:'预计胜率提升3-5%, 月均交易机会增加30-40%, 但手续费相应增加约15%',
};

const MOCK_HEALTH: HealthCheckResult[] = [
  { strategyName:'MACD金叉',status:'green',label:'正常',detail:'最近30天盈利+3,400 USDT, 胜率保持64%以上',lastUpdated:'2026-06-10',daysSinceUpdate:3},
  { strategyName:'布林带突破',status:'green',label:'正常',detail:'参数20天内更新过, 最近30天盈利+1,200 USDT',lastUpdated:'2026-06-05',daysSinceUpdate:8},
  { strategyName:'RSI超卖反弹',status:'yellow',label:'参数过期',detail:'参数105天未更新, 建议重新优化',lastUpdated:'2026-02-28',daysSinceUpdate:105},
  { strategyName:'EMA交叉',status:'red',label:'连续亏损',detail:'最近30天亏损-890 USDT, 连续亏损12笔, 建议暂停或重新优化',lastUpdated:'2026-06-01',daysSinceUpdate:12},
  { strategyName:'多时间框架共振',status:'yellow',label:'参数过期',detail:'参数92天未更新, 建议近期优化',lastUpdated:'2026-03-13',daysSinceUpdate:92},
];

// ═══════════ Components ═══════════

// ── AI Portfolio Generator (M01) ──

function AIPortfolioUI() {
  const [description, setDescription] = useState('稳健型, 趋势为主, 适合中等风险');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PortfolioResult|null>(null);
  const [saved, setSaved] = useState(false);
  const [balance, setBalance] = useState(10234.80);

  const handleGenerate = useCallback(async () => {
    if (balance < 2) return message.error('余额不足, 需2 USDT');
    setLoading(true); setBalance(p=>p-2); setResult(null);
    await new Promise(r=>setTimeout(r,1500+Math.random()*800));
    if (Math.random()>0.1) { setResult(MOCK_PORTFOLIO); message.success('组合生成完成 (扣费2 USDT)'); }
    else { setBalance(p=>p+2); message.warning('AI生成失败, 已退费2 USDT'); }
    setLoading(false);
  },[description,balance]);

  return (
    <div>
      <div style={{marginBottom:12}}>
        <div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>描述你的交易偏好</div>
        <Input.TextArea value={description} onChange={e=>setDescription(e.target.value)} rows={2}
          placeholder="例: 稳健型, 趋势为主, 适合中等风险, 日线周期" style={{background:'#0d0f1a'}}/>
      </div>

      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <Button type="primary" icon={loading?<ReloadOutlined spin/>:<PieChartOutlined/>} loading={loading}
          onClick={handleGenerate} disabled={balance<2}>AI生成组合 (2 USDT)</Button>
        <Tag color="blue">余额: {balance.toFixed(2)} U</Tag>
      </div>

      {result && (
        <Card size="small" title={<Space><PieChartOutlined/><span style={{color:'#e0e0e0'}}>推荐组合</span></Space>}
          extra={<Space><Tag color="green">预期{result.expectedReturn}%</Tag>
            <Button size="small" type="primary" onClick={()=>{setSaved(true);message.success('组合已保存');}} disabled={saved}>
              {saved?'已保存':'保存组合'}</Button></Space>}
          style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
          styles={{body:{padding:'12px'}}}>
          <Table dataSource={result.strategies} columns={[
            {title:'策略',dataIndex:'name',key:'name',render:(v:string)=><span style={{color:'#e0e0e0',fontWeight:500}}>{v}</span>},
            {title:'类型',dataIndex:'type',key:'type',render:(v:string)=><Tag color="blue">{v}</Tag>},
            {title:'权重',dataIndex:'weight',key:'w',render:(v:number)=><span style={{color:'#f59e0b',fontWeight:700,fontFamily:'monospace'}}>{v}%</span>},
            {title:'选择理由',dataIndex:'reason',key:'r',render:(v:string)=><span style={{color:'#8b949e',fontSize:10}}>{v}</span>},
          ]} rowKey="name" size="small" pagination={false} rowClassName={()=>'dark-table-row'}/>
          <div style={{marginTop:10,padding:'8px 12px',background:'#0d0f1a',borderRadius:6,fontSize:11,color:'#8b949e'}}>
            💡 {result.reasoning}
          </div>
        </Card>
      )}
      {!result&&!loading&&<Empty description="描述你的偏好, AI从策略库中选配最优组合 (扣费2 USDT)"/>}
      <Alert message="AI生成组合: 2 USDT/次 · 从策略库选配+权重分配 · 不生成代码 · 失败退费" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ── Backtest Read (M02) ──

function BacktestReadUI() {
  const [strategy, setStrategy] = useState('MACD金叉');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestReadResult|null>(null);
  const [balance, setBalance] = useState(10234.80);

  const handleRead = useCallback(async () => {
    if (balance<1) return message.error('余额不足, 需1 USDT');
    setLoading(true); setBalance(p=>p-1); setResult(null);
    await new Promise(r=>setTimeout(r,800+Math.random()*600));
    if (Math.random()>0.1) { setResult(MOCK_BACKTEST_READ[strategy]); message.success('回测解读完成 (扣费1 USDT)'); }
    else { setBalance(p=>p+1); message.warning('解读失败, 已退费1 USDT'); }
    setLoading(false);
  },[strategy,balance]);

  return (
    <div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <Select value={strategy} onChange={setStrategy} style={{width:150}} options={[{label:'MACD金叉',value:'MACD金叉'}]}/>
        <Button type="primary" icon={loading?<ReloadOutlined spin/>:<ReadOutlined/>} loading={loading}
          onClick={handleRead} disabled={balance<1}>AI解读回测 (1 USDT)</Button>
        <Tag color="blue">余额: {balance.toFixed(2)} U</Tag>
      </div>

      {result && (
        <div>
          <Card size="small" title={<Space><ReadOutlined/><span style={{color:'#e0e0e0'}}>AI解读</span></Space>}
            extra={<Tag color={result.overallRating==='good'?'green':result.overallRating==='ok'?'gold':'red'}>
              {result.overallRating==='good'?'优秀':result.overallRating==='ok'?'良好':'需改进'}</Tag>}
            style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:10}}
            styles={{body:{padding:'12px'}}}>
            <p style={{color:'#e0e0e0',fontSize:12,lineHeight:'20px'}}>{result.summary}</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,fontSize:11}}>
              <div><span style={{color:'#6b7280'}}>胜率</span> <span style={{color:'#e0e0e0',fontWeight:600}}>{result.winRate}%</span></div>
              <div><span style={{color:'#6b7280'}}>夏普</span> <span style={{color:'#e0e0e0',fontWeight:600}}>{result.sharpeRatio}</span></div>
              <div><span style={{color:'#6b7280'}}>最大回撤</span> <span style={{color:'#ef4444'}}>{result.maxDrawdown}%</span></div>
            </div>
          </Card>

          <Card size="small" title={<span style={{color:'#ef4444',fontSize:13}}>📉 拖后腿阶段</span>}
            style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:10}}
            styles={{body:{padding:'10px'}}}>
            {result.badPeriods.map((bp,i)=>(<div key={i} style={{padding:'6px 10px',background:'#0d0f1a',borderRadius:6,marginBottom:4,display:'flex',justifyContent:'space-between'}}>
              <Space><Tag color="red">{bp.period}</Tag><span style={{color:'#8b949e',fontSize:11}}>{bp.reason}</span></Space>
              <span style={{color:'#ef4444',fontFamily:'monospace'}}>-${Math.abs(bp.pnl).toLocaleString()}</span></div>))}
          </Card>

          <Card size="small" title={<span style={{color:'#f59e0b',fontSize:13}}>🎛 参数敏感度</span>}
            style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
            styles={{body:{padding:'10px'}}}>
            {result.paramSensitivity.map((ps,i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 8px'}}>
              <span style={{color:'#e0e0e0',fontSize:11}}>{ps.param}</span>
              <Tag color={ps.sensitivity==='高'?'red':'gold'}>{ps.sensitivity}</Tag></div>))}
          </Card>
        </div>
      )}
      {!result&&!loading&&<Empty description="选择策略, AI解读回测结果 (扣费1 USDT)"/>}
      <Alert message="AI回测解读: 1 USDT/次 · 基于真实回测数据 · 不胡编 · 失败退费" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ── Optimize UI (M03) ──

function OptimizeUI() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResult|null>(null);
  const [adopted, setAdopted] = useState(false);
  const [balance, setBalance] = useState(10234.80);

  const handleOptimize = useCallback(async () => {
    if (balance<1.5) return message.error('余额不足, 需1.5 USDT');
    setLoading(true); setBalance(p=>p-1.5); setResult(null);
    await new Promise(r=>setTimeout(r,1000+Math.random()*700));
    if (Math.random()>0.1) { setResult(MOCK_OPTIMIZE); message.success('优化建议完成 (扣费1.5 USDT)'); }
    else { setBalance(p=>p+1.5); message.warning('优化失败, 已退费1.5 USDT'); }
    setLoading(false);
  },[balance]);

  return (
    <div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <Button type="primary" icon={loading?<ReloadOutlined spin/>:<BulbOutlined/>} loading={loading}
          onClick={handleOptimize} disabled={balance<1.5}>AI优化建议 (1.5 USDT)</Button>
        <Tag color="blue">余额: {balance.toFixed(2)} U</Tag>
      </div>

      {result && (
        <div>
          <Card size="small" title={<Space><FormOutlined/><span style={{color:'#e0e0e0'}}>当前参数</span></Space>}
            style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:10}}
            styles={{body:{padding:'10px'}}}>
            <Space wrap>{result.currentParams.map(p=><Tag key={p.name} color="blue">{p.name}: {p.value}</Tag>)}</Space>
          </Card>

          <Card size="small" title={<Space><BulbOutlined style={{color:'#f59e0b'}}/><span style={{color:'#e0e0e0'}}>优化建议</span></Space>}
            extra={<Button type="primary" size="small" onClick={()=>{setAdopted(true);message.success('参数已采纳');}} disabled={adopted}>
              {adopted?'已采纳':'一键采纳'}</Button>}
            style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
            styles={{body:{padding:'10px'}}}>
            <Table dataSource={result.suggestions} columns={[
              {title:'参数',dataIndex:'param',key:'p',render:(v:string)=><span style={{color:'#e0e0e0'}}>{v}</span>},
              {title:'当前',dataIndex:'current',key:'c',render:(v:string)=><Tag>{v}</Tag>},
              {title:'建议',dataIndex:'suggested',key:'s',render:(v:string)=><Tag color="green">{v}</Tag>},
              {title:'影响',dataIndex:'impact',key:'i',render:(v:string)=><Tag color={v==='高'?'red':'gold'}>{v}</Tag>},
              {title:'理由',dataIndex:'reason',key:'r',render:(v:string)=><span style={{color:'#8b949e',fontSize:10}}>{v}</span>},
            ]} rowKey="param" size="small" pagination={false} rowClassName={()=>'dark-table-row'}/>
            <div style={{marginTop:10,padding:'8px 12px',background:'#1a2e1a',borderRadius:6,fontSize:11,color:'#22c55e'}}>
              📈 {result.expectedImprovement}
            </div>
          </Card>
        </div>
      )}
      {!result&&!loading&&<Empty description="AI分析当前策略参数, 给出优化建议 (扣费1.5 USDT)"/>}
      <Alert message="AI优化建议: 1.5 USDT/次 · 输出结构化参数 · 失败退费" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ── Health Check (M04) ──

function HealthCheckUI() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [ran, setRan] = useState(false);
  const [balance, setBalance] = useState(10234.80);

  const handleCheck = useCallback(async () => {
    if (balance<1) return message.error('余额不足, 需1 USDT');
    setLoading(true); setBalance(p=>p-1);
    await new Promise(r=>setTimeout(r,800+Math.random()*500));
    setResults(MOCK_HEALTH); setRan(true);
    message.success('健康检查完成 (扣费1 USDT)');
    setLoading(false);
  },[balance]);

  const statusConfig: Record<string,{color:string;icon:React.ReactNode;bg:string}> = {
    red: {color:'#ef4444',icon:<CloseCircleOutlined/>,bg:'#2e0a0a'},
    yellow: {color:'#f59e0b',icon:<CheckCircleOutlined/>,bg:'#2e2a1a'},
    green: {color:'#22c55e',icon:<CheckCircleOutlined/>,bg:'#1a2e1a'},
  };

  return (
    <div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <Button type="primary" icon={loading?<ReloadOutlined spin/>:<HeartOutlined/>} loading={loading}
          onClick={handleCheck} disabled={balance<1}>AI健康检查 (1 USDT)</Button>
        <Tag color="blue">余额: {balance.toFixed(2)} U</Tag>
      </div>

      {ran && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
            <div style={{padding:'10px',background:'#1a2e1a',borderRadius:8,border:'1px solid #22c55e33',textAlign:'center'}}>
              <div style={{fontSize:9,color:'#6b7280'}}>🟢 正常</div>
              <div style={{fontSize:22,fontWeight:700,color:'#22c55e'}}>{results.filter(r=>r.status==='green').length}</div></div>
            <div style={{padding:'10px',background:'#2e2a1a',borderRadius:8,border:'1px solid #f59e0b33',textAlign:'center'}}>
              <div style={{fontSize:9,color:'#6b7280'}}>🟡 参数过期</div>
              <div style={{fontSize:22,fontWeight:700,color:'#f59e0b'}}>{results.filter(r=>r.status==='yellow').length}</div></div>
            <div style={{padding:'10px',background:'#2e0a0a',borderRadius:8,border:'1px solid #ef444433',textAlign:'center'}}>
              <div style={{fontSize:9,color:'#6b7280'}}>🔴 亏损</div>
              <div style={{fontSize:22,fontWeight:700,color:'#ef4444'}}>{results.filter(r=>r.status==='red').length}</div></div>
          </div>

          {results.map(r=>{const sc=statusConfig[r.status];return(
            <Card key={r.strategyName} size="small"
              style={{background:sc.bg,border:`1px solid ${sc.color}33`,borderRadius:10,marginBottom:8}}
              styles={{body:{padding:'12px'}}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <Space size={8}>
                  <span style={{color:sc.color,fontSize:16}}>{sc.icon}</span>
                  <div><div style={{color:'#e0e0e0',fontWeight:600,fontSize:13}}>{r.strategyName}</div>
                    <div style={{color:'#8b949e',fontSize:10}}>{r.detail}</div></div>
                </Space>
                <Space>
                  <Tag color={r.status==='green'?'green':r.status==='yellow'?'gold':'red'}>{r.label}</Tag>
                  <span style={{color:'#6b7280',fontSize:10}}>{r.daysSinceUpdate}天</span>
                </Space>
              </div>
              <div style={{marginTop:6,fontSize:9,color:'#6b7280'}}>最后更新: {r.lastUpdated}</div>
            </Card>);})}
        </div>
      )}
      {!ran&&!loading&&<Empty description="一键扫描所有策略健康状态 (扣费1 USDT)"/>}
      <Alert message="健康检查: 1 USDT/次 · 红=30天连续亏损/黄=90天未更新/绿=正常 · 每日自动跑+手动触发" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ── Main Export ──

export default function AIStrategyPanel() {
  return (
    <div style={{padding:'0 4px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,
        padding:'12px 16px',background:'linear-gradient(135deg,#1a1d2e 0%,#232740 100%)',borderRadius:10,border:'1px solid #2a2d3e'}}>
        <Space>
          <RobotOutlined style={{fontSize:20,color:'#a78bfa'}}/>
          <div><div style={{color:'#e0e0e0',fontWeight:600,fontSize:16}}>AI 策略工具</div>
            <div style={{color:'#6b7280',fontSize:11}}>组合生成·回测解读·优化建议·健康检查 · 1-2U/次</div></div>
        </Space>
        <Space><Tag color="green">v17.6</Tag><Tag color="purple">静默扣款</Tag></Space>
      </div>

      <Card size="small" style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
        styles={{body:{padding:'12px'}}}>
        <Tabs defaultActiveKey="portfolio" size="small" items={[
          { key:'portfolio',label:<Space size={4}><PieChartOutlined/><span>生成组合 (2U)</span></Space>,children:<AIPortfolioUI/>},
          { key:'backtest',label:<Space size={4}><ReadOutlined/><span>回测解读 (1U)</span></Space>,children:<BacktestReadUI/>},
          { key:'optimize',label:<Space size={4}><BulbOutlined/><span>优化建议 (1.5U)</span></Space>,children:<OptimizeUI/>},
          { key:'health',label:<Space size={4}><HeartOutlined/><span>健康检查 (1U)</span></Space>,children:<HealthCheckUI/>},
        ]}/>
      </Card>
    </div>
  );
}
