// @ts-nocheck
// ── R143 ML — WalletFullPage (提现+转账+打赏+总览) ───────────────────────
// PM: 4 modules, 7h. 提现/转账/打赏/总览整合
import { useState, useCallback } from 'react';
import {
  Card, Button, Input, Select, Tabs, Table, Tag, Space, QRCode,
  Alert, message, Badge, Empty, Statistic, Modal, Descriptions, Tooltip, Slider,
} from 'antd';
import {
  ArrowUpOutlined, SwapOutlined, HeartOutlined, WalletOutlined,
  SendOutlined, DownloadOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  CrownOutlined, StarOutlined, TrophyOutlined, UserOutlined,
  BankOutlined, ThunderboltOutlined, HistoryOutlined, DollarOutlined,
  CopyOutlined, CalculatorOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface WithdrawRecord {
  id: string; chain: 'TRC20' | 'ERC20'; amount: number; fee: number;
  netAmount: number; address: string; txHash?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  walletType: 'hot' | 'cold'; createdAt: number; completedAt?: number;
}

interface TransferRecord {
  id: string; type: 'sent' | 'received'; counterparty: string; amount: number;
  fee: number; note?: string; status: 'completed' | 'pending';
  createdAt: number;
}

interface TipRecord {
  id: string; creatorName: string; creatorLevel: 'L1' | 'L2' | 'L3';
  amount: number; platformCut: number; creatorGets: number;
  status: 'completed'; createdAt: number;
}

// ═══════════ Mock ═══════════

const MOCK_WITHDRAWS: WithdrawRecord[] = [
  { id: 'w1', chain: 'TRC20', amount: 500, fee: 2, netAmount: 498, address: 'TR7NHq...Lj6t', txHash: '0xabc...', status: 'completed', walletType: 'hot', createdAt: Date.now() - 86400000, completedAt: Date.now() - 86300000 },
  { id: 'w2', chain: 'ERC20', amount: 5000, fee: 5, netAmount: 4995, address: '0xdAC17...7', status: 'processing', walletType: 'cold', createdAt: Date.now() - 3600000 },
  { id: 'w3', chain: 'TRC20', amount: 100, fee: 2, netAmount: 98, address: 'TR7NHq...Lj6t', status: 'pending', walletType: 'hot', createdAt: Date.now() - 600000 },
];

const MOCK_TRANSFERS: TransferRecord[] = [
  { id: 'tr1', type: 'sent', counterparty: 'trader123', amount: 1000, fee: 3, status: 'completed', createdAt: Date.now() - 21600000 },
  { id: 'tr2', type: 'received', counterparty: 'whale_tracker', amount: 500, fee: 1.5, status: 'completed', createdAt: Date.now() - 43200000 },
  { id: 'tr3', type: 'sent', counterparty: 'alpha_trader', amount: 200, fee: 0.6, note: '感谢策略分享', status: 'completed', createdAt: Date.now() - 86400000 },
];

const MOCK_TIPS: TipRecord[] = [
  { id: 'tip1', creatorName: 'AlphaQuant', creatorLevel: 'L3', amount: 49.9, platformCut: 4.99, creatorGets: 44.91, status: 'completed', createdAt: Date.now() - 1800000 },
  { id: 'tip2', creatorName: 'WhaleTracker', creatorLevel: 'L3', amount: 19.9, platformCut: 1.99, creatorGets: 17.91, status: 'completed', createdAt: Date.now() - 86400000 },
];

// ═══════════ Helpers ═══════════

function copyText(t: string) { navigator.clipboard?.writeText(t); message.success('已复制'); }
function fmtTime(ts: number) { return new Date(ts).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
function fmtUsdt(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const LEVEL_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string; cut: string }> = {
  L1: { color: '#8b949e', icon: <StarOutlined />, label: '新手', cut: '30%' },
  L2: { color: '#3b82f6', icon: <TrophyOutlined />, label: '进阶(≥100笔)', cut: '20%' },
  L3: { color: '#f59e0b', icon: <CrownOutlined />, label: '旗舰(≥1000笔)', cut: '10%' },
};

const TIP_AMOUNTS = [9.9, 19.9, 49.9, 99.9];

// ═══════════ Modules ═══════════

// ── Withdraw Panel ──

function WithdrawPanel() {
  const [chain, setChain] = useState<'TRC20' | 'ERC20'>('TRC20');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fee = Math.max(Number(amount) * 0.001, 2);
  const netAmount = Number(amount) - fee;
  const isOver100k = Number(amount) > 100000;

  const handleWithdraw = useCallback(async () => {
    if (!address || !amount) return message.warning('请填写地址和金额');
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    message.success('提现请求已提交');
  }, [address, amount]);

  const columns = [
    { title: '链', dataIndex: 'chain', key: 'chain', width: 55, render: (v:string) => <Tag color={v==='TRC20'?'gold':'blue'}>{v==='TRC20'?'TRC':'ERC'}</Tag> },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 80, render: (v:number) => <span style={{color:'#e0e0e0',fontFamily:'monospace'}}>{fmtUsdt(v)}</span> },
    { title: '手续费', dataIndex: 'fee', key: 'fee', width: 65, render: (v:number) => <span style={{color:'#8b949e',fontSize:11}}>{fmtUsdt(v)}</span> },
    { title: '到账', dataIndex: 'netAmount', key: 'net', width: 80, render: (v:number) => <span style={{color:'#22c55e',fontFamily:'monospace'}}>{fmtUsdt(v)}</span> },
    { title: '钱包', dataIndex: 'walletType', key: 'wallet', width: 55, render: (v:string) => <Tag color={v==='hot'?'green':'blue'}>{v==='hot'?'热':'冷'}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 70, render: (v:string) => {
      if(v==='completed') return <Badge color="green" text="完成"/>;
      if(v==='processing') return <Badge color="gold" text="处理中"/>;
      return <Badge color="default" text="待处理"/>;
    }},
    { title: '时间', dataIndex: 'createdAt', key: 'time', width: 90, render: (v:number) => <span style={{color:'#8b949e',fontSize:10}}>{fmtTime(v)}</span> },
  ];

  return (
    <div>
      {/* Withdraw form */}
      <Card size="small" title={<Space><ArrowUpOutlined style={{color:'#ef4444'}}/><span style={{color:'#e0e0e0'}}>发起提现</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:12}}
        styles={{body:{padding:'14px'}}}>
        <Space direction="vertical" size={12} style={{width:'100%'}}>
          <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>区块链</div>
            <Select value={chain} onChange={setChain} style={{width:'100%'}}>
              <Select.Option value="TRC20">TRC-20 (推荐)</Select.Option>
              <Select.Option value="ERC20">ERC-20</Select.Option>
            </Select></div>
          <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>提现地址</div>
            <Input placeholder={`${chain}地址`} value={address} onChange={(e)=>setAddress(e.target.value)}/></div>
          <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>金额</div>
            <Input type="number" placeholder="最低2USDT" value={amount} onChange={(e)=>setAmount(e.target.value)} suffix="USDT"/></div>
          {amount && Number(amount) > 0 && (
            <div style={{padding:'8px 12px',background:'#0d0f1a',borderRadius:6,fontSize:12,color:'#8b949e'}}>
              手续费: {fmtUsdt(fee)} USDT (0.1%最低2U) · 到账: {fmtUsdt(netAmount)} USDT
              {isOver100k && <div style={{color:'#f59e0b',marginTop:4}}>⚠ 大额提现({'>'}10万U) 走冷钱包，需离线签名</div>}
            </div>
          )}
          <Button type="primary" danger onClick={handleWithdraw} loading={submitting} block icon={<ArrowUpOutlined/>}>
            确认提现
          </Button>
        </Space>
      </Card>

      {/* Risk rules */}
      <Alert message={<span style={{fontSize:11}}>提现规则: 0.1%最低2U · 单笔≤10万U · 日累计≤100万U · 首次无需审核 · 余额{'>'}1000且注册{'<'}7天人工审核 · 冷钱包80%+热钱包20%</span>}
        type="info" showIcon={false} style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginBottom:12}}/>

      {/* History */}
      <Card size="small" title={<Space><HistoryOutlined/><span style={{color:'#e0e0e0'}}>提现记录</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}} styles={{body:{padding:'8px'}}}>
        <Table dataSource={MOCK_WITHDRAWS} columns={columns} rowKey="id" size="small" pagination={false}
          rowClassName={()=>'dark-table-row'} locale={{emptyText:<Empty description="无提现记录"/>}}/>
      </Card>
    </div>
  );
}

