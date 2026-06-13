// @ts-nocheck
// ── R147 ML — TradingFinalPanel (下单方式+交易明细+TA扣费) ───────────────
// PM: 3 modules, 5h
import { useState, useCallback } from 'react';
import {
  Card, Button, Select, Input, Table, Space, Tag, Tabs,
  message, Empty, Alert, Descriptions, Tooltip, InputNumber, Badge,
} from 'antd';
import {
  ThunderboltOutlined, SwapOutlined, HistoryOutlined,
  RobotOutlined, DollarOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, SendOutlined,
  ReloadOutlined, FireOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

type OrderType = 'limit' | 'market' | 'stop' | 'stop_limit';
type OrderScenario = 'strategy_entry' | 'copytrade_entry' | 'stop_loss' | 'take_profit';

interface TradeDetail {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: OrderType;
  scenario: OrderScenario;
  price: number;
  quantity: number;
  total: number;
  fee: number;
  feeRate: string;
  assetType: string;
  feeRefunded: boolean;
  status: 'filled' | 'failed' | 'cancelled' | 'expired';
  brokerName: string;
  createdAt: number;
  filledAt?: number;
  errorReason?: string;
}

interface TAAgentRun {
  id: string;
  agentTier: 'standard' | 'advanced' | 'flagship';
  tierPrice: number;
  symbol: string;
  strategy: string;
  status: 'running' | 'completed' | 'failed';
  result?: string;
  fee: number;
  feeRefunded: boolean;
  startedAt: number;
  completedAt?: number;
}

// ═══════════ Mock ═══════════

const MOCK_TRADES: TradeDetail[] = [
  { id:'td1',symbol:'BTC-USDT',side:'BUY',orderType:'limit',scenario:'strategy_entry',price:97234,quantity:0.01,total:972.34,fee:2.1,feeRate:'0.1%',assetType:'加密现货',feeRefunded:false,status:'filled',brokerName:'Binance',createdAt:Date.now()-3600000,filledAt:Date.now()-3540000},
  { id:'td2',symbol:'ETH-USDT',side:'BUY',orderType:'market',scenario:'copytrade_entry',price:3821,quantity:0.5,total:1910.5,fee:2.0,feeRate:'0.1%',assetType:'加密现货',feeRefunded:false,status:'filled',brokerName:'Binance',createdAt:Date.now()-7200000,filledAt:Date.now()-7140000},
  { id:'td3',symbol:'HK.00700',side:'SELL',orderType:'market',scenario:'stop_loss',price:378.5,quantity:100,total:37850,fee:37.85,feeRate:'0.1%',assetType:'股票/ETF',feeRefunded:false,status:'filled',brokerName:'Futu',createdAt:Date.now()-10800000,filledAt:Date.now()-10740000},
  { id:'td4',symbol:'SOL-USDT',side:'SELL',orderType:'limit',scenario:'take_profit',price:192.3,quantity:5,total:961.5,fee:2.0,feeRate:'0.1%',assetType:'加密现货',feeRefunded:false,status:'filled',brokerName:'OKX',createdAt:Date.now()-14400000,filledAt:Date.now()-14340000},
  { id:'td5',symbol:'BNB-USDT',side:'BUY',orderType:'market',scenario:'copytrade_entry',price:612,quantity:0.3,total:183.6,fee:2.0,feeRate:'0.1%',assetType:'加密现货',feeRefunded:true,status:'failed',brokerName:'Binance',createdAt:Date.now()-18000000,errorReason:'Insufficient balance'},
  { id:'td6',symbol:'DOGE-USDT',side:'BUY',orderType:'limit',scenario:'strategy_entry',price:0.172,quantity:5000,total:860,fee:2.0,feeRate:'0.1%',assetType:'加密现货',feeRefunded:false,status:'expired',brokerName:'Bybit',createdAt:Date.now()-21600000},
  { id:'td7',symbol:'US.AAPL',side:'BUY',orderType:'limit',scenario:'strategy_entry',price:198.5,quantity:50,total:9925,fee:9.93,feeRate:'0.1%',assetType:'股票/ETF',feeRefunded:false,status:'filled',brokerName:'Tiger',createdAt:Date.now()-25200000,filledAt:Date.now()-25140000},
  { id:'td8',symbol:'BTC-PERP',side:'SELL',orderType:'market',scenario:'stop_loss',price:96800,quantity:0.02,total:1936,fee:0.5,feeRate:'0.02%',assetType:'加密合约',feeRefunded:false,status:'filled',brokerName:'Binance',createdAt:Date.now()-86400000,filledAt:Date.now()-86340000},
];

const MOCK_TA_RUNS: TAAgentRun[] = [
  { id:'ta1',agentTier:'standard',tierPrice:1.0,symbol:'BTC-USDT',strategy:'MACD金叉',status:'completed',result:'执行1轮: 买入0.01 BTC',fee:1.0,feeRefunded:false,startedAt:Date.now()-3600000,completedAt:Date.now()-3590000},
  { id:'ta2',agentTier:'advanced',tierPrice:1.5,symbol:'ETH-USDT',strategy:'布林带突破',status:'completed',result:'执行1轮: 分析+画线',fee:1.5,feeRefunded:false,startedAt:Date.now()-7200000,completedAt:Date.now()-7190000},
  { id:'ta3',agentTier:'flagship',tierPrice:2.0,symbol:'BTC-USDT',strategy:'多因子共振',status:'failed',result:'下单被券商拒绝(价格超限)',fee:0,feeRefunded:true,startedAt:Date.now()-10800000},
];

// ═══════════ Helpers ═══════════

function fmtTime(ts: number) { return new Date(ts).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }

const SCENARIO_CONFIG: Record<OrderScenario, { label: string; defaultType: OrderType; color: string; editable: boolean }> = {
  strategy_entry: { label:'策略入场',defaultType:'limit',color:'#3b82f6',editable:true},
  copytrade_entry: { label:'跟单入场',defaultType:'market',color:'#22c55e',editable:true},
  stop_loss: { label:'止损',defaultType:'market',color:'#ef4444',editable:false},
  take_profit: { label:'止盈',defaultType:'limit',color:'#f59e0b',editable:false},
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  limit: '限价单', market: '市价单', stop: '条件单', stop_limit: '限价条件单',
};

const TA_TIER_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; price: number }> = {
  standard: { label:'标准Agent',color:'#3b82f6',icon:<RobotOutlined/>,price:1.0},
  advanced: { label:'高级Agent',color:'#a78bfa',icon:<FireOutlined/>,price:1.5},
  flagship: { label:'旗舰Agent',color:'#f59e0b',icon:<FireOutlined/>,price:2.0},
};

