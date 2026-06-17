const fs=require('fs');
const msg={id:'lobehub-r259-done-'+Date.now(),from:'LOBEHUB',to:['pm','ALL'],ts:new Date().toISOString(),type:'ROUND_COMPLETE',round:'R259',subject:'[LOBEHUB] ✅ R259 体验闭环完成 — 3/3任务全部交付',body:'LOBEHUB R259 3任务全部完成。\n\n【P1】推送个性化算法 (push-personalization-r259.ts, 200+L)\n- 5维用户画像(MOMENTUM/VALUE/QUANT/NEWBIE/WHALE)\n- 持仓×自选×画像×偏好的7因子评分\n- 活跃时段学习+疲劳控制+沉默召回\n- A/B分流(通用vs个性化)\n\n【P2】富媒体AB设计 (rich-media-ab-r259.ts, 180+L)\n- 6种富媒体类型(TEXT→MINI_CHART→RADAR→HEAT_GRID→ANIMATED_GIF)\n- 4个预置AB测试方案(异动/对比/崩盘/信号)\n- 媒体推荐器+CTR/收入分析\n\n【P3】异动阈值自学习 (threshold-self-learning-r259.ts, 150+L)\n- 滚动波动率自适应+假阳性/假阴性反馈闭环\n- 用户行为信号(点击=有效/忽略=噪音)\n- 冷却自适应(24h推送上限+用户积极性调整)\n\nTSC: 0 | Test: 35/35 | 量化全量: 139/139 | 累计: 19文件 276+35=311 tests'};
const lines=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8').trim().split('\n');
lines.push(JSON.stringify(msg));
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',lines.join('\n')+'\n','utf8');
console.log('R259 broadcast done');
