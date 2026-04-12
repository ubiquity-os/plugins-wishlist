/**
 * Comprehensive Unit Tests for Contributor Role Rewards
 *
 * Covers three plugin variants:
 * - #46: No Config v1 (reward-engine)
 * - #47: With Config v3 (rewards handler with pull/issue context)
 * - #48: Contributor Class v2 (class detection + target matching)
 *
 * Bounty: ubiquity-os/plugins-wishlist#49 ($75)
 */

import { describe, expect, it } from "@jest/globals";

// ============================================================================
// With Config v3 — types & handlers
// ============================================================================
import {
  ContributorClass,
  TargetRole,
} from "../contributor-rewards-with-config/src/types/plugin-input";
import {
  getContributorClass,
  matchesTarget,
  parseEventName,
  getEventRewardConfig,
  calculateReward,
  applyLabelOverrides,
  calculateRewards,
  aggregateRewards,
  ContributorReward,
} from "../contributor-rewards-with-config/src/handlers/rewards";
import { PluginSettings } from "../contributor-rewards-with-config/src/types/plugin-input";

// ============================================================================
// No Config v1 — reward engine
// ============================================================================
import {
  computeRewards,
  verifyContributorRole,
  ComputeRewardsInput,
  ContributorRewards,
} from "../proposals/webhook-rewards/src/reward-engine";

// ============================================================================
// #48 Contributor Class Detection
// ============================================================================
describe("Contributor Class Detection", () => {
  describe("getContributorClass — basic classification", () => {
    it("classifies issue author as ISSUER", () => {
      expect(getContributorClass("alice", "alice", [], false)).toBe(ContributorClass.ISSUER);
    });

    it("classifies assignee as ASSIGNEE", () => {
      expect(getContributorClass("bob", "alice", [{ login: "bob" }], false)).toBe(ContributorClass.ASSIGNEE);
    });

    it("classifies org member as COLLABORATOR", () => {
      expect(getContributorClass("charlie", "alice", [], true)).toBe(ContributorClass.COLLABORATOR);
    });

    it("defaults to CONTRIBUTOR", () => {
      expect(getContributorClass("dave", "alice", [], false)).toBe(ContributorClass.CONTRIBUTOR);
    });
  });

  describe("getContributorClass — priority ordering", () => {
    it("ISSUER takes priority over COLLABORATOR", () => {
      expect(getContributorClass("alice", "alice", [], true)).toBe(ContributorClass.ISSUER);
    });

    it("ASSIGNEE takes priority over COLLABORATOR", () => {
      expect(getContributorClass("bob", "alice", [{ login: "bob" }], true)).toBe(ContributorClass.ASSIGNEE);
    });

    it("ISSUER takes priority over ASSIGNEE (user is both author and assignee)", () => {
      expect(getContributorClass("alice", "alice", [{ login: "alice" }], false)).toBe(ContributorClass.ISSUER);
    });
  });

  describe("getContributorClass — edge cases", () => {
    it("handles undefined issueAuthor", () => {
      expect(getContributorClass("dave", undefined, [], false)).toBe(ContributorClass.CONTRIBUTOR);
    });

    it("handles undefined assignees", () => {
      expect(getContributorClass("dave", "alice", undefined, false)).toBe(ContributorClass.CONTRIBUTOR);
    });

    it("handles both undefined issueAuthor and assignees", () => {
      expect(getContributorClass("dave", undefined, undefined, false)).toBe(ContributorClass.CONTRIBUTOR);
    });

    it("handles empty assignees array", () => {
      expect(getContributorClass("dave", "alice", [], false)).toBe(ContributorClass.CONTRIBUTOR);
    });

    it("handles multiple assignees — user not in list", () => {
      expect(getContributorClass("dave", "alice", [{ login: "bob" }, { login: "charlie" }], false)).toBe(
        ContributorClass.CONTRIBUTOR
      );
    });

    it("handles multiple assignees — user in list", () => {
      expect(getContributorClass("charlie", "alice", [{ login: "bob" }, { login: "charlie" }], false)).toBe(
        ContributorClass.ASSIGNEE
      );
    });

    it("handles case-sensitive login comparison", () => {
      expect(getContributorClass("Alice", "alice", [], false)).toBe(ContributorClass.CONTRIBUTOR);
      expect(getContributorClass("BOB", "alice", [{ login: "bob" }], false)).toBe(ContributorClass.CONTRIBUTOR);
    });

    it("org member with undefined author still gets COLLABORATOR", () => {
      expect(getContributorClass("charlie", undefined, [], true)).toBe(ContributorClass.COLLABORATOR);
    });

    it("self-assignment: author assigns themselves (ISSUER wins)", () => {
      const result = getContributorClass("alice", "alice", [{ login: "alice" }], true);
      expect(result).toBe(ContributorClass.ISSUER);
    });
  });
});

