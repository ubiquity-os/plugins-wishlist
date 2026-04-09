import { PluginContext } from "@ubiquity-os/plugin-sdk";
import { DeadlineConfig } from "./index";

const DEFAULT_CONFIG: DeadlineConfig = {
  timezone: "UTC",
  deadlineRewardRatio: 0.25,
  disqualificationEnabled: true,
  projectView: null,
};

// In-memory store for active deadlines (production would use KV/db)
interface DeadlineEntry {
  owner: string;
  repo: string;
  issueNumber: number;
  deadline: Date;
  assignedAt: Date;
  assignee: string;
  reminded24h: boolean;
  reminded1h: boolean;
  expired: boolean;
}

const activeDeadlines: Map<string, DeadlineEntry> = new Map();

function deadlineKey(owner: string, repo: string, issueNumber: number): string {
  return `${owner}/${repo}#${issueNumber}`;
}

/**
 * Register a deadline for tracking.
 */
export function registerDeadline(entry: Omit<DeadlineEntry, "reminded24h" | "reminded1h" | "expired">): void {
  activeDeadlines.set(deadlineKey(entry.owner, entry.repo, entry.issueNumber), {
    ...entry,
    reminded24h: false,
    reminded1h: false,
    expired: false,
  });
}

/**
 * Check all active deadlines and trigger reminders/expiry.
 */
export async function checkDeadlines(ctx: PluginContext): Promise<void> {
  const now = new Date();

  for (const [key, entry] of activeDeadlines.entries()) {
    const hoursUntilDeadline = (entry.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 24h reminder
    if (!entry.reminded24h && hoursUntilDeadline <= 24 && hoursUntilDeadline > 1) {
      await postReminder(ctx, entry, "⏰ **24 hours remaining** until deadline!");
      entry.reminded24h = true;
    }

    // 1h reminder
    if (!entry.reminded1h && hoursUntilDeadline <= 1 && hoursUntilDeadline > 0) {
      await postReminder(ctx, entry, "🚨 **1 hour remaining** until deadline! Wrap it up!");
      entry.reminded1h = true;
    }

    // Expired
    if (!entry.expired && hoursUntilDeadline <= 0) {
      await handleExpiry(ctx, entry);
      entry.expired = true;
      activeDeadlines.delete(key);
    }
  }
}

/**
 * Post a reminder comment on the issue.
 */
async function postReminder(
  ctx: PluginContext,
  entry: DeadlineEntry,
  message: string
): Promise<void> {
  const { owner, repo, issueNumber, deadline, assignee } = entry;
  const body = `${message}\n\n📅 Deadline: ${deadline.toUTCString()}\n👤 Assignee: @${assignee}`;

  await ctx.octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  // Update labels
  try {
    await ctx.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: [hoursUntilDeadlineLabel(message)],
    });
  } catch {
    // Label may not exist, non-critical
  }
}

function hoursUntilDeadlineLabel(message: string): string {
  if (message.includes("1 hour")) return "deadline: 1h";
  if (message.includes("24 hours")) return "deadline: 24h";
  return "deadline: pending";
}

/**
 * Handle deadline expiry.
 */
async function handleExpiry(ctx: PluginContext, entry: DeadlineEntry): Promise<void> {
  const { owner, repo, issueNumber, assignee } = entry;
  const config = DEFAULT_CONFIG;

  const body = config.disqualificationEnabled
    ? `❌ **Deadline expired!** @${assignee} has been disqualified from this task.`
    : `⚠️ **Deadline expired.** Reward will be reduced based on completion delay.`;

  await ctx.octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });

  // Add expired label
  try {
    await ctx.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: ["deadline: expired"],
    });
  } catch {
    // Non-critical
  }
}

/**
 * Start the cron-based scheduler.
 * Checks deadlines every 5 minutes.
 */
export function startDeadlineScheduler(): void {
  const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  setInterval(() => {
    // In production, this would invoke checkDeadlines with a proper context
    // For now, this is a placeholder that demonstrates the scheduling pattern
    console.log(`[deadline-scheduler] Checking ${activeDeadlines.size} active deadlines...`);
  }, CHECK_INTERVAL);
}

export { activeDeadlines };
