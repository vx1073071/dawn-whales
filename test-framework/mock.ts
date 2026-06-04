/**
 * QMock - Mock/spy functions (standalone, no Jest/Vitest dependency)
 * Q44: 测试框架自建
 *
 * Usage:
 *   const fn = qmock(fn)
 *   const fn = qmockImplementation(fn)
 *   const spy = qmockSpyOn(obj, 'method')
 *   qmockRestoreAll()
 *
 * Compatible API with jest.fn() / vi.fn()
 */

import { stringify } from './expect.js';
import type { MockFunction, MockCall, MockResult, MockMetadata } from './types.js';

// ============ Internal State ============

const allMocks: Array<{ restore: () => void }> = [];

let callCounter = 0;

// ============ Mock Function Implementation ============

interface InternalMockState<T extends (...args: unknown[]) => unknown> {
  implementation: T | null;
  onceImplementations: T[];
  returnValues: unknown[];
  onceReturnValues: unknown[];
  resolvedValues: unknown[];
  onceResolvedValues: unknown[];
  rejectedValues: unknown[];
  onceRejectedValues: unknown[];
  instances: unknown[];
  callResults: Array<{ type: 'return' | 'throw'; value: unknown }>;
  defaultReturnValue: unknown;
  defaultThrowValue: unknown;
  isMocked: boolean;
}

function createMockFunction<T extends (...args: unknown[]) => unknown>(
  initialImpl?: T
): MockFunction<T> {
  const state: InternalMockState<T> = {
    implementation: initialImpl ?? null,
    onceImplementations: [],
    returnValues: [],
    onceReturnValues: [],
    resolvedValues: [],
    onceResolvedValues: [],
    rejectedValues: [],
    onceRejectedValues: [],
    instances: [],
    callResults: [],
    defaultReturnValue: undefined,
    defaultThrowValue: undefined,
    isMocked: false,
  };

  const metadata: MockMetadata = {
    name: 'qmock',
    mockName: 'qmock',
    calls: [],
    instances: [],
    invocationCallOrder: [],
    results: [],
  };

  const mockFn = function (this: unknown, ...args: unknown[]): unknown {
    const timestamp = Date.now(); // use Date.now for mock
    callCounter++;
    const currentCallOrder = callCounter;
    metadata.invocationCallOrder.push(currentCallOrder);

    // Determine which implementation to use
    let result: { type: 'return' | 'throw'; value: unknown };

    // 1. onceImplementation (highest priority)
    if (state.onceImplementations.length > 0) {
      const onceImpl = state.onceImplementations.shift()!;
      try {
        const ret = onceImpl.apply(this, args);
        result = { type: 'return', value: ret };
      } catch (e) {
        result = { type: 'throw', value: e };
      }
    }
    // 2. returnValueOnce
    else if (state.onceReturnValues.length > 0) {
      result = { type: 'return', value: state.onceReturnValues.shift() };
    }
    // 3. resolvedValueOnce
    else if (state.onceResolvedValues.length > 0) {
      result = { type: 'return', value: Promise.resolve(state.onceResolvedValues.shift()) };
    }
    // 4. rejectedValueOnce
    else if (state.onceRejectedValues.length > 0) {
      result = { type: 'return', value: Promise.reject(state.onceRejectedValues.shift()) };
    }
    // 5. implementation (set by setImplementation)
    else if (state.implementation) {
      try {
        const ret = state.implementation.apply(this, args);
        result = { type: 'return', value: ret };
      } catch (e) {
        result = { type: 'throw', value: e };
      }
    }
    // 6. returnValues queue
    else if (state.returnValues.length > 0) {
      result = { type: 'return', value: state.returnValues.shift() };
    }
    // 7. defaultReturnValue
    else if (state.defaultReturnValue !== undefined) {
      result = { type: 'return', value: state.defaultReturnValue };
    }
    // 8. defaultThrowValue
    else if (state.defaultThrowValue !== undefined) {
      result = { type: 'throw', value: state.defaultThrowValue };
    }
    // 9. fallback: return undefined
    else {
      result = { type: 'return', value: undefined };
    }

    // Record call
    const call: MockCall = {
      args,
      timestamp,
      isThrow: result.type === 'throw',
    };
    if (result.type === 'return') {
      call.returnValue = result.value;
    } else {
      call.thrownValue = result.value;
    }
    metadata.calls.push(call);

    // Record result
    metadata.results.push({
      type: result.type,
      value: result.value,
    });

    metadata.instances.push(this);

    // Execute
    if (result.type === 'throw') {
      throw result.value;
    }
    return result.value;
  };

  // Attach mock metadata
  (mockFn as any)._isQMock = true;
  (mockFn as any).mock = metadata;
  (mockFn as any).mockName = (n: string) => {
    metadata.mockName = n;
    metadata.name = n;
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).getMockName = () => metadata.mockName;
  (mockFn as any).mockImplementation = (fn: T) => {
    state.implementation = fn;
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).mockImplementationOnce = (fn: T) => {
    state.onceImplementations.push(fn);
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).mockReturnValue = (val: ReturnType<T>) => {
    state.defaultReturnValue = val;
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).mockReturnValueOnce = (val: ReturnType<T>) => {
    state.onceReturnValues.push(val);
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).mockResolvedValue = (val: Awaited<ReturnType<T>>) => {
    state.defaultReturnValue = Promise.resolve(val);
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).mockResolvedValueOnce = (val: Awaited<ReturnType<T>>) => {
    state.onceResolvedValues.push(val);
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).mockRejectedValue = (err: unknown) => {
    state.defaultThrowValue = err;
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).mockRejectedValueOnce = (err: unknown) => {
    state.onceRejectedValues.push(err);
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).mockReturnThis = () => {
    state.implementation = ((function (this: unknown) { return this; }) as any) as T;
    return mockFn as MockFunction<T>;
  };
  (mockFn as any).withImplementation = (fn: T, cb: () => void) => {
    const prev = state.implementation;
    state.implementation = fn;
    try {
      cb();
    } finally {
      state.implementation = prev;
    }
  };
  (mockFn as any).getMockImplementation = () => {
    return state.implementation ?? undefined;
  };
  (mockFn as any).mockRestore = () => {
    // no-op for plain mock (only meaningful for spy)
  };
  (mockFn as any).restoreMocks = () => {
    metadata.calls = [];
    metadata.instances = [];
    metadata.invocationCallOrder = [];
    metadata.results = [];
    state.onceImplementations = [];
    state.onceReturnValues = [];
    state.onceResolvedValues = [];
    state.onceRejectedValues = [];
  };

  // Register for restoreAllMocks
  allMocks.push({ restore: () => { (mockFn as any).restoreMocks(); } });

  return mockFn as MockFunction<T>;
}

