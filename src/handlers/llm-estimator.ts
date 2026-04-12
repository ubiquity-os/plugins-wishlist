import { Context } from "../types";

/**
 * Calls the LLM to estimate the development time for a given issue body.
 * Returns the raw estimate in hours (before offset adjustment), or null on failure.
 */
export async function estimateTime(context: Context, issueBody: string, timeLabels: string[]): Promise<number | null> {
  const { config } = context;

  const prompt = buildPrompt(issueBody, timeLabels);

  if (config.provider === "claude-cli") {
    return estimateWithClaudeCli(context, prompt);
  }

  return estimateWithApi(context, prompt);
}

function buildPrompt(issueBody: string, timeLabels: string[]): string {
  return `You are a senior software engineer estimating development time for a GitHub issue.

IMPORTANT INSTRUCTIONS:
- Provide a FRESH, INDEPENDENT time estimate.
- Do NOT anchor on or be influenced by any time estimates you may see in the issue text.
- Consider: code complexity, testing requirements, documentation needs, edge cases, review cycles.
- Output ONLY a single number representing your estimate in decimal hours (e.g., 2.5, 8, 40).
- Do not include any explanation, units, or other text — just the number.

Available Time labels in this repository: ${timeLabels.join(", ")}

Issue specification:
---
${issueBody}
---

Estimated hours (just the number):`;
}

async function estimateWithClaudeCli(context: Context, prompt: string): Promise<number | null> {
  const { logger } = context;

  try {
    const { execFile } = await import("child_process");
    const result = await new Promise<string>((resolve, reject) => {
      execFile("claude", ["-p", prompt, "--model", context.config.model], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout ?? "0");
      });
    });

    if (!result) {
      logger.error("Claude CLI returned empty result");
      return null;
    }

    return parseEstimate(result);
  } catch (error) {
    logger.error(`Claude CLI error: ${error}`);
    return null;
  }
}

async function estimateWithApi(context: Context, prompt: string): Promise<number | null> {
  const { config, logger, env } = context;

  try {
    if (config.provider === "anthropic") {
      return await callAnthropicApi(env.ANTHROPIC_API_KEY ?? "none", config.model, prompt, logger);
    } else if (config.provider === "openai") {
      return await callOpenAiApi(env.OPENAI_API_KEY ?? "none", config.model, prompt, logger);
    } else if (config.provider === "xai") {
      return await callXaiApi(env.XAI_API_KEY ?? "none", config.model, prompt, logger);
    }

    logger.error(`Unknown provider: ${config.provider}`);
    return null;
  } catch (error) {
    logger.error(`API call error: ${error}`);
    return null;
  }
}

async function callAnthropicApi(apiKey: string, model: string, prompt: string, logger: { error: (msg: string) => void }): Promise<number | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 64,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error(`Anthropic API error: ${response.status} ${err}`);
    return null;
  }

  const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
  const text = data.content?.[0]?.text;
  if (!text) return null;
  return parseEstimate(text);
}

async function callOpenAiApi(apiKey: string, model: string, prompt: string, logger: { error: (msg: string) => void }): Promise<number | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 64,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error(`OpenAI API error: ${response.status} ${err}`);
    return null;
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;
  return parseEstimate(text);
}

async function callXaiApi(apiKey: string, model: string, prompt: string, logger: { error: (msg: string) => void }): Promise<number | null> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 64,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error(`xAI API error: ${response.status} ${err}`);
    return null;
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;
  return parseEstimate(text);
}

/**
 * Parses the LLM output into a number. Handles cases like "8", "8 hours", "About 8.5", etc.
 */
export function parseEstimate(text: string): number | null {
  // eslint-disable-next-line sonarjs/null-dereference
  const match = text.match(/(\d+\.?\d*)/);
  const captured = match?.[1];
  if (!captured) return null;
  const value = parseFloat(captured);
  if (value > 0 && isFinite(value)) {
    return value;
  }
  return null;
}
