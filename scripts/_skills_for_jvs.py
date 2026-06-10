import os, json

skills = []
for base in ['skills', 'workspace/skills']:
    for root, dirs, files in os.walk(os.path.expanduser(f'~/.easyclaw/{base}')):
        for f in files:
            if f == 'SKILL.md':
                path = os.path.join(root, f)
                name = os.path.basename(os.path.dirname(path))
                skills.append({'name': name, 'path': path})

out = os.path.expanduser('~/.easyclaw/workspace/chat-bridge/SKILLS_FOR_JVS.md')
with open(out, 'w', encoding='utf-8') as f:
    f.write('# All ML Skills — for JVS\n\n')
    f.write(f'## {len(skills)} skills available\n\n')
    f.write('### How to load any skill:\n')
    f.write('Read the SKILL.md at the path below, then follow its instructions.\n\n')
    f.write('| # | Name | Path |\n')
    f.write('|---|------|------|\n')
    for i, s in enumerate(sorted(skills, key=lambda x: x['name']), 1):
        f.write(f"| {i} | {s['name']} | {s['path']} |\n")
    
    f.write('\n## JVS R88 重点技能\n\n')
    jvs_recs = ['futuapi', 'tushare-finance', 'eastmoney_fin_data', 'eastmoney_fin_search',
                'quant-strategy', 'quant-strategy-dev', 'quant-backtest', 'quant-trading-system',
                'git-essentials', 'github-operations', 'electron', 'api-gateway',
                'install-futu-opend', 'moomooapi', 'yahooquery']
    for name in jvs_recs:
        found = [s for s in skills if s['name'] == name]
        if found:
            f.write(f"- **{found[0]['name']}**: `{found[0]['path']}`\n")
    
    f.write('\n## 通信协议\n\n')
    f.write('- 桥文件: `C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl`\n')
    f.write('- appendFileSync 模式写消息\n')
    f.write('- msgId: UUID\n')
    f.write('- 中英双语必写\n')

print(f'Wrote {out}')
print(f'Total skills: {len(skills)}')
