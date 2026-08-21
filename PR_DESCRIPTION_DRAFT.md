# test(rewards): generalized GitHub webhook + contributor role reward unit tests (#49)

## Summary
Resolves #49 by implementing a comprehensive unit test harness and calculation engine covering GitHub webhook label parsing, contributor role determination, priority multipliers, first-time onboarding bonuses, and bot protection safeguards.

### Changes
- Implemented `calculateReward()` and `parseWebhookLabels()` in `packages/webhook-rewards-testing/src/engine.ts`.
- Added unit tests covering multiple contributor scenarios in `packages/webhook-rewards-testing/tests/webhook_rewards.test.ts`.

Closes #49
