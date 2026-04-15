import { Context } from "./types";
import { parseEventName, getEventRewardConfig, calculateRewards, ContributorReward, aggregateRewards } from "./handlers/rewards";

/**
 * The main plugin function. Processes webhook events and calculates contributor rewards.
 */
export async function runPlugin(context: Context) {
  const { logger, eventName, config, payload } = context;

  const { category, action } = parseEventName(eventName);
  logger.info(`Processing event: ${eventName}`, { category, action });

  // Check if this event has any reward configuration
  const rewardConfig = getEventRewardConfig(config, eventName);
  if (!rewardConfig) {
    logger.info `No reward configuration found for event: ${eventName}`);
    return;
  }

  // Determine if we're in a pull or issue context
  // issue_comment on PRs has payload.issue.pull_request (a truthy object)
  const payloadAny = payload as Record<string, unknown>;
  const issueObj = payloadAny.issue as Record<string, unknown> | undefined;
  const isPullContext = "pull_request" in payload || (issueObj && "pull_request" in issueObj);
  const contextType = isPullContext ? "pull" : "issue";

  // Extract relevant data from payload
  const issueOrPull = isPullContext
    ? (payload as { pull_request: { number: number; user?: { login: string }; assignees?: Array<{ login: string }> } }).pull_request
    : (payload as { issue: { number: number; user?: { login: string }; assignees?: Array<{ login: string }> } }).issue;

  const sender = payload.sender;
  if (!sender?.login) {
    logger.error("No sender login found in payload");
    return;
  }

  // Get labels from the issue/pull
  const labels = (issueOrPull as { labels?: Array<{ name: string }> }).labels || [];

  // Collect all relevant contributors based on event type
  const contributors: Array<{
    login: string;
    issueAuthor: boolean;
    assignees?: Array<{ login: string }>;
    isOrgMember: boolean;
    role?: string;
  }> = [];

  // Add the sender/actor
  contributors.push({
    login: sender.login,
    issueAuthor: issueOrPull.user?.login === sender.login,
    assignees: issueOrPull.assignees,
    isOrgMember: false, // TODO: resolve via API call when available
  });

  // For review_requested events, add the requested reviewer
  const payloadAny2 = payload as Record<string, unknown>;
  const requestedReviewer = payloadAny2.requested_reviewer as { login: string } | undefined;
  if (requestedReviewer?.login && requestedReviewer.login !== sender.login) {
    contributors.push({
      login: requestedReviewer.login,
      issueAuthor: issueOrPull.user?.login === requestedReviewer.login,
      assignees: issueOrPull.assignees,
      isOrgMember: false,
      role: "reviewer",
    });
  }

  // Add assignees as potential collaborators
  if (issueOrPull.assignees) {
    for (const assignee of issueOrPull.assignees) {
      if (assignee.login !== sender.login && assigee.login !== requestedReviewer?.login) {
        contributors.push({
          login: assignee.login,
          issueAuthor: issueOrPull.user?.login === assignee.login,
          assignees: issueOrPull.assignees,
          isOrgMember: false,
          role: "assignee",
        });
      }
    }
  }

  const rewards: ContributorReward[] = calculateRewards(config, eventName, contributors, contextType, labels);

  if (rewards.length === 0) {
    logger.info("No rewards to distribute for this event");
    return;
  }

  // Log the reward results
  for (const reward of rewards) {
    logger.ok(`Reward calculated: ${reward.login} (${reward.class}) → ${reward.reward}`);
  }

  // Aggregate and return results
  const aggregated = aggregateRewards(rewards);
  logger.info("Reward calculation complete", Object.fromEntries(aggregated));

  return { rewards, aggregated };
}
