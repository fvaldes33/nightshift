import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../routers";

type DocRouterOutput = inferRouterOutputs<AppRouter>["doc"];
type DocRouterInput = inferRouterInputs<AppRouter>["doc"];

/**
 * ROUTER INPUTS
 */
export type DocListInput = DocRouterInput["list"];
export type DocGetInput = DocRouterInput["get"];
export type DocCreateInput = DocRouterInput["create"];
export type DocUpdateInput = DocRouterInput["update"];

/**
 * ROUTER OUTPUTS
 */
export type DocListOutput = DocRouterOutput["list"];
export type DocGetOutput = DocRouterOutput["get"];
export type DocListItem = DocListOutput[number];