// ═══════════ Components ═══════════

// ── Order Type UI (M01) ──

function OrderTypeUI() {
  const [scenario, setScenario] = useState<OrderScenario>('strategy_entry');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [price, setPrice] = useState(97234);
  const [triggerPrice, setTriggerPrice] = useState<number|undefined>();
  const [quantity, setQuantity] = useState(0.01);
  const sc = SCENARIO_CONFIG[scenario];

  const handleScenarioChange = useCallback((s:OrderScenario)=>{
    setScenario(s); setOrderType(SCENARIO_CONFIG[s].defaultType);
  },[scenario]);

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {Object.entries(SCENARIO_CONFIG).map(([key,cfg])=>(
          <Button key={key} type={scenario===key?'primary':'default'}
            ghost={scenario!==key} onClick={()=>handleScenarioChange(key as OrderScenario)}
            style={{borderColor:cfg.color}}>
            <Tag color={cfg.color} style={{fontSize:9}}>{cfg.label}</Tag>
            <span style={{fontSize:11}}>{ORDER_TYPE_LABELS[cfg.defaultType]}{cfg.editable?' (可调)':' (锁定)'}</span>
          </Button>
        ))}
      </div>

      <Card size="small" style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:12}}
        styles={{body:{padding:'14px'}}}>
        <div style={{marginBottom:12}}>
          <div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>下单方式{sc.editable?'':' (锁定)'}</div>
          <Select value={orderType} onChange={setOrderType} style={{width:'100%'}} disabled={!sc.editable}>
            <Select.Option value="limit">限价单 - 指定价格成交</Select.Option>
            <Select.Option value="market">市价单 - 当前最优价成交</Select.Option>
            <Select.Option value="stop">条件单 - 达到触发价后下单</Select.Option>
            <Select.Option value="stop_limit">限价条件单 - 触发后以限价成交</Select.Option>
          </Select>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {(orderType==='limit'||orderType==='stop_limit') && (
            <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>限价</div>
              <InputNumber value={price} onChange={v=>setPrice(v||0)} style={{width:'100%'}}/></div>
          )}
          {(orderType==='stop'||orderType==='stop_limit') && (
            <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>触发价</div>
              <InputNumber value={triggerPrice||price} onChange={v=>setTriggerPrice(v||undefined)} style={{width:'100%'}}/></div>
          )}
          <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>数量</div>
            <InputNumber value={quantity} onChange={v=>setQuantity(v||0)} style={{width:'100%'}}/></div>
        </div>

        <div style={{marginTop:12,padding:'8px 12px',background:'#0d0f1a',borderRadius:6,fontSize:11,color:'#8b949e'}}>
          {scenario==='strategy_entry'&&'策略入场默认限价单, 精准控制入场价。可切市价单即时成交。'}
          {scenario==='copytrade_entry'&&'跟单入场必须用市价单(默认), 否则滑点跟不上信号源。可切限价单。'}
          {scenario==='stop_loss'&&'止损必须用市价单! 止损是保命机制, 不可调。'}
          {scenario==='take_profit'&&'止盈默认限价单, 锁定目标利润。不可调。'}
        </div>
      </Card>

      <Alert message="4种下单场景: 策略入场(限价)/跟单(市价)/止损(市价·锁定)/止盈(限价·锁定) · 用户可调整限价/市价" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginBottom:10,fontSize:11}}/>
    </div>
  );
}