// ── Transfer Panel ──

function TransferPanel() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fee = Number(amount) * 0.003;

  const handleTransfer = useCallback(async () => {
    if (!recipient || !amount) return message.warning('请填写接收方和金额');
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    message.success('转账成功');
  }, [recipient, amount]);

  const columns = [
    { title: '类型', dataIndex: 'type', key:'type', width:60, render:(v:string)=><Tag color={v==='sent'?'orange':'green'}>{v==='sent'?'转出':'收款'}</Tag> },
    { title: '对方', dataIndex: 'counterparty', key:'cp', render:(v:string)=><span style={{color:'#e0e0e0'}}>@{v}</span> },
    { title: '金额', dataIndex: 'amount', key:'amount', width:80, render:(v:number)=><span style={{color:v>=0?'#22c55e':'#ef4444',fontFamily:'monospace',fontWeight:600}}>{v>=0?'+':''}{fmtUsdt(v)}</span> },
    { title: '手续费', dataIndex: 'fee', key:'fee', width:65, render:(v:number)=><span style={{color:'#8b949e',fontSize:11}}>{fmtUsdt(v)}</span> },
    { title: '备注', dataIndex: 'note', key:'note', render:(v:string|undefined)=><span style={{color:'#6b7280',fontSize:11}}>{v||'—'}</span> },
    { title: '时间', dataIndex: 'createdAt', key:'time', width:90, render:(v:number)=><span style={{color:'#8b949e',fontSize:10}}>{fmtTime(v)}</span> },
  ];

  return (
    <div>
      <Card size="small" title={<Space><SwapOutlined style={{color:'#3b82f6'}}/><span style={{color:'#e0e0e0'}}>用户转账</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:12}}
        styles={{body:{padding:'14px'}}}>
        <Space direction="vertical" size={12} style={{width:'100%'}}>
          <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>接收方ID</div>
            <Input placeholder="用户ID 或 @用户名" value={recipient} onChange={(e)=>setRecipient(e.target.value)}/></div>
          <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>金额</div>
            <Input type="number" placeholder="金额" value={amount} onChange={(e)=>setAmount(e.target.value)} suffix="USDT"/></div>
          <div><div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>备注 (可选)</div>
            <Input placeholder="转账备注" value={note} onChange={(e)=>setNote(e.target.value)}/></div>
          {amount && Number(amount) > 0 && (
            <div style={{padding:'10px 12px',background:'#2e2a1a',borderRadius:6,border:'1px solid #f59e0b33',fontSize:12}}>
              <div style={{color:'#f59e0b'}}>⚠ 双方各收 0.3% 手续费</div>
              <div style={{color:'#8b949e',marginTop:4}}>你支付: {fmtUsdt(Number(amount)+fee)} USDT (含{fmtUsdt(fee)}手) · 对方收到: {fmtUsdt(Number(amount)*0.997)} USDT (扣0.3%)</div>
            </div>
          )}
          <Button type="primary" onClick={handleTransfer} loading={submitting} block icon={<SendOutlined/>}>确认转账</Button>
        </Space>
      </Card>
      <Alert message={<span style={{fontSize:11}}>转账≠打赏! 转账走0.3%×2手续费管道。打赏走创作者等级抽成(L1:30%/L2:20%/L3:10%)。</span>}
        type="warning" showIcon style={{background:'#2e2a1a',border:'1px solid #f59e0b33',borderRadius:8,marginBottom:12}}/>

      <Card size="small" title={<Space><HistoryOutlined/><span style={{color:'#e0e0e0'}}>转账记录</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}} styles={{body:{padding:'8px'}}}>
        <Table dataSource={MOCK_TRANSFERS} columns={columns} rowKey="id" size="small" pagination={false}
          rowClassName={()=>'dark-table-row'} locale={{emptyText:<Empty description="无转账记录"/>}}/>
      </Card>
    </div>
  );
}

