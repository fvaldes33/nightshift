import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@openralph/backend/routers/index";

export const trpc = createTRPCReact<AppRouter>();
