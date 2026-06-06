with open('tests/jvs-e2e-validation.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace process.exit(failed > 0 ? 1 : 0); with return (so vitest can continue)
content = content.replace(
    'process.exit(failed > 0 ? 1 : 0);\n\ndescribe("JVS E2E Validation Suite"',
    'return;\n}\n\ndescribe("JVS E2E Validation Suite"'
)

# Also replace the standalone process.exit(1); at the end
content = content.replace(
    '  process.exit(1);\n});',
    '  if (failed > 0) throw new Error(`${failed} sub-tests failed`);\n});'
)

with open('tests/jvs-e2e-validation.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")