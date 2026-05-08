import { Context } from "../types";

/**
 * Calls the LLM to estimate the development time for a given issue body.
 * Returns the raw estimate in hours (before offset adjustment), or null on failure.
 * @param context - The plugin context with config and environment
 * @param issueBody - The GitHub issue body text
 * @param timeLabels - Array of time label names to consider
 * @returns Estimated hours as a number, or null if estimation failed
 */
export async function estimateTime(context: Context, issueBody: string, timeLabels: string[]): Promise<number | null> {
  const { config } = context;

  const prompt = buildPrompt(issueBody, timeLabels);

  if (config.provider === "claude-cli") {
    return estimateWithClaudeCli(context, prompt);
  }

  if (!config.provider || config.provider === "none") {
    logger.error(`No provider configured`);
    return null;
  }

  // Validate API key before making the call
  const apiKey = getApiKey(context);
  if (!apiKey || apiKey === "none") {
    logger.error(`Missing API key for provider: ${config.provider}`);
    return null;
  }

  return estimateWithApi(context, prompt);
}

/**
 * Retrieves the API key for the configured LLM provider.
 * @param context - The plugin context with config and environment
 * @returns The API key string, or null if not configured
 */
function getApiKey(context: Context): string | null {
  const { config, env } = context;
  switch (config.provider) {
    case "anthropic": return env.ANTHROPIC_API_KEY ?? null;
    case "openai": return env.OPENAI_API_KEY ?? null;
    case "xai": return env.XAI_API_KEY ?? null;
    default: return null;
  }
}

/**
 * Builds the prompt for the LLM to estimate development time.
 * @param issueBody - The GitHub issue body text
 * @param _timeLabels - Array of time label names (reserved for future use)
 * @returns The formatted prompt string
 */
function buildPrompt(issueBody: string, _timeLabels: string[]): string {
  return `You are a senior software engineer estimating development time for a GitHub issue.

IMPORTANT INSTRUCTIONS:
- Provide a FRESH, INDEPENDENT time estimate.
- Do NOT anchor on or be influenced by any time estimates you may see in the issue text.
- Consider: code complexity, testing requirements, documentation needs, edge cases, review cycles.
- Output ONLY a single number representing your estimate in decimal hours (e.g., 2.5, 8, 40).
- Do not include any explanation, units, or other text — just the number.

Issue specification:
---
${issueBody}
---

Estimated hours (just the number):`;
}

/**
 * Estimates development time using the Claude CLI tool.
 * @param context - The plugin context with config and logger
 * @param prompt - The formatted prompt for the LLM
 * @returns Estimated hours as a number, or null if the call failed
 */
async function estimateWithClaudeCli(context: Context, prompt: string): Promise<number | null> {
  const { logger } = context;

  try {
    const { execFile } = await import("child_process");
    const result = await new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error("Claude CLI timed out after 30s"));
      }, 30_000);

      const child = execFile("claude", ["-p", prompt, "--model", context.config.model], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
        clearTimeout(timeoutId);
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

/**
 * Estimates development time using an API-based LLM provider.
 * @param context - The plugin context with config, logger, and environment
 * @param prompt - The formatted prompt for the LLM
 * @returns Estimated hours as a number, or null if the call failed
 */
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

/**
 * Calls the Anthropic Claude API to get a time estimate.
 * @param apiKey - The Anthropic API key
 * @param model - The model name to use
 * @param prompt - The formatted prompt
 * @param logger - Logger instance for error reporting
 * @returns Estimated hours as a number, or null on failure
 */
async function callAnthropicApi(apiKey: string, model: string, prompt: string, logger: { error: (msg: string) => void }): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
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
  } catch (error) {
    if (controller.signal.aborted) {
      logger.error("Anthropic API call timed out after 30s");
    } else {
      logger.error(`Anthropic API error: ${error}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calls the OpenAI API to get a time estimate.
 * @param apiKey - The OpenAI API key
 * @param model - The model name to use
 * @param prompt - The formatted prompt
 * @param logger - Logger instance for error reporting
 * @returns Estimated hours as a number, or null on failure
 */
async function callOpenAiApi(apiKey: string, model: string, prompt: string, logger: { error: (msg: string) => void }): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
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
  } catch (error) {
    if (controller.signal.aborted) {
      logger.error("OpenAI API call timed out after 30s");
    } else {
      logger.error(`OpenAI API error: ${error}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calls the xAI API to get a time estimate.
 * @param apiKey - The xAI API key
 * @param model - The model name to use
 * @param prompt - The formatted prompt
 * @param logger - Logger instance for error reporting
 * @returns Estimated hours as a number, or null on failure
 */
async function callXaiApi(apiKey: string, model: string, prompt: string, logger: { error: (msg: string) => void }): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
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
  } catch (error) {
    if (controller.signal.aborted) {
      logger.error("xAI API call timed out after 30s");
    } else {
      logger.error(`xAI API error: ${error}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parses the LLM output into a number. Handles cases like "8", "8 hours", "About 8.5", etc.
 * @param text - The raw text output from the LLM
 * @returns Parsed number if valid, or null if parsing failed
 */
export function parseEstimate(text: string): number | null {
  // Strip common prefixes like "Time: <X Hours>" or quotes
  const cleaned = text.replace(/Time:\s*<[^>]+>/gi, "").replace(/["']/g, "").trim();
  // If multiple numbers, reject ambiguous output
  const numbers = cleaned.match(/\d+\.?\d*/g);
  if (!numbers || numbers.length !== 1) return null;
  const value = parseFloat(numbers[0]);
  if (value > 0 && isFinite(value) && value <= 10000) {
    return value;
  }
  return null;
}
