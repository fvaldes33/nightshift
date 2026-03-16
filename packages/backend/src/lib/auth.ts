import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@openralph/db/config/database";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
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
