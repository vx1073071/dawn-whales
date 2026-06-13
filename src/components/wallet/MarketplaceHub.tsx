// @ts-nocheck
// ── R144 ML — MarketplaceHub (模板市场+组合市场+信号订阅+等级徽章+购买确认) ──
// PM: 5 modules, 6h
import { useState, useCallback, useMemo } from 'react';
import {
  Card, Table, Tag, Space, Button, Input, Select, Tabs, Badge,
  Modal, message, Empty, Tooltip, Descriptions, Alert,
} from 'antd';
import {
  SearchOutlined, ShoppingCartOutlined, StarOutlined,
  TrophyOutlined, CrownOutlined, DollarOutlined,
  HeartOutlined, UserOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, CheckCircleOutlined,
  ArrowRightOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import FeePreview from '@/components/billing/FeePreview';

// ═══════════ Types ═══════════

type CreatorLevel = 'L1' | 'L2' | 'L3';
type ProductType = 'template' | 'combo' | 'subscription';

interface CreatorInfo {
  id: string; name: string; level: CreatorLevel; totalSales: number;
  joinDate: number;
}

interface StrategyTemplate {
  id: string; name: string; description: string; price: number;
  creator: CreatorInfo; category: string; difficulty: 'easy'|'medium'|'advanced';
  sales: number; rating: number; tags: string[];
}

interface StrategyCombo {
  id: string; name: string; description: string; price: number;
  creator: CreatorInfo; strategies: string[]; allocation: number[];
  sales: number; rating: number;
}

interface SignalSubscription {
  id: string; creator: CreatorInfo; price: number; period: 'monthly';
  subscribers: number; winRate: number; totalReturn: number;
  maxDrawdown: number; strategy: string; description: string;
  isSubscribed: boolean; expiresAt?: number;
}

// ═══════════ Level Config ═══════════

const LEVEL_CONFIG: Record<CreatorLevel, { color: string; icon: React.ReactNode; label: string; cut: number; next: number }> = {
  L1: { color: '#8b949e', icon: <StarOutlined />, label: '新手', cut: 30, next: 100 },
  L2: { color: '#3b82f6', icon: <TrophyOutlined />, label: '进阶', cut: 20, next: 1000 },
  L3: { color: '#f59e0b', icon: <CrownOutlined />, label: '旗舰', cut: 10, next: 99999 },
};

// ═══════════ Mock Data ═══════════

const MOCK_CREATORS: CreatorInfo[] = [
  { id: 'c1', name: 'AlphaQuant', level: 'L3', totalSales: 3420, joinDate: Date.now()-15552000000 },
  { id: 'c2', name: 'WhaleTracker', level: 'L3', totalSales: 8900, joinDate: Date.now()-12960000000 },
  { id: 'c3', name: 'GoldenCross', level: 'L2', totalSales: 780, joinDate: Date.now()-7776000000 },
  { id: 'c4', name: 'ScalperBot', level: 'L2', totalSales: 456, joinDate: Date.now()-5184000000 },
  { id: 'c5', name: 'TrendRider', level: 'L1', totalSales: 89, joinDate: Date.now()-2592000000 },
];

const MOCK_TEMPLATES: StrategyTemplate[] = [
  { id:'t1',name:'MACD金叉策略',description:'经典MACD金叉买入+死叉卖出,适合1h/4h周期',price:19.9,creator:MOCK_CREATORS[0],category:'趋势',difficulty:'easy',sales:1240,rating:4.5,tags:['MACD','趋势','中频']},
  { id:'t2',name:'布林带突破',description:'布林带收窄突破策略,波动率过滤',price:24.9,creator:MOCK_CREATORS[1],category:'突破',difficulty:'medium',sales:890,rating:4.7,tags:['布林带','突破','低频']},
  { id:'t3',name:'RSI超卖反弹',description:'RSI<30超卖区域反弹买入',price:9.9,creator:MOCK_CREATORS[2],category:'反转',difficulty:'easy',sales:2100,rating:4.2,tags:['RSI','反转','高频']},
  { id:'t4',name:'多时间框架共振',description:'日线+4h+1h三周期共振策略',price:39.9,creator:MOCK_CREATORS[0],category:'综合',difficulty:'advanced',sales:567,rating:4.8,tags:['多周期','共振','低频']},
  { id:'t5',name:'EMA交叉+成交量',description:'EMA20/50交叉,成交量确认',price:14.9,creator:MOCK_CREATORS[4],category:'趋势',difficulty:'easy',sales:45,rating:3.9,tags:['EMA','成交量','中频']},
];

const MOCK_COMBOS: StrategyCombo[] = [
  { id:'cb1',name:'稳健组合',description:'低风险+稳定收益,适合新手',price:49.9,creator:MOCK_CREATORS[1],strategies:['布林带突破','EMA交叉+成交量'],allocation:[60,40],sales:234,rating:4.6},
  { id:'cb2',name:'激进组合',description:'高频+高收益,适合经验交易者',price:69.9,creator:MOCK_CREATORS[3],strategies:['RSI超卖反弹','多时间框架共振','MACD金叉'],allocation:[40,35,25],sales:156,rating:4.3},
  { id:'cb3',name:'全自动组合',description:'一键部署,无需手动干预',price:99.9,creator:MOCK_CREATORS[0],strategies:['MACD金叉','布林带突破','多时间框架共振','RSI超卖反弹'],allocation:[25,25,25,25],sales:89,rating:4.9},
];

const MOCK_SUBSCRIPTIONS: SignalSubscription[] = [
  { id:'s1',creator:MOCK_CREATORS[0],price:29.9,period:'monthly',subscribers:3420,winRate:64.5,totalReturn:380,maxDrawdown:18,strategy:'多因子+趋势跟踪',description:'机构级量化策略,覆盖BTC/ETH/SOL',isSubscribed:true,expiresAt:Date.now()+2592000000},
  { id:'s2',creator:MOCK_CREATORS[1],price:49.9,period:'monthly',subscribers:8900,winRate:67,totalReturn:520,maxDrawdown:15,strategy:'链上鲸鱼追踪',description:'追踪智能钱地址交易行为',isSubscribed:false},
  { id:'s3',creator:MOCK_CREATORS[2],price:19.9,period:'monthly',subscribers:1280,winRate:58.2,totalReturn:210,maxDrawdown:25,strategy:'MA双均线',description:'经典均线策略,中长期趋势',isSubscribed:false},
  { id:'s4',creator:MOCK_CREATORS[3],price:39.9,period:'monthly',subscribers:5600,winRate:71.3,totalReturn:156,maxDrawdown:12,strategy:'高频剥头皮',description:'短线高频,需低延迟',isSubscribed:false},
  { id:'s5',creator:MOCK_CREATORS[4],price:9.9,period:'monthly',subscribers:89,winRate:52.8,totalReturn:89,maxDrawdown:32,strategy:'趋势+网格',description:'稳健型,低波动网格',isSubscribed:false},
];

// ═══════════ Components ═══════════

// ── Creator Badge ──

function CreatorBadge({ creator, showCut }: { creator: CreatorInfo; showCut?: boolean }) {
  const lc = LEVEL_CONFIG[creator.level];
  return (
    <Space size={4}>
      <Tag color={lc.color} style={{ fontSize: 10 }}>
        {lc.icon} {creator.level} {lc.label}
      </Tag>
      {showCut && <Tag color="blue" style={{ fontSize: 9 }}>抽{lc.cut}%</Tag>}
    </Space>
  );
}

// ── Purchase Confirm Modal ──

function PurchaseConfirmModal({
  visible, onClose, product, onConfirm,
}: {
  visible: boolean; onClose: () => void; product: StrategyTemplate|StrategyCombo|null;
  onConfirm: () => void;
}) {
  if (!product) return null;
  const lc = LEVEL_CONFIG[product.creator.level];
  const platformCut = product.price * (lc.cut / 100);
  const creatorGets = product.price - platformCut;
  const balance = 10234.80;
  const canAfford = balance >= product.price;

  return (
    <Modal title={<Space><ShoppingCartOutlined style={{color:'#f59e0b'}}/><span>确认购买</span></Space>}
      open={visible} onCancel={onClose} onOk={onConfirm}
      okText={`支付 ${product.price} USDT`} okButtonProps={{disabled:!canAfford}}
      width={460}>
      <Descriptions size="small" column={1} labelStyle={{color:'#6b7280'}} contentStyle={{color:'#e0e0e0'}}>
        <Descriptions.Item label="产品">{product.name}</Descriptions.Item>
        <Descriptions.Item label="创作者"><Space><span>{product.creator.name}</span><CreatorBadge creator={product.creator} showCut/></Space></Descriptions.Item>
        <Descriptions.Item label="价格"><span style={{color:'#f59e0b',fontWeight:700,fontSize:16}}>{product.price} USDT</span></Descriptions.Item>
        <Descriptions.Item label="费用明细">
          <FeePreview
            marketplaceProduct="template"
            productPrice={product.price}
            creatorLevel={product.creator.level}
            size="small"
          />
        </Descriptions.Item>
      </Descriptions>
      <div style={{marginTop:12,padding:'10px',background:canAfford?'#1a2e1a':'#2e0a0a',borderRadius:8,border:`1px solid ${canAfford?'#22c55e33':'#ef444433'}`,fontSize:11}}>
        {canAfford ? <span style={{color:'#22c55e'}}>✅ 余额充足: {balance.toFixed(2)} → {(balance-product.price).toFixed(2)} USDT</span>
        : <span style={{color:'#ef4444'}}>❌ 余额不足: {balance.toFixed(2)} {'<'} {product.price} USDT</span>}
      </div>
    </Modal>
  );
}

// ── Template Market ──

function TemplateMarket() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [purchaseItem, setPurchaseItem] = useState<StrategyTemplate|null>(null);
  const [purchaseVisible, setPurchaseVisible] = useState(false);

  const filtered = MOCK_TEMPLATES.filter(t=>{
    if(search&&!t.name.toLowerCase().includes(search.toLowerCase())&&!t.description.toLowerCase().includes(search.toLowerCase()))return false;
    if(category&&t.category!==category)return false;
    return true;
  });

  const columns = [
    { title:'模板',dataIndex:'name',key:'name',render:(v:string,r:StrategyTemplate)=>(<div><div style={{color:'#e0e0e0',fontWeight:500}}>{v}</div><div style={{color:'#6b7280',fontSize:10}}>{r.description.slice(0,40)}...</div></div>)},
    { title:'创作者',key:'creator',render:(_:any,r:StrategyTemplate)=>(<div><span style={{color:'#e0e0e0',fontSize:11}}>{r.creator.name}</span><div><CreatorBadge creator={r.creator}/></div></div>)},
    { title:'类别',dataIndex:'category',key:'cat',width:60,render:(v:string)=><Tag color="purple">{v}</Tag>},
    { title:'难度',dataIndex:'difficulty',key:'diff',width:55,render:(v:string)=><Tag color={v==='easy'?'green':v==='advanced'?'red':'gold'}>{v==='easy'?'简单':v==='advanced'?'高级':'中等'}</Tag>},
    { title:'销量',dataIndex:'sales',key:'sales',width:55,render:(v:number)=><span style={{color:'#e0e0e0'}}>{v}</span>},
    { title:'评分',dataIndex:'rating',key:'rating',width:50,render:(v:number)=><span style={{color:'#f59e0b'}}>{'⭐'.repeat(Math.round(v))}</span>},
    { title:'价格',dataIndex:'price',key:'price',width:70,render:(v:number)=><span style={{color:'#f59e0b',fontWeight:700,fontFamily:'monospace'}}>{v}U</span>},
    { title:'',key:'action',width:70,render:(_:any,r:StrategyTemplate)=><Button size="small" type="primary" ghost icon={<ShoppingCartOutlined/>} onClick={()=>{setPurchaseItem(r);setPurchaseVisible(true);}}>购买</Button>},
  ];

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:10}}>
        <Input prefix={<SearchOutlined/>} placeholder="搜索模板..." value={search} onChange={e=>setSearch(e.target.value)} allowClear style={{width:200,background:'#0d0f1a'}}/>
        <Select placeholder="类别" value={category||undefined} onChange={setCategory} allowClear style={{width:120}} options={[{label:'趋势',value:'趋势'},{label:'突破',value:'突破'},{label:'反转',value:'反转'},{label:'综合',value:'综合'}]}/>
      </div>
      <Table dataSource={filtered} columns={columns} rowKey="id" size="small" pagination={false}
        rowClassName={()=>'dark-table-row'} locale={{emptyText:<Empty description="无匹配模板"/>}}/>
      <PurchaseConfirmModal visible={purchaseVisible} onClose={()=>setPurchaseVisible(false)} product={purchaseItem} onConfirm={()=>{setPurchaseVisible(false);message.success('购买成功!');}}/>
    </div>
  );
}

