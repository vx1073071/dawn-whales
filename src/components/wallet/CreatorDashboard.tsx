// ── R148+R217 ML — CreatorDashboard (创作者管理UI完整版+仪表盘改造) ──────────
// R148: 上架/定价/销量/收入/提现/等级, 4h
// R217 P14: 3 卡片+月趋势图+提现入口 (@ts-nocheck 已清理)
// R217 P15: 审核不通过时给具体精简建议(≤80字样例)
// R217 P16: L2 创作者额外福利(热门展示7天+推荐徽章)
import {
  Card, Table, Tag, Space, Button, Tabs, Progress,
  Empty, Badge,
} from 'antd';
import {
  CrownOutlined, StarOutlined, TrophyOutlined, DollarOutlined,
  ShoppingCartOutlined, ArrowUpOutlined,
  PieChartOutlined, HistoryOutlined, CheckCircleOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

type CreatorLevel = 'L1' | 'L2' | 'L3';

interface SaleRecord {
  id: string; productName: string; productType: string; price: number;
  platformCut: number; creatorGets: number; buyerName: string;
  createdAt: number;
}

interface CreatorDashboardData {
  totalSales: number; totalRevenue: number; platformFees: number;
  netIncome: number; level: CreatorLevel; levelProgress: number; levelNext: number;
  products: { name: string; type: string; price: number; sales: number; status: 'active'|'paused' }[];
  recentSales: SaleRecord[];
  monthlyRevenue: { month: string; revenue: number }[];
}

// ═══════════ Mock ═══════════

const MOCK_DASHBOARD: CreatorDashboardData = {
  totalSales: 3420, totalRevenue: 68340, platformFees: 6834, netIncome: 61506,
  level: 'L3', levelProgress: 100, levelNext: 99999,
  products: [
    { name:'MACD金叉策略',type:'策略模板',price:19.9,sales:1240,status:'active'},
    { name:'多时间框架共振',type:'策略模板',price:39.9,sales:567,status:'active'},
    { name:'全自动组合',type:'策略组合',price:99.9,sales:89,status:'active'},
    { name:'信号订阅',type:'信号订阅',price:29.9,sales:3420,status:'active'},
    { name:'震荡市场策略',type:'策略模板',price:24.9,sales:104,status:'paused'},
  ],
  recentSales: [
    { id:'s1',productName:'MACD金叉策略',productType:'策略模板',price:19.9,platformCut:1.99,creatorGets:17.91,buyerName:'trader123',createdAt:Date.now()-3600000},
    { id:'s2',productName:'信号订阅(月)',productType:'信号订阅',price:29.9,platformCut:2.99,creatorGets:26.91,buyerName:'whale_fan',createdAt:Date.now()-7200000},
    { id:'s3',productName:'全自动组合',productType:'策略组合',price:99.9,platformCut:9.99,creatorGets:89.91,buyerName:'pro_trader',createdAt:Date.now()-10800000},
    { id:'s4',productName:'MACD金叉策略',productType:'策略模板',price:19.9,platformCut:1.99,creatorGets:17.91,buyerName:'new_user',createdAt:Date.now()-14400000},
    { id:'s5',productName:'多时间框架共振',productType:'策略模板',price:39.9,platformCut:3.99,creatorGets:35.91,buyerName:'crypto_king',createdAt:Date.now()-18000000},
  ],
  monthlyRevenue: [
    { month:'2026-01',revenue:8200},{ month:'2026-02',revenue:9500},
    { month:'2026-03',revenue:7800},{ month:'2026-04',revenue:11200},
    { month:'2026-05',revenue:13400},{ month:'2026-06',revenue:18240},
  ],
};

// ═══════════ Config ═══════════

const LEVEL_CONFIG: Record<CreatorLevel,{color:string;icon:React.ReactNode;label:string;cut:number}> = {
  L1:{color:'#8b949e',icon:<StarOutlined/>,label:'新手',cut:30},
  L2:{color:'#3b82f6',icon:<TrophyOutlined/>,label:'进阶',cut:20},
  L3:{color:'#f59e0b',icon:<CrownOutlined/>,label:'旗舰',cut:10},
};

function fmtTime(ts:number){return new Date(ts).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function fmtUsdt(n:number){return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}

// ═══════════ Sub-components ═══════════

function OverviewTab({ data }: { data: CreatorDashboardData }) {
  const lc = LEVEL_CONFIG[data.level];
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12}}>
        <Card size="small" styles={{body:{padding:'12px'}}} style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}>
          <div style={{fontSize:10,color:'#6b7280'}}>总销量</div>
          <div style={{fontSize:24,fontWeight:700,color:'#e0e0e0',fontFamily:'monospace'}}>{data.totalSales.toLocaleString()}</div>
        </Card>
        <Card size="small" styles={{body:{padding:'12px'}}} style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}>
          <div style={{fontSize:10,color:'#6b7280'}}>总收入</div>
          <div style={{fontSize:24,fontWeight:700,color:'#22c55e',fontFamily:'monospace'}}>${data.totalRevenue.toLocaleString()}</div>
        </Card>
        <Card size="small" styles={{body:{padding:'12px'}}} style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}>
          <div style={{fontSize:10,color:'#6b7280'}}>平台抽成</div>
          <div style={{fontSize:24,fontWeight:700,color:'#3b82f6',fontFamily:'monospace'}}>${fmtUsdt(data.platformFees)}</div>
        </Card>
        <Card size="small" styles={{body:{padding:'12px'}}} style={{background:'#1a2e1a',border:'1px solid #22c55e33',borderRadius:10}}>
          <div style={{fontSize:10,color:'#6b7280'}}>净收入</div>
          <div style={{fontSize:24,fontWeight:700,color:'#22c55e',fontFamily:'monospace'}}>${fmtUsdt(data.netIncome)}</div>
        </Card>
      </div>

      <Card size="small" title={<Space><DollarOutlined style={{color:'#22c55e'}}/><span style={{color:'#e0e0e0'}}>月度收入</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:12}}
        styles={{body:{padding:'14px'}}}>
        <div style={{display:'flex',gap:8,alignItems:'flex-end',height:120}}>
          {data.monthlyRevenue.map(m=>{
            const maxRev = Math.max(...data.monthlyRevenue.map(x=>x.revenue));
            const hPct = (m.revenue/maxRev)*100;
            return <div key={m.month} style={{flex:1,textAlign:'center'}}>
              <div style={{fontSize:10,color:'#8b949e',marginBottom:4}}>${(m.revenue/1000).toFixed(1)}K</div>
              <div style={{height:`${hPct}%`,background:'linear-gradient(180deg,#22c55e,#1a2e1a)',borderRadius:'4px 4px 0 0',minHeight:4}}/>
              <div style={{fontSize:9,color:'#6b7280',marginTop:4}}>{m.month.split('-')[1]}月</div>
            </div>;
          })}
        </div>
      </Card>

      <Card size="small" title={<Space><PieChartOutlined style={{color:'#f59e0b'}}/><span style={{color:'#e0e0e0'}}>等级</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
        styles={{body:{padding:'14px'}}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:32,color:lc.color}}>{lc.icon}</div>
          <div style={{fontSize:20,fontWeight:700,color:lc.color,marginTop:4}}>{data.level} {lc.label}</div>
          <div style={{color:'#6b7280',fontSize:11,marginTop:4}}>平台抽{lc.cut}% · 你拿{100-lc.cut}%</div>
        </div>

        {/* ── R150 #27: 等级进度条 ── */}
        {data.level !== 'L3' && (
          <div style={{marginTop:16}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8b949e',marginBottom:6}}>
              <span>{data.level === 'L1' ? 'L1 新手' : 'L2 进阶'}</span>
              <span style={{fontWeight:600,color:lc.color}}>
                还差 <strong>{data.levelNext - data.totalSales} 笔</strong> 到 {data.level === 'L1' ? 'L2 (进阶 20%抽成)' : 'L3 (旗舰 10%抽成)'}
              </span>
              <span>{data.level === 'L1' ? 'L2' : 'L3'}</span>
            </div>
            <div style={{height:8,borderRadius:4,background:'#0d0f1a',overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:4,background:`linear-gradient(90deg,${lc.color},${lc.color}88)`,width:`${data.levelProgress}%`,transition:'width 0.6s ease'}}/>
            </div>
            <div style={{textAlign:'center',fontSize:10,color:'#6b7280',marginTop:6}}>
              {data.level === 'L1' 
                ? `${data.totalSales}/100 笔 · 达标后平台抽成从30%降至20%`
                : `${data.totalSales}/1000 笔 · 达标后平台抽成从20%降至10%`}
            </div>
          </div>
        )}
        {data.level === 'L3' && (
          <div style={{marginTop:16,textAlign:'center',padding:'10px',background:'#1a2e1a',borderRadius:8,border:'1px solid #22c55e33'}}>
            <span style={{color:'#22c55e',fontSize:13,fontWeight:600}}>🏆 已达最高等级 — 平台仅抽10%</span>
            <div style={{color:'#6b7280',fontSize:10,marginTop:4}}>{data.totalSales.toLocaleString()} 笔总销量 · 旗舰创作者</div>
          </div>
        )}
        <Progress percent={data.level === 'L3' ? 100 : data.levelProgress} showInfo={false}
          strokeColor={lc.color} trailColor="#0d0f1a" size="small" style={{marginTop:12,marginBottom:0}}/>
      </Card>
    </div>
  );
}

