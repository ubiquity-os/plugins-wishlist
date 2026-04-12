import { Context } from "./context";

export function isIssueOpenedEvent(context: Context): context is Context<"issues.opened"> {
  return context.eventName === "issues.opened";
}

export function isIssueEditedEvent(context: Context): context is Context<"issues.edited"> {
  return context.eventName === "issues.edited";
}