// ── Trade Detail (M02) ──

function TradeDetailPage() {
  const [filter, setFilter] = useState('all');
  const filtered = MOCK_TRADES.filter(t=>{
    if(filter==='filled')return t.status==='filled';
    if(filter==='failed')return t.status==='failed'||t.status==='expired';
    if(filter==='refunded')return t.feeRefunded;
    return true;
  });

  const totalFee = filtered.reduce((s,t)=>s+(t.feeRefunded?0:t.fee),0);

  const columns = [
    { title:'时间',dataIndex:'createdAt',key:'t',width:90,render:(v:number)=><span style={{color:'#8b949e',fontSize:10}}>{fmtTime(v)}</span> },
    { title:'币种',dataIndex:'symbol',key:'s',width:90,render:(v:string)=><span style={{color:'#e0e0e0',fontWeight:600,fontSize:11}}>{v}</span> },
    { title:'方向',dataIndex:'side',key:'d',width:50,render:(v:string)=><Tag color={v==='BUY'?'green':'red'}>{v==='BUY'?'买':'卖'}</Tag> },
    { title:'场景',dataIndex:'scenario',key:'sc',width:80,render:(v:OrderScenario)=>{const c=SCENARIO_CONFIG[v];return<Tag color={c.color}>{c.label}</Tag>}},
    { title:'方式',dataIndex:'orderType',key:'ot',width:65,render:(v:OrderType)=><Tag>{ORDER_TYPE_LABELS[v]}</Tag> },
    { title:'总金额',key:'total',width:80,render:(_:any,r:TradeDetail)=><span style={{fontFamily:'monospace',color:'#e0e0e0',fontSize:11}}>${r.total.toFixed(2)}</span> },
    { title:'手续费',key:'fee',width:80,render:(_:any,r:TradeDetail)=><Space size={2}>
      <span style={{fontFamily:'monospace',color:r.feeRefunded?'#8b949e':'#f59e0b',fontSize:11}}>{r.feeRefunded?'已退':`$${r.fee.toFixed(2)}`}</span>
      <Tag color="blue" style={{fontSize:8,lineHeight:'12px'}}>{r.feeRate}</Tag></Space>},
    { title:'资产',dataIndex:'assetType',key:'at',width:75,render:(v:string)=><Tag color="cyan">{v}</Tag>},
    { title:'状态',dataIndex:'status',key:'st',width:60,render:(v:string)=>{
      if(v==='filled')return<Badge color="green" text="成交"/>;
      if(v==='failed')return<Badge color="red" text="失败"/>;
      if(v==='expired')return<Badge color="default" text="过期"/>;
      return<Badge color="default" text={v}/>;}},
    { title:'券商',dataIndex:'brokerName',key:'bn',width:65,render:(v:string)=><Tag>{v}</Tag>},
  ];

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <Space>
          {[{key:'all',label:'全部'},{key:'filled',label:'成交'},{key:'failed',label:'失败/过期'},{key:'refunded',label:'已退费'}].map(f=>(
            <Button key={f.key} size="small" type={filter===f.key?'primary':'default'} ghost={filter!==f.key} onClick={()=>setFilter(f.key)}>{f.label}</Button>
          ))}
        </Space>
        <span style={{color:'#f59e0b',fontSize:12,fontFamily:'monospace'}}>手续费合计: ${totalFee.toFixed(2)}</span>
      </div>
      <Table dataSource={filtered} columns={columns} rowKey="id" size="small"
        pagination={{pageSize:10,size:'small',showTotal:t=>`共 ${t} 笔`}}
        rowClassName={()=>'dark-table-row'} locale={{emptyText:<Empty description="无交易"/>}}/>
      <Alert message="5类资产费率: 股票/期货/期权 0.1%最低2U · 加密现货 0.1%最低2U · 加密合约 0.02%最低0.5U · 失败退费" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ── TA Status Display (M03) ──

function TAStatusDisplay() {
  const [runs] = useState(MOCK_TA_RUNS);
  const [balance, setBalance] = useState(10234.80);
  const totalFee = runs.reduce((s,r)=>s+(r.feeRefunded?0:r.fee),0);

  return (
    <div>
      <div style={{display:'flex',gap:12,marginBottom:12,flexWrap:'wrap'}}>
        {Object.entries(TA_TIER_CONFIG).map(([key,cfg])=>(
          <Card key={key} size="small" style={{flex:1,minWidth:160,background:'#1a1d2e',border:`1px solid ${cfg.color}33`,borderRadius:10}}
            styles={{body:{padding:'12px'}}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:20,color:cfg.color,marginBottom:4}}>{cfg.icon}</div>
              <div style={{color:cfg.color,fontWeight:700,fontSize:13}}>{cfg.label}</div>
              <div style={{color:'#f59e0b',fontSize:18,fontWeight:700,fontFamily:'monospace',marginTop:4}}>
                {cfg.price} USDT<span style={{fontSize:11,color:'#8b949e'}}>/轮</span></div>
              <Tag color="green" style={{marginTop:4}}>执行失败不收费</Tag>
            </div>
          </Card>
        ))}
      </div>

      <div style={{marginBottom:10,fontSize:11}}>
        <Space><Tag color="blue">余额: {balance.toFixed(2)} U</Tag>
          <span style={{color:'#8b949e'}}>TA累计费用: {totalFee.toFixed(2)} U</span></Space>
      </div>

      {runs.map(r=>{const tc=TA_TIER_CONFIG[r.agentTier];return(
        <Card key={r.id} size="small" style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:8}}
          styles={{body:{padding:'12px'}}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <Space size={8}>
              <span style={{color:tc.color,fontSize:16}}>{tc.icon}</span>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{color:'#e0e0e0',fontWeight:600,fontSize:13}}>{r.symbol}</span>
                  <Tag color={tc.color}>{tc.label}</Tag>
                </div>
                <div style={{color:'#6b7280',fontSize:10}}>{r.strategy}</div>
              </div>
            </Space>
            <div style={{textAlign:'right'}}>
              {r.status==='running'&&<Space><ReloadOutlined spin/><span style={{color:'#f59e0b',fontSize:11}}>执行中</span></Space>}
              {r.status==='completed'&&<Space>
                <CheckCircleOutlined style={{color:'#22c55e'}}/>
                <span style={{color:'#8b949e',fontSize:10}}>{r.result}</span>
                <Tag color={r.feeRefunded?'default':'orange'}>{r.feeRefunded?'退费':`-${r.fee.toFixed(1)}U`}</Tag></Space>}
              {r.status==='failed'&&<Space>
                <CloseCircleOutlined style={{color:'#ef4444'}}/>
                <span style={{color:'#ef4444',fontSize:10}}>{r.result}</span>
                <Tag color="green">不收费</Tag></Space>}
            </div>
          </div>
        </Card>);})}

      <Alert message="TA Agent扣费: 标准1U/高级1.5U/旗舰2U · 执行失败不收费(下单被拒/超时/券商拒绝) · 纯按次无月卡" type="info" showIcon={false}
        style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:10,fontSize:11}}/>
    </div>
  );
}

