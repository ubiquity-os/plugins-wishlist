# Webhook Rewards — No Config v1

> Zero configuration. Install and it works.

## What It Does

This UbiquityOS plugin automatically rewards contributors when GitHub webhook events fire:

- **PR merged** → contributors on the linked issue get rewards
- **Issue closed** → contributors with qualifying roles get rewards
- **Amount** → derived from `Time` and `Priority` labels on the issue

### How It Works

1. Receives a webhook event (`issues.closed`, `pull_request.merged`)
2. Fetches the full issue/PR timeline from GitHub
3. Counts qualifying events per contributor (comments, commits, reviews, etc.)
4. Computes reward amounts using label-based pricing
5. Posts a reward permit comment on the issue

## Zero Config Setup

No configuration file needed. Just:

1. **Install the plugin** in your UbiquityOS instance
2. **Add webhook** — point your GitHub repo webhooks at the plugin endpoint
3. **Done** — rewards start flowing on the next PR merge or issue close

### Default Pricing

| Label | Value |
|-------|-------|
| Priority: Urgent | 500 |
| Priority: High | 300 |
| Priority: Medium | 200 |
| Priority: Low | 100 |
| Time: <1 Hour | 1x |
| Time: <1 Day | 2x |
| Time: <1 Week | 4x |
| Time: <1 Month | 8x |

**Formula:** `totalReward = baseAmount × eventCount × timeMultiplier`

### Counted Timeline Events

Each occurrence adds 1 to the contributor's event count:

- `committed`
- `commented`
- `labeled`
- `closed`
- `merged`
- `cross-referenced`
- `reviewed`
- `approved`

## Roadmap

| Version | Feature |
|---------|---------|
| **v1** (this) | Zero config, timeline counting, label-based pricing |
| **v2** | User class identification (spec author, assignee, collaborator, contributor) |
| **v3** | Full configuration support (custom events, amounts, roles) |

## Bounty

[ubiquity-os/plugins-wishlist#46](https://github.com/ubiquity-os/plugins-wishlist/issues/46) — Generalized "GitHub Webhook + Contributor Role -> Rewards" No Config v1 ($300)

## License

MIT
