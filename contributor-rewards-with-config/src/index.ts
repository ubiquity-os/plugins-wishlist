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
    logger.info(`No reward configuration found for event: ${eventName}`);
    return;
  }

  // Determine if we're in a pull or issue context
  // GitHub uses payload.issue.pull_request for PR-backed issue events
  const isPullContext = "pull_request" in payload || ("issue" in payload && payload.issue && "pull_request" in (payload.issue as Record<string, unknown>));
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

  // Build contributor list from multiple potential targets
  const contributorSet = new Set<string>();
  const contributors: Array<{ login: string; issueAuthor?: string; assignees?: Array<{ login: string }>; isOrgMember: boolean }> = [];

  const addContributor = (login: string) => {
    if (login && !contributorSet.has(login)) {
      contributorSet.add(login);
      contributors.push({
        login,
        issueAuthor: issueOrPull.user?.login,
        assignees: issueOrPull.assignees,
        isOrgMember: false,
      });
    }
  };

  // Sender
  addContributor(sender.login);
  // Issue/PR author
  if (issueOrPull.user?.login) addContributor(issueOrPull.user.login);
  // Assignees
  if (issueOrPull.assignees) {
    for (const a of issueOrPull.assignees) addContributor(a.login);
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
