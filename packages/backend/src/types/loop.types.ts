import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../routers";

type LoopRouterOutput = inferRouterOutputs<AppRouter>["loop"];
type LoopRouterInput = inferRouterInputs<AppRouter>["loop"];

/**
 * ROUTER INPUTS
 */
export type LoopListInput = LoopRouterInput["list"];
export type LoopGetInput = LoopRouterInput["get"];
export type LoopCreateInput = LoopRouterInput["create"];
export type LoopUpdateInput = LoopRouterInput["update"];

/**
 * ROUTER OUTPUTS
 */
export type LoopListOutput = LoopRouterOutput["list"];
export type LoopGetOutput = LoopRouterOutput["get"];
export type LoopListItem = LoopListOutput[number];