// ── Tip Component ──

function TipModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [selectedAmount, setSelectedAmount] = useState(19.9);
  const [creatorLevel, setCreatorLevel] = useState<'L1'|'L2'|'L3'>('L3');
  const [submitting, setSubmitting] = useState(false);

  const lc = LEVEL_CONFIG[creatorLevel];
  const cutPct = parseInt(lc.cut);
  const platformCut = selectedAmount * (cutPct / 100);
  const creatorGets = selectedAmount - platformCut;

  const handleTip = useCallback(async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    setSubmitting(false);
    message.success(`打赏 ${fmtUsdt(selectedAmount)} USDT 成功! 创作者获得 ${fmtUsdt(creatorGets)} USDT`);
    onClose();
  }, [selectedAmount, creatorGets, onClose]);

  return (
    <Modal title={<Space><HeartOutlined style={{color:'#ef4444'}}/><span>打赏创作者</span></Space>}
      open={visible} onCancel={onClose} onOk={handleTip} confirmLoading={submitting} okText="确认打赏" width={460}>
      <Space direction="vertical" size={14} style={{width:'100%'}}>
        <div>
          <div style={{color:'#6b7280',fontSize:11,marginBottom:4}}>创作者等级</div>
          <Select value={creatorLevel} onChange={setCreatorLevel} style={{width:'100%'}}>
            <Select.Option value="L1">L1 新手 (平台抽30%)</Select.Option>
            <Select.Option value="L2">L2 进阶 ≥100笔 (平台抽20%)</Select.Option>
            <Select.Option value="L3">L3 旗舰 ≥1000笔 (平台抽10%)</Select.Option>
          </Select>
        </div>

        <div>
          <div style={{color:'#6b7280',fontSize:11,marginBottom:6}}>打赏金额</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {TIP_AMOUNTS.map((a) => (
              <Button key={a} type={selectedAmount===a?'primary':'default'}
                onClick={()=>setSelectedAmount(a)}
                style={{height:44,fontSize:14,fontWeight:600}}>
                {a}U
              </Button>
            ))}
          </div>
        </div>

        <div style={{padding:'10px 14px',background:'#0d0f1a',borderRadius:8,border:'1px solid #2a2d3e'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:'#8b949e',fontSize:11}}>打赏金额</span>
            <span style={{color:'#e0e0e0',fontFamily:'monospace'}}>{fmtUsdt(selectedAmount)} USDT</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:'#8b949e',fontSize:11}}>平台抽成 ({lc.cut})</span>
            <span style={{color:'#3b82f6',fontFamily:'monospace'}}>-{fmtUsdt(platformCut)} USDT</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:600}}>
            <span style={{color:'#22c55e',fontSize:11}}>创作者获得</span>
            <span style={{color:'#22c55e',fontFamily:'monospace',fontSize:14}}>{fmtUsdt(creatorGets)} USDT</span>
          </div>
        </div>
      </Space>
    </Modal>
  );
}