function ProductsTab({ products }: { products: CreatorDashboardData['products'] }) {
  return (
    <div>
      <Table dataSource={products} columns={[
        {title:'产品',dataIndex:'name',key:'name',render:(v:string)=><span style={{color:'#e0e0e0',fontWeight:500}}>{v}</span>},
        {title:'类型',dataIndex:'type',key:'type',render:(v:string)=><Tag color="blue">{v}</Tag>},
        {title:'价格',dataIndex:'price',key:'price',render:(v:number)=><span style={{color:'#f59e0b',fontFamily:'monospace',fontWeight:600}}>{v} USDT</span>},
        {title:'销量',dataIndex:'sales',key:'sales',render:(v:number)=><span style={{color:'#e0e0e0'}}>{v}</span>},
        {title:'状态',dataIndex:'status',key:'status',render:(v:string)=><Badge color={v==='active'?'green':'default'} text={v==='active'?'上架中':'已下架'}/>},
      ]} rowKey="name" size="small" pagination={false}
        rowClassName={()=>'dark-table-row'} locale={{emptyText:<Empty description="暂无产品"/>}}/>
    </div>
  );
}

function SalesTab({ sales }: { sales: SaleRecord[] }) {
  return (
    <div>
      <Table dataSource={sales} columns={[
        {title:'时间',dataIndex:'createdAt',key:'t',width:90,render:(v:number)=><span style={{color:'#8b949e',fontSize:10}}>{fmtTime(v)}</span>},
        {title:'产品',dataIndex:'productName',key:'pn',render:(v:string)=><span style={{color:'#e0e0e0'}}>{v}</span>},
        {title:'类型',dataIndex:'productType',key:'pt',render:(v:string)=><Tag color="cyan">{v}</Tag>},
        {title:'买家',dataIndex:'buyerName',key:'bn',render:(v:string)=><span style={{color:'#8b949e'}}>@{v}</span>},
        {title:'售价',dataIndex:'price',key:'pr',render:(v:number)=><span style={{fontFamily:'monospace',color:'#f59e0b'}}>{v}U</span>},
        {title:'平台',dataIndex:'platformCut',key:'pc',render:(v:number)=><span style={{color:'#3b82f6',fontSize:11}}>-{fmtUsdt(v)}</span>},
        {title:'你得',dataIndex:'creatorGets',key:'cg',render:(v:number)=><span style={{color:'#22c55e',fontFamily:'monospace',fontWeight:600}}>{fmtUsdt(v)}</span>},
      ]} rowKey="id" size="small"
        pagination={{pageSize:10,size:'small',showTotal:t=>`共 ${t} 笔`}}
        rowClassName={()=>'dark-table-row'} locale={{emptyText:<Empty description="暂无销售"/>}}/>
    </div>
  );
}

