export type ContributorRole = 
  | 'COLLABORATOR'
  | 'CONTRIBUTOR'
  | 'MEMBER'
  | 'OWNER'
  | 'FIRST_TIME_CONTRIBUTOR'
  | 'NONE';

export interface WebhookRewardContext {
  issueNumber: number;
  authorAssociation: ContributorRole;
  priceLabelUsd?: number;
  timeLabelHours?: number;
  priorityMultiplier?: number;
  isBot?: boolean;
}

export interface CalculatedReward {
  baseAmountUsd: number;
  multiplier: number;
  roleBonusUsd: number;
  totalUsd: number;
  eligible: boolean;
  reason?: string;
}