function TipPanel() {
  const [tipVisible, setTipVisible] = useState(false);

  const columns = [
    { title: '创作者', dataIndex: 'creatorName', key:'name', render:(v:string,r:TipRecord)=>(<div><span style={{color:'#e0e0e0'}}>{v}</span><Tag color={LEVEL_CONFIG[r.creatorLevel].color} style={{fontSize:9,marginLeft:4}}>{LEVEL_CONFIG[r.creatorLevel].icon} {r.creatorLevel}</Tag></div>) },
    { title: '打赏', dataIndex: 'amount', key:'amount', width:70, render:(v:number)=><span style={{color:'#e0e0e0',fontFamily:'monospace',fontWeight:600}}>{fmtUsdt(v)}</span> },
    { title: '平台', dataIndex: 'platformCut', key:'plat', width:65, render:(v:number)=><span style={{color:'#3b82f6',fontSize:11}}>{fmtUsdt(v)}</span> },
    { title: '创作者得', dataIndex: 'creatorGets', key:'gets', width:70, render:(v:number)=><span style={{color:'#22c55e',fontFamily:'monospace'}}>{fmtUsdt(v)}</span> },
    { title: '时间', dataIndex: 'createdAt', key:'time', width:90, render:(v:number)=><span style={{color:'#8b949e',fontSize:10}}>{fmtTime(v)}</span> },
  ];

  return (
    <div>
      <Card size="small" title={<Space><HeartOutlined style={{color:'#ef4444'}}/><span style={{color:'#e0e0e0'}}>打赏创作者</span></Space>}
        extra={<Button type="primary" size="small" icon={<HeartOutlined/>} onClick={()=>setTipVisible(true)}>打赏</Button>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:12}}
        styles={{body:{padding:'12px'}}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
          {Object.entries(LEVEL_CONFIG).map(([key,cfg])=>(
            <Tag key={key} color={cfg.color} style={{fontSize:11,padding:'4px 10px'}}>
              {cfg.icon} {key} {cfg.label}: 平台抽{cfg.cut}
            </Tag>
          ))}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {TIP_AMOUNTS.map((a)=>(
            <Button key={a} onClick={()=>setTipVisible(true)} style={{height:40}}>{a} USDT</Button>
          ))}
        </div>
      </Card>

      <Alert message={<span style={{fontSize:11}}>💡 打赏≠转账! 打赏按创作者等级抽成(不是0.3%)。L1:30% / L2:20% / L3:10%。仅创作者市场接受打赏。</span>}
        type="info" showIcon={false} style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginBottom:12}}/>

      <Card size="small" title={<Space><HistoryOutlined/><span style={{color:'#e0e0e0'}}>打赏记录</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}} styles={{body:{padding:'8px'}}}>
        <Table dataSource={MOCK_TIPS} columns={columns} rowKey="id" size="small" pagination={false}
          rowClassName={()=>'dark-table-row'} locale={{emptyText:<Empty description="暂无打赏记录"/>}}/>
      </Card>

      <TipModal visible={tipVisible} onClose={()=>setTipVisible(false)}/>
    </div>
  );
}

