// Mock ws module for vitest
import { EventEmitter } from 'events';

class MockWebSocketServer extends EventEmitter {
  constructor(_options?: any) {
    super();
  }
  close() {
    this.emit('close');
  }
}

class MockWebSocket extends EventEmitter {
  static Server = MockWebSocketServer;
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 1; // OPEN
  
  send(_data: any) {}
  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }
  ping() {}
}

export default MockWebSocket;
export const Server = MockWebSocketServer;
export const OPEN = 1;
export const CLOSED = 3;
