import { ContributorRole, WebhookRewardContext, CalculatedReward } from './types';

export function calculateReward(ctx: WebhookRewardContext): CalculatedReward {
  if (ctx.isBot) {
    return {
      baseAmountUsd: 0,
      multiplier: 1.0,
      roleBonusUsd: 0,
      totalUsd: 0,
      eligible: false,
      reason: 'Automated bot accounts are ineligible for rewards'
    };
  }

  const basePrice = ctx.priceLabelUsd ?? (ctx.timeLabelHours ? ctx.timeLabelHours * 75 : 0);
  if (basePrice <= 0) {
    return {
      baseAmountUsd: 0,
      multiplier: 1.0,
      roleBonusUsd: 0,
      totalUsd: 0,
      eligible: false,
      reason: 'No valid price or time labels detected on issue'
    };
  }

  const multiplier = Math.max(1.0, ctx.priorityMultiplier ?? 1.0);
  
  // Role incentive bonus
  let roleBonus = 0;
  if (ctx.authorAssociation === 'FIRST_TIME_CONTRIBUTOR') {
    roleBonus = 10.0; // Onboarding bonus
  }

  const total = (basePrice * multiplier) + roleBonus;

  return {
    baseAmountUsd: basePrice,
    multiplier,
    roleBonusUsd: roleBonus,
    totalUsd: parseFloat(total.toFixed(2)),
    eligible: true
  };
}

export function parseWebhookLabels(labels: Array<{ name: string }>): { price?: number; timeHours?: number; priority?: number } {
  let price: number | undefined;
  let timeHours: number | undefined;
  let priority: number | undefined;

  for (const label of labels) {
    const priceMatch = label.name.match(/Price:\s*([0-9.]+)\s*USD/i);
    if (priceMatch) price = parseFloat(priceMatch[1]);

    const timeMatch = label.name.match(/Time:\s*<([0-9.]+)\s*(Hour|Hours|Minutes|Day|Days|Week|Weeks)/i);
    if (timeMatch) {
      const val = parseFloat(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      if (unit.startsWith('min')) timeHours = val / 60;
      else if (unit.startsWith('day')) timeHours = val * 8;
      else if (unit.startsWith('week')) timeHours = val * 40;
      else timeHours = val;
    }

    const priorityMatch = label.name.match(/Priority:\s*([0-9]+)/i);
    if (priorityMatch) priority = 1.0 + (parseFloat(priorityMatch[1]) * 0.25);
  }

  return { price, timeHours, priority };
}
