import { StaticDecode, Type as T } from "@sinclair/typebox";
import "dotenv/config";
import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";

export const envSchema = T.Object({
  LOG_LEVEL: T.Optional(T.Enum(LOG_LEVEL, { default: LOG_LEVEL.INFO })),
  KERNEL_PUBLIC_KEY: T.Optional(T.String()),
  ANTHROPIC_API_KEY: T.Optional(T.String()),
  OPENAI_API_KEY: T.Optional(T.String()),
  XAI_API_KEY: T.Optional(T.String()),
});

export type Env = StaticDecode<typeof envSchema>;
