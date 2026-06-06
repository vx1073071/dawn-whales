/**
 * Mobile Data Adapter (JVS-42-02)
 *
 * Lightweight data adapter for mobile devices with push notifications,
 * data compression, and bandwidth optimization.
 */

import log from 'electron-log';

// ============================================================================
// Inline EventEmitter Polyfill
// ============================================================================

type EventListener = (...args: any[]) => void;

class SimpleEventEmitter {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      this._listeners.set(
        event,
        list.filter((fn) => fn !== listener)
      );
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapped: EventListener = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        log.error('[EventEmitter] Listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types
// ============================================================================

export type PushPriority = 'high' | 'normal' | 'low';
export type DataCategory = 'quote' | 'position' | 'order' | 'alert' | 'analytics';
export type ConnectionType = 'wifi' | 'cellular' | 'unknown';
export type CompressionLevel = 'none' | 'light' | 'medium' | 'heavy';

export interface MobileDevice {
  id: string;
  platform: 'ios' | 'android' | 'web';
  model?: string;
  osVersion?: string;
  appVersion?: string;
  pushToken?: string;
  connectionType: ConnectionType;
  bandwidthKbps: number;
  lastSeen: number;
  enabled: boolean;
}

export interface PushNotification {
  id: string;
  deviceId: string;
  category: DataCategory;
  priority: PushPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: number;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  delivered: boolean;
  deliveredAt?: number;
}

export interface BandwidthStats {
  totalBytesSent: number;
  totalBytesReceived: number;
  averageBandwidthKbps: number;
  peakBandwidthKbps: number;
  compressionRatio: number;
  notificationsSent: number;
  notificationsFailed: number;
  lastUpdated: number;
}

export interface DataPayload {
  category: DataCategory;
  data: any;
  timestamp: number;
  priority: PushPriority;
}

// ============================================================================
// MobileDataAdapter
// ============================================================================

export class MobileDataAdapter extends SimpleEventEmitter {
  private devices: Map<string, MobileDevice> = new Map();
  private notifications: PushNotification[] = [];
  private maxNotifications: number;
  private compressionLevel: CompressionLevel;
  private bandwidthStats: BandwidthStats;

  constructor(maxNotifications: number = 1000, compressionLevel: CompressionLevel = 'medium') {
    super();
    this.maxNotifications = maxNotifications;
    this.compressionLevel = compressionLevel;
    this.bandwidthStats = {
      totalBytesSent: 0,
      totalBytesReceived: 0,
      averageBandwidthKbps: 0,
      peakBandwidthKbps: 0,
      compressionRatio: 1.0,
      notificationsSent: 0,
      notificationsFailed: 0,
      lastUpdated: Date.now(),
    };
    log.info('[MobileDataAdapter] Initialized with compression:', compressionLevel);
  }

  // --------------------------------------------------------------------------
  // Device Management
  // --------------------------------------------------------------------------

  /**
   * Register a mobile device
   */
  registerDevice(device: MobileDevice): boolean {
    if (this.devices.has(device.id)) {
      log.warn(`[MobileDataAdapter] Device ${device.id} already registered`);
      return false;
    }

    // Create a copy to avoid modifying the original object
    const deviceCopy = { ...device };
    this.devices.set(device.id, deviceCopy);
    log.info(`[MobileDataAdapter] Device registered: ${device.id} (${device.platform})`);
    this.emit('device-registered', device.id);

    return true;
  }

  /**
   * Unregister a mobile device
   */
  unregisterDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      log.warn(`[MobileDataAdapter] Device ${deviceId} not found`);
      return false;
    }

    this.devices.delete(deviceId);
    log.info(`[MobileDataAdapter] Device unregistered: ${deviceId}`);
    this.emit('device-unregistered', deviceId);

    return true;
  }

