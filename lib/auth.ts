import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { appOrigin } from "./origin";
import { getDb } from "../db";
import * as schema from "../db/schema";

export function getAuth(request: Request) {
  const runtime = process.env;
  const origin = appOrigin(request);
  const local = process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const secret = runtime.BETTER_AUTH_SECRET || (local ? "local-development-only-secret-not-for-production-2026" : "");
  if (secret.length < 32 || secret.startsWith("replace-with-")) throw new Error("Authentication is not configured");
  return betterAuth({
    appName: "嘴巴等等我",
    secret,
    baseURL: origin,
    trustedOrigins: [origin],
    database: drizzleAdapter(getDb(), { provider: "pg", schema, transaction: true }),
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: !local, storage: "database", window: 60, max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 8 }, "/sign-up/email": { window: 3600, max: 10 } },
    },
    advanced: { cookiePrefix: "zuiba", useSecureCookies: origin.startsWith("https:"), ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } },
    databaseHooks: { user: { create: { before: async (u) => ({ data: { ...u, name: u.name.trim().slice(0, 24) || "新饭友" } }) } } },
  });
}
