const fs = require('fs');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;

['src/components/dashboard/DashboardPage.tsx', 'src/components/market/SectorRotationPage.tsx', 'src/components/pm/AgentDashboard.tsx'].forEach(file => {
  const c = fs.readFileSync(file, 'utf8');
  const lines = c.split('\n');
  console.log(`\n=== ${file} ===`);
  lines.forEach((l, i) => {
    if (CJK.test(l)) {
      const t = l.trim();
      if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('import ')) {
        console.log(`  ${i+1}: ${l.trim().substring(0, 160)}`);
      }
    }
  });
});
