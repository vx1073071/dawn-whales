// JVS-42-02: MobileDataAdapter Tests
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MobileDataAdapter,
  type MobileDevice,
  type PushNotification,
} from '../electron/engine/mobile-data-adapter';

describe('MobileDataAdapter', () => {
  let adapter: MobileDataAdapter;

  beforeEach(() => {
    adapter = new MobileDataAdapter();
  });

  describe('Device Management', () => {
    it('should register device', () => {
      const device: MobileDevice = {
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      };
      expect(adapter.registerDevice(device)).toBe(true);
      expect(adapter.getDevice('dev-1')).toBeDefined();
    });

    it('should not register duplicate device', () => {
      const device: MobileDevice = {
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      };
      adapter.registerDevice(device);
      expect(adapter.registerDevice(device)).toBe(false);
    });

    it('should unregister device', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      expect(adapter.unregisterDevice('dev-1')).toBe(true);
      expect(adapter.getDevice('dev-1')).toBeUndefined();
    });

    it('should get all devices', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      adapter.registerDevice({
        id: 'dev-2',
        name: 'Samsung S24',
        platform: 'android',
        pushToken: 'token-456',
        enabled: true,
        lastSeen: Date.now(),
      });
      expect(adapter.getAllDevices()).toHaveLength(2);
    });
  });

  describe('Device Connection', () => {
    it('should update device connection', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      expect(adapter.updateDeviceConnection('dev-1', 'wifi')).toBe(true);
    });

    it('should update push token', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      expect(adapter.updatePushToken('dev-1', 'new-token')).toBe(true);
    });

    it('should set device enabled', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      expect(adapter.setDeviceEnabled('dev-1', false)).toBe(true);
    });
  });

  describe('Push Notifications', () => {
    it('should send notification', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      const notification = adapter.sendNotification(
        'dev-1',
        'alert',
        'normal',
        'Test Alert',
        'This is a test notification',
        { type: 'alert', value: 123 }
      );
      expect(notification).toBeDefined();
    });

    it('should send broadcast', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      adapter.registerDevice({
        id: 'dev-2',
        name: 'Samsung S24',
        platform: 'android',
        pushToken: 'token-456',
        enabled: true,
        lastSeen: Date.now(),
      });
      const notifications = adapter.broadcastNotification(
        'alert',
        'normal',
        'Broadcast',
        'Broadcast message'
      );
      expect(notifications).toHaveLength(2);
    });
  });

  describe('Compression', () => {
    it('should set compression level', () => {
      adapter.setCompressionLevel('heavy');
      // No error means success
      expect(true).toBe(true);
    });

    it('should get bandwidth stats', () => {
      const stats = adapter.getBandwidthStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalBytesSent).toBe('number');
    });
  });

  describe('Stats', () => {
    it('should get stats', () => {
      const stats = adapter.getStats();
      expect(stats).toBeDefined();
    });

    it('should get bandwidth stats', () => {
      const stats = adapter.getBandwidthStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalBytesSent).toBe('number');
    });
  });

  describe('Notifications Management', () => {
    it('should get device notifications', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      adapter.sendNotification(
        'dev-1',
        'alert',
        'normal',
        'Test',
        'Test message'
      );
      const notifications = adapter.getDeviceNotifications('dev-1');
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should get all notifications', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      adapter.sendNotification(
        'dev-1',
        'alert',
        'normal',
        'Test',
        'Test message'
      );
      const notifications = adapter.getAllNotifications();
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should clear device notifications', () => {
      adapter.registerDevice({
        id: 'dev-1',
        name: 'iPhone 15',
        platform: 'ios',
        pushToken: 'token-123',
        enabled: true,
        lastSeen: Date.now(),
      });
      adapter.sendNotification(
        'dev-1',
        'alert',
        'normal',
        'Test',
        'Test message'
      );
      const cleared = adapter.clearDeviceNotifications('dev-1');
      expect(cleared).toBeGreaterThan(0);
    });
  });
});
