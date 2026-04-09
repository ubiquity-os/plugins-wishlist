# command-plan

A UbiquityOS plugin that implements the `/plan` command to break down a spec issue into child GitHub Issues with proper labels and parent-child relationships.

## Bounty

[#78 - command-plan](https://github.com/ubiquity-os/plugins-wishlist/issues/78) — $600

## What It Does

When a user comments `/plan` on an issue, this plugin:

1. **Reads the parent issue body** as the specification
2. **Parses the spec** into discrete tasks using section headers and content structure
3. **Creates child issues** for each task with:
   - Descriptive title (no prefixes)
   - One **time label** (e.g., `Time: <2 Hours`)
   - One **priority label** (e.g., `Priority: 2 (Medium)`)
   - Structured body: description, acceptance criteria, files section
4. **Links parent-child** via GitHub's `sub_issues` REST API
5. **Posts a summary comment** on the parent issue

### Hard Rules

- ✅ Descriptive titles only — no prefixes
- ✅ One time label per issue
- ✅ One priority label per issue
- ❌ No sprint labels
- ❌ No pricing labels

## Usage

Comment `/plan` on any issue that contains a spec in its body:

```
/plan
```

The plugin will automatically break the spec into child issues and link them.

## Configuration

```json
{
  "aiModel": "gpt-4o",
  "maxTasks": 10
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `aiModel` | string | `"gpt-4o"` | LLM model for spec breakdown |
| `maxTasks` | number | `10` | Maximum child issues to create |

## File Structure

```
src/
├── index.ts      # Main plugin handler
├── parser.ts     # Spec parsing and task extraction
├── github.ts     # GitHub API helpers
└── types.ts      # Shared TypeScript types
```

## Development

```bash
npm install
npm run build
npm run dev
```

## License

MIT
