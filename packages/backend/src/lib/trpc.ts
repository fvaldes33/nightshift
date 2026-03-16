import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ActorContext } from "./context";
import { AppError } from "./errors";

export interface TRPCContext {
  request: Request;
  responseHeaders: Headers;
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        appError: error.cause instanceof AppError ? error.cause.toJSON() : null,
      },
    };
  },
});

const appErrorMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof AppError) {
      const codeMap: Record<string, TRPCError["code"]> = {
        BAD_REQUEST: "BAD_REQUEST",
        UNAUTHORIZED: "UNAUTHORIZED",
        FORBIDDEN: "FORBIDDEN",
        NOT_FOUND: "NOT_FOUND",
        CONFLICT: "CONFLICT",
        INTERNAL_ERROR: "INTERNAL_SERVER_ERROR",
      };
      throw new TRPCError({
        code: codeMap[error.code] ?? "INTERNAL_SERVER_ERROR",
        message: error.message,
        cause: error,
      });
    }
    throw error;
  }
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure.use(appErrorMiddleware);

export const protectedProcedure = publicProcedure.use(async ({ next }) => {
  const actor = ActorContext.use();
  if (actor.type !== "user") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { user: actor.properties.user } });
});
