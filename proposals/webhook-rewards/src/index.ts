/**
 * Webhook Rewards — No Config v1
 *
 * A zero-config UbiquityOS plugin that:
 * 1. Listens to GitHub webhook events on issues and pull requests
 * 2. Fetches the issue/PR timeline
 * 3. Counts qualifying events per contributor
 * 4. Computes reward totals based on Time/Priority labels
 * 5. Generates reward permits for contributors with the "Contributor" role
 *
 * Bounty: ubiquity-os/plugins-wishlist#46
 */

import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { manifest } from "../manifest.json";
import { handleWebhookEvent } from "./webhook-handler";
import { computeRewards, ContributorRewards } from "./reward-engine";

export type SupportedEvents =
  | "issues.closed"
  | "pull_request.closed"
  | "pull_request.merged";

export interface PluginEnv {
  APP_ID: string;
  PRIVATE_KEY: string;
  WEBHOOK_SECRET?: string;
}

export interface PluginContext {
  env: PluginEnv;
  payload: Record<string, unknown>;
  eventName: string;
  octokit: import("@octokit/rest").Octokit;
  logger: { info: (msg: string, data?: unknown) => void; error: (msg: string, data?: unknown) => void; debug: (msg: string, data?: unknown) => void };
}

/**
 * Default role names that qualify for rewards.
 * Overridable via config in future iterations.
 */
const DEFAULT_QUALIFYING_ROLES = ["contributor", "member", "collaborator"];

/**
 * Default pricing multipliers mapped from label names.
 * Time labels carry a multiplier; Priority labels carry a base amount.
 */
const DEFAULT_PRICING: Record<string, number> = {
  "Time: <1 Hour": 1,
  "Time: <1 Day": 2,
  "Time: <1 Week": 4,
  "Time: <1 Month": 8,
  "Priority: Urgent": 500,
  "Priority: High": 300,
  "Priority: Medium": 200,
  "Priority: Low": 100,
};

/**
 * Events we count from the issue/PR timeline, each worth 1 unit.
 */
const COUNTED_TIMELINE_EVENTS = [
  "committed",
  "commented",
  "labeled",
  "closed",
  "merged",
  "cross-referenced",
  "reviewed",
  "approved",
];

/**
 * Main plugin entry point.
 */
const plugin = createPlugin<PluginContext>(manifest, async (context) => {
  const { eventName, payload, octokit, logger } = context;

  logger.info(`[webhook-rewards] Received event: ${eventName}`);

  // Only handle supported events
  const supportedEvents: SupportedEvents[] = [
    "issues.closed",
    "pull_request.closed",
    "pull_request.merged",
  ];

  const normalizedEvent = normalizeEventName(eventName, payload);
  if (!supportedEvents.includes(normalizedEvent as SupportedEvents)) {
    logger.debug(`[webhook-rewards] Ignoring event: ${eventName}`);
    return;
  }

  // Extract owner/repo/issue_number
  const repo = extractRepoMeta(payload);
  if (!repo) {
    logger.error("[webhook-rewards] Could not extract repo metadata from payload");
    return;
  }

  logger.info(`[webhook-rewards] Processing ${normalizedEvent} for ${repo.owner}/${repo.repo}#${repo.issue_number}`);

  // Handle the webhook event (fetch timeline, filter contributors)
  const timelineEvents = await handleWebhookEvent({
    octokit,
    owner: repo.owner,
    repo: repo.repo,
    issueNumber: repo.issue_number,
    logger,
  });

  if (!timelineEvents || timelineEvents.length === 0) {
    logger.info("[webhook-rewards] No timeline events found, nothing to reward");
    return;
  }

  // Fetch issue labels for pricing
  const labels = extractLabels(payload);

  // Compute rewards
  const rewards = computeRewards({
    timelineEvents,
    labels,
    pricing: DEFAULT_PRICING,
    countedEvents: COUNTED_TIMELINE_EVENTS,
    qualifyingRoles: DEFAULT_QUALIFYING_ROLES,
  });

  if (rewards.length === 0) {
    logger.info("[webhook-rewards] No qualifying contributors found");
    return;
  }

  logger.info(`[webhook-rewards] Computed rewards for ${rewards.length} contributors`);

  // Generate permits
  for (const reward of rewards) {
    await generatePermit({
      octokit,
      owner: repo.owner,
      repo: repo.repo,
      issueNumber: repo.issue_number,
      reward,
      logger,
    });
  }

  logger.info("[webhook-rewards] All reward permits generated");
});

/**
 * Normalize event name for merged PRs.
 */
function normalizeEventName(eventName: string, payload: Record<string, unknown>): string {
  if (eventName === "pull_request" && (payload as any).action === "closed") {
    const pr = (payload as any).pull_request;
    if (pr && pr.merged) {
      return "pull_request.merged";
    }
    return "pull_request.closed";
  }
  if (eventName === "issues" && (payload as any).action === "closed") {
    return "issues.closed";
  }
  return eventName;
}

/**
 * Extract owner, repo, and issue_number from webhook payload.
 */
function extractRepoMeta(payload: Record<string, unknown>): {
  owner: string;
  repo: string;
  issue_number: number;
} | null {
  const repo = (payload as any).repository;
  const issue = (payload as any).issue || (payload as any).pull_request;
  if (!repo || !issue) return null;

  return {
    owner: repo.owner?.login || repo.full_name?.split("/")[0],
    repo: repo.name,
    issue_number: issue.number,
  };
}

/**
 * Extract label names from the issue/PR payload.
 */
function extractLabels(payload: Record<string, unknown>): string[] {
  const issue = (payload as any).issue || (payload as any).pull_request;
  if (!issue?.labels) return [];
  return issue.labels.map((l: any) => (typeof l === "string" ? l : l.name));
}

/**
 * Generate a reward permit comment on the issue.
 *
 * In a production setup this would call the UbiquityOS permit-generation
 * system.  For the no-config v1 we post a structured comment that the
 * permit bot can parse.
 */
async function generatePermit({
  octokit,
  owner,
  repo,
  issueNumber,
  reward,
  logger,
}: {
  octokit: import("@octokit/rest").Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
  reward: ContributorRewards;
  logger: PluginContext["logger"];
}): Promise<void> {
  const body = [
    `## 🏆 Reward Permit`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Contributor** | @${reward.username} |`,
    `| **Event Count** | ${reward.eventCount} |`,
    `| **Base Amount** | ${reward.baseAmount} |`,
    `| **Multiplier** | ${reward.multiplier}x |`,
    `| **Total Reward** | **${reward.totalReward}** |`,
    ``,
    `_Generated by [webhook-rewards](https://github.com/ubiquity-os/plugins-wishlist/tree/main/proposals/webhook-rewards) (no-config v1)_`,
  ].join("\n");

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  logger.info(`[webhook-rewards] Permit posted for @${reward.username}: ${reward.totalReward}`);
}

export { plugin };
export default plugin;