// ── Combo Market ──

function ComboMarket() {
  const [purchaseItem, setPurchaseItem] = useState<StrategyCombo|null>(null);
  const [purchaseVisible, setPurchaseVisible] = useState(false);

  return (
    <div>
      {MOCK_COMBOS.map(cb=>(
        <Card key={cb.id} size="small"
          style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:10}}
          styles={{body:{padding:'14px'}}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <Space size={10}>
              <span style={{fontSize:24}}>{'📦'}</span>
              <div>
                <div style={{color:'#e0e0e0',fontWeight:600,fontSize:14}}>{cb.name}</div>
                <div style={{color:'#6b7280',fontSize:11}}>{cb.description}</div>
                <Space size={4} style={{marginTop:4}}>
                  <span style={{color:'#8b949e',fontSize:10}}>{cb.creator.name}</span>
                  <CreatorBadge creator={cb.creator} showCut/>
                </Space>
              </div>
            </Space>
            <div style={{textAlign:'right'}}>
              <div style={{color:'#f59e0b',fontSize:20,fontWeight:700,fontFamily:'monospace'}}>{cb.price}U</div>
              <Space size={4} style={{fontSize:10,color:'#8b949e'}}>
                <span>⭐{cb.rating}</span><span>·</span><span>{cb.sales}笔</span>
              </Space>
            </div>
          </div>

          {/* Strategy list */}
          <div style={{marginTop:10,padding:'8px 12px',background:'#0d0f1a',borderRadius:6}}>
            <div style={{color:'#6b7280',fontSize:10,marginBottom:4}}>策略分配</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {cb.strategies.map((s,i)=>(
                <Tag key={s} color="blue" style={{fontSize:10}}>{s} ({cb.allocation[i]}%)</Tag>
              ))}
            </div>
          </div>

          <Button type="primary" block icon={<ShoppingCartOutlined/>} style={{marginTop:10}}
            onClick={()=>{setPurchaseItem(cb);setPurchaseVisible(true);}}>购买组合</Button>
        </Card>
      ))}
      <PurchaseConfirmModal visible={purchaseVisible} onClose={()=>setPurchaseVisible(false)} product={purchaseItem} onConfirm={()=>{setPurchaseVisible(false);message.success('组合购买成功!');}}/>
    </div>
  );
}

