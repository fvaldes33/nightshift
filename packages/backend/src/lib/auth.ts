import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@openralph/db/config/database";
import * as schema from "@openralph/db/models/index";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      scope: ["repo", "read:org"],
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:56677"],
  databaseHooks: {
    user: {
      create: {
        before: async (user, _ctx) => {
          const allowed = ["@appvents.com", "franco.valdes89@gmail.com"];
          if (!allowed.some((a) => a.includes("@") ? user.email === a : user.email.endsWith(a))) {
            return false;
          }
          return { data: user };
        },
      },
    },
  },
});
