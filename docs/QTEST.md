<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# QTest Documentation

> Custom test framework for TradingEasy — no Jest/Vitest dependency required.
> Location: `test-framework/`

## Quick Start

```js
// my.test.js
const { expect, describe, it, test } = require('./qtest.js');

describe('MyModule', () => {
  it('should add numbers', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async', async () => {
    await expect(Promise.resolve(42)).resolves.toBe(42);
  });
});
```

Run: `node qtest.js my.test.js` or `node parallel-runner.js --files "*.test.js" --workers 4`

---

## Core API

### `expect(value)`

Creates an expectation object.

```js
expect(2 + 2).toBe(4);
expect('hello').toContain('ell');
expect(() => throw new Error('boom')).toThrow();
```

### `.not`

Negates any matcher:

```js
expect(2 + 2).not.toBe(5);
expect([1, 2, 3]).not.toContain(5);
```

### `.resolves`

Unwraps a resolved Promise:

```js
await expect(Promise.resolve('hello')).resolves.toBe('hello');
```

### `.rejects`

Unwraps a rejected Promise:

```js
await expect(Promise.reject(new Error('fail'))).rejects.toThrow();
```

### `expect.soft(value)`

Non-fatal assertion — continues after failure (useful for enum checks):

```js
expect.soft(status).toBeOneOf(['pending', 'active', 'done']);
```

---

## Synchronous Matchers

| Matcher | Description |
|---------|-------------|
| `.toBe(expected)` | Strict equality (`Object.is`) |
| `.toEqual(expected)` | Deep equality (objects, arrays, dates, regex) |
| `.toContain(item)` | Array contains item, or string contains substring |
| `.toThrow(expected?)` | Function throws; optionally check message |
| `.toMatch(regex)` | String matches regex |
| `.toHaveLength(n)` | Array has length `n` |
| `.toHaveProperty(path, value?)` | Object has property (dot-notation path) |
| `.toBeTruthy()` | Value is truthy |
| `.toBeFalsy()` | Value is falsy |
| `.toBeNull()` | Value is `null` |
| `.toBeUndefined()` | Value is `undefined` |
| `.toBeDefined()` | Value is not `undefined` |
| `.toBeTypeOf(type)` | `typeof` matches |
| `.toBeGreaterThan(n)` | Number comparison |
| `.toBeLessThan(n)` | Number comparison |
| `.toBeGreaterThanOrEqual(n)` | |
| `.toBeLessThanOrEqual(n)` | |
| `.toBeCloseTo(n, precision?)` | Floating-point comparison (default precision=2) |
| `.toBeInstanceOf(Class)` | `instanceof` check |

---

## Async Matchers

Used with `await expect(promise)`:

| Matcher | Description |
|---------|-------------|
| `.resolves.toBe(expected)` | Promise resolves to value |
| `.resolves.toEqual(expected)` | Deep equality |
| `.resolves.toContain(item)` | Resolved array contains item |
| `.rejects.toThrow(expected?)` | Promise rejects with error |

---

## Object Matchers

```js
// Deep equality
expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });

// Property check
expect({ name: 'Alice', age: 30 }).toHaveProperty('name');
expect({ user: { profile: { age: 30 } } }).toHaveProperty('user.profile.age', 30);

// Array contains
expect([1, 2, 3]).toContain(2);
expect(['apple', 'banana']).toContain('banana');
```

---

## Error/Throw Matchers

```js
// Check that function throws
expect(() => JSON.parse('invalid')).toThrow();
expect(() => JSON.parse('{"a":1}')).not.toThrow();

// Check error message
expect(() => { throw new Error('DB connection failed'); }).toThrow('DB connection');

// Regex match on error
expect(() => { throw new Error('Timeout after 3000ms'); }).toThrow(/timeout/i);
```

---

## String Matchers

```js
expect('Hello World').toContain('World');
expect('test@example.com').toMatch(/^\w+@\w+\.\w+$/);
```

---

## Number Matchers