// ── Signal Subscription ──

function SignalSubscribePage() {
  const [subs, setSubs] = useState(MOCK_SUBSCRIPTIONS);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SignalSubscription|null>(null);
  const [autoRenew, setAutoRenew] = useState<Record<string,boolean>>({s1:true});
  const [showRenewWarning, setShowRenewWarning] = useState(true);
  const [renewConfirmVisible, setRenewConfirmVisible] = useState(false);
  const [renewTarget, setRenewTarget] = useState<SignalSubscription|null>(null);

  // Calculate time until expiry
  const getTimeUntil = (expiresAt: number) => expiresAt - Date.now();
  const formatRemaining = (ms: number) => {
    if (ms <= 0) return { text:'已过期', color:'#ef4444', urgent:true };
    const hours = ms / 3600000;
    if (hours < 2) return { text:`${Math.floor(hours)}小时`, color:'#ef4444', urgent:true };
    if (hours < 24) return { text:`${Math.floor(hours)}小时`, color:'#f59e0b', urgent:true };
    if (hours < 72) return { text:`${Math.floor(hours/24)}天`, color:'#f59e0b', urgent:false };
    return { text:`${Math.floor(hours/24)}天`, color:'#22c55e', urgent:false };
  };
  const toggleAutoRenew = useCallback((id:string)=>{
    setAutoRenew(prev=>({...prev,[id]:!prev[id]}));
    message.info(autoRenew[id]?'已关闭自动续费':'已开启自动续费');
  },[autoRenew]);
  const handleManualRenew = useCallback((s:SignalSubscription)=>{
    setRenewTarget(s);setRenewConfirmVisible(true);
  },[]);
  const handleRenewConfirm = useCallback(()=>{
    if(!renewTarget)return;
    setSubs(prev=>prev.map(x=>x.id===renewTarget.id?{...x,isSubscribed:true,expiresAt:Date.now()+2592000000}:x));
    setRenewConfirmVisible(false);
    message.success(`已续费 ${renewTarget.creator.name} 信号`);
  },[renewTarget]);

  const handleSubscribe = useCallback((s:SignalSubscription)=>{
    setSelectedSub(s);setConfirmVisible(true);
  },[]);

  const handleCancel = useCallback((s:SignalSubscription)=>{
    setSubs(prev=>prev.map(x=>x.id===s.id?{...x,isSubscribed:false,expiresAt:undefined}:x));
    message.info(`已取消 ${s.creator.name} 的信号订阅`);
  },[]);

  const handleConfirm = useCallback(()=>{
    if(!selectedSub)return;
    setSubs(prev=>prev.map(x=>x.id===selectedSub.id?{...x,isSubscribed:true,expiresAt:Date.now()+2592000000}:x));
    setConfirmVisible(false);
    message.success(`已订阅 ${selectedSub.creator.name} 的信号`);
  },[selectedSub]);

  return (
    <div>
      {/* ── R150 #26: 到期续费警告 ── */}
      {showRenewWarning && subs.some(s=>s.isSubscribed&&s.expiresAt&&getTimeUntil(s.expiresAt).urgent) && (
        <Alert
          message={
            <Space direction="vertical" size={2} style={{width:'100%'}}>
              <span style={{fontWeight:600}}>⏰ 信号订阅即将到期</span>
              {subs.filter(s=>s.isSubscribed&&s.expiresAt&&getTimeUntil(s.expiresAt).urgent).map(s=>(
                <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>{s.creator.name}: 剩余 <strong style={{color:getTimeUntil(s.expiresAt!).color}}>{formatRemaining(getTimeUntil(s.expiresAt!)).text}</strong></span>
                  <Button size="small" type="primary" onClick={()=>handleManualRenew(s)} style={{fontSize:10}}>立即续费</Button>
                </div>
              ))}
            </Space>
          }
          type="warning" closable onClose={()=>setShowRenewWarning(false)}
          style={{background:'#2e2a0a',border:'1px solid #f59e0b66',borderRadius:10,marginBottom:12}}/>
      )}

      {subs.map(s=>{const lc=LEVEL_CONFIG[s.creator.level];return(
        <Card key={s.id} size="small"
          style={{background:s.isSubscribed?'#1a2e1a':'#1a1d2e',border:`1px solid ${s.isSubscribed?'#22c55e33':'#2a2d3e'}`,borderRadius:10,marginBottom:10}}
          styles={{body:{padding:'14px'}}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <Space size={10}>
              <span style={{fontSize:24}}>{'📡'}</span>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{color:'#e0e0e0',fontWeight:600,fontSize:14}}>{s.creator.name}</span>
                  <CreatorBadge creator={s.creator}/>
                  {s.isSubscribed&&<Tag color="green" style={{fontSize:9}}>已订阅</Tag>}
                </div>
                <div style={{color:'#6b7280',fontSize:11}}>{s.description}</div>
                <Space size={12} style={{marginTop:6,fontSize:10,color:'#8b949e'}}>
                  <span>胜率 <span style={{color:'#e0e0e0',fontWeight:600}}>{s.winRate}%</span></span>
                  <span>总收益 <span style={{color:'#22c55e'}}>+{s.totalReturn}%</span></span>
                  <span>回撤 <span style={{color:'#ef4444'}}>{s.maxDrawdown}%</span></span>
                  <span>订阅 <span style={{color:'#e0e0e0'}}>{s.subscribers}</span></span>
                </Space>
              </div>
            </Space>
            <div style={{textAlign:'right'}}>
              <div style={{color:'#f59e0b',fontSize:18,fontWeight:700,fontFamily:'monospace'}}>{s.price}U<span style={{fontSize:11,color:'#8b949e'}}>/月</span></div>
              {s.isSubscribed ? (
                <div>
                  <div style={{color:'#22c55e',fontSize:9}}>到期: {new Date(s.expiresAt!).toLocaleDateString()} · {formatRemaining(getTimeUntil(s.expiresAt!)).text}</div>
                  <Space size={4} style={{marginTop:4}}>
                    <Button size="small" onClick={()=>toggleAutoRenew(s.id)}
                      type={autoRenew[s.id]?'primary':'default'} style={{fontSize:9}}>
                      {autoRenew[s.id]?'自动续费:开':'自动续费:关'}
                    </Button>
                    <Button size="small" danger onClick={()=>handleCancel(s)}>取消订阅</Button>
                  </Space>
                </div>
              ) : (
                <Button size="small" type="primary" onClick={()=>handleSubscribe(s)} style={{marginTop:4}}>订阅</Button>
              )}
            </div>
          </div>
        </Card>
      )})}

      <Modal title={<Space><ThunderboltOutlined style={{color:'#f59e0b'}}/><span>确认订阅</span></Space>}
        open={confirmVisible} onCancel={()=>setConfirmVisible(false)} onOk={handleConfirm}
        okText={`确认订阅 ${selectedSub?.price}U/月`} width={460}>
        {selectedSub&&<>
          <Descriptions size="small" column={1} labelStyle={{color:'#6b7280'}} contentStyle={{color:'#e0e0e0'}}>
            <Descriptions.Item label="信号源">{selectedSub.creator.name} <CreatorBadge creator={selectedSub.creator} showCut/></Descriptions.Item>
            <Descriptions.Item label="价格"><span style={{color:'#f59e0b',fontWeight:700}}>{selectedSub.price} USDT/月</span></Descriptions.Item>
            <Descriptions.Item label="策略">{selectedSub.strategy}</Descriptions.Item>
          </Descriptions>
          <Alert message="每月自动续费。余额不足暂停，充值后恢复。可随时取消。" type="info" showIcon={false}
            style={{background:'#1a2e2a',border:'1px solid #3b82f633',borderRadius:8,marginTop:12,fontSize:11}}/>
        </>}
      </Modal>

      {/* ── R150 #26: 手动续费确认 ── */}
      <Modal title={<Space><ThunderboltOutlined style={{color:'#22c55e'}}/><span>续费确认</span></Space>}
        open={renewConfirmVisible} onCancel={()=>setRenewConfirmVisible(false)} onOk={handleRenewConfirm}
        okText={`续费 ${renewTarget?.price}U/月`} width={460}>
        {renewTarget&&<>
          <Descriptions size="small" column={1} labelStyle={{color:'#6b7280'}} contentStyle={{color:'#e0e0e0'}}>
            <Descriptions.Item label="信号源">{renewTarget.creator.name} <CreatorBadge creator={renewTarget.creator} showCut/></Descriptions.Item>
            <Descriptions.Item label="续费价格"><span style={{color:'#22c55e',fontWeight:700}}>{renewTarget.price} USDT/月</span></Descriptions.Item>
            <Descriptions.Item label="费用明细">
              <FeePreview marketplaceProduct="subscription" productPrice={renewTarget.price} creatorLevel={renewTarget.creator.level} size="small"/>
            </Descriptions.Item>
          </Descriptions>
        </>}
      </Modal>
    </div>
  );
}

