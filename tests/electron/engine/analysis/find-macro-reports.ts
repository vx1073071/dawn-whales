// Comprehensive search for M2/LPR/Unemployment/Industrial report names
import https from 'https';

// Test many variations
const testCases = [
  // M2 / Money Supply
  { category: 'M2', names: [
    'RPT_ECONOMY_M2',
    'RPT_ECONOMY_MONEY_SUPPLY',
    'RPT_ECONOMY_MONEY_SUPPLY_M2',
    'RPT_ECONOMY_CURRENCY_M2',
    'RPT_ECONOMY_M2_GROWTH',
    'RPT_ECONOMY_M2_YOY',
    'RPT_ECONOMY_MONETARY_M2',
    'RPT_ECONOMY_LIQUIDITY_M2',
    'RPT_ECONOMY_CASH_M2',
    'RPT_ECONOMY_BANK_M2',
  ]},
  
  // LPR / Interest Rates
  { category: 'LPR', names: [
    'RPT_ECONOMY_LPR',
    'RPT_ECONOMY_LOAN_PRIME_RATE',
    'RPT_ECONOMY_LOAN_RATE',
    'RPT_ECONOMY_INTEREST_RATE',
    'RPT_ECONOMY_BENCHMARK_RATE',
    'RPT_ECONOMY_BANK_RATE',
    'RPT_ECONOMY_LENDING_RATE',
    'RPT_ECONOMY_LOAN_PRIME',
    'RPT_ECONOMY_PRIME_LOAN',
    'RPT_ECONOMY_RATE_LPR',
  ]},
  
  // Unemployment
  { category: 'Unemployment', names: [
    'RPT_ECONOMY_UNEMPLOYMENT',
    'RPT_ECONOMY_EMPLOYMENT',
    'RPT_ECONOMY_LABOR',
    'RPT_ECONOMY_JOBLESS',
    'RPT_ECONOMY_UNEMPLOY_RATE',
    'RPT_ECONOMY_LABOR_FORCE',
    'RPT_ECONOMY_JOB_MARKET',
    'RPT_ECONOMY_WORKFORCE',
    'RPT_ECONOMY_EMPLOYMENT_RATE',
    'RPT_ECONOMY_UNEMPLOYMENT_RATE',
  ]},
  
  // Industrial Production
  { category: 'Industrial', names: [
    'RPT_ECONOMY_INDUSTRIAL',
    'RPT_ECONOMY_INDUSTRIAL_PRODUCTION',
    'RPT_ECONOMY_INDUSTRIAL_OUTPUT',
    'RPT_ECONOMY_INDUSTRIAL_GROWTH',
    'RPT_ECONOMY_INDUSTRIAL_YOY',
    'RPT_ECONOMY_MANUFACTURING',
    'RPT_ECONOMY_FACTORY_OUTPUT',
    'RPT_ECONOMY_PRODUCTION',
    'RPT_ECONOMY_OUTPUT',
    'RPT_ECONOMY_INDUSTRIAL_INDEX',
  ]},
];

let totalTests = testCases.reduce((sum, tc) => sum + tc.names.length, 0);
let completed = 0;
const results = {};

testCases.forEach(testCase => {
  results[testCase.category] = [];
  
  testCase.names.forEach(name => {
    const url = `https://datacenter.eastmoney.com/api/data/v1/get?reportName=${name}&columns=ALL&pageSize=1&source=WEB&client=WEB`;
    
    https.get(url, {headers: {'User-Agent': 'Mozilla/5.0'}}, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.success && json.result && json.result.data && json.result.data.length > 0) {
            console.log(`✓ ${testCase.category} - ${name}: SUCCESS`);
            console.log(`  Columns: ${Object.keys(json.result.data[0]).slice(0, 10).join(', ')}`);
            results[testCase.category].push({
              name,
              columns: Object.keys(json.result.data[0]),
              sample: json.result.data[0]
            });
          } else {
            // Silent fail for non-existent reports
          }
        } catch(e) {
          // Silent parse error
        }
        
        completed++;
        if (completed === totalTests) {
          console.log('\n=== SUMMARY ===');
          Object.keys(results).forEach(category => {
            if (results[category].length > 0) {
              console.log(`\n${category}:`);
              results[category].forEach(r => {
                console.log(`  ✓ ${r.name}`);
                console.log(`    Columns: ${r.columns.slice(0, 8).join(', ')}...`);
              });
            } else {
              console.log(`\n${category}: No valid reports found`);
            }
          });
          process.exit(0);
        }
      });
    }).on('error', () => {
      completed++;
      if (completed === totalTests) {
        console.log('\n=== SUMMARY ===');
        Object.keys(results).forEach(category => {
          if (results[category].length > 0) {
            console.log(`\n${category}:`);
            results[category].forEach(r => {
              console.log(`  ✓ ${r.name}`);
            });
          } else {
            console.log(`\n${category}: No valid reports found`);
          }
        });
        process.exit(0);
      }
    });
  });
});
