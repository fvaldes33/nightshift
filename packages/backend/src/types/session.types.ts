import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../routers";

type SessionRouterOutput = inferRouterOutputs<AppRouter>["session"];
type SessionRouterInput = inferRouterInputs<AppRouter>["session"];

/**
 * ROUTER INPUTS
 */
export type SessionListInput = SessionRouterInput["list"];
export type SessionGetInput = SessionRouterInput["get"];
export type SessionCreateInput = SessionRouterInput["create"];
export type SessionUpdateInput = SessionRouterInput["update"];

/**
 * ROUTER OUTPUTS
 */
export type SessionListOutput = SessionRouterOutput["list"];
export type SessionGetOutput = SessionRouterOutput["get"];
export type SessionListItem = SessionListOutput[number];