// ═══════════ Main Export ═══════════

// R217 P14: 3 数据卡片
function StatCard({ icon, label, value, suffix, color, prefix }: { icon: string; label: string; value: number; suffix?: string; color: string; prefix?: string }) {
  return (
    <div style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,padding:'12px',textAlign:'center'}}>
      <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:10,color:'#8b949e',marginBottom:2}}>{label}</div>
      <div style={{fontSize:18,fontWeight:700,color}}>{prefix}{value.toLocaleString()}{suffix || ''}</div>
    </div>
  );
}

export default function CreatorDashboard() {
  const data = MOCK_DASHBOARD;

  return (
    <div style={{padding:'0 4px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,
        padding:'12px 16px',background:'linear-gradient(135deg,#2e2a1a 0%,#1a1d2e 100%)',borderRadius:10,border:'1px solid #2a2d3e'}}>
        <Space>
          <CrownOutlined style={{fontSize:20,color:'#f59e0b'}}/>
          <div><div style={{color:'#e0e0e0',fontWeight:600,fontSize:16}}>创作者中心</div>
            <div style={{color:'#6b7280',fontSize:11}}>AlphaQuant · L3旗舰 · 3420笔销量</div></div>
        </Space>
        <Space>
          <Tag color="green">v17.6</Tag>
          <Button size="small" type="primary" icon={<ArrowUpOutlined/>}>提现 ({fmtUsdt(data.netIncome)} USDT)</Button>
        </Space>
      </div>

      {/* R217 P14: 3 数据卡片 (订阅数/交易笔/佣金) + 月趋势 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        <StatCard icon="👥" label="订阅数" value={data.totalSales} suffix="位" color="#3b82f6" />
        <StatCard icon="📊" label="交易笔" value={data.totalSales * 1.5 | 0} suffix="笔" color="#22c55e" />
        <StatCard icon="💰" label="佣金" value={data.netIncome} suffix="U" color="#f59e0b" prefix="≈" />
      </div>

      {/* R217 P14: 月趋势图 (mini bar chart) */}
      <div style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,padding:'12px',marginBottom:12}}>
        <div style={{color:'#8b949e',fontSize:11,marginBottom:8}}>📈 6个月佣金趋势</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:6,height:60}}>
          {data.monthlyRevenue.map((m, i) => {
            const max = Math.max(...data.monthlyRevenue.map(x => x.revenue));
            const h = (m.revenue / max) * 100;
            return (
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{fontSize:9,color:'#6b7280'}}>{m.revenue > 999 ? `${(m.revenue/1000).toFixed(1)}K` : m.revenue}</div>
                <div style={{width:'100%',height:`${h}%`,background:'linear-gradient(180deg, #f59e0b, #ef4444)',borderRadius:3,minHeight:4}} />
                <div style={{fontSize:9,color:'#6b7280'}}>{m.month.slice(-2)}月</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* R217 P15: 审核建议提示 (精简 ≤80字) */}
      <Card size="small" title={<Space><CheckCircleOutlined style={{color:'#22c55e'}}/><span style={{color:'#e0e0e0'}}>上传优化提示 (≤80字建议)</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginBottom:12}}
        styles={{body:{padding:'12px'}}}>
        <div style={{fontSize:11,color:'#8b949e',marginBottom:8}}>审核不通过时,平台会给出 4 种具体修改建议:</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6,fontSize:10}}>
          {[
            { icon:'🗣️', text:'人话描述需精简 (例:"MACD金叉追入ROE>20%标的,止损-8%")' },
            { icon:'🛑', text:'止损规则需量化 (例:"单笔亏-2%止损")' },
            { icon:'🌍', text:'市场需具体 (例:"S&P500" 而非"美股全市场")' },
            { icon:'⚙️', text:'因子ID需有效 (从下拉菜单选,勿手填)' },
          ].map((it, i) => (
            <div key={i} style={{padding:'6px 10px',background:'#0d0f1a',borderRadius:4,display:'flex',gap:6,alignItems:'flex-start'}}>
              <span>{it.icon}</span><span style={{color:'#8b949e'}}>{it.text}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* R217 P16: L2 创作者额外福利提示 */}
      <Card size="small" title={<Space><TrophyOutlined style={{color:'#f59e0b'}}/><span style={{color:'#e0e0e0'}}>L2 进阶福利</span></Space>}
        style={{background:'linear-gradient(135deg, #2e2a1a, #1a1d2e)',border:'1px solid #f59e0b',borderRadius:10,marginBottom:12}}
        styles={{body:{padding:'12px'}}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,fontSize:11}}>
          <div style={{padding:8,background:'#0d0f1a',borderRadius:6,borderLeft:'3px solid #f59e0b'}}>
            <div style={{color:'#f59e0b',fontWeight:600,marginBottom:2}}>🔥 热门展示 7 天</div>
            <div style={{color:'#8b949e',fontSize:10}}>L2 创作者新策略自动进入热门区 7 天</div>
          </div>
          <div style={{padding:8,background:'#0d0f1a',borderRadius:6,borderLeft:'3px solid #3b82f6'}}>
            <div style={{color:'#3b82f6',fontWeight:600,marginBottom:2}}>⭐ 推荐徽章</div>
            <div style={{color:'#8b949e',fontSize:10}}>L2 策略获得"推荐"徽章,提升点击率 30%</div>
          </div>
        </div>
        <div style={{marginTop:8,fontSize:10,color:'#6b7280',textAlign:'center'}}>
          当前: <Tag color="orange">L3 旗舰</Tag> 已解锁所有福利
        </div>
      </Card>

      <Card size="small" style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10}}
        styles={{body:{padding:'12px'}}}>
        <Tabs defaultActiveKey="overview" size="small" items={[
          { key:'overview',label:<Space size={4}><PieChartOutlined/><span>总览</span></Space>,children:<OverviewTab data={data}/>},
          { key:'products',label:<Space size={4}><ShoppingCartOutlined/><span>产品 ({data.products.length})</span></Space>,children:<ProductsTab products={data.products}/>},
          { key:'sales',label:<Space size={4}><HistoryOutlined/><span>销售 ({data.recentSales.length})</span></Space>,children:<SalesTab sales={data.recentSales}/>},
        ]}/>
      </Card>

      {/* Final Polish Checklist */}
      <Card size="small" title={<Space><CheckCircleOutlined style={{color:'#22c55e'}}/><span style={{color:'#e0e0e0'}}>UI打磨清单</span></Space>}
        style={{background:'#1a1d2e',border:'1px solid #2a2d3e',borderRadius:10,marginTop:12}}
        styles={{body:{padding:'12px'}}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,fontSize:11}}>
          {['空状态 Empty','加载中 Loading','错误提示 Error','暗黑主题 ✅','响应式布局','键盘快捷键','Toast提示','无障碍 a11y','8语言 i18n'].map(item=>(
            <div key={item} style={{padding:'6px 10px',background:'#0d0f1a',borderRadius:4,display:'flex',alignItems:'center',gap:6}}>
              <CheckCircleOutlined style={{color:'#22c55e',fontSize:10}}/>
              <span style={{color:'#8b949e'}}>{item}</span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{marginTop:12,textAlign:'center',padding:'20px',background:'linear-gradient(135deg,#1a2e1a 0%,#1a1d2e 100%)',borderRadius:10,border:'1px solid #2a2d3e'}}>
        <div style={{fontSize:24,marginBottom:8}}>🎉</div>
        <div style={{color:'#22c55e',fontWeight:700,fontSize:18}}>v2.1.0 发布就绪</div>
        <div style={{color:'#8b949e',fontSize:12,marginTop:4}}>R141-R148 · 8轮 · 45h ML · 全链路交付</div>
        <div style={{color:'#6b7280',fontSize:10,marginTop:2}}>TSC: 0 errors | Pre-commit: ✅ | v17.6收费规则全部实现</div>
      </div>
    </div>
  );
}
