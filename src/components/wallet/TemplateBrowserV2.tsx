// ── R204 ML P5: TemplateBrowserV2 — 策略模板浏览器 (28核心模板+3入口+4铁律) ──────────
import React, { useState, useMemo } from 'react';
import { Button, Input, Tag, Badge, Card, Empty } from 'antd';
import {
  SearchOutlined, StarFilled, DollarOutlined,
  ThunderboltOutlined, FireOutlined, SafetyOutlined,
  ClockCircleOutlined, GlobalOutlined,
  CheckCircleOutlined, RobotOutlined,
  AppstoreOutlined, SettingOutlined,
} from '@ant-design/icons';

export type CreateMode = 'ai' | 'template' | 'form';

interface FactorCombo { factorId: string; factorName: string; weight: number; direction: 'long' | 'short'; }
interface ChargePoint { id: string; label: string; labelCN: string; price: number; icon: string; }
interface IronLaws { stopLoss: string; applicable: string; failureCheck: string; }

export interface TemplateItem {
  id: string; name: string; nameCN: string; oneLiner: string;
  category: string; marketTags: string[]; factors: FactorCombo[];
  ironLaws: IronLaws; chargePoints: ChargePoint[];
  assetClass: string; timeframe: string; difficulty: string;
}

interface Props {
  onSelectMode?: (mode: CreateMode) => void;
  onUseTemplate?: (tmpl: TemplateItem) => void;
  onCharge?: (serviceId: string, amount: number) => Promise<boolean>;
  locale?: string;
}

const IK: Record<string, Record<string, string>> = {
  zhCN: { title:'策略模板库',sub:'28款核心策略，一键部署',search:'搜索模板...',all:'全部市场',
    us:'美股',hk:'港股',crypto:'加密',cross:'跨市场',beg:'入门',mid:'进阶',adv:'高级',
    sl:'止损',ap:'适用',fc:'失效自检',fac:'核心因子',ai:'AI增强',use:'一键使用',res:'个结果',no:'无匹配模板',
    bt:'回测1U',fil:'填充1U',opt:'优化1.5U',dx:'诊断1U',un:'解锁2U',aiMode:'AI智能创建',manMode:'手动创建',
    aiDesc:'输入自然语言描述，AI自动生成策略代码和参数',manDesc:'自定义因子组合、权重、止损和仓位参数' },
  en: { title:'Strategy Templates',sub:'28 core strategies',search:'Search...',all:'All Markets',
    us:'US',hk:'HK',crypto:'Crypto',cross:'Cross-Market',beg:'Beginner',mid:'Intermediate',adv:'Advanced',
    sl:'Stop-Loss',ap:'Applicable',fc:'Self-Check',fac:'Core Factors',ai:'AI Boost',use:'Use',res:' results',no:'No match',
    bt:'BT 1U',fil:'Fill 1U',opt:'Opt 1.5U',dx:'Diag 1U',un:'Unlock 2U',aiMode:'AI Create',manMode:'Manual Create',
    aiDesc:'Describe in natural language → AI generates strategy',manDesc:'Custom factors, weights, stop-loss & positions' },
};

const T = (k: string, l: string): string => (IK[l]||IK.en)[k]||k;
const DC: Record<string,string> = {beginner:'#52c41a',intermediate:'#d4a853',advanced:'#ff4d4f'};
const CATS = ['全部','美股','港股','加密','跨市场'];

const ICONS: Record<string,React.ReactNode> = {
  backtest:<ClockCircleOutlined/>,fill:<RobotOutlined/>,optimize:<FireOutlined/>,diagnose:<ThunderboltOutlined/>,
};

