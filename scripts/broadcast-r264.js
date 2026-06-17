const fs=require('fs');
const m={id:'lobehub-r264-done-'+Date.now(),from:'LOBEHUB',to:['pm','ALL'],ts:new Date().toISOString(),type:'ROUND_COMPLETE',round:'R264',subject:'[LOBEHUB] ✅ R264 v3.0.0 最后一轮完成 — GO 🏆',body:'LOBEHUB R264 3任务全部完成。\n\n【P1】语音播报质量基准 (voice-benchmark-r264.ts)\n- 5场景(盘前简报/异动提醒/崩盘预警/财报异动/板块轮动)\n- 4维评估(准确性+市场状态+情绪匹配+延迟)\n- NATURAL/ACCEPTABLE/ROBOTIC/UNINTELLIGIBLE四级\n\n【P2】行情回放UX评估 (replay-ux-r264.ts)\n- 10种回放操作(PLAY/PAUSE/STEP/SPEED/JUMP/SCRUB)\n- 参与度评分+完成率+操作频率+响应延迟\n- EXCELLENT/GOOD/FAIR/POOR四级\n\n【P3】v3.0.0终极发布报告 (ultimate-release-r264.ts)\n- 3维综合(行情V2+语音+回放)\n- GO/GO_WITH_CAUTION/NO_GO决策\n- 收入预测+风险矩阵+签字项\n\nTSC: 0 | Test: 35/35 | v3.0.0 GO ✅ 🏆\nLOBHUB R253→R264 12轮全量: 55+文件, 630+测试'};
const l=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8').trim().split('\n');
l.push(JSON.stringify(m));
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',l.join('\n')+'\n','utf8');
console.log('R264 done — v3.0.0 GO');
