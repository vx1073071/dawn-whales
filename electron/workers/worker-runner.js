// ── QUANT MOO — Worker Runner ────────────────────────────────────────────
// Runs inside worker_threads, loads the target module and executes

const { parentPort, workerData } = require('worker_threads');
const path = require('path');

// Handler registry — maps module name to handler function
const handlers = new Map();

parentPort?.on('message', async (msg) => {
  const { taskId, module, data } = msg;
  
  try {
    // Dynamically load the target module
    let handler = handlers.get(module);
    if (!handler) {
      const mod = require(path.resolve(__dirname, '..', module));
      handler = mod.default || mod.execute || mod.handler;
      handlers.set(module, handler);
    }
    
    if (typeof handler !== 'function') {
      throw new Error(`Module ${module} does not export a default function`);
    }
    
    const result = await handler(data);
    parentPort?.postMessage({ taskId, data: result });
  } catch (err) {
    parentPort?.postMessage({
      taskId,
      error: err.message || 'Unknown worker error',
    });
  }
});

parentPort?.postMessage({ ready: true, id: workerData?.id });