// ── Level Guide ──

function LevelGuide() {
  return (
    <Card size="small" title={<Space><TrophyOutlined style={{color:'#f59e0b'}}/><span style={{color:'#e0e0e0'}}>创作者等级说明</span></Space>}
      style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:12}}
      styles={{body:{padding:'14px'}}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {Object.entries(LEVEL_CONFIG).map(([key,cfg])=>(
          <div key={key} style={{padding:'12px',background:'#0d0f1a',borderRadius:8,border:`1px solid ${cfg.color}33`,textAlign:'center'}}>
            <div style={{fontSize:24,marginBottom:4,color:cfg.color}}>{cfg.icon}</div>
            <div style={{color:cfg.color,fontWeight:700,fontSize:14}}>{key} {cfg.label}</div>
            <div style={{color:'#8b949e',fontSize:10,marginTop:4}}>{key==='L1'?`0-${cfg.next-1}笔`:`${cfg.next-900}笔起`}</div>
            <Tag color={cfg.color} style={{marginTop:4}}>平台抽{cfg.cut}%</Tag>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,fontSize:11,color:'#6b7280',textAlign:'center'}}>
        纯销量升级 · 无需KYC · 无需好评率 · 自动切换抽成比例 · 99笔=L1, 100笔=L2, 999笔=L2, 1000笔=L3
      </div>
    </Card>
  );
}

