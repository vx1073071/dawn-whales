with open('tests/jvs-e2e-validation.test.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find process.exit
for i, line in enumerate(lines):
    if 'process.exit(failed > 0 ? 1 : 0)' in line:
        print(f"process.exit at line {i+1}")
        idx = i
        break

# Cut BEFORE process.exit (idx), add vitest describe
clean = lines[:idx]
clean.append('\ndescribe("JVS E2E Validation Suite", () => {\n')
clean.append('  it("runs all E2E tests", async () => { await runAllTests(); });\n')
clean.append('});\n')

with open('tests/jvs-e2e-validation.test.ts', 'w', encoding='utf-8') as f:
    f.writelines(clean)
print(f"Done: {len(clean)} lines")