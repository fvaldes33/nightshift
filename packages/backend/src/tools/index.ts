import type { InferUITools, UIDataTypes, UIMessage } from "ai";

import {
  clone_repo,
  create_worktree,
  delete_worktree,
  push_branch,
  create_pull_request,
  list_pull_requests,
  add_pr_reviewers,
  add_pr_labels,
} from "./github.tools";
import { list_tasks, get_task, create_task, update_task, add_task_comment } from "./task.tools";
import { confirm_loop_details } from "./ralph.tools";

export const githubTools = {
  clone_repo,
  create_worktree,
  delete_worktree,
  push_branch,
  create_pull_request,
  list_pull_requests,
  add_pr_reviewers,
  add_pr_labels,
};
export const taskTools = { list_tasks, get_task, create_task, update_task, add_task_comment };
export const ralphTools = { confirm_loop_details };

export const allTools = {
  ...githubTools,
  ...taskTools,
  ...ralphTools,
};

export type AllTools = typeof allTools;
export type SessionUITools = InferUITools<AllTools>;

export type NightshiftDataTypes = UIDataTypes & {
  plan: {
    filePath: string;
    title: string;
    content: string;
  };
};

export type NightshiftMessage = UIMessage<unknown, NightshiftDataTypes, SessionUITools>;

export {
  clone_repo,
  create_worktree,
  delete_worktree,
  push_branch,
  create_pull_request,
  list_pull_requests,
  add_pr_reviewers,
  add_pr_labels,
  list_tasks,
  get_task,
  create_task,
  update_task,
  add_task_comment,
  confirm_loop_details,
};