// ============ qmock() ============

/**
 * Create a mock function.
 * qmock() -> fn()
 * qmock(impl) -> fn with implementation
 */
export function qmock<T extends (...args: unknown[]) => unknown>(
  implementation?: T
): MockFunction<T> {
  return createMockFunction(implementation);
}

// ============ qmockSpyOn() ============

const spyRegistry = new WeakMap<object, Map<string | symbol, PropertyDescriptor | null>>();

export function qmockSpyOn<T extends object, M extends keyof T>(
  obj: T,
  methodName: M,
  accessType?: 'get' | 'set'
): MockFunction<T[M] extends (...args: unknown[]) => unknown ? T[M] : never> {
  if (obj === null || obj === undefined) {
    throw new Error(`Cannot spyOn on a primitive value: ${String(obj)}`);
  }

  const prop = methodName as string;
  const original = (obj as any)[prop];

  if (typeof original !== 'function' && !accessType) {
    throw new Error(
      `Cannot spy on ${prop}: it is not a function. ` +
      `Use qmockSpyOn(obj, '${String(prop)}', 'get'|'set') for accessors.`
    );
  }

  // Save original for restore
  if (!spyRegistry.has(obj)) {
    spyRegistry.set(obj, new Map());
  }
  const objSpies = spyRegistry.get(obj)!;
  if (!objSpies.has(methodName as string | symbol)) {
    objSpies.set(methodName as string | symbol, Object.getOwnPropertyDescriptor(obj, prop) ?? null);
  }

  const mockFn = qmock(original?.bind?.(obj));

  // Replace with mock
  if (accessType === 'get') {
    Object.defineProperty(obj, prop, {
      get: () => mockFn,
      configurable: true,
      enumerable: true,
    });
  } else if (accessType === 'set') {
    Object.defineProperty(obj, prop, {
      set: mockFn as any,
      configurable: true,
      enumerable: true,
    });
  } else {
    (obj as any)[prop] = mockFn;
  }

  // Attach restore
  (mockFn as any).mockRestore = () => {
    const saved = objSpies.get(methodName as string | symbol);
    if (saved !== undefined) {
      if (saved === null) {
        delete (obj as any)[prop];
      } else {
        Object.defineProperty(obj, prop, saved);
      }
      objSpies.delete(methodName as string | symbol);
    }
  };

  return mockFn as any;
}

// ============ qmockClearAllMocks / qmockRestoreAllMocks ============

export function qmockClearAllMocks(): void {
  for (const { restore } of allMocks) {
    restore();
  }
}

export function qmockResetAllMocks(): void {
  qmockClearAllMocks();
  // Also reset implementations
  for (const m of allMocks) {
    // resetAllMocks: clear calls + reset implementation to default
    // (implementation stays, just calls cleared)
  }
}

export function qmockRestoreAllMocks(): void {
  for (const m of allMocks) {
    m.restore();
  }
  allMocks.length = 0;
  spyRegistry = new WeakMap(); // reset spy registry
}

// ============ Autoload for globals ============

export function setupGlobals(globalObj: any = globalThis): void {
  globalObj.qmock = qmock;
  globalObj.qmockSpyOn = qmockSpyOn;
  globalObj.qmockClearAllMocks = qmockClearAllMocks;
  globalObj.qmockResetAllMocks = qmockResetAllMocks;
  globalObj.qmockRestoreAllMocks = qmockRestoreAllMocks;
}

// Re-export for import style
export default qmock;
