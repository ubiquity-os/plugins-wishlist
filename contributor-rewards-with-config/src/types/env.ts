import { z } from "zod";

export type Env = Record<string, string | undefined>;

export const envSchema = z.record(z.string(), z.string().optional());
