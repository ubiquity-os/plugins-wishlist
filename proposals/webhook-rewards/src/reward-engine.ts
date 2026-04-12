/**
 * Reward Engine — computes reward amounts from timeline events and labels.
 *
 * Algorithm (v1 — no config):
 *   1. Group timeline events by contributor (actor login).
 *   2. Count events that match the COUNTED_TIMELINE_EVENTS list.
 *   3. Derive a base amount from Priority labels.
 *   4. Derive a multiplier from Time labels.
 *   5. totalReward = baseAmount * eventCount * multiplier
 */

export interface ContributorRewards {
  username: string;
  eventCount: number;
  baseAmount: number;
  multiplier: number;
  totalReward: number;
  role: string;
}

export interface TimelineEvent {
  event: string;
  actor?: { login: string } | null;
  created_at: string;
}

export interface ComputeRewardsInput {
  timelineEvents: TimelineEvent[];
  labels: string[];
  pricing: Record<string, number>;
  countedEvents: string[];
  qualifyingRoles: string[];
}

/**
 * Compute per-contributor reward totals.
 */
export function computeRewards(input: ComputeRewardsInput): ContributorRewards[] {
  const { timelineEvents, labels, pricing, countedEvents, qualifyingRoles } = input;

  // Step 1: determine base amount from Priority labels
  let baseAmount = 200; // sensible default
  for (const label of labels) {
    const pricingKey = Object.keys(pricing).find(
      (k) => label.toLowerCase() === k.toLowerCase()
    );
    if (pricingKey && isPriorityLabel(pricingKey)) {
      baseAmount = pricing[pricingKey];
    }
  }

  // Step 2: determine multiplier from Time labels
  let multiplier = 1;
  for (const label of labels) {
    const pricingKey = Object.keys(pricing).find(
      (k) => label.toLowerCase() === k.toLowerCase()
    );
    if (pricingKey && isTimeLabel(pricingKey)) {
      multiplier = pricing[pricingKey];
    }
  }

  // Step 3: count events per contributor
  const contributorCounts = new Map<string, number>();
  for (const evt of timelineEvents) {
    if (!countedEvents.includes(evt.event)) continue;
    const login = evt.actor?.login;
    if (!login) continue;
    contributorCounts.set(login, (contributorCounts.get(login) || 0) + 1);
  }

  // Step 4: build reward records
  const rewards: ContributorRewards[] = [];
  for (const [username, eventCount] of contributorCounts.entries()) {
    // In v1, all contributors are treated as qualifying (role check is placeholder)
    const role = "contributor";
    if (!qualifyingRoles.some((r) => role.includes(r.toLowerCase()))) {
      continue;
    }

    const totalReward = baseAmount * eventCount * multiplier;
    rewards.push({ username, eventCount, baseAmount, multiplier, totalReward, role });
  }

  // Sort by total descending
  rewards.sort((a, b) => b.totalReward - a.totalReward);
  return rewards;
}

function isPriorityLabel(label: string): boolean {
  return label.toLowerCase().startsWith("priority");
}

function isTimeLabel(label: string): boolean {
  return label.toLowerCase().startsWith("time");
}

/**
 * Verify a user's role in the org/repo via GitHub API.
 * In v1 this is a stub — always returns true.
 * Future iterations will check actual org/repo roles.
 */
export async function verifyContributorRole(
  _octokit: unknown,
  _owner: string,
  _repo: string,
  _username: string,
  _qualifyingRoles: string[]
): Promise<boolean> {
  // v1: no config — treat everyone as qualifying contributor
  return true;
}
