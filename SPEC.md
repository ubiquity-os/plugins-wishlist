# Generalized "GitHub Webhook + Contributor Role -> Rewards" Contributor Class v2

## Ubiquity OS Plugin Specification

**Plugin Name:** `@ubiquity-os/contributor-classification`
**Version:** 2.0.0
**Category:** Rewards / Analytics
**Complexity:** Medium
**Estimated Time:** <1 Day
**Price:** $300 USD

## 1. Overview

### 1.1 Summary
This plugin extends the webhook-based reward system by classifying contributors into distinct roles based on their activity and relationship to the task. Building on [v1](https://github.com/ubiquity-os/plugins-wishlist/issues/46), this version introduces contributor classification to enable more nuanced reward distribution.

### 1.2 Problem Statement
Current reward systems treat all contributors equally without distinguishing between:
- The person who defined the task
- The person responsible for delivering the solution
- Official team members
- General community contributors

This lack of classification limits the ability to implement differentiated reward structures.

### 1.3 Solution
Identify and classify each contributor into one of four mutually exclusive categories, then aggregate their webhook events accordingly.

## 2. Contributor Classifications

### 2.1 Classification Types

| Class | Identifier | Description | Priority |
|-------|------------|-------------|----------|
| Specification Author | `specification_author` | The original author of the task/issue | 1 (Highest) |
| Assignee | `assignee` | The person responsible for the deliverable | 2 |
| Collaborator | `collaborator` | Added to the org/repo as an official team member | 3 |
| Contributor | `contributor` | Default category for all other participants | 4 (Lowest) |

### 2.2 Classification Rules

```
For each user in the issue/PR context:
  1. If user is the issue author 鈫?classify as `specification_author`
  2. Else if user is in the issue assignees 鈫?classify as `assignee`
  3. Else if user is a repo/org collaborator 鈫?classify as `collaborator`
  4. Otherwise 鈫?classify as `contributor`
```

### 2.3 Priority and Uniqueness
- A user can only belong to ONE classification at a time
- Classifications are mutually exclusive and follow priority order
- The first matching condition determines the classification

## 3. Functionality Specification

### 3.1 Core Features

#### 3.1.1 Timeline Event Collection
- Retrieve all webhook events from the issue timeline
- Retrieve all events from linked pull requests
- Aggregate events by user

#### 3.1.2 Contributor Classification
- Identify the specification author from issue metadata
- Identify assignees from issue assignment data
- Check collaborator status via repository/org membership APIs
- Default all other participants to contributor status

#### 3.1.3 Event Counting
- Count matching webhook events per contributor
- Assign a value of `1` to each event occurrence
- Return sum totals per contributor

#### 3.1.4 Output Generation
```typescript
interface ContributorReward {
  user: string;
  classification: ContributorClass;
  events: Record<string, number>;
  totalScore: number;
}

type ContributorClass = 
  | 'specification_author' 
  | 'assignee' 
  | 'collaborator' 
  | 'contributor';

interface RewardsOutput {
  issueId: number;
  contributors: ContributorReward[];
  metadata: {
    issueAuthor: string;
    assigneeCount: number;
    collaboratorCount: number;
    contributorCount: number;
  };
}
```

### 3.2 Webhook Event Types
Support counting for all standard GitHub webhook events including:
- `issue_comment`
- `pull_request`
- `pull_request_review`
- `pull_request_review_comment`
- `commit_comment`
- `create` (branch/tag)
- `delete` (branch/tag)
- `push`
- `release`
- `member`
- `label`

Reference: [GitHub Webhook Events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)

### 3.3 Configuration
- **No required configuration** - Uses sensible defaults
- **Optional filters** - Can filter which event types to count
- **Optional weights** - Can assign different weights to event types

```yaml
# Plugin Configuration (optional)
eventFilters:
  include:
    - issue_comment
    - pull_request
    - pull_request_review
  exclude:
    - push  # Don't count pushes for rewards

weights:
  issue_comment: 1
  pull_request: 2
  pull_request_review: 1.5
  # Default weight is 1 if not specified
```

### 3.4 Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User is both author and assignee | Classify as `specification_author` (higher priority) |
| User is collaborator AND regular contributor | Classify as `collaborator` |
| Issue has no assignees | Only `specification_author` and `contributor` apply |
| PR is not linked to issue | Process issue events only |
| User is not in any classification | Default to `contributor` |
| No events found for user | Return 0 totalScore |

## 4. Technical Implementation

### 4.1 Dependencies
- `@ubiquity-os/plugin-sdk` - Core plugin framework
- `@octokit/webhooks` - Webhook event types
- GitHub API client (octokit/rest.js)

### 4.2 File Structure
```
src/
鈹溾攢鈹€ index.ts           # Plugin entry point
鈹溾攢鈹€ handlers/
鈹?  鈹斺攢鈹€ classify.ts    # Main classification logic
鈹溾攢鈹€ types/
鈹?  鈹斺攢鈹€ contributor.ts # TypeScript types
鈹斺攢鈹€ utils/
    鈹溾攢鈹€ github.ts      # GitHub API helpers
    鈹斺攢鈹€ classifier.ts  # Classification logic
```

### 4.3 API Endpoints Used
- `GET /repos/{owner}/{repo}/issues/{issue_number}` - Issue details
- `GET /repos/{owner}/{repo}/issues/{issue_number}/assignees` - Assignees
- `GET /repos/{owner}/{repo}/issues/{issue_number}/timeline` - Timeline events
- `GET /repos/{owner}/{repo}/collaborators/{username}` - Collaborator check
- `GET /orgs/{org}/public_members/{username}` - Org membership (public)

## 5. Testing Requirements

### 5.1 Unit Tests
- Classification logic for each contributor type
- Event counting and aggregation
- Edge cases handling

### 5.2 Integration Tests
- Mock GitHub API responses
- Test with various issue/PR configurations

### 5.3 Test Scenarios
1. User is only specification_author
2. User is only assignee
3. User is only collaborator
4. User is only contributor
5. User matches multiple categories (use priority)
6. No users in any category (all contributors)
7. Empty timeline
8. Issue with multiple assignees and contributors

## 6. Acceptance Criteria

- [ ] Plugin correctly identifies specification_author from issue author
- [ ] Plugin correctly identifies assignees from issue assignment
- [ ] Plugin correctly identifies collaborators from repo/org membership
- [ ] Plugin defaults unknown users to contributor
- [ ] Plugin respects classification priority (specification_author > assignee > collaborator > contributor)
- [ ] Plugin counts webhook events correctly per user
- [ ] Plugin returns structured output with all required fields
- [ ] Plugin handles edge cases gracefully
- [ ] Plugin passes all unit and integration tests
- [ ] Plugin follows Ubiquity OS plugin template structure

## 7. Related Issues

- [v1: No Config Version](https://github.com/ubiquity-os/plugins-wishlist/issues/46) - Foundation for this plugin
- [Final Iteration: Enable Configuration](https://github.com/ubiquity-os/plugins-wishlist/issues/47) - Future enhancement

## 8. References

- [Ubiquity OS Plugin Template](https://github.com/ubiquity-os/plugin-template)
- [GitHub Webhook Events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [Octokit Webhooks.js](https://github.com/octokit/webhooks.js)
