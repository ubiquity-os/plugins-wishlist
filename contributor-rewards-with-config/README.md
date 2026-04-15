# Contributor Rewards With Config

UbiquityOS plugin for configurable contributor rewards based on webhook events and contributor class.

Part of the Contributor Role series:
- **v1 (#46)**: No Config - counts events per contributor
- **v2 (#48)**: Contributor Class - identifies user roles (specification author, assignee, collaborator, contributor)
- **v3 (#47)**: This plugin - adds configurable reward multipliers and event-specific rewards

## Features

- **Configurable rewards** per webhook event type
- **Contributor class detection**: ISSUER, ASSIGNEE, COLLABORATOR, CONTRIBUTOR
- **Target roles**: ISSUER, ASSIGNEE, COLLABORATOR, CONTRIBUTOR, REVIEWERS, COMMENTERS, COMMITTERS
- **Pull/Issue context separation**: Different reward values for pull vs issue context
- **Label overrides**: Additional reward modifiers based on issue/PR labels
- **Negative values**: Support for event negation (e.g., review_request_removed)

## Configuration

```yaml
pull_request:
  opened:
    pull:
      targets: [CONTRIBUTOR]
      value: 5
    issue:
      targets: [CONTRIBUTOR]
      value: 2
  closed:
    pull:
      targets: [ISSUER]
      value: 10
  review_requested:
    pull:
      targets: [REVIEWERS]
      value: 1

pull_request_review:
  submitted:
    pull:
      targets: [REVIEWERS]
      value: 3

issue_comment:
  created:
    issue:
      targets: [COMMENTERS]
      value: 1

labelOverrides:
  bug:
    value: 5
  "good-first-issue":
    value: 3
```

## Development

```bash
bun install
bun test
```

## License

MIT
