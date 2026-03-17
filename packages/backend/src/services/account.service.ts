import { db } from "@openralph/db/config/database";
import { and, eq } from "@openralph/db/drizzle";
import { account } from "@openralph/db/models/auth.model";
import { z } from "zod";
import { ActorContext } from "../lib/context";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const getGitHubToken = fn(z.object({}), async () => {
  const actor = ActorContext.use();
  if (actor.type !== "user") throw new AppError("Unauthorized", "UNAUTHORIZED");

  const ghAccount = await db.query.account.findFirst({
    where: and(eq(account.userId, actor.properties.user.id), eq(account.providerId, "github")),
  });
  if (!ghAccount?.accessToken) {
    throw new AppError("No GitHub account linked", "BAD_REQUEST");
  }

  return ghAccount.accessToken;
});
