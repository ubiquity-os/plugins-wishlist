import { Context as PluginContext } from "@ubiquity-os/plugin-sdk";
import { Env } from "./env";
import { PluginSettings } from "./plugin-input";

export type SupportedEvents = "issues.opened" | "issues.edited";

export type Context<T extends SupportedEvents = SupportedEvents> = PluginContext<PluginSettings, Env, null, T>;
