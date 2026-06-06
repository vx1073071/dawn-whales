with open('tests/jvs-integration.test.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep lines 0-420 (through process.exit line), add clean vitest describe
clean = lines[:421]
clean.append('\ndescribe("JVS Integration Suite", () => {\n')
clean.append('  it("runs JVS-3 SentimentIndex", async () => { await testSentimentIndex(); });\n')
clean.append('  it("runs JVS-7 AnomalyDetector", async () => { await testAnomalyDetector(); });\n')
clean.append('  it("runs JVS-6 SectorRotation", async () => { await testSectorRotation(); });\n')
clean.append('  it("runs JVS-5 NewsAggregator", async () => { await testNewsAggregator(); });\n')
clean.append('  it("runs JVS-12 CapitalFlowMonitor", async () => { await testCapitalFlowMonitor(); });\n')
clean.append('  it("runs JVS-15 PortfolioRisk", async () => { await testPortfolioRisk(); });\n')
clean.append('  it("runs JVS-14 StockDiagnosis", async () => { await testStockDiagnosis(); });\n')
clean.append('});\n')

with open('tests/jvs-integration.test.ts', 'w', encoding='utf-8') as f:
    f.writelines(clean)
print(f'Done: {len(clean)} lines')