  /**
   * Update device connection info
   */
  updateDeviceConnection(
    deviceId: string,
    connectionType: ConnectionType,
    bandwidthKbps: number
  ): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      log.warn(`[MobileDataAdapter] Device ${deviceId} not found`);
      return false;
    }

    device.connectionType = connectionType;
    device.bandwidthKbps = bandwidthKbps;
    device.lastSeen = Date.now();

    this.bandwidthStats.averageBandwidthKbps = 
      (this.bandwidthStats.averageBandwidthKbps + bandwidthKbps) / 2;
    this.bandwidthStats.peakBandwidthKbps = Math.max(
      this.bandwidthStats.peakBandwidthKbps,
      bandwidthKbps
    );
    this.bandwidthStats.lastUpdated = Date.now();

    log.info(`[MobileDataAdapter] Device ${deviceId} connection updated: ${connectionType} @ ${bandwidthKbps}kbps`);
    this.emit('device-updated', deviceId);

    return true;
  }

  /**
   * Update device push token
   */
  updatePushToken(deviceId: string, pushToken: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      log.warn(`[MobileDataAdapter] Device ${deviceId} not found`);
      return false;
    }

    device.pushToken = pushToken;
    device.lastSeen = Date.now();

    log.info(`[MobileDataAdapter] Device ${deviceId} push token updated`);
    this.emit('device-updated', deviceId);

    return true;
  }

  /**
   * Enable/disable a device
   */
  setDeviceEnabled(deviceId: string, enabled: boolean): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      log.warn(`[MobileDataAdapter] Device ${deviceId} not found`);
      return false;
    }

    device.enabled = enabled;
    device.lastSeen = Date.now();

    log.info(`[MobileDataAdapter] Device ${deviceId} ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('device-updated', deviceId);

    return true;
  }

  /**
   * Get a device by ID
   */
  getDevice(deviceId: string): MobileDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get all devices
   */
  getAllDevices(): MobileDevice[] {
    return Array.from(this.devices.values());
  }

  // --------------------------------------------------------------------------
  // Push Notifications
  // --------------------------------------------------------------------------

  /**
   * Send push notification to a device
   */
  sendNotification(
    deviceId: string,
    category: DataCategory,
    priority: PushPriority,
    title: string,
    message: string,
    data?: Record<string, any>
  ): PushNotification | null {
    const device = this.devices.get(deviceId);
    if (!device) {
      log.warn(`[MobileDataAdapter] Device ${deviceId} not found`);
      return null;
    }

    if (!device.enabled) {
      log.warn(`[MobileDataAdapter] Device ${deviceId} is disabled`);
      return null;
    }

    if (!device.pushToken) {
      log.warn(`[MobileDataAdapter] Device ${deviceId} has no push token`);
      this.bandwidthStats.notificationsFailed++;
      return null;
    }

    // Check bandwidth constraints
    const shouldCompress = this.shouldCompress(device, priority);
    const payload: DataPayload = {
      category,
      data: data || {},
      timestamp: Date.now(),
      priority,
    };

    const originalSize = JSON.stringify(payload).length;
    const compressedData = shouldCompress ? this.compressData(payload) : payload;
    const compressedSize = JSON.stringify(compressedData).length;

    const notification: PushNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deviceId,
      category,
      priority,
      title,
      message,
      data: compressedData,
      timestamp: Date.now(),
      compressed: shouldCompress,
      originalSize,
      compressedSize,
      delivered: true,
      deliveredAt: Date.now(),
    };

    this.notifications.push(notification);

    // Trim notifications if exceeding max
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(-this.maxNotifications);
    }

    // Update bandwidth stats
    this.bandwidthStats.totalBytesSent += compressedSize;
    this.bandwidthStats.notificationsSent++;
    this.bandwidthStats.compressionRatio = 
      this.bandwidthStats.totalBytesSent / 
      (this.bandwidthStats.totalBytesSent + (shouldCompress ? originalSize - compressedSize : 0));
    this.bandwidthStats.lastUpdated = Date.now();

    log.info(`[MobileDataAdapter] Notification sent to ${deviceId}: ${title}`);
    this.emit('notification-sent', notification);

    return notification;
  }

  /**
   * Broadcast notification to all enabled devices
   */
  broadcastNotification(
    category: DataCategory,
    priority: PushPriority,
    title: string,
    message: string,
    data?: Record<string, any>
  ): PushNotification[] {
    const notifications: PushNotification[] = [];

    for (const device of this.devices.values()) {
      if (device.enabled && device.pushToken) {
        const notification = this.sendNotification(
          device.id,
          category,
          priority,
          title,
          message,
          data
        );
        if (notification) {
          notifications.push(notification);
        }
      }
    }

    return notifications;
  }

  /**
   * Get notifications for a device
   */
  getDeviceNotifications(deviceId: string, limit?: number): PushNotification[] {
    const deviceNotifs = this.notifications.filter((n) => n.deviceId === deviceId);
    return limit ? deviceNotifs.slice(-limit) : deviceNotifs;
  }

  /**
   * Get all notifications
   */
  getAllNotifications(limit?: number): PushNotification[] {
    return limit ? this.notifications.slice(-limit) : this.notifications;
  }

  /**
   * Clear notifications for a device
   */
  clearDeviceNotifications(deviceId: string): number {
    const before = this.notifications.length;
    this.notifications = this.notifications.filter((n) => n.deviceId !== deviceId);
    const cleared = before - this.notifications.length;

    log.info(`[MobileDataAdapter] Cleared ${cleared} notifications for device ${deviceId}`);
    return cleared;
  }

  // --------------------------------------------------------------------------
  // Data Compression
  // --------------------------------------------------------------------------

  /**
   * Check if data should be compressed based on device and priority
   */
  private shouldCompress(device: MobileDevice, priority: PushPriority): boolean {
    if (this.compressionLevel === 'none') return false;
    if (priority === 'high') return false; // Don't compress high priority
    if (device.connectionType === 'wifi') return this.compressionLevel === 'heavy';
    if (device.connectionType === 'cellular') return true;
    return this.compressionLevel !== 'none';
  }

  /**
   * Compress data payload
   */
  private compressData(payload: DataPayload): any {
    // Simple compression: remove null/undefined values and shorten keys
    const compressed: any = {
      c: payload.category,
      t: payload.timestamp,
      p: payload.priority,
      d: this.minifyObject(payload.data),
    };
    return compressed;
  }

  /**
   * Minify object by removing null values and shortening keys
   */
  private minifyObject(obj: any): any {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.minifyObject(item));

    const minified: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        minified[key] = this.minifyObject(value);
      }
    }
    return minified;
  }

  // --------------------------------------------------------------------------
  // Bandwidth Management
  // --------------------------------------------------------------------------

  /**
   * Get bandwidth statistics
   */
  getBandwidthStats(): BandwidthStats {
    return { ...this.bandwidthStats };
  }

  /**
   * Set compression level
   */
  setCompressionLevel(level: CompressionLevel): void {
    this.compressionLevel = level;
    log.info(`[MobileDataAdapter] Compression level set to: ${level}`);
  }

  /**
   * Reset bandwidth statistics
   */
  resetBandwidthStats(): void {
    this.bandwidthStats = {
      totalBytesSent: 0,
      totalBytesReceived: 0,
      averageBandwidthKbps: 0,
      peakBandwidthKbps: 0,
      compressionRatio: 1.0,
      notificationsSent: 0,
      notificationsFailed: 0,
      lastUpdated: Date.now(),
    };
    log.info('[MobileDataAdapter] Bandwidth stats reset');
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Destroy the adapter and clean up
   */
  destroy(): void {
    this.devices.clear();
    this.notifications = [];
    this.removeAllListeners();
    log.info('[MobileDataAdapter] Destroyed');
    this.emit('destroyed');
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalDevices: number;
    activeDevices: number;
    totalNotifications: number;
    compressionRatio: number;
  } {
    const devices = this.getAllDevices();
    return {
      totalDevices: devices.length,
      activeDevices: devices.filter((d) => d.enabled).length,
      totalNotifications: this.notifications.length,
      compressionRatio: this.bandwidthStats.compressionRatio,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createMobileDataAdapter(
  maxNotifications?: number,
  compressionLevel?: CompressionLevel
): MobileDataAdapter {
  return new MobileDataAdapter(maxNotifications, compressionLevel);
}

export default MobileDataAdapter;
