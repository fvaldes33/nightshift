import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@openralph/db/config/database";
import * as schema from "@openralph/db/models/index";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  databaseHooks: {
    user: {
      create: {
        before: async (user, _ctx) => {
          if (!user.email.endsWith("@appvents.com")) {
            return false;
          }
          return { data: user };
        },
      },
    },
  },
});