// ── Wallet Overview (integrated summary) ──

function WalletOverview() {
  const balance = { total: 12580.50, available: 10234.80, frozen: 2345.70, pendingDeposit: 0 };

  const recentTransactions = [
    { id:'tx1', type:'deposit', amount:5000, time:Date.now()-86400000 },
    { id:'tx2', type:'trade_fee', amount:-5, time:Date.now()-43200000 },
    { id:'tx3', type:'transfer_out', amount:-1000, fee:3, time:Date.now()-21600000 },
    { id:'tx4', type:'ai_fee', amount:-1, time:Date.now()-3600000 },
    { id:'tx5', type:'tip_received', amount:50, time:Date.now()-1800000 },
  ];

  const typeLabels: Record<string, { label: string; color: string }> = {
    deposit: { label: '充值', color: '#22c55e' },
    trade_fee: { label: '交易费', color: '#8b949e' },
    transfer_out: { label: '转出', color: '#f59e0b' },
    ai_fee: { label: 'AI费', color: '#8b949e' },
    tip_received: { label: '打赏', color: '#22c55e' },
  };

  const [activeTab, setActiveTab] = useState('overview');
  const tabs = [
    { key: 'overview', label: <Space size={2}><WalletOutlined/><span>总览</span></Space>, children: <div>
      {/* Balance */}
      <Card style={{background:'linear-gradient(135deg,#1a1d2e 0%,#232740 100%)',border:'1px solid #2a2d3e',borderRadius:12,marginBottom:12}}
        styles={{body:{padding:'20px'}}}>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <div><Space size={6}><WalletOutlined style={{color:'#f59e0b'}}/><span style={{color:'#8b949e',fontSize:12}}>USDT钱包</span></Space>
            <div style={{fontSize:36,fontWeight:800,color:'#e0e0e0',fontFamily:'monospace'}}>{fmtUsdt(balance.total)}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#6b7280'}}>可用</div><div style={{color:'#22c55e',fontWeight:700,fontFamily:'monospace'}}>{fmtUsdt(balance.available)}</div></div>
            <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#6b7280'}}>冻结</div><div style={{color:'#f59e0b',fontWeight:700,fontFamily:'monospace'}}>{fmtUsdt(balance.frozen)}</div></div>
            <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#6b7280'}}>待确认</div><div style={{color:'#3b82f6',fontWeight:700,fontFamily:'monospace'}}>{fmtUsdt(balance.pendingDeposit)}</div></div>
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
        {[{label:'充值',icon:<DownloadOutlined/>,color:'#22c55e'},{label:'提现',icon:<ArrowUpOutlined/>,color:'#ef4444'},{label:'转账',icon:<SwapOutlined/>,color:'#3b82f6'},{label:'打赏',icon:<HeartOutlined/>,color:'#ef4444'}].map(a=>(
          <Button key={a.label} size="large" style={{height:52,background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,color:a.color,fontSize:11}} icon={a.icon}
            onClick={()=>setActiveTab(a.label==='充值'?'deposit':a.label==='提现'?'withdraw':a.label==='转账'?'transfer':'tip')}>
            {a.label}
          </Button>
        ))}
      </div>

      {/* Recent 5 */}
      <Card size="small" title={<Space><HistoryOutlined/><span style={{color:'#e0e0e0',fontSize:13}}>最近交易</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}} styles={{body:{padding:'8px'}}}>
        {recentTransactions.map(tx=>{const tl=typeLabels[tx.type]||{label:tx.type,color:'#8b949e'};return(
          <div key={tx.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 10px',background:'#0d0f1a',borderRadius:6,marginBottom:4}}>
            <Space size={6}><Tag color={tl.color} style={{fontSize:9}}>{tl.label}</Tag><span style={{color:'#e0e0e0',fontSize:11}}>{(tx as any).note||''}</span></Space>
            <div style={{textAlign:'right'}}>
              <span style={{color:tx.amount>=0?'#22c55e':'#ef4444',fontWeight:600,fontFamily:'monospace',fontSize:12}}>{tx.amount>=0?'+':''}{fmtUsdt(tx.amount)}</span>
              <div style={{color:'#6b7280',fontSize:9}}>{fmtTime(tx.time)}</div>
            </div>
          </div>)})}
      </Card>
    </div>},
    { key: 'deposit', label: <Space size={2}><DownloadOutlined/><span>充值</span></Space>, children: <div style={{color:'#8b949e',textAlign:'center',padding:20}}>使用上方「充值&手续费」页面进行充值操作</div> },
    { key: 'withdraw', label: <Space size={2}><ArrowUpOutlined/><span>提现</span></Space>, children: <WithdrawPanel/> },
    { key: 'transfer', label: <Space size={2}><SwapOutlined/><span>转账</span></Space>, children: <TransferPanel/> },
    { key: 'tip', label: <Space size={2}><HeartOutlined/><span>打赏</span></Space>, children: <TipPanel/> },
  ];

  return <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} size="small"/>;
}

// ── Main Export ──

export default function WalletFullPage() {
  return (
    <div style={{padding:'0 4px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,
        padding:'12px 16px',background:'linear-gradient(135deg,#2e2a1a 0%,#1a1d2e 100%)',borderRadius:10,border:'1px solid #2a2d3e'}}>
        <Space>
          <WalletOutlined style={{fontSize:20,color:'#f59e0b'}}/>
          <div><div style={{color:'#e0e0e0',fontWeight:600,fontSize:16}}>钱包</div>
            <div style={{color:'#6b7280',fontSize:11}}>充值0% · 提现0.1%最低2U · 转账0.3%×2 · 打赏L1:30%/L2:20%/L3:10%</div></div>
        </Space>
        <Space><Tag color="green">v17.6</Tag><Tag color="gold">转账≠打赏</Tag></Space>
      </div>
      <WalletOverview/>
    </div>
  );
}
