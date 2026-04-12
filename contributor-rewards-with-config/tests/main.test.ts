import { describe, expect, it } from "@jest/globals";
import { ContributorClass, TargetRole } from "../src/types/plugin-input";
import {
  getContributorClass,
  matchesTarget,
  parseEventName,
  getEventRewardConfig,
  calculateReward,
  applyLabelOverrides,
  calculateRewards,
  aggregateRewards,
} from "../src/handlers/rewards";
import { PluginSettings } from "../src/types/plugin-input";

describe("Contributor Rewards With Config", () => {
  describe("parseEventName", () => {
    it("should parse pull_request.opened", () => {
      const result = parseEventName("pull_request.opened");
      expect(result).toEqual({ category: "pull_request", action: "opened" });
    });

    it("should parse issue_comment.created", () => {
      const result = parseEventName("issue_comment.created");
      expect(result).toEqual({ category: "issue_comment", action: "created" });
    });

    it("should handle event without dot", () => {
      const result = parseEventName("push");
      expect(result).toEqual({ category: "push", action: "" });
    });
  });

  describe("getContributorClass", () => {
    it("should identify issuer", () => {
      expect(getContributorClass("alice", "alice", [], false)).toBe(ContributorClass.ISSUER);
    });

    it("should identify assignee", () => {
      expect(getContributorClass("bob", "alice", [{ login: "bob" }], false)).toBe(ContributorClass.ASSIGNEE);
    });

    it("should identify collaborator", () => {
      expect(getContributorClass("charlie", "alice", [], true)).toBe(ContributorClass.COLLABORATOR);
    });

    it("should default to contributor", () => {
      expect(getContributorClass("dave", "alice", [], false)).toBe(ContributorClass.CONTRIBUTOR);
    });

    it("issuer takes priority over org membership", () => {
      expect(getContributorClass("alice", "alice", [], true)).toBe(ContributorClass.ISSUER);
    });

    it("assignee takes priority over org membership", () => {
      expect(getContributorClass("bob", "alice", [{ login: "bob" }], true)).toBe(ContributorClass.ASSIGNEE);
    });
  });

  describe("matchesTarget", () => {
    it("should match ISSUER target", () => {
      expect(matchesTarget(TargetRole.ISSUER, ContributorClass.ISSUER, "alice")).toBe(true);
      expect(matchesTarget(TargetRole.ISSUER, ContributorClass.CONTRIBUTOR, "alice")).toBe(false);
    });

    it("should match REVIEWERS target", () => {
      expect(matchesTarget(TargetRole.REVIEWERS, ContributorClass.CONTRIBUTOR, "bob", ["bob"])).toBe(true);
      expect(matchesTarget(TargetRole.REVIEWERS, ContributorClass.CONTRIBUTOR, "bob", ["alice"])).toBe(false);
    });

    it("should match COMMENTERS target", () => {
      expect(matchesTarget(TargetRole.COMMENTERS, ContributorClass.CONTRIBUTOR, "bob", [], ["bob"])).toBe(true);
    });
  });

  describe("getEventRewardConfig", () => {
    const settings: PluginSettings = {
      pull_request: {
        opened: {
          pull: { targets: [TargetRole.CONTRIBUTOR], value: 5 },
          issue: { targets: [TargetRole.CONTRIBUTOR], value: 2 },
        },
      },
    };

    it("should find config for pull_request.opened", () => {
      const config = getEventRewardConfig(settings, "pull_request.opened");
      expect(config).toBeDefined();
      expect(config?.pull?.value).toBe(5);
    });

    it("should return undefined for unconfigured event", () => {
      const config = getEventRewardConfig(settings, "pull_request.closed");
      expect(config).toBeUndefined();
    });

    it("should return undefined for unknown category", () => {
      const config = getEventRewardConfig(settings, "unknown.event");
      expect(config).toBeUndefined();
    });
  });

  describe("calculateReward", () => {
    it("should calculate reward for matching target", () => {
      const reward = calculateReward({ pull: { targets: [TargetRole.CONTRIBUTOR], value: 5 } }, "pull", ContributorClass.CONTRIBUTOR, "bob");
      expect(reward).toBe(5);
    });

    it("should return 0 for non-matching target", () => {
      const reward = calculateReward({ pull: { targets: [TargetRole.ISSUER], value: 5 } }, "pull", ContributorClass.CONTRIBUTOR, "bob");
      expect(reward).toBe(0);
    });

    it("should return 0 for undefined config", () => {
      const reward = calculateReward(undefined, "pull", ContributorClass.CONTRIBUTOR, "bob");
      expect(reward).toBe(0);
    });

    it("should return 0 for missing context type", () => {
      const reward = calculateReward({ issue: { targets: [TargetRole.CONTRIBUTOR], value: 3 } }, "pull", ContributorClass.CONTRIBUTOR, "bob");
      expect(reward).toBe(0);
    });

    it("should handle negative values for event negation", () => {
      const reward = calculateReward({ pull: { targets: [TargetRole.REVIEWERS], value: -1 } }, "pull", ContributorClass.CONTRIBUTOR, "bob", {
        reviewers: ["bob"],
      });
      expect(reward).toBe(-1);
    });
  });

  describe("applyLabelOverrides", () => {
    it("should add label override values", () => {
      const result = applyLabelOverrides(10, [{ name: "bug" }], { bug: { value: 5 } });
      expect(result).toBe(15);
    });

    it("should handle negative label overrides", () => {
      const result = applyLabelOverrides(10, [{ name: "bug" }], { bug: { value: -5 } });
      expect(result).toBe(5);
    });

    it("should return base reward when no overrides", () => {
      const result = applyLabelOverrides(10, [{ name: "feature" }], undefined);
      expect(result).toBe(10);
    });

    it("should handle multiple labels", () => {
      const result = applyLabelOverrides(10, [{ name: "bug" }, { name: "priority" }], { bug: { value: -5 }, priority: { value: 10 } });
      expect(result).toBe(15);
    });
  });

  describe("calculateRewards", () => {
    const settings: PluginSettings = {
      pull_request: {
        opened: {
          pull: { targets: [TargetRole.CONTRIBUTOR, TargetRole.ISSUER], value: 5 },
        },
      },
      labelOverrides: {
        "good-first-issue": { value: 3 },
      },
    };

    it("should calculate rewards for multiple contributors", () => {
      const rewards = calculateRewards(
        settings,
        "pull_request.opened",
        [
          { login: "alice", issueAuthor: "alice", isOrgMember: false },
          { login: "bob", issueAuthor: "alice", assignees: [], isOrgMember: false },
        ],
        "pull",
        []
      );

      expect(rewards).toHaveLength(2);
      expect(rewards.find((r) => r.login === "alice")?.reward).toBe(5);
      expect(rewards.find((r) => r.login === "bob")?.reward).toBe(5);
    });

    it("should filter out zero rewards", () => {
      const rewards = calculateRewards(
        settings,
        "pull_request.opened",
        [{ login: "charlie", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: true }],
        "pull",
        []
      );

      expect(rewards).toHaveLength(0);
    });

    it("should apply label overrides", () => {
      const rewards = calculateRewards(settings, "pull_request.opened", [{ login: "alice", issueAuthor: "alice", isOrgMember: false }], "pull", [
        { name: "good-first-issue" },
      ]);

      expect(rewards[0]?.reward).toBe(8);
    });
  });

  describe("aggregateRewards", () => {
    it("should aggregate rewards by login", () => {
      const rewards = [
        { login: "alice", class: ContributorClass.ISSUER, reward: 5 },
        { login: "alice", class: ContributorClass.ISSUER, reward: 3 },
        { login: "bob", class: ContributorClass.CONTRIBUTOR, reward: 2 },
      ];

      const aggregated = aggregateRewards(rewards);
      expect(aggregated.get("alice")?.total).toBe(8);
      expect(aggregated.get("bob")?.total).toBe(2);
    });

    it("should handle empty rewards", () => {
      const aggregated = aggregateRewards([]);
      expect(aggregated.size).toBe(0);
    });
  });

  describe("Integration: full reward flow", () => {
    const fullSettings: PluginSettings = {
      pull_request: {
        closed: {
          pull: { targets: [TargetRole.ASSIGNEE], value: 10 },
          issue: { targets: [TargetRole.ISSUER], value: 1 },
        },
        opened: {
          pull: { targets: [TargetRole.CONTRIBUTOR], value: 2 },
        },
        review_requested: {
          pull: { targets: [TargetRole.REVIEWERS], value: 1 },
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
      },
    };

    it("should handle a complete pull request lifecycle", () => {
      const openRewards = calculateRewards(fullSettings, "pull_request.opened", [{ login: "bob", issueAuthor: "alice", isOrgMember: false }], "pull", []);
      expect(openRewards).toHaveLength(1);
      expect(openRewards[0].reward).toBe(2);

      const reviewRewards = calculateRewards(
        fullSettings,
        "pull_request.review_requested",
        [{ login: "charlie", issueAuthor: "alice", isOrgMember: false }],
        "pull",
        [],
        { reviewers: ["charlie"] }
      );
      expect(reviewRewards).toHaveLength(1);
      expect(reviewRewards[0].reward).toBe(1);

      const closeRewards = calculateRewards(
        fullSettings,
        "pull_request.closed",
        [{ login: "bob", issueAuthor: "alice", assignees: [{ login: "bob" }], isOrgMember: false }],
        "pull",
        [{ name: "bug" }]
      );
      expect(closeRewards).toHaveLength(1);
      expect(closeRewards[0].reward).toBe(15);
    });
  });
});
