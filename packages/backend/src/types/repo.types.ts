import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../routers";

type RepoRouterOutput = inferRouterOutputs<AppRouter>["repo"];
type RepoRouterInput = inferRouterInputs<AppRouter>["repo"];

/**
 * ROUTER INPUTS
 */
export type RepoListInput = RepoRouterInput["list"];
export type RepoGetInput = RepoRouterInput["get"];
export type RepoCreateInput = RepoRouterInput["create"];
export type RepoUpdateInput = RepoRouterInput["update"];
export type RepoListGitHubInput = RepoRouterInput["listGitHub"];

/**
 * ROUTER OUTPUTS
 */
export type RepoListOutput = RepoRouterOutput["list"];
export type RepoGetOutput = RepoRouterOutput["get"];
export type RepoListGitHubOutput = RepoRouterOutput["listGitHub"];
export type RepoListItem = RepoListOutput[number];
