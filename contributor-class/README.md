# Contributor Class Plugin

Identifies the "class" of each contributor based on their relationship to an issue or pull request.

## Contributor Classes

| Class | Description | Default Multiplier |
|-------|------------|-------------------|
| `specification_author` | Original author of the issue/task | 1.0x |
| `assignee` | Responsible for the deliverable | 1.0x |
| `collaborator` | Org/repo team member | 0.75x |
| `contributor` | External contributor (default) | 0.5x |

## Usage

The plugin processes webhook events and classifies all participants in an issue/PR context. Classification is based on:

1. Did they author the original issue? → `specification_author`
2. Are they assigned to the issue? → `assignee`
3. Are they an org member or repo collaborator? → `collaborator`
4. Otherwise → `contributor`

Multipliers are configurable per repository.
