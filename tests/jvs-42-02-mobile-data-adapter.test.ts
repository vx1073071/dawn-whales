/**
 * Tests for Mobile Data Adapter (JVS-42-02)
 *
 * Tests mobile device management, push notifications, compression, and bandwidth optimization.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MobileDataAdapter,
  type MobileDevice,
} from '../electron/engine/data/mobile-data-adapter';

describe('MobileDataAdapter', () => {
  let adapter: MobileDataAdapter;

  const iosDevice: MobileDevice = {
    id: 'ios-1',
    platform: 'ios',
    model: 'iPhone 15',
    osVersion: '17.0',
    appVersion: '1.0.0',
    pushToken: 'ios-token-123',
    connectionType: 'wifi',
    bandwidthKbps: 10000,
    lastSeen: Date.now(),
    enabled: true,
  };

  const androidDevice: MobileDevice = {
    id: 'android-1',
    platform: 'android',
    model: 'Pixel 8',
    osVersion: '14',
    appVersion: '1.0.0',
    pushToken: 'android-token-456',
    connectionType: 'cellular',
    bandwidthKbps: 5000,
    lastSeen: Date.now(),
    enabled: true,
  };

  beforeEach(() => {
    adapter = new MobileDataAdapter(1000, 'medium');
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('Device Management', () => {
    it('should register a mobile device', () => {
      const registered = adapter.registerDevice(iosDevice);
      const device = adapter.getDevice('ios-1');

      expect(registered).toBe(true);
      expect(device?.id).toBe('ios-1');
      expect(device?.platform).toBe('ios');
      expect(device?.enabled).toBe(true);
    });

    it('should reject duplicate device registration', () => {
      adapter.registerDevice(iosDevice);
      const registered = adapter.registerDevice(iosDevice);

      expect(registered).toBe(false);
    });

    it('should unregister a device', () => {
      adapter.registerDevice(iosDevice);
      const unregistered = adapter.unregisterDevice('ios-1');

      expect(unregistered).toBe(true);
      expect(adapter.getDevice('ios-1')).toBeUndefined();
    });

    it('should return false when unregistering non-existent device', () => {
      const unregistered = adapter.unregisterDevice('non-existent');
      expect(unregistered).toBe(false);
    });

    it('should update device connection info', () => {
      adapter.registerDevice(iosDevice);
      const updated = adapter.updateDeviceConnection('ios-1', 'cellular', 3000);

      const device = adapter.getDevice('ios-1');
      expect(updated).toBe(true);
      expect(device?.connectionType).toBe('cellular');
      expect(device?.bandwidthKbps).toBe(3000);
    });

    it('should update push token', () => {
      adapter.registerDevice(iosDevice);
      const updated = adapter.updatePushToken('ios-1', 'new-token-789');

      const device = adapter.getDevice('ios-1');
      expect(updated).toBe(true);
      expect(device?.pushToken).toBe('new-token-789');
    });

    it('should enable/disable device', () => {
      adapter.registerDevice(iosDevice);

      adapter.setDeviceEnabled('ios-1', false);
      expect(adapter.getDevice('ios-1')?.enabled).toBe(false);

      adapter.setDeviceEnabled('ios-1', true);
      expect(adapter.getDevice('ios-1')?.enabled).toBe(true);
    });

    it('should get all devices', () => {
      adapter.registerDevice(iosDevice);
      adapter.registerDevice(androidDevice);

      const devices = adapter.getAllDevices();
      expect(devices).toHaveLength(2);
    });
  });

  describe('Push Notifications', () => {
    it('should send notification to device', () => {
      adapter.registerDevice(iosDevice);

      const notification = adapter.sendNotification(
        'ios-1',
        'quote',
        'normal',
        'Price Alert',
        'AAPL price changed by 5%',
        { symbol: 'AAPL', change: 5 }
      );

      expect(notification).not.toBeNull();
      expect(notification?.deviceId).toBe('ios-1');
      expect(notification?.category).toBe('quote');
      expect(notification?.priority).toBe('normal');
      expect(notification?.delivered).toBe(true);
    });

    it('should reject notification to non-existent device', () => {
      const notification = adapter.sendNotification(
        'non-existent',
        'quote',
        'normal',
        'Test',
        'Test message'
      );

      expect(notification).toBeNull();
    });

    it('should reject notification to disabled device', () => {
      adapter.registerDevice(iosDevice);
      adapter.setDeviceEnabled('ios-1', false);

      const notification = adapter.sendNotification(
        'ios-1',
        'quote',
        'normal',
        'Test',
        'Test message'
      );

      expect(notification).toBeNull();
    });

    it('should reject notification to device without push token', () => {
      const deviceNoToken = { ...iosDevice, id: 'no-token', pushToken: undefined };
      adapter.registerDevice(deviceNoToken);

      const notification = adapter.sendNotification(
        'no-token',
        'quote',
        'normal',
        'Test',
        'Test message'
      );

      expect(notification).toBeNull();
    });

    it('should broadcast notification to all enabled devices', () => {
      adapter.registerDevice(iosDevice);
      adapter.registerDevice(androidDevice);

      const notifications = adapter.broadcastNotification(
        'alert',
        'high',
        'Market Alert',
        'Market is volatile',
        { market: 'S&P500' }
      );

      expect(notifications).toHaveLength(2);
    });

    it('should get notifications for device', () => {
      adapter.registerDevice(iosDevice);
      adapter.registerDevice(androidDevice);

      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test 1', 'Message 1');
      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test 2', 'Message 2');
      adapter.sendNotification('android-1', 'quote', 'normal', 'Test 3', 'Message 3');

      const iosNotifs = adapter.getDeviceNotifications('ios-1');
      expect(iosNotifs).toHaveLength(2);
    });

    it('should clear device notifications', () => {
      adapter.registerDevice(iosDevice);
      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test 1', 'Message 1');
      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test 2', 'Message 2');

      const cleared = adapter.clearDeviceNotifications('ios-1');
      expect(cleared).toBe(2);
      expect(adapter.getDeviceNotifications('ios-1')).toHaveLength(0);
    });
  });

  describe('Compression', () => {
    it('should compress data for cellular connections', () => {
      adapter.registerDevice(androidDevice); // cellular connection

      const notification = adapter.sendNotification(
        'android-1',
        'quote',
        'normal',
        'Test',
        'Test message',
        { symbol: 'AAPL', price: 150 }
      );

      expect(notification?.compressed).toBe(true);
      expect(notification?.compressedSize).toBeLessThan(notification!.originalSize);
    });

    it('should not compress high priority notifications', () => {
      adapter.registerDevice(androidDevice);

      const notification = adapter.sendNotification(
        'android-1',
        'alert',
        'high',
        'Urgent Alert',
        'Critical message',
        { level: 'critical' }
      );

      expect(notification?.compressed).toBe(false);
    });

    it('should set compression level', () => {
      adapter.setCompressionLevel('heavy');
      adapter.registerDevice(iosDevice); // wifi connection

      const notification = adapter.sendNotification(
        'ios-1',
        'quote',
        'normal',
        'Test',
        'Test message',
        { data: 'large payload' }
      );

      expect(notification?.compressed).toBe(true);
    });
  });

  describe('Bandwidth Management', () => {
    it('should track bandwidth statistics', () => {
      adapter.registerDevice(iosDevice);
      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test', 'Message', { data: 'test' });

      const stats = adapter.getBandwidthStats();
      expect(stats.totalBytesSent).toBeGreaterThan(0);
      expect(stats.notificationsSent).toBe(1);
    });

    it('should reset bandwidth stats', () => {
      adapter.registerDevice(iosDevice);
      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test', 'Message');

      adapter.resetBandwidthStats();
      const stats = adapter.getBandwidthStats();

      expect(stats.totalBytesSent).toBe(0);
      expect(stats.notificationsSent).toBe(0);
    });

    it('should update average bandwidth on device connection update', () => {
      adapter.registerDevice(iosDevice);
      adapter.updateDeviceConnection('ios-1', 'wifi', 15000);

      const stats = adapter.getBandwidthStats();
      expect(stats.averageBandwidthKbps).toBeGreaterThan(0);
      expect(stats.peakBandwidthKbps).toBe(15000);
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      adapter.registerDevice(iosDevice);
      adapter.registerDevice(androidDevice);
      adapter.setDeviceEnabled('android-1', false);

      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test', 'Message');

      const stats = adapter.getStats();
      expect(stats.totalDevices).toBe(2);
      expect(stats.activeDevices).toBe(1);
      expect(stats.totalNotifications).toBe(1);
      expect(stats.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit device-registered event', () => {
      const handler = vi.fn();
      adapter.on('device-registered', handler);

      adapter.registerDevice(iosDevice);

      expect(handler).toHaveBeenCalledWith('ios-1');
    });

    it('should emit device-unregistered event', () => {
      adapter.registerDevice(iosDevice);

      const handler = vi.fn();
      adapter.on('device-unregistered', handler);

      adapter.unregisterDevice('ios-1');

      expect(handler).toHaveBeenCalledWith('ios-1');
    });

    it('should emit notification-sent event', () => {
      adapter.registerDevice(iosDevice);

      const handler = vi.fn();
      adapter.on('notification-sent', handler);

      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test', 'Message');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should destroy adapter', () => {
      adapter.registerDevice(iosDevice);
      adapter.sendNotification('ios-1', 'quote', 'normal', 'Test', 'Message');

      adapter.destroy();

      expect(adapter.getAllDevices()).toHaveLength(0);
      expect(adapter.getAllNotifications()).toHaveLength(0);
    });
  });
});
