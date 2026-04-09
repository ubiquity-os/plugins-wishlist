import { PluginContext, ActionHandler } from "@ubiquity-os/plugin-sdk";
import { startDeadlineScheduler, checkDeadlines } from "./scheduler";

export interface DeadlineConfig {
  timezone: string;
  deadlineRewardRatio: number;
  disqualificationEnabled: boolean;
  projectView: string | null;
}

const DEFAULT_CONFIG: DeadlineConfig = {
  timezone: "UTC",
  deadlineRewardRatio: 0.25,
  disqualificationEnabled: true,
  projectView: null,
};

interface DeadlineMetadata {
  issueNumber: number;
  deadline: string; // ISO 8601
  baseTaskValue: number;
  assignedAt: string; // ISO 8601
  assignee: string;
  owner: string;
  repo: string;
}

/**
 * Calculate the final reward based on completion time vs deadline.
 */
export function calculateReward(
  baseTaskValue: number,
  deadlineRewardRatio: number,
  disqualificationEnabled: boolean,
  assignedAt: Date,
  deadline: Date,
  completedAt: Date
): number {
  const assignedTime = assignedAt.getTime();
  const deadlineTime = deadline.getTime();
  const completedTime = completedAt.getTime();

  const totalDuration = deadlineTime - assignedTime;
  if (totalDuration <= 0) return baseTaskValue;

  const actualCompletionTime = completedTime - assignedTime;
  const ratio = actualCompletionTime / totalDuration;

  // Completed before or on deadline
  if (ratio <= 1) {
    const bonus = deadlineRewardRatio * (1 - ratio);
    return baseTaskValue * (1 + bonus);
  }

  // Past deadline
  if (disqualificationEnabled) {
    return 0;
  }

  // Gradual decline: 0 at 2x the deadline
  const penalty = ratio - 1;
  const multiplier = Math.max(0, 1 - penalty);
  return baseTaskValue * multiplier;
}

/**
 * Parse /deadline command from comment body.
 * Supports: /deadline 2025-12-31, /deadline 2025-12-31T23:59:00Z
 */
function parseDeadlineCommand(body: string): Date | null {
  const match = body.match(/\/deadline\s+(\S+)/);
  if (!match) return null;
  const date = new Date(match[1]);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Store deadline metadata as an issue comment with hidden markup.
 */
async function storeDeadlineMetadata(
  ctx: PluginContext,
  owner: string,
  repo: string,
  issueNumber: number,
  metadata: DeadlineMetadata
): Promise<void> {
  const body = `<!-- deadline-metadata ${JSON.stringify(metadata)} -->\n⏰ **Deadline set:** ${new Date(metadata.deadline).toUTCString()}`;
  await ctx.octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
}

/**
 * Apply deadline-related labels to an issue.
 */
async function applyDeadlineLabels(
  ctx: PluginContext,
  owner: string,
  repo: string,
  issueNumber: number,
  deadline: Date
): Promise<void> {
  const now = new Date();
  const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  let label: string;
  if (hoursUntil <= 1) {
    label = "deadline: 1h";
  } else if (hoursUntil <= 24) {
    label = "deadline: 24h";
  } else {
    label = "deadline: pending";
  }

  // Ensure label exists
  try {
    await ctx.octokit.issues.getLabel({ owner, repo, name: label });
  } catch {
    await ctx.octokit.issues.createLabel({ owner, repo, name: label, color: "ff6b6b" });
  }

  await ctx.octokit.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [label] });
}

/**
 * Handle the /deadline command.
 */
export const deadlineHandler: ActionHandler = async (ctx: PluginContext) => {
  const config: DeadlineConfig = { ...DEFAULT_CONFIG, ...(ctx.config?.commandDeadline || {}) };
  const { owner, repo, number: issueNumber } = ctx.payload.issue
    ? { owner: ctx.payload.repository.owner.login, repo: ctx.payload.repository.name, number: ctx.payload.issue.number }
    : { owner: "", repo: "", number: 0 };

  if (!ctx.payload.comment?.body) return;
  const deadline = parseDeadlineCommand(ctx.payload.comment.body);
  if (!deadline) return;

  const issue = ctx.payload.issue;
  const assignee = issue.assignees?.[0]?.login || issue.assignee?.login || "";
  const baseTaskValue = extractTaskValue(issue.labels);

  const metadata: DeadlineMetadata = {
    issueNumber,
    deadline: deadline.toISOString(),
    baseTaskValue,
    assignedAt: new Date().toISOString(),
    assignee,
    owner,
    repo,
  };

  await storeDeadlineMetadata(ctx, owner, repo, issueNumber, metadata);
  await applyDeadlineLabels(ctx, owner, repo, issueNumber, deadline);

  ctx.logger.info(`Deadline set for #${issueNumber}: ${deadline.toISOString()}`);
};

/**
 * Extract task value from issue labels (e.g., "Price: 100 USD").
 */
function extractTaskValue(labels: any[]): number {
  for (const label of labels) {
    const name = typeof label === "string" ? label : label.name || "";
    const match = name.match(/Price:\s*\$?(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

/**
 * Handle task completion — calculate and post reward.
 */
export async function handleCompletion(
  ctx: PluginContext,
  owner: string,
  repo: string,
  issueNumber: number,
  config: DeadlineConfig
): Promise<void> {
  // In a real implementation, we'd look up stored deadline metadata
  // from the issue comments and compute the reward
  const completedAt = new Date();
  const reward = calculateReward(
    0, // baseTaskValue - would be loaded from metadata
    config.deadlineRewardRatio,
    config.disqualificationEnabled,
    new Date(), // assignedAt
    new Date(), // deadline
    completedAt
  );

  const body = reward > 0
    ? `🎉 **Task completed!** Calculated reward: **$${reward.toFixed(2)}**`
    : `⚠️ **Task completed past deadline.** Reward: **$0.00** (disqualification enabled)`;

  await ctx.octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
}

// Start the deadline scheduler
startDeadlineScheduler();

export { checkDeadlines };
export default deadlineHandler;
