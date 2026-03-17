import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../routers";

type MessageRouterOutput = inferRouterOutputs<AppRouter>["message"];
type MessageRouterInput = inferRouterInputs<AppRouter>["message"];

/**
 * ROUTER INPUTS
 */
export type MessageListInput = MessageRouterInput["list"];
export type MessageCreateInput = MessageRouterInput["create"];

/**
 * ROUTER OUTPUTS
 */
export type MessageListOutput = MessageRouterOutput["list"];
export type MessageListItem = MessageListOutput[number];