// ═══════════ Main Export ═══════════

export default function MarketplaceHub() {
  return (
    <div style={{padding:'0 4px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,
        padding:'12px 16px',background:'linear-gradient(135deg,#1a1d2e 0%,#232740 100%)',borderRadius:10,border:'1px solid #2a2d3e'}}>
        <Space>
          <ShoppingCartOutlined style={{fontSize:20,color:'#f59e0b'}}/>
          <div><div style={{color:'#e0e0e0',fontWeight:600,fontSize:16}}>创作者市场</div>
            <div style={{color:'#6b7280',fontSize:11}}>模板·组合·订阅·打赏 · 最低9.9U · L1:30%/L2:20%/L3:10%</div></div>
        </Space>
        <Space><Tag color="green">v17.6</Tag><Tag color="gold">纯销量升级</Tag></Space>
      </div>

      <LevelGuide/>

      <Card size="small" style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
        styles={{body:{padding:'12px'}}}>
        <Tabs defaultActiveKey="template" size="small" items={[
          { key:'template',label:<Space size={4}><span>📜</span><span>策略模板 ({MOCK_TEMPLATES.length})</span></Space>,children:<TemplateMarket/>},
          { key:'combo',label:<Space size={4}><span>📦</span><span>策略组合 ({MOCK_COMBOS.length})</span></Space>,children:<ComboMarket/>},
          { key:'subscription',label:<Space size={4}><span>📡</span><span>信号订阅 ({MOCK_SUBSCRIPTIONS.length})</span></Space>,children:<SignalSubscribePage/>},
        ]}/>
      </Card>
    </div>
  );
}
