import { db } from "@openralph/db/config/database";
import * as schema from "@openralph/db/models/index";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:56677",
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:56677"],
});
