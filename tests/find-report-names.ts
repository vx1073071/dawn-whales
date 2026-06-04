// Test script to find correct report names for M2/LPR/Unemployment
import https from 'https';

const reportNames = [
  // M2 variations
  'RPT_ECONOMY_MONEY_SUPPLY',
  'RPT_ECONOMY_CURRENCY',
  'RPT_ECONOMY_M0_M1_M2',
  'RPT_ECONOMY_MONETARY',
  'RPT_ECONOMY_LIQUIDITY',
  
  // LPR variations
  'RPT_ECONOMY_LOAN_PRIME_RATE',
  'RPT_ECONOMY_LOAN_RATE',
  'RPT_ECONOMY_INTEREST_RATE',
  'RPT_ECONOMY_BENCHMARK_RATE',
  
  // Unemployment variations
  'RPT_ECONOMY_UNEMPLOYMENT',
  'RPT_ECONOMY_EMPLOYMENT',
  'RPT_ECONOMY_LABOR',
  'RPT_ECONOMY_JOBLESS',
];

let completed = 0;
const results = [];

reportNames.forEach(name => {
  const url = `https://datacenter.eastmoney.com/api/data/v1/get?reportName=${name}&columns=ALL&pageSize=1&source=WEB&client=WEB`;
  
  https.get(url, {headers: {'User-Agent': 'Mozilla/5.0'}}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const result = {
          name,
          success: json.success,
          message: json.message,
          columns: null
        };
        
        if (json.success && json.result && json.result.data && json.result.data.length > 0) {
          result.columns = Object.keys(json.result.data[0]).slice(0, 15);
          console.log(`✓ ${name}: SUCCESS`);
          console.log(`  Columns: ${result.columns.join(', ')}`);
        } else {
          console.log(`✗ ${name}: ${json.message}`);
        }
        
        results.push(result);
      } catch(e) {
        console.log(`✗ ${name}: Parse error - ${e.message}`);
        results.push({name, success: false, message: 'Parse error', columns: null});
      }
      
      completed++;
      if (completed === reportNames.length) {
        console.log('\n=== Summary ===');
        const successful = results.filter(r => r.success);
        console.log(`Found ${successful.length} valid reports:`);
        successful.forEach(r => {
          console.log(`  ${r.name}`);
          if (r.columns) {
            console.log(`    Columns: ${r.columns.join(', ')}`);
          }
        });
        process.exit(0);
      }
    });
  }).on('error', (e) => {
    console.log(`✗ ${name}: Network error - ${e.message}`);
    results.push({name, success: false, message: 'Network error', columns: null});
    completed++;
    if (completed === reportNames.length) process.exit(0);
  });
});