```js
expect(10).toBeGreaterThan(5);
expect(3.14159).toBeCloseTo(3.14, 2);  // precision=2 decimal places
expect(100).toBeLessThanOrEqual(100);
```

---

## Asymmetric Matchers

```js
expect({ name: 'Alice', age: 30, city: 'NYC' })
  .toEqual(expect.objectContaining({ name: 'Alice', age: 30 }));
```

---

## Architecture

```
qtest.js              # Main entry — exports expect/describe/it/test/run
qtest-report.txt      # Last run report (appended)
parallel-runner.ts    # Multi-worker test runner
core.ts               # Test runner core (describe/it/TestSuite/TestCase)
expect.ts             # Assertion library + matchers
isolation.ts          # VM sandbox for untrusted code
mutation.js           # Mutation testing
types.ts              # TypeScript interfaces
```

### File Structure

- **`core.ts`**: `describe()`, `it()`, `test()`, `TestSuite`, `TestCase`, `run()` — orchestrates test execution, collects results, writes `qtest-report.txt`
- **`expect.ts`**: `expect()`, `Expect`, `makeMatcher()`, `stringify()`, `getDeepEquality()`, `getDeepDiff()` — all assertion logic
- **`isolation.ts`**: `runInSandbox(code, options)` — runs code in VM2 sandbox with timeout, sandboxed globals, and error capture
- **`qtest.js`**: Combines all modules, configures VM globals, loads test files

### Key Implementation Details

#### Double-negation fix (critical)

The `.not` getter creates a **new** negated `Expect` object instead of toggling a flag:

```js
// In expect.ts
get not(): Expect {
  return createExpect(this._received, { not: true });  // always true, not !config.not
}
```

This prevents the double-negation bug where `.not.toBe()` would call the negated matcher function (already inverted) → then `makeMatcher` would invert again → wrong result.

#### `.resolves` and `.rejects`

```js
get resolves(): Promise<Expect> {
  return Promise.resolve(this._received).then(v => createExpect(v, this._config));
}
get rejects(): Promise<Expect> {
  return Promise.resolve(this._received).catch(e => createExpect(e, { ...this._config, isRejects: true }));
}
```

#### Deep equality

`toEqual` uses recursive deep comparison supporting: primitives, `null`, `Date` (by time), `RegExp` (by string), arrays, and plain objects.

#### Stringification

`stringify()` handles: `undefined`, `null`, strings (quoted), bigint (`n` suffix), functions (`[Function: name]`), symbols, circular JSON.

---

## Running Tests

```bash
# Single file
node qtest.js tests/my.test.js

# Parallel (TypeScript)
npx tsx parallel-runner.ts --files "tests/**/*.test.ts" --workers 4

# With coverage (manual)
node -e "
  const { run } = require('./qtest.js');
  run(['tests/my.test.js'], { reporter: 'verbose' });
"
```

---

## CLI Options

```bash
node qtest.js <files...>              # Run test files
node qtest.js --reporter=verbose      # Verbose output
node qtest.js --reporter=json         # JSON output
node qtest.js --timeout=5000          # Test timeout (ms)
```

---

## Report Format

`qtest-report.txt` is appended after each run:

```
=== QTest Report: 2026-06-05 22:08:41 ===
Duration: 1.23s
Total: 15 | Passed: 15 | Failed: 0
Status: ✅ ALL PASSED
```

---

## Migration Notes

When migrating from Vitest to QTest:

1. `describe`/`it`/`test`/`expect` are API-compatible
2. `beforeEach`/`afterEach`/`beforeAll`/`afterAll` hooks are supported
3. `vi.fn()` mocks → use `jest.fn()` shim or manual mocks
4. `vi.mock()` → use `jest.mock()` shim or `require()` mocks
5. Async tests: `async/await` works the same way
6. Skipped tests: `it.skip()` and `describe.skip()` are supported

Vitest-specific globals (`describe`, `it`, `expect`) can be injected by running tests via `qtest.js` which sets up the global scope.
