# Old Proposal Handler

**Issue:** [#70](https://github.com/ubiquity-os/plugins-wishlist/issues/70)
**Reward:** $75
**Status:** Implementation

## Problem

Maintainers rarely go through old proposals on devpool.directory, and the team doesn't proactively handle them. This results in a growing backlog of stale proposals that clutter the system without any clear resolution path.

## Proposed Solution

A UbiquityOS plugin (`daemon-old-proposal-handler`) that automates the lifecycle management of old proposals through a three-stage process:

### 1. Scan
- Periodically scans configured repositories for open issues matching proposal criteria
- Configurable `staleThreshold` (default: 30 days) determines when a proposal is considered stale
- Optional `proposalLabels` filter to only target specific issue types

### 2. Remind
- Posts a human-readable comment on stale proposals asking whether they're still relevant
- Adds a configurable warning label (`stale-proposal` by default)
- Tracks reminder state in Deno KV for CRON persistence

### 3. Close
- After a configurable `warningPeriod` (default: 7 days), if no human activity is detected on the proposal, it is automatically closed with `not_planned` state reason
- Detects human comments (ignoring bot comments) as activity that resets the timer
- `closeOnExpiry` can be disabled to only label without closing

### Flow

```
Open Issue → Age ≥ staleThreshold?
  No → Skip
  Yes → Already reminded?
    No → Post reminder, add label, track in KV
    Yes → Time since reminder ≥ warningPeriod?
      No → Skip (waiting)
      Yes → Human activity since reminder?
        Yes → Skip (active discussion)
        No → Close proposal, remove from KV
```

## Implementation

**Repository:** [zhaog100/ubiquity-os-old-proposal-handler](https://github.com/zhaog100/ubiquity-os-old-proposal-handler)

### Architecture
- **TypeScript + Deno** following the UbiquityOS plugin template
- **Dual mode:** Event-driven (webhook) + CRON-based (daily scan)
- **State:** Deno KV for tracking proposals across runs
- **Structured metadata** in comments for reliable bot comment detection

### Events
- `issues.opened` / `issues.edited` — Check if issue is a stale proposal
- `issue_comment.created` — Re-evaluate on new activity
- `schedule.cron` — Daily scan at 01:00 UTC

### Configuration
```yaml
plugins:
  - uses:
    - plugin: old-proposal-handler
      with:
        staleThreshold: "30 days"
        warningPeriod: "7 days"
        proposalLabels: []
        targetRepos: ["ubiquity-os/plugins-wishlist"]
        warningLabel: "stale-proposal"
        closeOnExpiry: true
        ignoreBotComments: true
```

### Key Files
- `src/handlers/proposal-handler.ts` — Core proposal evaluation and action logic
- `src/handlers/scan-proposals.ts` — Repository scanning orchestrator
- `src/cron/runner.ts` — CRON job execution with per-repo config resolution
- `src/adapters/kv-database-handler.ts` — Deno KV state management
- `src/helpers/structured-metadata.ts` — Comment metadata for bot tracking
