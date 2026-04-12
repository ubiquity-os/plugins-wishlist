import { StaticDecode, Type as T } from "@sinclair/typebox";

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

const targetRoleEnum = T.Enum(TargetRole);

/**
 * Reward entry for a single context (pull or issue)
 */
const rewardEntry = T.Object(
  {
    targets: T.Array(targetRoleEnum, { default: [TargetRole.CONTRIBUTOR] }),
    value: T.Number({ default: 0 }),
  },
  { default: { targets: [TargetRole.CONTRIBUTOR], value: 0 } }
);

/**
 * Event reward config with pull/issue context separation
 */
const eventReward = T.Object(
  {
    pull: T.Optional(rewardEntry),
    issue: T.Optional(rewardEntry),
  },
  { default: {} }
);

/**
 * Pull request events
 */
const pullRequestEvents = T.Partial(
  T.Object({
    assigned: eventReward,
    auto_merge_disabled: eventReward,
    auto_merge_enabled: eventReward,
    closed: eventReward,
    converted_to_draft: eventReward,
    demilestoned: eventReward,
    dequeued: eventReward,
    edited: eventReward,
    enqueued: eventReward,
    labeled: eventReward,
    locked: eventReward,
    milestoned: eventReward,
    opened: eventReward,
    ready_for_review: eventReward,
    reopened: eventReward,
    review_request_removed: eventReward,
    review_requested: eventReward,
    synchronize: eventReward,
    unassigned: eventReward,
    unlabeled: eventReward,
    unlocked: eventReward,
  })
);

/**
 * Pull request review events
 */
const pullRequestReviewEvents = T.Partial(
  T.Object({
    dismissed: eventReward,
    edited: eventReward,
    submitted: eventReward,
  })
);

/**
 * Pull request review comment events
 */
const pullRequestReviewCommentEvents = T.Partial(
  T.Object({
    created: eventReward,
    edited: eventReward,
    deleted: eventReward,
  })
);

/**
 * Issue comment events
 */
const issueCommentEvents = T.Partial(
  T.Object({
    created: eventReward,
    edited: eventReward,
    deleted: eventReward,
  })
);

/**
 * Issues events
 */
const issuesEvents = T.Partial(
  T.Object({
    assigned: eventReward,
    closed: eventReward,
    deleted: eventReward,
    demilestoned: eventReward,
    edited: eventReward,
    labeled: eventReward,
    locked: eventReward,
    milestoned: eventReward,
    opened: eventReward,
    pinned: eventReward,
    reopened: eventReward,
    unassigned: eventReward,
    unlabeled: eventReward,
    unlocked: eventReward,
    unpinned: eventReward,
  })
);

/**
 * Label-specific overrides
 */
const labelOverrides = T.Record(T.String(), T.Object({ value: T.Number({ default: 0 }) }), { default: {} });

/**
 * Push event config
 */
const pushEvent = T.Object(
  {
    pull: T.Optional(rewardEntry),
    issue: T.Optional(rewardEntry),
  },
  { default: {} }
);

/**
 * Main plugin settings schema
 */
export const pluginSettingsSchema = T.Object(
  {
    pull_request: T.Optional(pullRequestEvents),
    pull_request_review: T.Optional(pullRequestReviewEvents),
    pull_request_review_comment: T.Optional(pullRequestReviewCommentEvents),
    issue_comment: T.Optional(issueCommentEvents),
    issues: T.Optional(issuesEvents),
    push: T.Optional(pushEvent),
    labelOverrides: T.Optional(labelOverrides),
  },
  { default: {} }
);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
export type EventRewardType = StaticDecode<typeof eventReward>;
export type RewardEntryType = StaticDecode<typeof rewardEntry>;
