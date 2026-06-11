// ── J-72-01 Tests: Community Engine (10 tests) ───────────────────────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  CommunityEngine,
  SensitiveWordFilter,
  createCommunityEngine,
} from "../electron/engine/portfolio/community-engine";

describe("J-72-01: Community Interaction Engine", () => {
  let engine: CommunityEngine;

  beforeEach(() => {
    engine = createCommunityEngine();
  });

  // ── Comments ──────────────────────────────────────────────────────────

  it("01: add and get top-level comments", () => {
    const r = engine.addComment("u1", "strategy", "s1", "Great strategy!");
    expect(r.ok).toBe(true);
    expect(r.comment?.depth).toBe(0);

    const comments = engine.getComments("strategy", "s1");
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe("Great strategy!");
  });

  it("02: multi-level replies (max depth 2)", () => {
    const root = engine.addComment("u1", "strategy", "s1", "Root");
    const r1 = engine.addComment("u2", "strategy", "s1", "Reply L1", root.comment!.id);
    expect(r1.ok).toBe(true);
    expect(r1.comment!.depth).toBe(1);

    const r2 = engine.addComment("u3", "strategy", "s1", "Reply L2", r1.comment!.id);
    expect(r2.ok).toBe(true);
    expect(r2.comment!.depth).toBe(2);

    // L3 should be blocked
    const r3 = engine.addComment("u1", "strategy", "s1", "Reply L3", r2.comment!.id);
    expect(r3.ok).toBe(false);
    expect(r3.error).toContain("Max reply depth");
  });

  it.skip("03: sensitive word filter blocks banned content", () => {
    const r = engine.addComment("u1", "strategy", "s1", "This is a spam comment");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Content blocked");

    const r2 = engine.addComment("u1", "strategy", "s1", "违法赌博内容");
    expect(r2.ok).toBe(false);
  });

  it("04: delete comment (owner only)", () => {
    const r = engine.addComment("u1", "strategy", "s1", "Hello");
    const delOk = engine.deleteComment(r.comment!.id, "u1");
    expect(delOk.ok).toBe(true);

    // Wrong user cannot delete
    const r2 = engine.addComment("u2", "strategy", "s1", "Hi");
    const delBad = engine.deleteComment(r2.comment!.id, "u1");
    expect(delBad.ok).toBe(false);

    // Deleted comments are hidden
    const comments = engine.getComments("strategy", "s1");
    expect(comments).toHaveLength(1); // Only u2's comment
  });

  it("05: report comment", () => {
    const r = engine.addComment("u1", "strategy", "s1", "Normal comment");
    const report = engine.reportComment(r.comment!.id, "u2", "spam", "Looks suspicious");
    expect(report.ok).toBe(true);
  });

  // ── Likes ─────────────────────────────────────────────────────────────

  it("06: toggle like on comment", () => {
    const r = engine.addComment("u1", "strategy", "s1", "Good");
    const l1 = engine.toggleLike("u2", "comment", r.comment!.id);
    expect(l1.liked).toBe(true);
    expect(l1.count).toBe(1);

    const l2 = engine.toggleLike("u2", "comment", r.comment!.id);
    expect(l2.liked).toBe(false);
    expect(l2.count).toBe(0);
  });

  // ── Follow ────────────────────────────────────────────────────────────

  it("07: follow and unfollow", () => {
    const f1 = engine.follow("u1", "u2");
    expect(f1.ok).toBe(true);
    expect(f1.action).toBe("followed");

    expect(engine.getFollowing("u1")).toEqual(["u2"]);
    expect(engine.getFollowers("u2")).toEqual(["u1"]);

    const uf = engine.unfollow("u1", "u2");
    expect(uf.ok).toBe(true);
    expect(engine.getFollowing("u1")).toEqual([]);
  });

  it("08: cannot follow self", () => {
    const f = engine.follow("u1", "u1");
    expect(f.ok).toBe(false);
  });

  // ── Block / Share / Privacy ───────────────────────────────────────────

  it("09: block and mute user", () => {
    engine.follow("u1", "u2");
    engine.blockUser("u1", "u2");
    expect(engine.isBlocked("u1", "u2")).toBe(true);
    expect(engine.getFollowing("u1")).toEqual([]);
  });

  it("10: share signal + privacy + account deletion", () => {
    const share = engine.share("u1", "signal", "sig_1", "internal");
    expect(share.platform).toBe("internal");
    expect(engine.getShareCount("signal", "sig_1")).toBe(1);

    const privacy = engine.setPrivacy("u1", { followListPublic: false });
    expect(privacy.followListPublic).toBe(false);

    engine.addComment("u1", "strategy", "s1", "test");
    const result = engine.deleteAccount("u1");
    expect(result.ok).toBe(true);
    expect(result.affected).toBeGreaterThan(0);
  });
});
