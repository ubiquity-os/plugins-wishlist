import { calculateReward, parseWebhookLabels } from '../src/engine';

describe('Generalized Webhook + Contributor Role -> Rewards Test Suite (#49)', () => {
  it('should parse labels and calculate standard reward for contributor', () => {
    const labels = [
      { name: 'Price: 75 USD' },
      { name: 'Time: <1 Hour' },
      { name: 'Priority: 1' }
    ];
    const parsed = parseWebhookLabels(labels);
    expect(parsed.price).toBe(75);
    expect(parsed.timeHours).toBe(1);
    expect(parsed.priority).toBe(1.25);

    const reward = calculateReward({
      issueNumber: 49,
      authorAssociation: 'CONTRIBUTOR',
      priceLabelUsd: parsed.price,
      priorityMultiplier: parsed.priority,
      isBot: false
    });

    expect(reward.eligible).toBe(true);
    expect(reward.baseAmountUsd).toBe(75);
    expect(reward.totalUsd).toBe(93.75); // 75 * 1.25
  });

  it('should add first-time contributor onboarding bonus', () => {
    const reward = calculateReward({
      issueNumber: 50,
      authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
      priceLabelUsd: 50,
      priorityMultiplier: 1.0,
      isBot: false
    });

    expect(reward.eligible).toBe(true);
    expect(reward.roleBonusUsd).toBe(10);
    expect(reward.totalUsd).toBe(60);
  });

  it('should reject bot accounts', () => {
    const reward = calculateReward({
      issueNumber: 51,
      authorAssociation: 'NONE',
      priceLabelUsd: 100,
      isBot: true
    });

    expect(reward.eligible).toBe(false);
    expect(reward.totalUsd).toBe(0);
    expect(reward.reason).toContain('bot');
  });

  it('should handle missing price labels gracefully', () => {
    const reward = calculateReward({
      issueNumber: 52,
      authorAssociation: 'COLLABORATOR',
      isBot: false
    });

    expect(reward.eligible).toBe(false);
    expect(reward.totalUsd).toBe(0);
  });
});
