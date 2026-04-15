# command-deadline

> UbiquityOS plugin for deadline tracking and incentive-based rewards.

## Overview

The **command-deadline** plugin encourages accurate time estimates and rewards contributors who complete tasks ahead of schedule.

## Features

- **`/deadline [date]`** — Set a deadline on any GitHub issue
- **Speed Bonus** — Complete early and earn up to `deadlineRewardRatio` extra
- **Gradual Penalty** — Late completions receive reduced payout (or zero if disqualification is enabled)
- **Reminders** — Automatic comments at 24h and 1h before deadline
- **Label Tracking** — Issues are labeled with deadline status (`deadline: pending`, `deadline: 24h`, `deadline: 1h`, `deadline: expired`)

## Reward Formula

```
reward = baseTaskValue × max(0, 1 + (deadlineRewardRatio × (1 - actualTime/deadlineTime)) - penalty)
```

| Scenario | Result |
|---|---|
| Instant completion | `base + (base × ratio)` |
| On time | `base` (100%) |
| Late (disqualification off) | Gradual decline to 0 at 2× deadline |
| Late (disqualification on) | `$0` |

## Configuration

```yaml
commandDeadline:
  timezone: "UTC"
  deadlineRewardRatio: 0.25    # Max 25% bonus for early completion
  disqualificationEnabled: true # Zero reward if late
  projectView: null            # Optional GitHub Project View sync
```

## Example

| Task Value | `deadlineRewardRatio` | Completion | Reward |
|---|---|---|---|
| $1600 | 0.25 | Instant | $2000 |
| $1600 | 0.25 | Halfway | $1800 |
| $1600 | 0.25 | On time | $1600 |
| $1600 | 0.25 | Late (no DQ) | Declining |

## Development

```bash
npm install
npm run build
npm start
```

## License

MIT
