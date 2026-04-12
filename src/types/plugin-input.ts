import { StaticDecode, Type as T } from "@sinclair/typebox";

export const pluginSettingsSchema = T.Object(
  {
    /**
     * The LLM model to use for time estimation.
     */
    model: T.String({ default: "claude-3-5-sonnet-20241022" }),
    /**
     * The LLM provider to use: "anthropic", "openai", "xai", or "claude-cli".
     */
    provider: T.Union([T.Literal("anthropic"), T.Literal("openai"), T.Literal("xai"), T.Literal("claude-cli")], { default: "anthropic" }),
    /**
     * Offset divisor to apply to the raw estimate (accounts for model overestimation).
     * e.g. 15 means raw estimate is divided by 15.
     */
    offsetDivisor: T.Number({ default: 15, minimum: 1 }),
  },
  { default: {} }
);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
