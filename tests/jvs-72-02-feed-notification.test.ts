// ── J-72-02 Tests: Feed + Notification Engine (8 tests) ──────────────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  FeedEngine,
  NotificationEngine,
  createFeedEngine,
  createNotificationEngine,
} from "../electron/engine/feed-notification-engine";

describe("J-72-02: Feed + Notification Engine", () => {
  let feed: FeedEngine;
  let notif: NotificationEngine;

  beforeEach(() => {
    feed = createFeedEngine();
    notif = createNotificationEngine();
  });

  // ── Feed ──────────────────────────────────────────────────────────────

  it("01: push and get feed for following", () => {
    feed.push({ type: "new_strategy", actorId: "u2", targetType: "strategy", targetId: "s1", targetSummary: "My strat" });
    feed.push({ type: "new_signal", actorId: "u3", targetType: "signal", targetId: "sig_1", targetSummary: "Buy AAPL" });

    const userFeed = feed.getFeed(["u2"]);
    expect(userFeed).toHaveLength(1);
    expect(userFeed[0].actorId).toBe("u2");

    const bothFeed = feed.getFeed(["u2", "u3"]);
    expect(bothFeed).toHaveLength(2);
  });

  it("02: feed respects offset/limit/since", () => {
    for (let i = 0; i < 10; i++) {
      feed.push({ type: "new_signal", actorId: "u1", targetType: "signal", targetId: `sig_${i}`, targetSummary: `Signal ${i}` });
    }

    const page1 = feed.getFeed(["u1"], { offset: 0, limit: 5 });
    expect(page1).toHaveLength(5);

    const page2 = feed.getFeed(["u1"], { offset: 5, limit: 5 });
    expect(page2).toHaveLength(5);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it("03: getUserEvents returns only user's events", () => {
    feed.push({ type: "like", actorId: "u_a", targetType: "comment", targetId: "c1", targetSummary: "Nice" });
    feed.push({ type: "follow", actorId: "u_b", targetType: "strategy", targetId: "s1", targetSummary: "Followed" });

    expect(feed.getUserEvents("u_a")).toHaveLength(1);
    expect(feed.getUserEvents("u_b")).toHaveLength(1);
  });

  // ── Notifications ─────────────────────────────────────────────────────

  it("04: notify and get notifications", () => {
    notif.notify("u1", "subscription_expiring", "即将到期", "您的订阅将在3天后到期");
    notif.notify("u1", "signal_update", "信号更新", "AAPL信号已更新");

    const all = notif.getNotifications("u1");
    expect(all).toHaveLength(2);
  });

  it("05: mark read / mark all read", () => {
    const n1 = notif.notify("u1", "admin_notice", "系统通知", "维护");

    expect(notif.getUnreadCount("u1")).toBe(1);

    notif.markRead("u1", n1.id);
    expect(notif.getUnreadCount("u1")).toBe(0);

    notif.notify("u1", "weekly_report", "周报", "收益+2%");
    notif.notify("u1", "alert", "告警", "异常");
    const result = notif.markAllRead("u1");
    expect(result.count).toBe(2);
    expect(notif.getUnreadCount("u1")).toBe(0);
  });

  it("06: getNotifications unreadOnly filter", () => {
    notif.notify("u1", "admin_notice", "系统通知", "body1");
    const n2 = notif.notify("u1", "weekly_report", "周报", "body2");

    notif.markRead("u1", n2.id);

    const unread = notif.getNotifications("u1", { unreadOnly: true });
    expect(unread).toHaveLength(1);
    expect(unread[0].type).toBe("admin_notice");
  });

  // ── Channels / Offline ────────────────────────────────────────────────

  it("07: register channel and check online", () => {
    const ch = notif.registerChannel("u1", "websocket");
    expect(ch.type).toBe("websocket");

    // Should show online (within 2 min)
    expect(notif.isOnline("u1")).toBe(true);

    notif.disconnectChannel(ch.id);
    expect(notif.isOnline("u1")).toBe(false);
  });

  it("08: offline messages queued when user is offline", () => {
    // User offline → notification goes to offline queue
    notif.notify("u2", "signal_update", "信号", "body");

    const offline = notif.getOfflineMessages("u2");
    expect(offline.length).toBeGreaterThanOrEqual(1);

    const delivered = notif.deliverOffline("u2");
    expect(delivered.delivered).toBeGreaterThanOrEqual(1);

    const after = notif.getOfflineMessages("u2");
    expect(after).toHaveLength(0);
  });
});
