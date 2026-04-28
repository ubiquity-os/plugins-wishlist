# command-plan Plugin

Breaks issue specs into child GitHub Issues via `/plan` command.

## Bounty

- **Bounty #**: 78
- **Reward**: $600

## What it does

- `/plan` command breaks a spec into child GitHub Issues
- Auto-assigns time and priority labels
- Links parent-child via sub_issues REST API
- Follows all hard rules (no sprint labels, no pricing, no title prefixes)

## Usage

Comment `/plan` on any issue with a spec in the body.

### Example

```markdown
## Authentication Module
Implement OAuth2 login with GitHub and Google.

## Database Layer
Set up PostgreSQL with Prisma ORM.

## API Endpoints
Create RESTful endpoints for users and posts.
```

After commenting `/plan`, the plugin will:
1. Parse the spec into 3 subtasks
2. Create 3 child issues with appropriate labels
3. Link them to the parent issue
4. Post a summary comment

## Files

- `src/index.ts` — Main plugin handler
- `src/parser.ts` — Spec parsing and task extraction
- `src/github.ts` — GitHub API helpers
- `src/types.ts` — Shared TypeScript types
- `manifest.json` — Plugin manifest
- `package.json` — Package config
- `tsconfig.json` — TypeScript config

## Configuration

```typescript
const config = {
  defaultPriority: "medium",
  autoAssign: true,
  labels: {
    priority: {
      high: "priority: high",
      medium: "priority: medium",
      low: "priority: low",
    },
    time: {
      "1h": "time: 1h",
      "1d": "time: 1d",
      "1w": "time: 1w",
    },
  },
};
```

## Hard Rules Followed

- ✅ No sprint labels
- ✅ No pricing information
- ✅ No title prefixes
- ✅ Clean, minimal output
