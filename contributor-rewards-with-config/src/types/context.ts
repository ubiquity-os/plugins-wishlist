import { Context as PluginContext } from "@ubiquity-os/plugin-sdk";
import { Env } from "./env";
import { PluginSettings } from "./plugin-input";

/**
 * Supported webhook events for contributor rewards
 */
export type SupportedEvents =
  | "issues.assigned"
  | "issues.closed"
  | "issues.deleted"
  | "issues.demilestoned"
  | "issues.edited"
  | "issues.labeled"
  | "issues.locked"
  | "issues.milestoned"
  | "issues.opened"
  | "issues.pinned"
  | "issues.reopened"
  | "issues.unassigned"
  | "issues.unlabeled"
  | "issues.unlocked"
  | "issues.unpinned"
  | "issue_comment.created"
  | "issue_comment.edited"
  | "issue_comment.deleted"
  | "pull_request.assigned"
  | "pull_request.auto_merge_disabled"
  | "pull_request.auto_merge_enabled"
  | "pull_request.closed"
  | "pull_request.converted_to_draft"
  | "pull_request.demilestoned"
  | "pull_request.dequeued"
  | "pull_request.edited"
  | "pull_request.enqueued"
  | "pull_request.labeled"
  | "pull_request.locked"
  | "pull_request.milestoned"
  | "pull_request.opened"
  | "pull_request.ready_for_review"
  | "pull_request.reopened"
  | "pull_request.review_request_removed"
  | "pull_request.review_requested"
  | "pull_request.synchronize"
  | "pull_request.unassigned"
  | "pull_request.unlabeled"
  | "pull_request.unlocked"
  | "pull_request_review.dismissed"
  | "pull_request_review.edited"
  | "pull_request_review.submitted"
  | "pull_request_review_comment.created"
  | "pull_request_review_comment.edited"
  | "pull_request_review_comment.deleted";

export type Context<T extends SupportedEvents = SupportedEvents> = PluginContext<PluginSettings, Env, null, T>;
