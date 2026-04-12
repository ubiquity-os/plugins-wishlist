import { Context } from "../types";
import { parseEventName, getEventRewardConfig, calculateRewards, ContributorReward, aggregateRewards } from "../handlers/rewards";

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
  const isPullContext = "pull_request" in payload;
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

  // For now, compute reward for the sender
  const contributors = [
    {
      login: sender.login,
      issueAuthor: issueOrPull.user?.login,
      assignees: issueOrPull.assignees,
      isOrgMember: false, // Would need API call to determine
    },
  ];

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