// ═══════════ Main Export ═══════════

export default function TradingFinalPanel() {
  return (
    <div style={{padding:'0 4px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,
        padding:'12px 16px',background:'linear-gradient(135deg,#1a1d2e 0%,#232740 100%)',borderRadius:10,border:'1px solid #2a2d3e'}}>
        <Space>
          <SwapOutlined style={{fontSize:20,color:'#f59e0b'}}/>
          <div><div style={{color:'#e0e0e0',fontWeight:600,fontSize:16}}>交易 & TA</div>
            <div style={{color:'#6b7280',fontSize:11}}>下单方式·交易明细·TA扣费 · 👑最后一轮功能开发!</div></div>
        </Space>
        <Space><Tag color="green">v17.6</Tag><Tag color="gold">R147 收官</Tag></Space>
      </div>

      <Card size="small" style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
        styles={{body:{padding:'12px'}}}>
        <Tabs defaultActiveKey="order" size="small" items={[
          { key:'order',label:<Space size={4}><SwapOutlined/><span>下单方式</span></Space>,children:<OrderTypeUI/>},
          { key:'detail',label:<Space size={4}><HistoryOutlined/><span>交易明细</span></Space>,children:<TradeDetailPage/>},
          { key:'ta',label:<Space size={4}><RobotOutlined/><span>TA扣费</span></Space>,children:<TAStatusDisplay/>},
        ]}/>
      </Card>
    </div>
  );
}
