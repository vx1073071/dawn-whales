// Worker for benchmark tasks
import { parentPort } from 'worker_threads';

function fib(n: number): number {
  return n <= 1 ? n : fib(n - 1) + fib(n - 2);
}

function matrixMultiply(size: number): number {
  const a = Array.from({ length: size }, () => 
    Array.from({ length: size }, () => Math.random()));
  const b = Array.from({ length: size }, () => 
    Array.from({ length: size }, () => Math.random()));
  const c = Array.from({ length: size }, () => new Array(size).fill(0));
  
  for (let i = 0; i < size; i++)
    for (let k = 0; k < size; k++)
      for (let j = 0; j < size; j++)
        c[i][j] += a[i][k] * b[k][j];
  
  return c[0][0]; // return sample value
}

parentPort?.on('message', (msg: unknown) => {
  const { type, n, size } = msg;
  let result: number;
  if (type === 'fib') {
    result = fib(n);
  } else if (type === 'matrix') {
    result = matrixMultiply(size);
  } else {
    throw new Error('Unknown bench type: ' + type);
  }
  parentPort?.postMessage({ result, type, id: msg.id });
});
