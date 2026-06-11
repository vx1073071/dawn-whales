// Search for finance/bank related reports that might contain M2/LPR data
import https from 'https';

const testCases = [
  // Finance/Bank variations for M2
  { category: 'M2 (Finance)', names: [
    'RPT_FINANCE_M2',
    'RPT_FINANCE_MONEY',
    'RPT_FINANCE_MONETARY',
    'RPT_BANK_M2',
    'RPT_BANK_DEPOSIT',
    'RPT_BANK_LIQUIDITY',
    'RPT_FINANCE_LIQUIDITY',
    'RPT_FINANCE_CURRENCY',
    'RPT_ECONOMY_FINANCE',
    'RPT_ECONOMY_BANK',
  ]},
  
  // Finance/Bank variations for LPR
  { category: 'LPR (Finance)', names: [
    'RPT_FINANCE_LPR',
    'RPT_FINANCE_LOAN',
    'RPT_FINANCE_RATE',
    'RPT_FINANCE_INTEREST',
    'RPT_BANK_LPR',
    'RPT_BANK_LOAN_RATE',
    'RPT_BANK_INTEREST',
    'RPT_ECONOMY_FINANCE',
    'RPT_ECONOMY_BANK',
    'RPT_FINANCE_CREDIT',
  ]},
  
  // Labor/Workforce variations
  { category: 'Unemployment (Labor)', names: [
    'RPT_LABOR_UNEMPLOYMENT',
    'RPT_LABOR_EMPLOYMENT',
    'RPT_LABOR_FORCE',
    'RPT_LABOR_MARKET',
    'RPT_SOCIAL_EMPLOYMENT',
    'RPT_SOCIAL_LABOR',
    'RPT_ECONOMY_SOCIAL',
    'RPT_ECONOMY_POPULATION',
    'RPT_ECONOMY_DEMOGRAPHIC',
    'RPT_ECONOMY_WORKFORCE',
  ]},
  
  // Manufacturing/Production variations
  { category: 'Industrial (Manufacturing)', names: [
    'RPT_MANUFACTURING_OUTPUT',
    'RPT_MANUFACTURING_PRODUCTION',
    'RPT_MANUFACTURING_INDEX',
    'RPT_INDUSTRY_OUTPUT',
    'RPT_INDUSTRY_PRODUCTION',
    'RPT_INDUSTRY_GROWTH',
    'RPT_ECONOMY_INDUSTRY',
    'RPT_ECONOMY_MANUFACTURE',
    'RPT_ECONOMY_FACTORY',
    'RPT_ECONOMY_GOODS',
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
            console.log(`  Columns: ${Object.keys(json.result.data[0]).slice(0, 12).join(', ')}`);
            results[testCase.category].push({
              name,
              columns: Object.keys(json.result.data[0]),
              sample: json.result.data[0]
            });
          }
        } catch(e) {
          // Silent
        }
        
        completed++;
        if (completed === totalTests) {
          console.log('\n=== SUMMARY ===');
          Object.keys(results).forEach(category => {
            if (results[category].length > 0) {
              console.log(`\n${category}:`);
              results[category].forEach(r => {
                console.log(`  ✓ ${r.name}`);
                console.log(`    Columns: ${r.columns.slice(0, 10).join(', ')}...`);
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
