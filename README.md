# Auto Time Label Estimator

A UbiquityOS plugin that automatically estimates development time and sets `Time: ` labels on GitHub issues using LLM analysis.

## Features

- **LLM-powered estimation**: Uses Claude, GPT-4, Grok, or Claude CLI to analyze issue specifications
- **Bias removal**: Strips existing Time: labels from issue content before estimation to provide fresh, independent estimates
- **Configurable offset**: Adjustable model bias correction divisor (default: /15)
- **Label matching**: Selects the best-fitting Time: label from the repository's existing labels
- **Multi-provider support**: Anthropic API, OpenAI API, xAI API, or Claude CLI

## How It Works

1. Listens for `issues.opened` and `issues.edited` events
2. Strips any existing `Time: <...>` references from the issue body to remove bias
3. Sends the cleaned issue content to the configured LLM with estimation instructions
4. Applies a configurable offset divisor to the raw estimate (accounts for model overestimation)
5. Matches the adjusted estimate to the best available `Time: ` label in the repository
6. Removes any existing `Time: ` labels and applies the new one

## Supported Time Labels

The plugin matches against the repository's existing `Time: ` labels. Standard labels include:

- `Time: <1 Hour`
- `Time: <2 Hours`
- `Time: <4 Hours`
- `Time: <1 Day`
- `Time: <1 Week`

## Configuration

### Plugin Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `model` | string | `claude-3-5-sonnet-20241022` | LLM model to use |
| `provider` | enum | `anthropic` | LLM provider: `anthropic`, `openai`, `xai`, or `claude-cli` |
| `offsetDivisor` | number | `15` | Divisor applied to raw estimate (e.g., 15h raw → 1h adjusted) |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | If provider=anthropic | Anthropic API key |
| `OPENAI_API_KEY` | If provider=openai | OpenAI API key |
| `XAI_API_KEY` | If provider=xai | xAI API key |
| `KERNEL_PUBLIC_KEY` | No | UbiquityOS kernel public key |

### UbiquityOS Plugin Configuration

```yaml
plugins:
  - name: auto-time-label
    uses:
      - plugin: auto-time-label
        with:
          model: claude-3-5-sonnet-20241022
          provider: anthropic
          offsetDivisor: 15
```

### Recommended Offsets

| Model | Recommended Offset |
|-------|--------------------|
| Claude 3.5 Sonnet | /15 |
| GPT-4 | /12 |
| Grok 2 | /10 |

## Development

```bash
# Install dependencies
yarn install

# Run locally
yarn worker

# Run tests
yarn test

# Build
yarn build
```

## License

MIT
