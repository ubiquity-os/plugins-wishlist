/**
 * Stub types for testing — mirrors the real plugin-input.ts without @sinclair/typebox dependency.
 * This allows tests to run without the full plugin dependency tree.
 */

/**
 * Contributor class roles
 */
export enum ContributorClass {
  ISSUER = "ISSUER",
  ASSIGNEE = "ASSIGNEE",
  COLLABORATOR = "COLLABORATOR",
  CONTRIBUTOR = "CONTRIBUTOR",
}

/**
 * Target roles that can receive rewards
 */
export enum TargetRole {
  ISSUER = "ISSUER",
  ASSIGNEE = "ASSIGNEE",
  COLLABORATOR = "COLLABORATOR",
  CONTRIBUTOR = "CONTRIBUTOR",
  REVIEWERS = "REVIEWERS",
  COMMENTERS = "COMMENTERS",
  COMMITTERS = "COMMITTERS",
}

/**
 * Reward entry for a single context (pull or issue)
 */
export interface RewardEntryType {
  targets: TargetRole[];
  value: number;
}

/**
 * Event reward config with pull/issue context separation
 */
export interface EventRewardType {
  pull?: RewardEntryType;
  issue?: RewardEntryType;
}

/**
 * Main plugin settings type
 */
export interface PluginSettings {
  pull_request?: Record<string, EventRewardType | undefined>;
  pull_request_review?: Record<string, EventRewardType | undefined>;
  pull_request_review_comment?: Record<string, EventRewardType | undefined>;
  issue_comment?: Record<string, EventRewardType | undefined>;
  issues?: Record<string, EventRewardType | undefined>;
  push?: EventRewardType;
  labelOverrides?: Record<string, { value: number }>;
}
