import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../routers";

type TaskRouterOutput = inferRouterOutputs<AppRouter>["task"];
type TaskRouterInput = inferRouterInputs<AppRouter>["task"];

/**
 * ROUTER INPUTS
 */
export type TaskListInput = TaskRouterInput["list"];
export type TaskGetInput = TaskRouterInput["get"];
export type TaskCreateInput = TaskRouterInput["create"];
export type TaskUpdateInput = TaskRouterInput["update"];
export type TaskBulkUpdateInput = TaskRouterInput["bulkUpdate"];
export type TaskBulkDeleteInput = TaskRouterInput["bulkDelete"];

/**
 * ROUTER OUTPUTS
 */
export type TaskListOutput = TaskRouterOutput["list"];
export type TaskGetOutput = TaskRouterOutput["get"];
export type TaskListItem = TaskListOutput[number];
