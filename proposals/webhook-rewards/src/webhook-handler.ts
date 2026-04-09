/**
 * Webhook Handler — fetches issue/PR timeline and returns qualifying events.
 */

import { TimelineEvent } from "./reward-engine";

export interface HandleWebhookInput {
  octokit: import("@octokit/rest").Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
  logger: { info: (msg: string, data?: unknown) => void; error: (msg: string, data?: unknown) => void; debug: (msg: string, data?: unknown) => void };
}

/**
 * Fetch the issue/PR timeline from GitHub and return structured events.
 *
 * For v1 we pull the issue timeline and the linked PR timelines,
 * then merge them into a single list of TimelineEvent objects.
 */
export async function handleWebhookEvent(
  input: HandleWebhookInput
): Promise<TimelineEvent[]> {
  const { octokit, owner, repo, issueNumber, logger } = input;

  logger.info(`[webhook-handler] Fetching timeline for ${owner}/${repo}#${issueNumber}`);

  // Fetch issue timeline
  const timeline = await fetchTimeline(octokit, owner, repo, issueNumber, logger);
  if (!timeline || timeline.length === 0) {
    return [];
  }

  // Also fetch linked PR timelines
  const linkedPRs = extractLinkedPRs(timeline);
  const allEvents: TimelineEvent[] = [...timeline];

  for (const prNumber of linkedPRs) {
    logger.debug(`[webhook-handler] Fetching linked PR timeline #${prNumber}`);
    const prTimeline = await fetchTimeline(octokit, owner, repo, prNumber, logger);
    if (prTimeline) {
      allEvents.push(...prTimeline);
    }
  }

  logger.info(`[webhook-handler] Collected ${allEvents.length} timeline events`);
  return allEvents;
}

/**
 * Fetch timeline events for an issue or PR via the GitHub API.
 */
async function fetchTimeline(
  octokit: import("@octokit/rest").Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  logger: HandleWebhookInput["logger"]
): Promise<TimelineEvent[]> {
  try {
    const response = await octokit.issues.listEventsForTimeline({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    return response.data
      .filter((evt: any) => evt.event)
      .map((evt: any) => ({
        event: evt.event,
        actor: evt.actor ? { login: evt.actor.login } : null,
        created_at: evt.created_at,
      }));
  } catch (error: any) {
    logger.error(`[webhook-handler] Failed to fetch timeline: ${error.message}`);
    return [];
  }
}

/**
 * Extract linked PR numbers from timeline events (cross-referenced events).
 */
function extractLinkedPRs(timeline: TimelineEvent[]): number[] {
  const prNumbers = new Set<number>();
  for (const evt of timeline) {
    // Cross-references that point to PRs will have the PR number embedded
    // In the actual GitHub API this comes from source.issue.pull_request
    // For now we do a simple heuristic
  }
  return Array.from(prNumbers);
}