// ============================================================================
// #46 No Config v1 — Reward Engine
// ============================================================================
describe("No Config v1 — Reward Engine", () => {
  const defaultPricing: Record<string, number> = {
    "Time: <1 Hour": 1,
    "Time: <1 Day": 2,
    "Time: <1 Week": 4,
    "Time: <1 Month": 8,
    "Priority: Urgent": 500,
    "Priority: High": 300,
    "Priority: Medium": 200,
    "Priority: Low": 100,
  };

  const countedEvents = [
    "committed",
    "commented",
    "labeled",
    "closed",
    "merged",
    "cross-referenced",
    "reviewed",
    "approved",
  ];

  const qualifyingRoles = ["contributor", "member", "collaborator"];

  describe("computeRewards — basic calculation", () => {
    it("computes rewards for a single contributor", () => {
      const result = computeRewards({
        timelineEvents: [
          { event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" },
          { event: "commented", actor: { login: "alice" }, created_at: "2025-01-01T01:00:00Z" },
        ],
        labels: ["Priority: Medium"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("alice");
      expect(result[0].eventCount).toBe(2);
      expect(result[0].baseAmount).toBe(200); // Priority: Medium
      expect(result[0].multiplier).toBe(1); // No Time label
      expect(result[0].totalReward).toBe(400); // 200 * 2 * 1
    });

    it("uses default base amount when no priority label", () => {
      const result = computeRewards({
        timelineEvents: [{ event: "committed", actor: { login: "bob" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: [],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result[0].baseAmount).toBe(200); // default
      expect(result[0].totalReward).toBe(200); // 200 * 1 * 1
    });

    it("applies time multiplier", () => {
      const result = computeRewards({
        timelineEvents: [{ event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: ["Priority: High", "Time: <1 Week"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result[0].baseAmount).toBe(300);
      expect(result[0].multiplier).toBe(4);
      expect(result[0].totalReward).toBe(1200); // 300 * 1 * 4
    });
  });

  describe("computeRewards — multiple contributors", () => {
    it("separates counts per contributor", () => {
      const result = computeRewards({
        timelineEvents: [
          { event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" },
          { event: "committed", actor: { login: "bob" }, created_at: "2025-01-01T01:00:00Z" },
          { event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T02:00:00Z" },
        ],
        labels: ["Priority: Low"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result).toHaveLength(2);
      const alice = result.find((r) => r.username === "alice");
      const bob = result.find((r) => r.username === "bob");
      expect(alice?.eventCount).toBe(2);
      expect(bob?.eventCount).toBe(1);
    });

    it("sorts results by total descending", () => {
      const result = computeRewards({
        timelineEvents: [
          { event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" },
          { event: "committed", actor: { login: "bob" }, created_at: "2025-01-01T01:00:00Z" },
          { event: "committed", actor: { login: "bob" }, created_at: "2025-01-01T02:00:00Z" },
          { event: "committed", actor: { login: "bob" }, created_at: "2025-01-01T03:00:00Z" },
        ],
        labels: ["Priority: Medium"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result[0].username).toBe("bob");
      expect(result[0].eventCount).toBe(3);
    });
  });

  describe("computeRewards — event filtering", () => {
    it("ignores non-counted events", () => {
      const result = computeRewards({
        timelineEvents: [
          { event: "subscribed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" },
          { event: "mentioned", actor: { login: "alice" }, created_at: "2025-01-01T01:00:00Z" },
        ],
        labels: ["Priority: Medium"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result).toHaveLength(0);
    });

    it("handles events without actor", () => {
      const result = computeRewards({
        timelineEvents: [
          { event: "committed", actor: null, created_at: "2025-01-01T00:00:00Z" },
          { event: "committed", actor: undefined as any, created_at: "2025-01-01T01:00:00Z" },
        ],
        labels: ["Priority: Medium"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result).toHaveLength(0);
    });

    it("mixes counted and non-counted events correctly", () => {
      const result = computeRewards({
        timelineEvents: [
          { event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" },
          { event: "subscribed", actor: { login: "alice" }, created_at: "2025-01-01T01:00:00Z" },
          { event: "commented", actor: { login: "alice" }, created_at: "2025-01-01T02:00:00Z" },
        ],
        labels: ["Priority: Medium"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result).toHaveLength(1);
      expect(result[0].eventCount).toBe(2);
    });
  });

  describe("computeRewards — label handling", () => {
    it("case-insensitive label matching", () => {
      const result = computeRewards({
        timelineEvents: [{ event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: ["priority: high"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result[0].baseAmount).toBe(300);
    });

    it("uses last matching priority label when multiple exist", () => {
      const result = computeRewards({
        timelineEvents: [{ event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: ["Priority: Low", "Priority: Urgent"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      // Both match, last one wins based on iteration order
      expect(result[0].baseAmount).toBe(500);
    });

    it("uses last matching time label when multiple exist", () => {
      const result = computeRewards({
        timelineEvents: [{ event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: ["Time: <1 Hour", "Time: <1 Month"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result[0].multiplier).toBe(8);
    });

    it("ignores unrecognized labels", () => {
      const result = computeRewards({
        timelineEvents: [{ event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: ["enhancement", "good-first-issue", "Priority: Low"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result[0].baseAmount).toBe(100);
      expect(result[0].multiplier).toBe(1);
    });

    it("handles empty labels", () => {
      const result = computeRewards({
        timelineEvents: [{ event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: [],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result[0].baseAmount).toBe(200);
    });
  });

  describe("computeRewards — empty inputs", () => {
    it("returns empty for no timeline events", () => {
      const result = computeRewards({
        timelineEvents: [],
        labels: ["Priority: Medium"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result).toHaveLength(0);
    });

    it("returns empty for no counted events matching", () => {
      const result = computeRewards({
        timelineEvents: [{ event: "subscribed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: ["Priority: Medium"],
        pricing: defaultPricing,
        countedEvents,
        qualifyingRoles,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("verifyContributorRole", () => {
    it("always returns true in v1 (no config)", async () => {
      const result = await verifyContributorRole(null as any, "owner", "repo", "alice", ["admin"]);
      expect(result).toBe(true);
    });

    it("returns true even for empty roles", async () => {
      const result = await verifyContributorRole(null as any, "owner", "repo", "alice", []);
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// #47 With Config v3 — Target Matching & Reward Calculation
// ============================================================================
describe("With Config v3 — Target Role Matching", () => {
  describe("matchesTarget — all TargetRole variants", () => {
    it("ISSUER matches ISSUER class", () => {
      expect(matchesTarget(TargetRole.ISSUER, ContributorClass.ISSUER, "alice")).toBe(true);
    });

    it("ISSUER does not match ASSIGNEE class", () => {
      expect(matchesTarget(TargetRole.ISSUER, ContributorClass.ASSIGNEE, "alice")).toBe(false);
    });

    it("ASSIGNEE matches ASSIGNEE class", () => {
      expect(matchesTarget(TargetRole.ASSIGNEE, ContributorClass.ASSIGNEE, "bob")).toBe(true);
    });

    it("COLLABORATOR matches COLLABORATOR class", () => {
      expect(matchesTarget(TargetRole.COLLABORATOR, ContributorClass.COLLABORATOR, "charlie")).toBe(true);
    });

    it("CONTRIBUTOR matches CONTRIBUTOR class", () => {
      expect(matchesTarget(TargetRole.CONTRIBUTOR, ContributorClass.CONTRIBUTOR, "dave")).toBe(true);
    });

    it("REVIEWERS matches when user is in reviewers list", () => {
      expect(matchesTarget(TargetRole.REVIEWERS, ContributorClass.CONTRIBUTOR, "bob", ["bob", "charlie"])).toBe(true);
    });

    it("REVIEWERS does not match when user is absent", () => {
      expect(matchesTarget(TargetRole.REVIEWERS, ContributorClass.CONTRIBUTOR, "bob", ["alice"])).toBe(false);
    });

    it("REVIEWERS does not match with undefined reviewers", () => {
      expect(matchesTarget(TargetRole.REVIEWERS, ContributorClass.CONTRIBUTOR, "bob")).toBe(false);
    });

    it("COMMENTERS matches when user is in commenters list", () => {
      expect(matchesTarget(TargetRole.COMMENTERS, ContributorClass.CONTRIBUTOR, "bob", undefined, ["bob"])).toBe(true);
    });

    it("COMMENTERS does not match when user is absent", () => {
      expect(matchesTarget(TargetRole.COMMENTERS, ContributorClass.CONTRIBUTOR, "bob", undefined, ["alice"])).toBe(false);
    });

    it("COMMITTERS matches when user is in committers list", () => {
      expect(matchesTarget(TargetRole.COMMITTERS, ContributorClass.CONTRIBUTOR, "bob", undefined, undefined, ["bob"])).toBe(true);
    });

    it("COMMITTERS does not match when user is absent", () => {
      expect(matchesTarget(TargetRole.COMMITTERS, ContributorClass.CONTRIBUTOR, "bob", undefined, undefined, ["alice"])).toBe(false);
    });
  });

  describe("matchesTarget — cross-role matching", () => {
    it("REVIEWERS ignores contributor class", () => {
      // REVIEWERS target should match based on reviewers list, not class
      expect(matchesTarget(TargetRole.REVIEWERS, ContributorClass.ISSUER, "alice", ["alice"])).toBe(true);
      expect(matchesTarget(TargetRole.REVIEWERS, ContributorClass.COLLABORATOR, "alice", ["alice"])).toBe(true);
    });

    it("ISSUER target ignores reviewers list", () => {
      // Class-based target should only check class
      expect(matchesTarget(TargetRole.ISSUER, ContributorClass.CONTRIBUTOR, "alice", ["alice"])).toBe(false);
    });
  });
});

// ============================================================================
// Pull/Issue Context Separation
// ============================================================================
describe("Pull/Issue Context Separation", () => {
  const settings: PluginSettings = {
    pull_request: {
      opened: {
        pull: { targets: [TargetRole.CONTRIBUTOR], value: 10 },
        issue: { targets: [TargetRole.ISSUER], value: 5 },
      },
    },
  };

  it("uses pull context for pull requests", () => {
    const reward = calculateReward(
      { pull: { targets: [TargetRole.CONTRIBUTOR], value: 10 }, issue: { targets: [TargetRole.ISSUER], value: 5 } },
      "pull",
      ContributorClass.CONTRIBUTOR,
      "bob"
    );
    expect(reward).toBe(10);
  });

  it("uses issue context for issues", () => {
    const reward = calculateReward(
      { pull: { targets: [TargetRole.CONTRIBUTOR], value: 10 }, issue: { targets: [TargetRole.ISSUER], value: 5 } },
      "issue",
      ContributorClass.ISSUER,
      "alice"
    );
    expect(reward).toBe(5);
  });

  it("returns 0 when pull context is missing", () => {
    const reward = calculateReward(
      { issue: { targets: [TargetRole.ISSUER], value: 5 } },
      "pull",
      ContributorClass.CONTRIBUTOR,
      "bob"
    );
    expect(reward).toBe(0);
  });

  it("returns 0 when issue context is missing", () => {
    const reward = calculateReward(
      { pull: { targets: [TargetRole.CONTRIBUTOR], value: 10 } },
      "issue",
      ContributorClass.ISSUER,
      "alice"
    );
    expect(reward).toBe(0);
  });

  it("handles different targets per context", () => {
    const config = {
      pull: { targets: [TargetRole.ASSIGNEE], value: 20 },
      issue: { targets: [TargetRole.COMMENTERS], value: 3 },
    };

    // Pull: ASSIGNEE gets reward
    expect(calculateReward(config, "pull", ContributorClass.ASSIGNEE, "bob")).toBe(20);
    // Pull: CONTRIBUTOR does not
    expect(calculateReward(config, "pull", ContributorClass.CONTRIBUTOR, "dave")).toBe(0);
    // Issue: COMMENTERS get reward
    expect(calculateReward(config, "issue", ContributorClass.CONTRIBUTOR, "bob", { commenters: ["bob"] })).toBe(3);
    // Issue: non-commenter gets nothing
    expect(calculateReward(config, "issue", ContributorClass.CONTRIBUTOR, "alice", { commenters: ["bob"] })).toBe(0);
  });

  it("calculates rewards correctly across contexts in full flow", () => {
    const rewards = calculateRewards(
      settings,
      "pull_request.opened",
      [
        { login: "alice", issueAuthor: "alice", isOrgMember: false }, // ISSUER
        { login: "bob", issueAuthor: "alice", isOrgMember: false },  // CONTRIBUTOR
      ],
      "pull",
      []
    );

    // In pull context: only CONTRIBUTOR target (value 10). Alice is ISSUER → no match. Bob is CONTRIBUTOR → match.
    expect(rewards).toHaveLength(1);
    expect(rewards.find((r) => r.login === "alice")).toBeUndefined();
    expect(rewards.find((r) => r.login === "bob")?.reward).toBe(10);
  });
});

// ============================================================================
// Negative Value Events
// ============================================================================
describe("Negative Value Events", () => {
  it("handles negative reward values", () => {
    const reward = calculateReward(
      { pull: { targets: [TargetRole.CONTRIBUTOR], value: -5 } },
      "pull",
      ContributorClass.CONTRIBUTOR,
      "bob"
    );
    expect(reward).toBe(-5);
  });

  it("handles zero reward values", () => {
    const reward = calculateReward(
      { pull: { targets: [TargetRole.CONTRIBUTOR], value: 0 } },
      "pull",
      ContributorClass.CONTRIBUTOR,
      "bob"
    );
    expect(reward).toBe(0);
  });

  it("negative label overrides reduce reward", () => {
    const result = applyLabelOverrides(10, [{ name: "penalty" }], { penalty: { value: -3 } });
    expect(result).toBe(7);
  });

  it("label override can make reward negative", () => {
    const result = applyLabelOverrides(5, [{ name: "big-penalty" }], { "big-penalty": { value: -10 } });
    expect(result).toBe(-5);
  });

  it("multiple negative label overrides stack", () => {
    const result = applyLabelOverrides(
      10,
      [{ name: "a" }, { name: "b" }],
      { a: { value: -3 }, b: { value: -4 } }
    );
    expect(result).toBe(3);
  });

  it("aggregateRewards handles negative totals correctly", () => {
    const rewards: ContributorReward[] = [
      { login: "alice", class: ContributorClass.CONTRIBUTOR, reward: 10 },
      { login: "alice", class: ContributorClass.CONTRIBUTOR, reward: -3 },
      { login: "bob", class: ContributorClass.CONTRIBUTOR, reward: -5 },
    ];

    const aggregated = aggregateRewards(rewards);
    expect(aggregated.get("alice")?.total).toBe(7);
    expect(aggregated.get("bob")?.total).toBe(-5);
  });

  it("full flow with negative events filters out zero results", () => {
    const settings: PluginSettings = {
      pull_request: {
        closed: {
          pull: { targets: [TargetRole.CONTRIBUTOR], value: 0 },
        },
      },
    };

    const rewards = calculateRewards(
      settings,
      "pull_request.closed",
      [{ login: "bob", issueAuthor: "alice", isOrgMember: false }],
      "pull",
      []
    );

    // Zero rewards are filtered out
    expect(rewards).toHaveLength(0);
  });
});

// ============================================================================
// Event Name Parsing
// ============================================================================
describe("Event Name Parsing", () => {
  it("parses standard events", () => {
    expect(parseEventName("pull_request.opened")).toEqual({ category: "pull_request", action: "opened" });
    expect(parseEventName("issues.closed")).toEqual({ category: "issues", action: "closed" });
    expect(parseEventName("issue_comment.created")).toEqual({ category: "issue_comment", action: "created" });
    expect(parseEventName("pull_request_review.submitted")).toEqual({
      category: "pull_request_review",
      action: "submitted",
    });
  });

  it("handles event without dot", () => {
    expect(parseEventName("push")).toEqual({ category: "push", action: "" });
  });

  it("handles deeply nested event names (only first dot splits)", () => {
    expect(parseEventName("pull_request_review_comment.created")).toEqual({
      category: "pull_request_review_comment",
      action: "created",
    });
  });
});

// ============================================================================
// Event Reward Config Lookup
// ============================================================================
describe("Event Reward Config Lookup", () => {
  it("finds configured event", () => {
    const settings: PluginSettings = {
      issues: {
        opened: {
          issue: { targets: [TargetRole.ISSUER], value: 1 },
        },
      },
    };
    const config = getEventRewardConfig(settings, "issues.opened");
    expect(config?.issue?.value).toBe(1);
  });

  it("returns undefined for unconfigured action", () => {
    const settings: PluginSettings = {
      issues: {
        opened: {
          issue: { targets: [TargetRole.ISSUER], value: 1 },
        },
      },
    };
    expect(getEventRewardConfig(settings, "issues.closed")).toBeUndefined();
  });

  it("returns undefined for unconfigured category", () => {
    const settings: PluginSettings = {
      issues: {
        opened: {
          issue: { targets: [TargetRole.ISSUER], value: 1 },
        },
      },
    };
    expect(getEventRewardConfig(settings, "pull_request.opened")).toBeUndefined();
  });

  it("returns undefined for empty settings", () => {
    const settings: PluginSettings = {};
    expect(getEventRewardConfig(settings, "issues.opened")).toBeUndefined();
  });

  it("navigates pull_request_review_comment correctly", () => {
    const settings: PluginSettings = {
      pull_request_review_comment: {
        created: {
          pull: { targets: [TargetRole.COMMENTERS], value: 1 },
        },
      },
    };
    const config = getEventRewardConfig(settings, "pull_request_review_comment.created");
    expect(config?.pull?.value).toBe(1);
  });
});

// ============================================================================
// Label Overrides
// ============================================================================
describe("Label Overrides", () => {
  it("adds positive override", () => {
    expect(applyLabelOverrides(10, [{ name: "bug" }], { bug: { value: 5 } })).toBe(15);
  });

  it("adds negative override", () => {
    expect(applyLabelOverrides(10, [{ name: "bug" }], { bug: { value: -5 } })).toBe(5);
  });

  it("handles multiple labels", () => {
    expect(
      applyLabelOverrides(10, [{ name: "a" }, { name: "b" }, { name: "c" }], {
        a: { value: 1 },
        b: { value: 2 },
        c: { value: 3 },
      })
    ).toBe(16);
  });

  it("ignores labels not in override config", () => {
    expect(applyLabelOverrides(10, [{ name: "unknown" }], { bug: { value: 5 } })).toBe(10);
  });

  it("returns base when no override config", () => {
    expect(applyLabelOverrides(10, [{ name: "bug" }], undefined)).toBe(10);
  });

  it("handles empty labels array", () => {
    expect(applyLabelOverrides(10, [], { bug: { value: 5 } })).toBe(10);
  });

  it("handles zero value override", () => {
    expect(applyLabelOverrides(10, [{ name: "bug" }], { bug: { value: 0 } })).toBe(10);
  });
});

// ============================================================================
// Full Reward Calculation Flow
// ============================================================================
describe("calculateRewards — full flow", () => {
  const settings: PluginSettings = {
    pull_request: {
      opened: {
        pull: { targets: [TargetRole.CONTRIBUTOR, TargetRole.ISSUER], value: 5 },
      },
      closed: {
        pull: { targets: [TargetRole.ASSIGNEE], value: 50 },
        issue: { targets: [TargetRole.ISSUER], value: 10 },
      },
    },
    issues: {
      labeled: {
        issue: { targets: [TargetRole.CONTRIBUTOR], value: 1 },
      },
    },
    pull_request_review: {
      submitted: {
        pull: { targets: [TargetRole.REVIEWERS], value: 3 },
      },
    },
    issue_comment: {
      created: {
        issue: { targets: [TargetRole.COMMENTERS], value: 1 },
      },
    },
    labelOverrides: {
      bug: { value: 5 },
      "priority:high": { value: 10 },
      penalty: { value: -2 },
    },
  };

  it("calculates rewards for multiple contributors with different classes", () => {
    const rewards = calculateRewards(
      settings,
      "pull_request.opened",
      [
        { login: "alice", issueAuthor: "alice", isOrgMember: false },
        { login: "bob", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: false },
        { login: "charlie", issueAuthor: "alice", isOrgMember: true },
        { login: "dave", issueAuthor: "alice", isOrgMember: false },
      ],
      "pull",
      []
    );

    // Only ISSUER (alice) and CONTRIBUTOR (dave) match the targets [CONTRIBUTOR, ISSUER]
    expect(rewards).toHaveLength(2);
    expect(rewards.find((r) => r.login === "alice")?.class).toBe(ContributorClass.ISSUER);
    expect(rewards.find((r) => r.login === "bob")).toBeUndefined(); // ASSIGNEE, not in targets
    expect(rewards.find((r) => r.login === "charlie")).toBeUndefined(); // COLLABORATOR, not in targets
    expect(rewards.find((r) => r.login === "dave")?.class).toBe(ContributorClass.CONTRIBUTOR);
  });

  it("filters out non-matching targets", () => {
    const rewards = calculateRewards(
      settings,
      "pull_request.closed",
      [
        { login: "alice", issueAuthor: "alice", isOrgMember: false }, // ISSUER, not ASSIGNEE
        { login: "bob", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: false }, // ASSIGNEE ✓
        { login: "dave", issueAuthor: "alice", isOrgMember: false }, // CONTRIBUTOR, not ASSIGNEE
      ],
      "pull",
      []
    );

    expect(rewards).toHaveLength(1);
    expect(rewards[0].login).toBe("bob");
    expect(rewards[0].reward).toBe(50);
  });

  it("applies label overrides to matching contributors", () => {
    const rewards = calculateRewards(
      settings,
      "pull_request.closed",
      [{ login: "bob", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: false }],
      "pull",
      [{ name: "bug" }, { name: "priority:high" }]
    );

    expect(rewards[0].reward).toBe(50 + 5 + 10); // base + bug + priority:high
  });

  it("applies negative label overrides", () => {
    const rewards = calculateRewards(
      settings,
      "pull_request.closed",
      [{ login: "bob", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: false }],
      "pull",
      [{ name: "penalty" }]
    );

    expect(rewards[0].reward).toBe(48); // 50 - 2
  });

  it("handles reviewers target via options", () => {
    const rewards = calculateRewards(
      settings,
      "pull_request_review.submitted",
      [{ login: "charlie", issueAuthor: "alice", isOrgMember: false }],
      "pull",
      [],
      { reviewers: ["charlie"] }
    );

    expect(rewards).toHaveLength(1);
    expect(rewards[0].reward).toBe(3);
  });

  it("handles commenters target via options", () => {
    const rewards = calculateRewards(
      settings,
      "issue_comment.created",
      [{ login: "dave", issueAuthor: "alice", isOrgMember: false }],
      "issue",
      [],
      { commenters: ["dave"] }
    );

    expect(rewards).toHaveLength(1);
    expect(rewards[0].reward).toBe(1);
  });

  it("returns empty for unconfigured event", () => {
    const rewards = calculateRewards(
      settings,
      "pull_request.synchronize",
      [{ login: "bob", issueAuthor: "alice", isOrgMember: false }],
      "pull",
      []
    );

    expect(rewards).toHaveLength(0);
  });
});

// ============================================================================
// Aggregation
// ============================================================================
describe("aggregateRewards", () => {
  it("aggregates rewards by login", () => {
    const rewards: ContributorReward[] = [
      { login: "alice", class: ContributorClass.ISSUER, reward: 5 },
      { login: "alice", class: ContributorClass.ISSUER, reward: 3 },
      { login: "bob", class: ContributorClass.CONTRIBUTOR, reward: 10 },
    ];

    const aggregated = aggregateRewards(rewards);
    expect(aggregated.get("alice")?.total).toBe(8);
    expect(aggregated.get("bob")?.total).toBe(10);
    expect(aggregated.size).toBe(2);
  });

  it("handles empty array", () => {
    const aggregated = aggregateRewards([]);
    expect(aggregated.size).toBe(0);
  });

  it("handles single reward", () => {
    const aggregated = aggregateRewards([{ login: "alice", class: ContributorClass.CONTRIBUTOR, reward: 42 }]);
    expect(aggregated.get("alice")?.total).toBe(42);
  });

  it("preserves class from first occurrence", () => {
    const rewards: ContributorReward[] = [
      { login: "alice", class: ContributorClass.ISSUER, reward: 5 },
      { login: "alice", class: ContributorClass.CONTRIBUTOR, reward: 3 },
    ];

    const aggregated = aggregateRewards(rewards);
    expect(aggregated.get("alice")?.class).toBe(ContributorClass.ISSUER);
  });

  it("handles mixed positive and negative rewards", () => {
    const rewards: ContributorReward[] = [
      { login: "alice", class: ContributorClass.CONTRIBUTOR, reward: 10 },
      { login: "alice", class: ContributorClass.CONTRIBUTOR, reward: -3 },
      { login: "alice", class: ContributorClass.CONTRIBUTOR, reward: 5 },
    ];

    const aggregated = aggregateRewards(rewards);
    expect(aggregated.get("alice")?.total).toBe(12);
  });
});

// ============================================================================
// Integration: Complete Lifecycle Scenarios
// ============================================================================
describe("Integration: Complete Lifecycle Scenarios", () => {
  const fullSettings: PluginSettings = {
    pull_request: {
      opened: { pull: { targets: [TargetRole.CONTRIBUTOR], value: 2 } },
      review_requested: { pull: { targets: [TargetRole.REVIEWERS], value: 1 } },
      closed: {
        pull: { targets: [TargetRole.ASSIGNEE], value: 50 },
        issue: { targets: [TargetRole.ISSUER], value: 10 },
      },
    },
    pull_request_review: {
      submitted: { pull: { targets: [TargetRole.REVIEWERS], value: 5 } },
    },
    issue_comment: {
      created: { issue: { targets: [TargetRole.COMMENTERS], value: 1 } },
    },
    issues: {
      opened: { issue: { targets: [TargetRole.ISSUER], value: 1 } },
      labeled: { issue: { targets: [TargetRole.CONTRIBUTOR], value: 1 } },
    },
    labelOverrides: {
      bug: { value: 5 },
      "good-first-issue": { value: 2 },
    },
  };

  it("scenario: issue created, labeled, PR opened, reviewed, closed", () => {
    // 1. Alice opens an issue
    const issueOpened = calculateRewards(
      fullSettings,
      "issues.opened",
      [{ login: "alice", issueAuthor: "alice", isOrgMember: false }],
      "issue",
      []
    );
    expect(issueOpened).toHaveLength(1);
    expect(issueOpened[0].reward).toBe(1);

    // 2. Issue gets labeled by Dave
    const issueLabeled = calculateRewards(
      fullSettings,
      "issues.labeled",
      [{ login: "dave", issueAuthor: "alice", isOrgMember: false }],
      "issue",
      [{ name: "bug" }]
    );
    expect(issueLabeled).toHaveLength(1);
    expect(issueLabeled[0].reward).toBe(1 + 5); // 1 + bug override

    // 3. Bob opens a PR (he is ASSIGNEE but target is CONTRIBUTOR)
    const prOpened = calculateRewards(
      fullSettings,
      "pull_request.opened",
      [{ login: "bob", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: false }],
      "pull",
      []
    );
    // Bob is ASSIGNEE (not CONTRIBUTOR), so he doesn't match the CONTRIBUTOR-only target
    expect(prOpened).toHaveLength(0);

    // 4. Charlie reviews the PR
    const reviewSubmitted = calculateRewards(
      fullSettings,
      "pull_request_review.submitted",
      [{ login: "charlie", issueAuthor: "alice", isOrgMember: true }],
      "pull",
      [],
      { reviewers: ["charlie"] }
    );
    expect(reviewSubmitted).toHaveLength(1);
    expect(reviewSubmitted[0].reward).toBe(5);

    // 5. PR is closed — Bob (assignee) gets big reward
    const prClosed = calculateRewards(
      fullSettings,
      "pull_request.closed",
      [{ login: "bob", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: false }],
      "pull",
      [{ name: "bug" }, { name: "good-first-issue" }]
    );
    expect(prClosed).toHaveLength(1);
    expect(prClosed[0].reward).toBe(50 + 5 + 2); // base + bug + good-first-issue
  });

  it("scenario: self-assignee (author is also assignee)", () => {
    // Alice opens issue and assigns herself
    const result = calculateRewards(
      fullSettings,
      "pull_request.closed",
      [{ login: "alice", issueAuthor: "alice", assignees: [{ login: "alice" }], isOrgMember: true }],
      "pull",
      []
    );

    // Alice is ISSUER (priority), not ASSIGNEE → 0 in pull context
    expect(result).toHaveLength(0);
  });

  it("scenario: no assignee on issue", () => {
    const result = calculateRewards(
      fullSettings,
      "pull_request.closed",
      [{ login: "bob", issueAuthor: "alice", assignees: [], isOrgMember: false }],
      "pull",
      []
    );

    // Bob is CONTRIBUTOR, not ASSIGNEE → 0
    expect(result).toHaveLength(0);
  });

  it("scenario: org member gets collaborator class", () => {
    const result = calculateRewards(
      {
        pull_request: {
          opened: {
            pull: { targets: [TargetRole.COLLABORATOR], value: 15 },
          },
        },
      },
      "pull_request.opened",
      [{ login: "charlie", issueAuthor: "alice", isOrgMember: true }],
      "pull",
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].class).toBe(ContributorClass.COLLABORATOR);
    expect(result[0].reward).toBe(15);
  });

  it("scenario: negative event (unassignment penalty)", () => {
    const settings: PluginSettings = {
      pull_request: {
        unassigned: {
          pull: { targets: [TargetRole.CONTRIBUTOR], value: -5 },
        },
      },
    };

    const result = calculateRewards(
      settings,
      "pull_request.unassigned",
      [{ login: "bob", issueAuthor: "alice", isOrgMember: false }],
      "pull",
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].reward).toBe(-5);
  });

  it("scenario: all contributors filtered out", () => {
    const result = calculateRewards(
      fullSettings,
      "pull_request.closed",
      [
        { login: "alice", issueAuthor: "alice", isOrgMember: false }, // ISSUER
        { login: "charlie", issueAuthor: "alice", isOrgMember: true }, // COLLABORATOR
        { login: "dave", issueAuthor: "alice", isOrgMember: false }, // CONTRIBUTOR
      ],
      "pull",
      []
    );

    // Only ASSIGNEE target, none are assignees
    expect(result).toHaveLength(0);
  });

  it("scenario: aggregate across multiple events", () => {
    const allRewards: ContributorReward[] = [];

    // PR opened
    allRewards.push(
      ...calculateRewards(
        fullSettings,
        "pull_request.opened",
        [{ login: "bob", issueAuthor: "alice", isOrgMember: false }],
        "pull",
        []
      )
    );

    // Review submitted
    allRewards.push(
      ...calculateRewards(
        fullSettings,
        "pull_request_review.submitted",
        [{ login: "charlie", issueAuthor: "alice", isOrgMember: false }],
        "pull",
        [],
        { reviewers: ["charlie"] }
      )
    );

    // PR closed
    allRewards.push(
      ...calculateRewards(
        fullSettings,
        "pull_request.closed",
        [{ login: "bob", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: false }],
        "pull",
        [{ name: "bug" }]
      )
    );

    const aggregated = aggregateRewards(allRewards);
    expect(aggregated.get("bob")?.total).toBe(2 + 55); // opened(2) + closed(50+5)
    expect(aggregated.get("charlie")?.total).toBe(5);
  });
});

// ============================================================================
// Edge Cases: No Config v1 + With Config v3 Combined
// ============================================================================
describe("Edge Cases", () => {
  describe("computeRewards — no actor events", () => {
    it("skips events where actor.login is undefined inside actor object", () => {
      const result = computeRewards({
        timelineEvents: [
          { event: "committed", actor: { login: undefined } as any, created_at: "2025-01-01T00:00:00Z" },
          { event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T01:00:00Z" },
        ],
        labels: ["Priority: Medium"],
        pricing: { "Priority: Medium": 200 },
        countedEvents: ["committed"],
        qualifyingRoles: ["contributor"],
      });

      // Only alice should appear
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("alice");
    });
  });

  describe("computeRewards — custom pricing", () => {
    it("uses custom pricing keys", () => {
      const customPricing = {
        "Priority: Critical": 1000,
        "Time: <1 Minute": 0.5,
      };

      const result = computeRewards({
        timelineEvents: [{ event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" }],
        labels: ["Priority: Critical", "Time: <1 Minute"],
        pricing: customPricing,
        countedEvents: ["committed"],
        qualifyingRoles: ["contributor"],
      });

      expect(result[0].baseAmount).toBe(1000);
      expect(result[0].multiplier).toBe(0.5);
      expect(result[0].totalReward).toBe(500); // 1000 * 1 * 0.5
    });
  });

  describe("computeRewards — role qualification", () => {
    it("qualifies all users in v1 since role is always 'contributor'", () => {
      const result = computeRewards({
        timelineEvents: [
          { event: "committed", actor: { login: "alice" }, created_at: "2025-01-01T00:00:00Z" },
          { event: "commented", actor: { login: "bob" }, created_at: "2025-01-01T01:00:00Z" },
        ],
        labels: ["Priority: Medium"],
        pricing: { "Priority: Medium": 200 },
        countedEvents: ["committed", "commented"],
        qualifyingRoles: ["contributor"],
      });

      expect(result).toHaveLength(2);
    });
  });

  describe("getContributorClass — specification_author role", () => {
    it("specification author (issuer) gets ISSUER class", () => {
      // In the system, specification_author maps to ISSUER
      expect(getContributorClass("alice", "alice", [], false)).toBe(ContributorClass.ISSUER);
    });

    it("specification author is not confused with assignee", () => {
      expect(getContributorClass("alice", "alice", [{ login: "bob" }], false)).toBe(ContributorClass.ISSUER);
    });
  });

  describe("calculateReward — multiple target roles", () => {
    it("matches when user matches at least one target", () => {
      const reward = calculateReward(
        { pull: { targets: [TargetRole.ISSUER, TargetRole.ASSIGNEE, TargetRole.CONTRIBUTOR], value: 7 } },
        "pull",
        ContributorClass.CONTRIBUTOR,
        "dave"
      );
      expect(reward).toBe(7);
    });

    it("returns 0 when user matches no targets", () => {
      const reward = calculateReward(
        { pull: { targets: [TargetRole.ISSUER, TargetRole.ASSIGNEE], value: 7 } },
        "pull",
        ContributorClass.CONTRIBUTOR,
        "dave"
      );
      expect(reward).toBe(0);
    });
  });
});