const TEMPLATES: TemplateItem[] = [
  {
    "id": "us_earn",
    "name": "Earnings Hunter",
    "nameCN": "财报猎人",
    "oneLiner": "季报后2日动量追入ROE>20%标的,止损-8%,连续miss退出。",
    "category": "美股",
    "marketTags": [
      "🇺🇸"
    ],
    "factors": [
      {
        "factorId": "MOM_12M",
        "factorName": "12M动量",
        "weight": 0.35,
        "direction": "long"
      },
      {
        "factorId": "ROE",
        "factorName": "ROE质量",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "PE",
        "factorName": "PE价值",
        "weight": 0.2,
        "direction": "long"
      },
      {
        "factorId": "LOW_VOL",
        "factorName": "低波动",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-8%(单笔)",
      "applicable": "美股+ETF,无期权",
      "failureCheck": "连3笔止损→停1周"
    },
    "chargePoints": [
      {
        "id": "bt_us_earn",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_us_earn",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_us_earn",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_us_earn",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "us_mag7",
    "name": "MAG7 Momentum",
    "nameCN": "MAG7动量",
    "oneLiner": "按60日动量排Mag7持仓前3,周调止损-7%,跌出前5退出。",
    "category": "美股",
    "marketTags": [
      "🇺🇸"
    ],
    "factors": [
      {
        "factorId": "MOM_12M",
        "factorName": "12M动量",
        "weight": 0.35,
        "direction": "long"
      },
      {
        "factorId": "ROE",
        "factorName": "ROE质量",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "PE",
        "factorName": "PE价值",
        "weight": 0.2,
        "direction": "long"
      },
      {
        "factorId": "LOW_VOL",
        "factorName": "低波动",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-8%(单笔)",
      "applicable": "美股+ETF,无期权",
      "failureCheck": "连3笔止损→停1周"
    },
    "chargePoints": [
      {
        "id": "bt_us_mag7",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_us_mag7",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_us_mag7",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_us_mag7",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "us_val",
    "name": "Deep Value",
    "nameCN": "价值挖掘",
    "oneLiner": "PE<12+PB<1.2+股>3%三重筛选5只等权月调,止损-10%。",
    "category": "美股",
    "marketTags": [
      "🇺🇸"
    ],
    "factors": [
      {
        "factorId": "MOM_12M",
        "factorName": "12M动量",
        "weight": 0.35,
        "direction": "long"
      },
      {
        "factorId": "ROE",
        "factorName": "ROE质量",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "PE",
        "factorName": "PE价值",
        "weight": 0.2,
        "direction": "long"
      },
      {
        "factorId": "LOW_VOL",
        "factorName": "低波动",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-8%(单笔)",
      "applicable": "美股+ETF,无期权",
      "failureCheck": "连3笔止损→停1周"
    },
    "chargePoints": [
      {
        "id": "bt_us_val",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_us_val",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_us_val",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_us_val",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "us_low",
    "name": "Low Vol Defense",
    "nameCN": "低波防御",
    "oneLiner": "VIX>25选Beta<0.7+公用事业,VIX<18平仓,止损-5%。",
    "category": "美股",
    "marketTags": [
      "🇺🇸"
    ],
    "factors": [
      {
        "factorId": "MOM_12M",
        "factorName": "12M动量",
        "weight": 0.35,
        "direction": "long"
      },
      {
        "factorId": "ROE",
        "factorName": "ROE质量",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "PE",
        "factorName": "PE价值",
        "weight": 0.2,
        "direction": "long"
      },
      {
        "factorId": "LOW_VOL",
        "factorName": "低波动",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-8%(单笔)",
      "applicable": "美股+ETF,无期权",
      "failureCheck": "连3笔止损→停1周"
    },
    "chargePoints": [
      {
        "id": "bt_us_low",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_us_low",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_us_low",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_us_low",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "us_13f",
    "name": "13F Tracker",
    "nameCN": "13F跟随",
    "oneLiner": "顶级基金13F新增45天延迟入场,持仓3月,止损-12%。",
    "category": "美股",
    "marketTags": [
      "🇺🇸"
    ],
    "factors": [
      {
        "factorId": "MOM_12M",
        "factorName": "12M动量",
        "weight": 0.35,
        "direction": "long"
      },
      {
        "factorId": "ROE",
        "factorName": "ROE质量",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "PE",
        "factorName": "PE价值",
        "weight": 0.2,
        "direction": "long"
      },
      {
        "factorId": "LOW_VOL",
        "factorName": "低波动",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-8%(单笔)",
      "applicable": "美股+ETF,无期权",
      "failureCheck": "连3笔止损→停1周"
    },
    "chargePoints": [
      {
        "id": "bt_us_13f",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_us_13f",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_us_13f",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_us_13f",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "us_pead",
    "name": "PEAD Drift",
    "nameCN": "PEAD漂移",
    "oneLiner": "财报超>20%标的持仓30日,止损-6%,超额<3%退出。",
    "category": "美股",
    "marketTags": [
      "🇺🇸"
    ],
    "factors": [
      {
        "factorId": "MOM_12M",
        "factorName": "12M动量",
        "weight": 0.35,
        "direction": "long"
      },
      {
        "factorId": "ROE",
        "factorName": "ROE质量",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "PE",
        "factorName": "PE价值",
        "weight": 0.2,
        "direction": "long"
      },
      {
        "factorId": "LOW_VOL",
        "factorName": "低波动",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-8%(单笔)",
      "applicable": "美股+ETF,无期权",
      "failureCheck": "连3笔止损→停1周"
    },
    "chargePoints": [
      {
        "id": "bt_us_pead",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_us_pead",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_us_pead",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_us_pead",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "us_vix",
    "name": "VIX Hedge",
    "nameCN": "VIX对冲",
    "oneLiner": "VIX期货升水做空VIX ETF,升水<5%平仓,仓位<20%,止损-15%。",
    "category": "美股",
    "marketTags": [
      "🇺🇸"
    ],
    "factors": [
      {
        "factorId": "MOM_12M",
        "factorName": "12M动量",
        "weight": 0.35,
        "direction": "long"
      },
      {
        "factorId": "ROE",
        "factorName": "ROE质量",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "PE",
        "factorName": "PE价值",
        "weight": 0.2,
        "direction": "long"
      },
      {
        "factorId": "LOW_VOL",
        "factorName": "低波动",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-8%(单笔)",
      "applicable": "美股+ETF,无期权",
      "failureCheck": "连3笔止损→停1周"
    },
    "chargePoints": [
      {
        "id": "bt_us_vix",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_us_vix",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_us_vix",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_us_vix",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "hk_ah",
    "name": "AH Premium Arb",
    "nameCN": "AH溢价套利",
    "oneLiner": "AH溢价>25%做多H+做空A,回归<15%平仓,止损-10%。",
    "category": "港股",
    "marketTags": [
      "🇭🇰"
    ],
    "factors": [
      {
        "factorId": "MOM_6M",
        "factorName": "6M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "DIV",
        "factorName": "股息率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "TURN",
        "factorName": "换手率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "AH_PREM",
        "factorName": "AH溢价",
        "weight": 0.2,
        "direction": "short"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-12%(含汇率)",
      "applicable": "港股+H股,港股通",
      "failureCheck": "AH溢价>30%持续3月→停"
    },
    "chargePoints": [
      {
        "id": "bt_hk_ah",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_hk_ah",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_hk_ah",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_hk_ah",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "hk_tb",
    "name": "Turbo Direction",
    "nameCN": "涡轮方向",
    "oneLiner": "突破20日线+量>2倍买平值涡轮,破10日线出,止损-20%。",
    "category": "港股",
    "marketTags": [
      "🇭🇰"
    ],
    "factors": [
      {
        "factorId": "MOM_6M",
        "factorName": "6M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "DIV",
        "factorName": "股息率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "TURN",
        "factorName": "换手率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "AH_PREM",
        "factorName": "AH溢价",
        "weight": 0.2,
        "direction": "short"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-12%(含汇率)",
      "applicable": "港股+H股,港股通",
      "failureCheck": "AH溢价>30%持续3月→停"
    },
    "chargePoints": [
      {
        "id": "bt_hk_tb",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_hk_tb",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_hk_tb",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_hk_tb",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "hk_div",
    "name": "Dividend Ladder",
    "nameCN": "股息阶梯",
    "oneLiner": "恒生高息成股息>5%+稳>3年,等权季调,止损-8%。",
    "category": "港股",
    "marketTags": [
      "🇭🇰"
    ],
    "factors": [
      {
        "factorId": "MOM_6M",
        "factorName": "6M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "DIV",
        "factorName": "股息率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "TURN",
        "factorName": "换手率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "AH_PREM",
        "factorName": "AH溢价",
        "weight": 0.2,
        "direction": "short"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-12%(含汇率)",
      "applicable": "港股+H股,港股通",
      "failureCheck": "AH溢价>30%持续3月→停"
    },
    "chargePoints": [
      {
        "id": "bt_hk_div",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_hk_div",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_hk_div",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_hk_div",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "hk_sb",
    "name": "Southbound",
    "nameCN": "南向追踪",
    "oneLiner": "港股通净流入前5,周调,连续2周负清仓,止损-10%。",
    "category": "港股",
    "marketTags": [
      "🇭🇰"
    ],
    "factors": [
      {
        "factorId": "MOM_6M",
        "factorName": "6M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "DIV",
        "factorName": "股息率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "TURN",
        "factorName": "换手率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "AH_PREM",
        "factorName": "AH溢价",
        "weight": 0.2,
        "direction": "short"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-12%(含汇率)",
      "applicable": "港股+H股,港股通",
      "failureCheck": "AH溢价>30%持续3月→停"
    },
    "chargePoints": [
      {
        "id": "bt_hk_sb",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_hk_sb",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_hk_sb",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_hk_sb",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "hk_rc",
    "name": "Red Chip Return",
    "nameCN": "红筹回归",
    "oneLiner": "回港二次上市30日动量追,满90天动量<0退出,止损-12%。",
    "category": "港股",
    "marketTags": [
      "🇭🇰"
    ],
    "factors": [
      {
        "factorId": "MOM_6M",
        "factorName": "6M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "DIV",
        "factorName": "股息率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "TURN",
        "factorName": "换手率",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "AH_PREM",
        "factorName": "AH溢价",
        "weight": 0.2,
        "direction": "short"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-12%(含汇率)",
      "applicable": "港股+H股,港股通",
      "failureCheck": "AH溢价>30%持续3月→停"
    },
    "chargePoints": [
      {
        "id": "bt_hk_rc",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_hk_rc",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_hk_rc",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_hk_rc",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "STOCK",
    "timeframe": "日线",
    "difficulty": "intermediate"
  },
  {
    "id": "cr_btc",
    "name": "BTC Trend",
    "nameCN": "BTC趋势",
    "oneLiner": "站上200日线+周MACD金叉做多,破200日线平仓止损-15%。",
    "category": "加密",
    "marketTags": [
      "₿",
      "Ξ"
    ],
    "factors": [
      {
        "factorId": "BTC_DOM",
        "factorName": "BTC占比",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "FUND_RATE",
        "factorName": "资金费率",
        "weight": 0.25,
        "direction": "short"
      },
      {
        "factorId": "MVRV",
        "factorName": "MVRV",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "EX_BAL",
        "factorName": "交易所余额",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-25%(高波动)",
      "applicable": "BTC/ETH+永续,CEX",
      "failureCheck": "费率2周连负→清仓"
    },
    "chargePoints": [
      {
        "id": "bt_cr_btc",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_cr_btc",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_cr_btc",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_cr_btc",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "CRYPTO",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "cr_eth",
    "name": "ETH Rotation",
    "nameCN": "ETH轮动",
    "oneLiner": "ETH/BTC突破30日线超配ETH,下破超配BTC周调止损-20%。",
    "category": "加密",
    "marketTags": [
      "₿",
      "Ξ"
    ],
    "factors": [
      {
        "factorId": "BTC_DOM",
        "factorName": "BTC占比",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "FUND_RATE",
        "factorName": "资金费率",
        "weight": 0.25,
        "direction": "short"
      },
      {
        "factorId": "MVRV",
        "factorName": "MVRV",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "EX_BAL",
        "factorName": "交易所余额",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-25%(高波动)",
      "applicable": "BTC/ETH+永续,CEX",
      "failureCheck": "费率2周连负→清仓"
    },
    "chargePoints": [
      {
        "id": "bt_cr_eth",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_cr_eth",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_cr_eth",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_cr_eth",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "CRYPTO",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "cr_fr",
    "name": "Funding Rate",
    "nameCN": "资金费套利",
    "oneLiner": "费率>0.05%做空永续+买现货,回归<0.01%平仓止损-3%。",
    "category": "加密",
    "marketTags": [
      "₿",
      "Ξ"
    ],
    "factors": [
      {
        "factorId": "BTC_DOM",
        "factorName": "BTC占比",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "FUND_RATE",
        "factorName": "资金费率",
        "weight": 0.25,
        "direction": "short"
      },
      {
        "factorId": "MVRV",
        "factorName": "MVRV",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "EX_BAL",
        "factorName": "交易所余额",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-25%(高波动)",
      "applicable": "BTC/ETH+永续,CEX",
      "failureCheck": "费率2周连负→清仓"
    },
    "chargePoints": [
      {
        "id": "bt_cr_fr",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_cr_fr",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_cr_fr",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_cr_fr",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "CRYPTO",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "cr_lq",
    "name": "Liquidation Hunt",
    "nameCN": "清算猎杀",
    "oneLiner": "链上>1000BTC清算反向入场距离>5%,止损-8%。",
    "category": "加密",
    "marketTags": [
      "₿",
      "Ξ"
    ],
    "factors": [
      {
        "factorId": "BTC_DOM",
        "factorName": "BTC占比",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "FUND_RATE",
        "factorName": "资金费率",
        "weight": 0.25,
        "direction": "short"
      },
      {
        "factorId": "MVRV",
        "factorName": "MVRV",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "EX_BAL",
        "factorName": "交易所余额",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-25%(高波动)",
      "applicable": "BTC/ETH+永续,CEX",
      "failureCheck": "费率2周连负→清仓"
    },
    "chargePoints": [
      {
        "id": "bt_cr_lq",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_cr_lq",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_cr_lq",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_cr_lq",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "CRYPTO",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "cr_3l",
    "name": "OnChain 3 Lights",
    "nameCN": "链上三灯",
    "oneLiner": "MVRV<1.5+NUPL<0.5+余额降做多,灯灭减50%止损-25%。",
    "category": "加密",
    "marketTags": [
      "₿",
      "Ξ"
    ],
    "factors": [
      {
        "factorId": "BTC_DOM",
        "factorName": "BTC占比",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "FUND_RATE",
        "factorName": "资金费率",
        "weight": 0.25,
        "direction": "short"
      },
      {
        "factorId": "MVRV",
        "factorName": "MVRV",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "EX_BAL",
        "factorName": "交易所余额",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-25%(高波动)",
      "applicable": "BTC/ETH+永续,CEX",
      "failureCheck": "费率2周连负→清仓"
    },
    "chargePoints": [
      {
        "id": "bt_cr_3l",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_cr_3l",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_cr_3l",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_cr_3l",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "CRYPTO",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "cr_fb",
    "name": "Futures Basis",
    "nameCN": "期现套利",
    "oneLiner": "年化基差>15%空合约+多现货,缩<5%平仓止损-5%。",
    "category": "加密",
    "marketTags": [
      "₿",
      "Ξ"
    ],
    "factors": [
      {
        "factorId": "BTC_DOM",
        "factorName": "BTC占比",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "FUND_RATE",
        "factorName": "资金费率",
        "weight": 0.25,
        "direction": "short"
      },
      {
        "factorId": "MVRV",
        "factorName": "MVRV",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "EX_BAL",
        "factorName": "交易所余额",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-25%(高波动)",
      "applicable": "BTC/ETH+永续,CEX",
      "failureCheck": "费率2周连负→清仓"
    },
    "chargePoints": [
      {
        "id": "bt_cr_fb",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_cr_fb",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_cr_fb",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_cr_fb",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "CRYPTO",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "cr_dca",
    "name": "HODL DCA",
    "nameCN": "HODL定投",
    "oneLiner": "每日定额BTC/ETH 50/50组合,永续持有不设损。",
    "category": "加密",
    "marketTags": [
      "₿",
      "Ξ"
    ],
    "factors": [
      {
        "factorId": "BTC_DOM",
        "factorName": "BTC占比",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "FUND_RATE",
        "factorName": "资金费率",
        "weight": 0.25,
        "direction": "short"
      },
      {
        "factorId": "MVRV",
        "factorName": "MVRV",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "EX_BAL",
        "factorName": "交易所余额",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-25%(高波动)",
      "applicable": "BTC/ETH+永续,CEX",
      "failureCheck": "费率2周连负→清仓"
    },
    "chargePoints": [
      {
        "id": "bt_cr_dca",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_cr_dca",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_cr_dca",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_cr_dca",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "CRYPTO",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "cr_wh",
    "name": "Whale Track",
    "nameCN": "巨鲸追踪",
    "oneLiner": ">1000BTC转入交易所1h反向入场,4h平仓止损-8%。",
    "category": "加密",
    "marketTags": [
      "₿",
      "Ξ"
    ],
    "factors": [
      {
        "factorId": "BTC_DOM",
        "factorName": "BTC占比",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "FUND_RATE",
        "factorName": "资金费率",
        "weight": 0.25,
        "direction": "short"
      },
      {
        "factorId": "MVRV",
        "factorName": "MVRV",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "EX_BAL",
        "factorName": "交易所余额",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-25%(高波动)",
      "applicable": "BTC/ETH+永续,CEX",
      "failureCheck": "费率2周连负→清仓"
    },
    "chargePoints": [
      {
        "id": "bt_cr_wh",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_cr_wh",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_cr_wh",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_cr_wh",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "CRYPTO",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "xm_gr",
    "name": "Global Rotation",
    "nameCN": "全球轮动",
    "oneLiner": "月选3月动量最强2全球ETF板块,排跌出前5退出止损-10%。",
    "category": "跨市场",
    "marketTags": [
      "🌎"
    ],
    "factors": [
      {
        "factorId": "MOM_3M",
        "factorName": "3M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "CORR",
        "factorName": "相关性",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "SPREAD",
        "factorName": "价差Z",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "VOL_RATIO",
        "factorName": "波动率比",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-10%(双边)",
      "applicable": "股票ETF外汇商品",
      "failureCheck": "利差>2月不收敛→关"
    },
    "chargePoints": [
      {
        "id": "bt_xm_gr",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_xm_gr",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_xm_gr",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_xm_gr",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "MULTI",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "xm_ct",
    "name": "Carry Trade",
    "nameCN": "套息交易",
    "oneLiner": "多高利率+空低利率货币利差>2%+波动<10%,缩<1%出止损-5%。",
    "category": "跨市场",
    "marketTags": [
      "🌎"
    ],
    "factors": [
      {
        "factorId": "MOM_3M",
        "factorName": "3M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "CORR",
        "factorName": "相关性",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "SPREAD",
        "factorName": "价差Z",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "VOL_RATIO",
        "factorName": "波动率比",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-10%(双边)",
      "applicable": "股票ETF外汇商品",
      "failureCheck": "利差>2月不收敛→关"
    },
    "chargePoints": [
      {
        "id": "bt_xm_ct",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_xm_ct",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_xm_ct",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_xm_ct",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "MULTI",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "xm_va",
    "name": "Vol Arbitrage",
    "nameCN": "波动率套利",
    "oneLiner": "跨市场VIX价差>5点空高多低,回归平仓止损-8%。",
    "category": "跨市场",
    "marketTags": [
      "🌎"
    ],
    "factors": [
      {
        "factorId": "MOM_3M",
        "factorName": "3M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "CORR",
        "factorName": "相关性",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "SPREAD",
        "factorName": "价差Z",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "VOL_RATIO",
        "factorName": "波动率比",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-10%(双边)",
      "applicable": "股票ETF外汇商品",
      "failureCheck": "利差>2月不收敛→关"
    },
    "chargePoints": [
      {
        "id": "bt_xm_va",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_xm_va",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_xm_va",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_xm_va",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "MULTI",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "xm_gl",
    "name": "Gold Link",
    "nameCN": "金股联动",
    "oneLiner": "金价破前高多金矿+空黄金ETF,2σ偏离平仓止损-10%。",
    "category": "跨市场",
    "marketTags": [
      "🌎"
    ],
    "factors": [
      {
        "factorId": "MOM_3M",
        "factorName": "3M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "CORR",
        "factorName": "相关性",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "SPREAD",
        "factorName": "价差Z",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "VOL_RATIO",
        "factorName": "波动率比",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-10%(双边)",
      "applicable": "股票ETF外汇商品",
      "failureCheck": "利差>2月不收敛→关"
    },
    "chargePoints": [
      {
        "id": "bt_xm_gl",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_xm_gl",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_xm_gl",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_xm_gl",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "MULTI",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "xm_is",
    "name": "Index Spread",
    "nameCN": "指数配对",
    "oneLiner": "恒生/标普偏离>2σ多低空高,回归均值平仓止损-8%。",
    "category": "跨市场",
    "marketTags": [
      "🌎"
    ],
    "factors": [
      {
        "factorId": "MOM_3M",
        "factorName": "3M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "CORR",
        "factorName": "相关性",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "SPREAD",
        "factorName": "价差Z",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "VOL_RATIO",
        "factorName": "波动率比",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-10%(双边)",
      "applicable": "股票ETF外汇商品",
      "failureCheck": "利差>2月不收敛→关"
    },
    "chargePoints": [
      {
        "id": "bt_xm_is",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_xm_is",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_xm_is",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_xm_is",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "MULTI",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "xm_ce",
    "name": "Comm-Equity",
    "nameCN": "商股联动",
    "oneLiner": "原油破60日均线多能源+空原油期货,偏离5%平仓止损-10%。",
    "category": "跨市场",
    "marketTags": [
      "🌎"
    ],
    "factors": [
      {
        "factorId": "MOM_3M",
        "factorName": "3M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "CORR",
        "factorName": "相关性",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "SPREAD",
        "factorName": "价差Z",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "VOL_RATIO",
        "factorName": "波动率比",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-10%(双边)",
      "applicable": "股票ETF外汇商品",
      "failureCheck": "利差>2月不收敛→关"
    },
    "chargePoints": [
      {
        "id": "bt_xm_ce",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_xm_ce",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_xm_ce",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_xm_ce",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "MULTI",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "xm_em",
    "name": "EM-DM Rotation",
    "nameCN": "新兴发达",
    "oneLiner": "EM相对DM3月动量>2%超配EM,本月调美元>3%退出止损-12%。",
    "category": "跨市场",
    "marketTags": [
      "🌎"
    ],
    "factors": [
      {
        "factorId": "MOM_3M",
        "factorName": "3M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "CORR",
        "factorName": "相关性",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "SPREAD",
        "factorName": "价差Z",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "VOL_RATIO",
        "factorName": "波动率比",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-10%(双边)",
      "applicable": "股票ETF外汇商品",
      "failureCheck": "利差>2月不收敛→关"
    },
    "chargePoints": [
      {
        "id": "bt_xm_em",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_xm_em",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_xm_em",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_xm_em",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "MULTI",
    "timeframe": "日线",
    "difficulty": "advanced"
  },
  {
    "id": "xm_rs",
    "name": "Rates-Sector",
    "nameCN": "利率板块",
    "oneLiner": "10Y涨>20bp多金融+能源+空公用+REIT,拐点平仓止损-8%。",
    "category": "跨市场",
    "marketTags": [
      "🌎"
    ],
    "factors": [
      {
        "factorId": "MOM_3M",
        "factorName": "3M动量",
        "weight": 0.3,
        "direction": "long"
      },
      {
        "factorId": "CORR",
        "factorName": "相关性",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "SPREAD",
        "factorName": "价差Z",
        "weight": 0.25,
        "direction": "long"
      },
      {
        "factorId": "VOL_RATIO",
        "factorName": "波动率比",
        "weight": 0.2,
        "direction": "long"
      }
    ],
    "ironLaws": {
      "stopLoss": "止损-10%(双边)",
      "applicable": "股票ETF外汇商品",
      "failureCheck": "利差>2月不收敛→关"
    },
    "chargePoints": [
      {
        "id": "bt_xm_rs",
        "label": "BT 1U",
        "labelCN": "回测解读1U",
        "price": 1,
        "icon": "backtest"
      },
      {
        "id": "fill_xm_rs",
        "label": "Fill 1U",
        "labelCN": "AI填充1U",
        "price": 1,
        "icon": "fill"
      },
      {
        "id": "opt_xm_rs",
        "label": "Opt 1.5U",
        "labelCN": "优化建议1.5U",
        "price": 1.5,
        "icon": "optimize"
      },
      {
        "id": "dx_xm_rs",
        "label": "Diag 1U",
        "labelCN": "因子诊断1U",
        "price": 1,
        "icon": "diagnose"
      }
    ],
    "assetClass": "MULTI",
    "timeframe": "日线",
    "difficulty": "advanced"
  }
];

const MODES: Array<{id:CreateMode;icon:React.ReactNode;t:string;tc:string;d:string;dc:string;price:string}> = [
  {id:'ai',icon:<RobotOutlined style={{fontSize:24,color:'#d4a853'}}/>,t:'AI Create',tc:'AI创建',d:'NL→strategy',dc:'自然语言→策略',price:'1U'},
  {id:'template',icon:<AppstoreOutlined style={{fontSize:24,color:'#4a90d9'}}/>,t:'Templates',tc:'模板库',d:'28 core templates',dc:'28款核心模板',price:'FREE'},
  {id:'form',icon:<SettingOutlined style={{fontSize:24,color:'#52c41a'}}/>,t:'Manual',tc:'手动创建',d:'Custom factors',dc:'自定义因子+参数',price:'FREE'},
];

const TemplateBrowserV2: React.FC<Props> = ({onSelectMode,onUseTemplate,locale:pl}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';
  const [mode,setMode] = useState<CreateMode>('template');
  const [mf,setMf] = useState('全部');
  const [q,setQ] = useState('');
  const [sel,setSel] = useState<TemplateItem|null>(null);
  const [exp,setExp] = useState<string|null>(null);

  const list = useMemo(() => {
    let a = TEMPLATES;
    if (mf !== '全部') a = a.filter(t=>t.category===mf);
    if (q.trim()) { const w = q.toLowerCase(); a = a.filter(t=>t.name.toLowerCase().includes(w)||t.nameCN.includes(w)||t.oneLiner.includes(w)||t.factors.some(f=>f.factorName.includes(w))); }
    return a;
  }, [mf, q]);

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:24,border:'1px solid rgba(74,144,217,0.15)',minHeight:560}}>
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <AppstoreOutlined style={{fontSize:22,color:'#4a90d9'}}/>
          <div><div style={{color:'#e8e8e8',fontSize:18,fontWeight:700}}>{T('title',l)}</div><div style={{color:'#909090',fontSize:12}}>{T('sub',l)}</div></div>
        </div>
      </div>

      {/* 3-entry Mode Selector */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
        {MODES.map(m=>(
          <button key={m.id} onClick={()=>{setMode(m.id);onSelectMode?.(m.id)}}
            style={{background:mode===m.id?'rgba(74,144,217,0.12)':'rgba(255,255,255,0.03)',border:mode===m.id?'1px solid rgba(74,144,217,0.4)':'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'16px 12px',cursor:'pointer',transition:'all .2s',textAlign:'center',position:'relative'}}>
            <Badge count={m.price} size="small" style={{position:'absolute',top:8,right:8,backgroundColor:m.price==='FREE'?'#52c41a':'#d4a853'}}/>
            <div style={{marginBottom:8}}>{m.icon}</div>
            <div style={{color:'#e8e8e8',fontSize:14,fontWeight:700}}>{l==='zhCN'?m.tc:m.t}</div>
            <div style={{color:'#909090',fontSize:11,marginTop:4,lineHeight:1.4}}>{l==='zhCN'?m.dc:m.d}</div>
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      {mode==='template' && (<>
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <Input prefix={<SearchOutlined style={{color:'#666'}}/>} placeholder={T('search',l)} value={q}
            onChange={e=>setQ(e.target.value)}
            style={{flex:1,minWidth:200,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#e8e8e8'}}/>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {CATS.map(cat=>(
              <Tag key={cat} color={mf===cat?(cat==='全部'?'blue':cat==='美股'?'geekblue':cat==='港股'?'red':cat==='加密'?'orange':'purple'):'default'}
                style={{cursor:'pointer',margin:0,fontWeight:mf===cat?600:400,background:mf===cat?undefined:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',color:mf===cat?undefined:'#909090'}}
                onClick={()=>setMf(cat)}>
                {cat==='全部'?T('all',l):cat==='美股'?T('us',l):cat==='港股'?T('hk',l):cat==='加密'?T('crypto',l):T('cross',l)}
              </Tag>
            ))}
          </div>
        </div>
        <div style={{color:'#909090',fontSize:12,marginBottom:16}}>{list.length}{T('res',l)}</div>
      </>)}

      {/* Template Grid */}
      {mode==='template' && (
        list.length > 0 ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))',gap:14}}>
            {list.map((tmpl: TemplateItem)=>{
              const isExp = exp===tmpl.id;
              const cc: Record<string,string> = {美股:'#4a90d9',港股:'#d73027',加密:'#f7931a',跨市场:'#9b59b6'};
              return (
                <Card key={tmpl.id} size="small" onClick={()=>setExp(isExp?null:tmpl.id)}
                  style={{background:'rgba(255,255,255,0.03)',border:sel?.id===tmpl.id?'2px solid rgba(74,144,217,0.5)':'1px solid rgba(255,255,255,0.08)',borderRadius:10,cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{color:'#e8e8e8',fontSize:14,fontWeight:700}}>{l==='zhCN'?tmpl.nameCN:tmpl.name}</span>
                        <Tag color={cc[tmpl.category]||'#666'} style={{fontSize:10,margin:0}}>{tmpl.category}</Tag>
                      </div>
                      <div style={{color:'#909090',fontSize:11,marginTop:2}}>{tmpl.marketTags.join(' ')} · {tmpl.assetClass}</div>
                    </div>
                    <Tag color={DC[tmpl.difficulty]} style={{fontSize:9,margin:0}}>{T(tmpl.difficulty==='beginner'?'beg':tmpl.difficulty==='intermediate'?'mid':'adv',l)}</Tag>
                  </div>

                  {/* Iron Law 1 */}
                  <div style={{color:'#d0d0d0',fontSize:12,lineHeight:1.6,marginBottom:10,padding:'8px 10px',background:'rgba(255,255,255,0.04)',borderRadius:6,borderLeft:'3px solid #d4a853'}}>
                    <span style={{color:'#d4a853',fontWeight:600,marginRight:6}}>📌</span>
                    {tmpl.oneLiner.substring(0,80)}
                  </div>

                  {/* Factors */}
                  <div style={{marginBottom:10}}>
                    <div style={{color:'#d4a853',fontSize:11,fontWeight:600,marginBottom:4}}><StarFilled style={{fontSize:10}}/> {T('fac',l)} ({tmpl.factors.length})</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {tmpl.factors.map(f=>(
                        <Tag key={f.factorId} style={{fontSize:10,margin:0,background:f.direction==='long'?'rgba(82,196,26,0.1)':'rgba(255,77,79,0.1)',border:'1px solid ' + (f.direction==='long'?'rgba(82,196,26,0.3)':'rgba(255,77,79,0.3)'),color:f.direction==='long'?'#52c41a':'#ff4d4f'}}>
                          {f.direction==='long'?'🟢':'🔴'} {f.factorName} {(f.weight*100).toFixed(0)}%
                        </Tag>
                      ))}
                    </div>
                  </div>

                  {/* Expanded: Iron Laws 2-4 + AI Charge */}
                  {isExp && (<>
                    <div style={{padding:10,background:'rgba(212,168,83,0.06)',borderRadius:8,marginBottom:10}}>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}><SafetyOutlined style={{color:'#ff4d4f',fontSize:12}}/><span style={{color:'#ccc',fontSize:11}}>{T('sl',l)}: <span style={{color:'#ff4d4f',fontWeight:600}}>{tmpl.ironLaws.stopLoss}</span></span></div>
                        <div style={{display:'flex',alignItems:'center',gap:6}}><GlobalOutlined style={{color:'#4a90d9',fontSize:12}}/><span style={{color:'#ccc',fontSize:11}}>{T('ap',l)}: {tmpl.ironLaws.applicable}</span></div>
                        <div style={{display:'flex',alignItems:'center',gap:6}}><CheckCircleOutlined style={{color:'#d4a853',fontSize:12}}/><span style={{color:'#ccc',fontSize:11}}>{T('fc',l)}: {tmpl.ironLaws.failureCheck}</span></div>
                      </div>
                      <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                        <div style={{color:'#d4a853',fontSize:11,fontWeight:600,marginBottom:6}}><DollarOutlined/> {T('ai',l)} (3-5)</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {tmpl.chargePoints.map((cp: ChargePoint)=>(<Tag key={cp.id} style={{fontSize:10,margin:0,cursor:'pointer',background:'rgba(212,168,83,0.1)',border:'1px solid rgba(212,168,83,0.3)',color:'#d4a853'}}>{ICONS[cp.icon]} {l==='zhCN'?cp.labelCN:cp.label}</Tag>))}
                        </div>
                      </div>
                    </div>
                  </>)}

                  {/* Use button */}
                  <Button type="primary" size="small" block icon={<CheckCircleOutlined/>}
                    onClick={e=>{e.stopPropagation();setSel(tmpl);onUseTemplate?.(tmpl)}}
                    style={{background:'linear-gradient(135deg, #4a90d9 0%, #357abd 100%)',border:'none',fontWeight:600,height:32}}>
                    {T('use',l)}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <Empty description={<span style={{color:'#909090'}}>{T('no',l)}</span>} image={Empty.PRESENTED_IMAGE_SIMPLE}/>
        )
      )}

      {/* Placeholder for non-template modes */}
      {mode!=='template' && (
        <div style={{textAlign:'center',padding:60,color:'#666'}}>
          <div style={{fontSize:48,marginBottom:16}}>{mode==='ai'?'🤖':'⚙️'}</div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>{T(mode==='ai'?'aiMode':'manMode',l)}</div>
          <div style={{fontSize:13}}>{T(mode==='ai'?'aiDesc':'manDesc',l)}</div>
        </div>
      )}
    </div>
  );
};

export default TemplateBrowserV2;
